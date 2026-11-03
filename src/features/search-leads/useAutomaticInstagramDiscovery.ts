import { useEffect, useRef, useState } from "react";
import { discoverBusinessPresence } from "../business-presence/discover-business-presence";
import type { BusinessPresence } from "../business-presence/types";
import type { ExistingLeadIdentity } from "./identity";
import { findBusinessDuplicate } from "./identity";
import { withSearchLocation, type SearchLocation } from "./search-location";
import type { BusinessSearchResult } from "./types";

// Backend limit: 20 presence_discovery calls / 15 min / user.
// Let a full Google Places page be processed; the server still enforces the
// shared 20/15-minute quota. Browser cache prevents paying for rechecks.
const MAX_AUTOMATIC_LOOKUPS = 20;
const WORKERS = 2;
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

/** Searches visible results automatically without bypassing the server quota.
 * It never marks a weak candidate as a confirmed Instagram account.
 */
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
  onSavedLeadPresence?: (leadId: string, presence: BusinessPresence) => void;
}) {
  const [enabled, setEnabled] = useState(automaticSetting);
  const [progress, setProgress] =
    useState<AutomaticInstagramProgress>(INITIAL_PROGRESS);
  const [checkingIds, setCheckingIds] = useState<string[]>([]);

  const attemptedRef = useRef(new Set<string>());
  const businessesRef = useRef(businesses);
  const leadsRef = useRef(existingLeads);
  const onPresenceRef = useRef(onPresence);
  const onSavedLeadPresenceRef = useRef(onSavedLeadPresence);
  businessesRef.current = businesses;
  leadsRef.current = existingLeads;
  onPresenceRef.current = onPresence;
  onSavedLeadPresenceRef.current = onSavedLeadPresence;

  // Adding Instagram metadata should not restart the queue; only a new set
  // of Places IDs or a new location should start a new automatic pass.
  const resultKeys = businesses.map((business) => business.placeId).join("|");
  const locationKey = `${location.city}|${location.state}`;
  const batchKey = `${locationKey}|${resultKeys}`;

  useEffect(() => {
    try {
      localStorage.setItem(SETTING_KEY, enabled ? "on" : "off");
    } catch {
      // The feature still works if browser storage is unavailable.
    }
  }, [enabled]);

  useEffect(() => {
    if (!active || !enabled || !resultKeys) {
      setCheckingIds([]);
      setProgress(INITIAL_PROGRESS);
      return;
    }

    let cancelled = false;
    let stop = false;
    let cursor = 0;
    let checked = 0;
    let found = 0;
    let candidates = 0;
    let notice = "";
    const controller = new AbortController();
    const queue = businessesRef.current
      .filter((business) => {
        const located = withSearchLocation(business, location);
        const saved = findBusinessDuplicate(located, leadsRef.current);
        if (confirmedInstagram(business) || confirmedSavedInstagram(saved)) {
          return false;
        }
        return !attemptedRef.current.has(`${locationKey}|${business.placeId}`);
      })
      .sort((a, b) => Number(Boolean(b.website)) - Number(Boolean(a.website)));

    const planned = queue.slice(0, MAX_AUTOMATIC_LOOKUPS);
    setProgress({
      running: planned.length > 0,
      checked: 0,
      total: planned.length,
      found: 0,
      candidates: 0,
      remaining: queue.length - planned.length,
      notice: planned.length === 0 ? "Instagrams já consultados ou disponíveis em cache." : "",
    });

    async function worker() {
      while (!cancelled && !stop && cursor < planned.length) {
        const business = planned[cursor++];
        const key = `${locationKey}|${business.placeId}`;
        if (attemptedRef.current.has(key)) continue;
        attemptedRef.current.add(key);
        setCheckingIds((current) =>
          current.includes(business.placeId)
            ? current
            : [...current, business.placeId],
        );

        try {
          const located = withSearchLocation(business, location);
          const presence = await discoverBusinessPresence(located, {
            allowWebSearch: true,
            signal: controller.signal,
          });

          if (cancelled) return;
          if (presence) {
            if (presence.instagramUrl && presence.instagramConfidence === "high") {
              found += 1;
            } else if (presence.instagramCandidates.length > 0) {
              candidates += 1;
            }
            onPresenceRef.current(business.placeId, presence);
            const saved = findBusinessDuplicate(located, leadsRef.current);
            if (saved?.id) onSavedLeadPresenceRef.current?.(saved.id, presence);
          }
        } catch (error) {
          if (cancelled) return;
          const message = error instanceof Error ? error.message : "";
          if (/limite|quota|muitas consultas|rate.limit|excedido/i.test(message)) {
            notice = "Limite temporário da busca de Instagram. Os demais perfis podem ser verificados mais tarde.";
            stop = true;
          } else if (/não está configurada|credencial.*recusada|sessão expirou/i.test(message)) {
            notice = message;
            stop = true;
          } else {
            // One inaccessible company should not block the rest of the list.
            notice = "Alguns perfis não puderam ser consultados. Você pode tentar novamente nos detalhes da empresa.";
          }
        } finally {
          if (cancelled) {
            // An interrupted screen transition must not permanently skip this
            // company when the user returns to the result list.
            attemptedRef.current.delete(key);
          } else {
            checked += 1;
            setCheckingIds((current) =>
              current.filter((id) => id !== business.placeId),
            );
            setProgress({
              running: !stop && checked < planned.length,
              checked,
              total: planned.length,
              found,
              candidates,
              remaining: queue.length - checked,
              notice,
            });
          }
        }
      }
    }

    void Promise.all(Array.from({ length: Math.min(WORKERS, planned.length) }, worker))
      .then(() => {
        if (!cancelled) {
          setProgress({
            running: false,
            checked,
            total: planned.length,
            found,
            candidates,
            remaining: Math.max(0, queue.length - checked),
            notice:
              notice ||
              (queue.length > planned.length
                ? "Limite preventivo desta busca atingido. Os demais perfis poderão ser verificados em uma próxima pesquisa ou em Ver empresa."
                : ""),
          });
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [active, enabled, batchKey, resultKeys, location.city, location.state]);

  return { enabled, setEnabled, progress, checkingIds };
}
