import { OPPORTUNITY_STALE_AFTER_DAYS } from "../../../supabase/functions/_shared/opportunity.ts";
import { normalizeStateCode } from "../../lib/location";
import type { PersistedLead } from "../leads/remote-leads";
import { loadOpportunityBusinessSearches } from "../open-now-niches/local-cache";
import {
  hasBusinessPhone,
  hasIdentifiedWebsite,
  hasStableActivitySignal,
  mergeOpportunityBusinesses,
  opportunityGroupKey,
  safeBusinessResult,
  type OpportunityObservation,
} from "./opportunity-businesses";
import {
  fetchPlacesSearchSamples,
  opportunityAuthedRequest,
} from "./places-search-cache";
import { calculateOpportunityScore } from "./opportunity-score";
import type {
  OpportunityRecord,
  OpportunitySample,
  OpportunityStats,
  OpportunitySummary,
} from "./types";

type RemoteOpenNowCache = {
  city: string;
  state: string;
  segment: string;
  checked_at: string | null;
  results: unknown;
};

async function fetchOpenNowSamples(): Promise<OpportunitySample[]> {
  const params = new URLSearchParams();
  params.set("select", "city,state,segment,checked_at,results");
  params.set("checked_at", "not.is.null");
  params.set("order", "checked_at.desc");

  const response = await opportunityAuthedRequest(
    `open_now_niche_cache?${params.toString()}`,
  );
  if (!response.ok) {
    throw new Error(`OPEN_NOW_OPPORTUNITY_CACHE_${response.status}`);
  }

  const rows = (await response.json()) as RemoteOpenNowCache[];
  return rows
    .filter((row): row is RemoteOpenNowCache & { checked_at: string } =>
      Boolean(row.checked_at),
    )
    .map((row): OpportunitySample => ({
      city: row.city,
      state: row.state,
      segment: row.segment,
      checkedAt: row.checked_at,
      results: (Array.isArray(row.results) ? row.results : [])
        .map(safeBusinessResult)
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      source: "open-now",
    }));
}

function localSamples(): OpportunitySample[] {
  return loadOpportunityBusinessSearches().map((row) => ({
    city: row.city,
    state: row.state,
    segment: row.segment,
    checkedAt: row.checkedAt,
    results: row.results,
    source: "local-search",
  }));
}

function latestIso(values: string[]) {
  return values.reduce(
    (latest, value) => (!latest || value > latest ? value : latest),
    "",
  );
}

function buildStats(
  businesses: OpportunityRecord["businesses"],
  lastObservedAt: string,
): OpportunityStats {
  const sampleSize = businesses.length;
  const withoutSite = businesses.filter((business) =>
    !hasIdentifiedWebsite(business)
  );
  const withSiteCount = sampleSize - withoutSite.length;
  const withPhone = businesses.filter(hasBusinessPhone);
  const rated = businesses.filter(
    (business) =>
      (typeof business.rating === "number" && business.rating > 0) ||
      (business.reviewCount ?? 0) > 0,
  );
  const reviewCountTotal = businesses.reduce(
    (total, business) => total + Math.max(0, business.reviewCount ?? 0),
    0,
  );
  const active = businesses.filter(hasStableActivitySignal);
  const withoutSiteWithPhone = withoutSite.filter(hasBusinessPhone);
  const withoutSiteWithPhoneRated = withoutSiteWithPhone.filter(
    (business) =>
      (typeof business.rating === "number" && business.rating > 0) ||
      (business.reviewCount ?? 0) > 0,
  );
  const activeWithoutSite = withoutSite.filter(hasStableActivitySignal);

  return {
    sampleSize,
    withSiteCount,
    withoutSiteCount: withoutSite.length,
    withoutSiteRate:
      sampleSize > 0 ? withoutSite.length / sampleSize : 0,
    withPhoneCount: withPhone.length,
    phoneRate: sampleSize > 0 ? withPhone.length / sampleSize : 0,
    ratedCount: rated.length,
    averageRating:
      rated.length > 0
        ? rated.reduce(
            (total, business) => total + (business.rating ?? 0),
            0,
          ) / rated.length
        : null,
    reviewCountTotal,
    averageReviewCount:
      sampleSize > 0 ? reviewCountTotal / sampleSize : 0,
    activeCount: active.length,
    withoutSiteWithPhoneCount: withoutSiteWithPhone.length,
    withoutSiteWithPhoneRate:
      withoutSite.length > 0
        ? withoutSiteWithPhone.length / withoutSite.length
        : 0,
    withoutSiteWithPhoneRatedCount: withoutSiteWithPhoneRated.length,
    activeWithoutSiteCount: activeWithoutSite.length,
    lastObservedAt,
  };
}

