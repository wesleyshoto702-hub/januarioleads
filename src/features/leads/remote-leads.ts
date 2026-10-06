import { getValidSession } from "../../lib/auth";
import type {
  InstagramCandidate,
  InstagramSource,
} from "../business-presence/types";
import type { NextActionType } from "../next-actions/types";
import type {
  DeepConfirmedChannels,
  DeepEnrichmentConfidence,
  DeepEnrichmentStatus,
  DeepVerifiedContent,
  DeepVerifiedImage,
} from "../business-enrichment/types";

const SUPABASE_URL = "https://czkazbianiflhldenhcj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";

export type LeadStatus = "send_message" | "waiting" | "accepted" | "rejected";

export type PersistedLead = {
  id: string;
  company: string;
  segment: string;
  phone: string;
  previousPhone?: string | undefined;
  status: LeadStatus;
  firstContact: string;
  lastContact?: string | undefined;
  notes: string;
  createdAt: string;
  placeId?: string | undefined;
  address?: string | undefined;
  website?: string | undefined;
  googleMapsUrl?: string | undefined;
  instagram?: string | undefined;
  instagramConfidence?: "high" | "medium" | "low" | undefined;
  instagramSource?: InstagramSource | undefined;
  instagramCheckedAt?: string | undefined;
  instagramUsername?: string | undefined;
  instagramCandidates?: InstagramCandidate[] | undefined;
  instagramRejectedUrls?: string[] | undefined;
  instagramSearchSignature?: string | undefined;
  instagramNeedsReview?: boolean | undefined;
  factualDescription?: string | undefined;
  primaryCategory?: string | undefined;
  categories?: string[] | undefined;
  description?: string | undefined;
  neighborhood?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  internationalPhone?: string | undefined;
  rating?: number | undefined;
  reviewCount?: number | undefined;
  isOpenNow?: boolean | undefined;
  openingHours?: string[] | undefined;
  businessStatus?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  enrichedAt?: string | undefined;
  source?: "manual" | "lavras-search" | "places-search" | undefined;
  autoSyncEnabled?: boolean | undefined;
  lastSyncedAt?: string | undefined;
  lastSyncError?: string | undefined;
  lastSyncErrorAt?: string | undefined;
  verifiedContent?: DeepVerifiedContent | undefined;
  verifiedImages?: DeepVerifiedImage[] | undefined;
  confirmedChannels?: DeepConfirmedChannels | undefined;
  deepEnrichmentStatus?: DeepEnrichmentStatus | undefined;
  deepEnrichmentQuality?: DeepEnrichmentConfidence | undefined;
  deepEnrichmentCheckedAt?: string | undefined;
  projectValue?: number | undefined;
  financialNotes?: string | undefined;
  nextActionType?: NextActionType | undefined;
  nextActionDate?: string | undefined;
  nextActionNotes?: string | undefined;
};

export type LeadUpdateRecord = {
  id: number;
  leadId: string;
  placeId: string | null;
  changeType: string;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  message: string;
  importance: "normal" | "high";
  source: string;
  isSeen: boolean;
  createdAt: string;
};

type RemoteLead = {
  id: string;
  user_id: string;
  company: string;
  segment: string;
  phone: string;
  previous_phone: string | null;
  status: LeadStatus;
  first_contact: string;
  last_contact: string | null;
  notes: string;
  created_at: string;
  place_id: string | null;
  address: string | null;
  website: string | null;
  google_maps_url: string | null;
  instagram: string | null;
  instagram_confidence: "high" | "medium" | "low" | null;
  instagram_source: InstagramSource | null;
  instagram_checked_at: string | null;
  instagram_username: string | null;
  instagram_candidates: InstagramCandidate[];
  instagram_rejected_urls: string[];
  instagram_search_signature: string | null;
  instagram_needs_review: boolean;
  factual_description: string | null;
  primary_category: string | null;
  categories: string[];
  description: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  international_phone: string | null;
  rating: number | null;
  review_count: number | null;
  is_open_now: boolean | null;
  opening_hours: string[];
  business_status: string | null;
  latitude: number | null;
  longitude: number | null;
  enriched_at: string | null;
  source: "manual" | "lavras-search" | "places-search" | null;
  auto_sync_enabled: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  last_sync_error_at: string | null;
  verified_content: DeepVerifiedContent;
  verified_images: DeepVerifiedImage[];
  confirmed_channels: DeepConfirmedChannels;
  deep_enrichment_status: DeepEnrichmentStatus | null;
  deep_enrichment_quality: DeepEnrichmentConfidence | null;
  deep_enrichment_checked_at: string | null;
  project_value: number | string | null;
  financial_notes: string | null;
  next_action_type: NextActionType | null;
  next_action_date: string | null;
  next_action_notes: string | null;
};

