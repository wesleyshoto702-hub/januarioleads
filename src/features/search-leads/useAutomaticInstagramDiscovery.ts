import { useEffect, useRef, useState } from "react";
import { discoverBusinessPresence } from "../business-presence/discover-business-presence";
import type { BusinessPresence } from "../business-presence/types";
import type { ExistingLeadIdentity } from "./identity";
import { findBusinessDuplicate } from "./identity";
import { withSearchLocation, type SearchLocation } from "./search-location";
import type { BusinessSearchResult } from "./types";

// The server has separate quotas for quick website checks and public web search.
// Avoid spending the full deep-search allowance on every results page.
const MAX_AUTOMATIC_LOOKUPS = 20;
const MAX_AUTOMATIC_WEB_LOOKUPS = 8;
const NO_WEBSITE_WEB_FIRST = 4;
const WEBSITE_WORKERS = 4;
const WEB_WORKERS = 2;
const SETTING_KEY = "januarioleads:auto-instagram:v1";

export type AutomaticInstagramProgress = {
  running: boolean;
  checked: number;
  total: number;
  found: number;
  candidates: number;
  remaining: number;
  notice: string;
};

const INITIAL_PROGRESS: AutomaticInstagramProgress = {
  running: false,
  checked: 0,
  total: 0,
  found: 0,
  candidates: 0,
  remaining: 0,
  notice: "",
};

function confirmedInstagram(business: BusinessSearchResult) {
  return Boolean(
    business.instagram?.trim() &&
      business.instagramConfidence !== "low" &&
      business.instagramConfidence !== "medium" &&
      !business.instagramNeedsReview,
  );
}

function confirmedSavedInstagram(lead: ExistingLeadIdentity | null) {
  return Boolean(
    lead?.instagram?.trim() &&
      lead.instagramConfidence !== "low" &&
      lead.instagramConfidence !== "medium" &&
      !lead.instagramNeedsReview,
  );
}

function automaticSetting() {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SETTING_KEY) !== "off";
  } catch {
    return true;
  }
}

type DiscoveryStage = "site" | "web";

