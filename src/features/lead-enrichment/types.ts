import type { BusinessSearchResult, BusinessSearchFailure } from "../search-leads/types";

export type LeadEnrichmentMethod = "placeId" | "phone" | "name-location" | "name-segment-location";

export type LeadEnrichmentConfidence = "high" | "probable" | "uncertain";

export type LeadEnrichmentCandidate = {
  business: BusinessSearchResult;
  method: LeadEnrichmentMethod;
  confidence: LeadEnrichmentConfidence;
  score: number;
  reasons: string[];
  phoneConflict: boolean;
};

export type LeadEnrichmentSuccess = {
  ok: true;
  mode: "lead-enrichment";
  candidates: LeadEnrichmentCandidate[];
  attemptedLayers: LeadEnrichmentMethod[];
};

export type LeadEnrichmentResponse = LeadEnrichmentSuccess | BusinessSearchFailure;

export type EnrichmentLead = {
  id: string;
  company: string;
  segment: string;
  phone: string;
  placeId?: string | undefined;
  address?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
};