type RemoteLeadUpdate = {
  id: number;
  lead_id: string;
  place_id: string | null;
  change_type: string;
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
  message: string;
  importance: "normal" | "high";
  source: string;
  is_seen: boolean;
  created_at: string;
};

async function authedRequest(path: string, init: RequestInit = {}) {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");

  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function toRemote(lead: PersistedLead, userId: string) {
  return compact({
    id: lead.id,
    user_id: userId,
    company: lead.company,
    segment: lead.segment,
    phone: lead.phone,
    previous_phone: lead.previousPhone,
    status: lead.status,
    first_contact: lead.firstContact,
    last_contact: lead.lastContact,
    notes: lead.notes,
    created_at: lead.createdAt,
    place_id: lead.placeId,
    address: lead.address,
    website: lead.website,
    google_maps_url: lead.googleMapsUrl,
    instagram: lead.instagram,
    instagram_confidence: lead.instagramConfidence,
    instagram_source: lead.instagramSource,
    instagram_checked_at: lead.instagramCheckedAt,
    instagram_username: lead.instagramUsername,
    instagram_candidates: lead.instagramCandidates ?? [],
    instagram_rejected_urls: lead.instagramRejectedUrls ?? [],
    instagram_search_signature: lead.instagramSearchSignature,
    instagram_needs_review: lead.instagramNeedsReview ?? false,
    factual_description: lead.factualDescription,
    primary_category: lead.primaryCategory,
    categories: lead.categories ?? [],
    description: lead.description,
    neighborhood: lead.neighborhood,
    city: lead.city,
    state: lead.state,
    international_phone: lead.internationalPhone,
    rating: lead.rating,
    review_count: lead.reviewCount,
    is_open_now: lead.isOpenNow,
    opening_hours: lead.openingHours ?? [],
    business_status: lead.businessStatus,
    latitude: lead.latitude,
    longitude: lead.longitude,
    enriched_at: lead.enrichedAt,
    source: lead.source,
    auto_sync_enabled: lead.autoSyncEnabled ?? true,
    verified_content: lead.verifiedContent ?? {},
    verified_images: lead.verifiedImages ?? [],
    confirmed_channels: lead.confirmedChannels ?? {},
    deep_enrichment_status: lead.deepEnrichmentStatus,
    deep_enrichment_quality: lead.deepEnrichmentQuality,
    deep_enrichment_checked_at: lead.deepEnrichmentCheckedAt,
    project_value: lead.projectValue,
    financial_notes: lead.financialNotes,
    next_action_type: lead.nextActionType ?? null,
    next_action_date: lead.nextActionDate ?? null,
    next_action_notes: lead.nextActionNotes?.trim() || null,
  });
}

function fromRemote(row: RemoteLead): PersistedLead {
  return {
    id: row.id,
    company: row.company,
    segment: row.segment,
    phone: row.phone,
    previousPhone: row.previous_phone ?? undefined,
    status: row.status,
    firstContact: row.first_contact,
    lastContact: row.last_contact ?? undefined,
    notes: row.notes,
    createdAt: row.created_at,
    placeId: row.place_id ?? undefined,
    address: row.address ?? undefined,
    website: row.website ?? undefined,
    googleMapsUrl: row.google_maps_url ?? undefined,
    instagram: row.instagram ?? undefined,
    instagramConfidence: row.instagram_confidence ?? undefined,
    instagramSource: row.instagram_source ?? undefined,
    instagramCheckedAt: row.instagram_checked_at ?? undefined,
    instagramUsername: row.instagram_username ?? undefined,
    instagramCandidates: row.instagram_candidates ?? [],
    instagramRejectedUrls: row.instagram_rejected_urls ?? [],
    instagramSearchSignature: row.instagram_search_signature ?? undefined,
    instagramNeedsReview: row.instagram_needs_review ?? false,
    factualDescription: row.factual_description ?? undefined,
    primaryCategory: row.primary_category ?? undefined,
    categories: row.categories ?? [],
    description: row.description ?? undefined,
    neighborhood: row.neighborhood ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    internationalPhone: row.international_phone ?? undefined,
    rating: row.rating ?? undefined,
    reviewCount: row.review_count ?? undefined,
    isOpenNow: row.is_open_now ?? undefined,
    openingHours: row.opening_hours ?? [],
    businessStatus: row.business_status ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    enrichedAt: row.enriched_at ?? undefined,
    source: row.source ?? undefined,
    autoSyncEnabled: row.auto_sync_enabled,
    lastSyncedAt: row.last_synced_at ?? undefined,
    lastSyncError: row.last_sync_error ?? undefined,
    lastSyncErrorAt: row.last_sync_error_at ?? undefined,
    verifiedContent: row.verified_content ?? {},
    verifiedImages: row.verified_images ?? [],
    confirmedChannels: row.confirmed_channels ?? {},
    deepEnrichmentStatus: row.deep_enrichment_status ?? undefined,
    deepEnrichmentQuality: row.deep_enrichment_quality ?? undefined,
    deepEnrichmentCheckedAt: row.deep_enrichment_checked_at ?? undefined,
    projectValue:
      row.project_value === null
        ? undefined
        : typeof row.project_value === "number"
          ? row.project_value
          : Number(row.project_value),
    financialNotes: row.financial_notes ?? undefined,
    nextActionType: row.next_action_type ?? undefined,
    nextActionDate: row.next_action_date ?? undefined,
    nextActionNotes: row.next_action_notes ?? undefined,
  };
}

export async function fetchRemoteLeads() {
  const response = await authedRequest(
    "leads?select=*&order=created_at.desc",
  );
  if (!response.ok) {
    throw new Error(`REMOTE_LEADS_${response.status}`);
  }

  return ((await response.json()) as RemoteLead[]).map(fromRemote);
}

export async function migrateLocalLeads(localLeads: PersistedLead[]) {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");

  const existing = await fetchRemoteLeads();
  const existingIds = new Set(existing.map((lead) => lead.id));
  const missing = localLeads.filter((lead) => !existingIds.has(lead.id));

  if (missing.length > 0) {
    const response = await authedRequest("leads?on_conflict=id", {
      method: "POST",
      headers: {
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify(
        missing.map((lead) => toRemote(lead, session.user.id)),
      ),
    });

    if (!response.ok) {
      throw new Error(`LOCAL_MIGRATION_${response.status}`);
    }
  }

  return fetchRemoteLeads();
}

export async function saveRemoteLead(lead: PersistedLead) {
  const session = await getValidSession();
  if (!session) return false;

  const response = await authedRequest("leads?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(toRemote(lead, session.user.id)),
  });

  return response.ok;
}

export async function deleteRemoteLead(id: string) {
  const response = await authedRequest(
    `leads?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    },
  );

  return response.ok;
}

export async function fetchLeadUpdates(limit = 60) {
  const params = new URLSearchParams();
  params.set(
    "select",
    "id,lead_id,place_id,change_type,field_name,old_value,new_value,message,importance,source,is_seen,created_at",
  );
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));

  const response = await authedRequest(`lead_updates?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`LEAD_UPDATES_${response.status}`);
  }

  return ((await response.json()) as RemoteLeadUpdate[]).map(
    (row): LeadUpdateRecord => ({
      id: row.id,
      leadId: row.lead_id,
      placeId: row.place_id,
      changeType: row.change_type,
      fieldName: row.field_name,
      oldValue: row.old_value,
      newValue: row.new_value,
      message: row.message,
      importance: row.importance,
      source: row.source,
      isSeen: row.is_seen,
      createdAt: row.created_at,
    }),
  );
}

export async function markLeadUpdatesSeen(leadId: string) {
  const response = await authedRequest(
    `lead_updates?lead_id=eq.${encodeURIComponent(leadId)}&is_seen=eq.false`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ is_seen: true }),
    },
  );

  return response.ok;
}