export function useAutomaticInstagramDiscovery({
  active,
  businesses,
  location,
  existingLeads,
  onPresence,
  onSavedLeadPresence,
}: {
  active: boolean;
  businesses: BusinessSearchResult[];
  location: SearchLocation;
  existingLeads: ExistingLeadIdentity[];
  onPresence: (placeId: string, presence: BusinessPresence) => void;
  onSavedLeadPresence?: ((leadId: string, presence: BusinessPresence) => void) | undefined;
}) {
  const [enabled, setEnabled] = useState(automaticSetting);
  const [progress, setProgress] =
    useState<AutomaticInstagramProgress>(INITIAL_PROGRESS);
  const [checkingIds, setCheckingIds] = useState<string[]>([]);

  const triedSiteRef = useRef(new Set<string>());
  const triedWebRef = useRef(new Set<string>());
  const businessesRef = useRef(businesses);
  const leadsRef = useRef(existingLeads);
  const onPresenceRef = useRef(onPresence);
  const onSavedLeadPresenceRef = useRef(onSavedLeadPresence);
  businessesRef.current = businesses;
  leadsRef.current = existingLeads;
  onPresenceRef.current = onPresence;
  onSavedLeadPresenceRef.current = onSavedLeadPresence;

  // Changes in Instagram metadata do not restart the queue.
  const resultKeys = businesses.map((business) => business.placeId).join("|");
  const locationKey = `${location.city}|${location.state}`;
  const batchKey = `${locationKey}|${resultKeys}`;

  useEffect(() => {
    try {
      localStorage.setItem(SETTING_KEY, enabled ? "on" : "off");
    } catch {
      // Automatic discovery still works if browser storage is disabled.
    }
  }, [enabled]);

  useEffect(() => {
    if (!active || !enabled || !resultKeys) {
      setCheckingIds([]);
      setProgress(INITIAL_PROGRESS);
      return;
    }

    let cancelled = false;
    let checked = 0;
    let total = 0;
    let notice = "";
    let siteQuotaExhausted = false;
    let webQuotaExhausted = false;
    const confirmed = new Set<string>();
    const review = new Set<string>();
    const inFlight = new Map<string, DiscoveryStage>();
    const siteResults = new Map<string, BusinessPresence>();
    const controller = new AbortController();

    const available = businessesRef.current
      .filter((business) => {
        const located = withSearchLocation(business, location);
        const saved = findBusinessDuplicate(located, leadsRef.current);
        return !confirmedInstagram(business) &&
          !confirmedSavedInstagram(saved);
      })
      .filter((business) => {
        const key = `${locationKey}|${business.placeId}`;
        return !triedSiteRef.current.has(key) &&
          !triedWebRef.current.has(key);
      })
      .slice(0, MAX_AUTOMATIC_LOOKUPS);

    const websites = available.filter((business) => Boolean(business.website));
    const withoutWebsites = available.filter((business) => !business.website);
    const firstWeb = withoutWebsites.slice(0, NO_WEBSITE_WEB_FIRST);
    const unresolvedSites: BusinessSearchResult[] = [];
    total = websites.length + firstWeb.length;

    const publish = (running = true) => {
      if (cancelled) return;
      setProgress({
        running,
        checked,
        total,
        found: confirmed.size,
        candidates: review.size,
        remaining: Math.max(0, available.length - confirmed.size - review.size),
        notice,
      });
    };

    if (total === 0) {
      setCheckingIds([]);
      setProgress({
        ...INITIAL_PROGRESS,
        notice: available.length === 0
          ? "Resultados já conhecidos ou consultados nesta região."
          : "Os perfis restantes poderão ser conferidos em Ver empresa.",
      });
      return;
    }
    publish();

    async function lookup(business: BusinessSearchResult, stage: DiscoveryStage) {
      const key = `${locationKey}|${business.placeId}`;
      const tried = stage === "site" ? triedSiteRef.current : triedWebRef.current;
      if (tried.has(key) || cancelled) return null;
      tried.add(key);
      inFlight.set(`${stage}|${key}`, stage);
      setCheckingIds((current) =>
        current.includes(business.placeId)
          ? current
          : [...current, business.placeId],
      );

      let presence: BusinessPresence | null = null;
      try {
        const located = withSearchLocation(business, location);
        presence = await discoverBusinessPresence(located, {
          allowWebSearch: stage === "web",
          skipOfficialSite: stage === "web" &&
            Boolean(business.website) &&
            siteResults.get(key)?.instagramCandidates.length === 0,
          signal: controller.signal,
        });
        if (cancelled) return null;
        if (stage === "site" && presence) siteResults.set(key, presence);
        if (presence?.instagramUrl) {
          confirmed.add(key);
          review.delete(key);
        } else if ((presence?.instagramCandidates.length ?? 0) > 0) {
          if (!confirmed.has(key)) review.add(key);
        }
        if (presence) {
          onPresenceRef.current(business.placeId, presence);
          if (
            presence.instagramUrl ||
            (presence.instagramCandidates?.length ?? 0) > 0
          ) {
            const saved = findBusinessDuplicate(located, leadsRef.current);
            if (saved?.id) onSavedLeadPresenceRef.current?.(saved.id, presence);
          }
        }
      } catch (error) {
        if (cancelled) return null;
        tried.delete(key);
        const message = error instanceof Error ? error.message : "";
        if (/limite|quota|muitas consultas|rate.limit|excedido/i.test(message)) {
          if (stage === "site") siteQuotaExhausted = true;
          else webQuotaExhausted = true;
          notice = stage === "web"
            ? "A cota da pesquisa web terminou. Os @ encontrados nos sites continuam disponíveis; os demais podem ser verificados depois."
            : "O limite de verificações de sites foi atingido. Os perfis restantes podem ser conferidos em Ver empresa.";
        } else if (/não está configurada|credencial.*recusada|sessão expirou/i.test(message)) {
          if (stage === "web") webQuotaExhausted = true;
          else siteQuotaExhausted = true;
          notice = message;
        } else {
          notice = "Algumas empresas não puderam ser verificadas. É possível tentar novamente em Ver empresa.";
        }
      } finally {
        inFlight.delete(`${stage}|${key}`);
        if (!cancelled) {
          checked += 1;
          setCheckingIds((current) =>
            current.filter((id) => id !== business.placeId),
          );
          publish();
        } else {
          tried.delete(key);
        }
      }
      return presence;
    }

    async function runPool(
      items: BusinessSearchResult[],
      workers: number,
      stage: DiscoveryStage,
    ) {
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(items.length, workers) }, async () => {
          while (!cancelled && next < items.length) {
            if (stage === "site" && siteQuotaExhausted) return;
            if (stage === "web" && webQuotaExhausted) return;
            const item = items[next++];
            if (!item) continue;
            const presence = await lookup(item, stage);
            if (
              stage === "site" &&
              !cancelled &&
              !siteQuotaExhausted &&
              presence &&
              !presence.instagramUrl &&
              presence.instagramSearchScope !== "web"
            ) {
              unresolvedSites.push(item);
            }
          }
        }),
      );
    }

    async function run() {
      // Site links can be confirmed in seconds and show up before deeper
      // research is complete. Run limited web searches for businesses without
      // a website alongside the fast site checks.
      await Promise.all([
        runPool(websites, WEBSITE_WORKERS, "site"),
        runPool(firstWeb, WEB_WORKERS, "web"),
      ]);
      if (cancelled || webQuotaExhausted) return;

      const remainingWebSlots = MAX_AUTOMATIC_WEB_LOOKUPS - firstWeb.length;
      const followUps = [
        ...unresolvedSites,
        ...withoutWebsites.slice(firstWeb.length),
      ]
        .filter((business) =>
          !triedWebRef.current.has(`${locationKey}|${business.placeId}`),
        )
        .slice(0, remainingWebSlots);

      total += followUps.length;
      publish();
      await runPool(followUps, WEB_WORKERS, "web");
    }

    void run()
      .catch(() => {
        notice = "Ocorreu uma falha na verificação automática; consulte o Instagram pela ficha da empresa.";
      })
      .finally(() => {
        if (cancelled) return;
        if (!notice && available.length > MAX_AUTOMATIC_WEB_LOOKUPS) {
          notice = "Perfis não confirmados poderão ser conferidos em Ver empresa. A busca profunda é limitada para preservar as cotas de API.";
        }
        publish(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
      // In-flight checks may have been interrupted by navigation.
      for (const [key, stage] of inFlight) {
        const id = key.slice(stage.length + 1);
        (stage === "site" ? triedSiteRef.current : triedWebRef.current).delete(id);
      }
    };
  }, [active, enabled, batchKey, resultKeys, location.city, location.state]);

  return { enabled, setEnabled, progress, checkingIds };
}