export function buildOpportunityRecords(
  samples: OpportunitySample[],
  leads: PersistedLead[],
  now = new Date(),
) {
  const grouped = new Map<string, OpportunitySample[]>();

  for (const sample of samples) {
    if (!sample.checkedAt || !sample.results.length) continue;
    const key = opportunityGroupKey(
      sample.city,
      normalizeStateCode(sample.state),
      sample.segment,
    );
    const rows = grouped.get(key) ?? [];
    rows.push(sample);
    grouped.set(key, rows);
  }

  const records: OpportunityRecord[] = [];
  for (const [key, rows] of grouped) {
    const first = rows[0]!;
    const observations: OpportunityObservation[] = rows.flatMap((sample) =>
      sample.results.map((business) => ({
        business,
        observedAt: sample.checkedAt,
        source: sample.source,
      })),
    );
    const businesses = mergeOpportunityBusinesses(observations, leads);
    if (!businesses.length) continue;

    const lastObservedAt = latestIso(rows.map((row) => row.checkedAt));
    const stats = buildStats(businesses, lastObservedAt);
    const score = calculateOpportunityScore(stats);
    const ageMs = now.getTime() - new Date(lastObservedAt).getTime();
    const stale =
      !Number.isFinite(ageMs) ||
      ageMs > OPPORTUNITY_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;

    records.push({
      key,
      city: first.city,
      state: normalizeStateCode(first.state),
      segment: first.segment,
      ...stats,
      ...score,
      stale,
      businesses,
    });
  }

  return records;
}

export function summarizeOpportunities(
  records: OpportunityRecord[],
): OpportunitySummary {
  const cities = new Set(records.map((record) => record.city));
  const segments = new Set(records.map((record) => record.segment));
  const businesses = new Map<string, OpportunityRecord["businesses"][number]>();

  for (const record of records) {
    for (const business of record.businesses) {
      const previous = businesses.get(business.placeId);
      if (
        !previous ||
        (!hasIdentifiedWebsite(previous) && hasIdentifiedWebsite(business))
      ) {
        businesses.set(business.placeId, business);
      }
    }
  }

  return {
    cities: cities.size,
    segments: segments.size,
    uniqueBusinesses: businesses.size,
    withoutSiteBusinesses: Array.from(businesses.values()).filter(
      (business) => !hasIdentifiedWebsite(business),
    ).length,
  };
}

export async function loadOpportunityData(leads: PersistedLead[]) {
  const [placesResult, openNowResult] = await Promise.allSettled([
    fetchPlacesSearchSamples(),
    fetchOpenNowSamples(),
  ]);

  const serverSamples = [
    ...(placesResult.status === "fulfilled" ? placesResult.value : []),
    ...(openNowResult.status === "fulfilled" ? openNowResult.value : []),
  ];

  const samples = [...serverSamples, ...localSamples()];
  const records = buildOpportunityRecords(samples, leads);

  if (
    placesResult.status === "rejected" &&
    openNowResult.status === "rejected" &&
    records.length === 0
  ) {
    throw new Error("OPPORTUNITY_DATA_UNAVAILABLE");
  }

  return {
    records,
    summary: summarizeOpportunities(records),
    partial:
      placesResult.status === "rejected" ||
      openNowResult.status === "rejected",
  };
}
