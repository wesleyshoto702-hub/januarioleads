export type DeepEnrichmentStatus =
  | "not_started"
  | "researching"
  | "completed"
  | "needs_review"
  | "failed";

export type DeepEnrichmentConfidence = "high" | "medium" | "low";

export type DeepVerifiedImage = {
  url: string;
  alt?: string | null;
  source?: string | null;
};

export type DeepConfirmedChannels = {
  whatsappUrl?: string | null;
  bookingUrl?: string | null;
  deliveryUrl?: string | null;
  reservationUrl?: string | null;
  ecommerceUrl?: string | null;
  menuUrl?: string | null;
};

export type DeepVerifiedContent = {
  services?: string[];
  products?: string[];
  menuItems?: string[];
  prices?: string[];
  professionals?: string[];
  credentials?: string[];
  portfolioImages?: DeepVerifiedImage[];
  facilities?: string[];
  team?: string[];
  history?: string | null;
  regionsServed?: string[];
  vehicleTypes?: string[];
  modalities?: string[];
  courses?: string[];
  treatments?: string[];
  eventTypes?: string[];
  properties?: string[];
  brands?: string[];
  capacity?: string | null;
  process?: string[];
  plans?: string[];
  specialties?: string[];
  beforeAfterImages?: DeepVerifiedImage[];
};

export type DeepEnrichmentApplied = {
  verifiedContent: DeepVerifiedContent;
  verifiedImages: DeepVerifiedImage[];
  confirmedChannels: DeepConfirmedChannels;
  identityUpdates: {
    website?: string | null;
    instagram?: string | null;
  };
  status: DeepEnrichmentStatus;
  quality: DeepEnrichmentConfidence | null;
  checkedAt: string | null;
};

export type DeepEnrichmentSnapshot = DeepEnrichmentApplied & {
  runId: string | null;
  completeness: number | null;
  expiresAt: string | null;
  cached: boolean;
  summary: {
    verifiedFacts: number;
    reviewFacts: number;
    lowFacts: number;
    services: number;
    products: number;
    professionals: number;
    portfolioImages: number;
    verifiedImages: number;
    prices: number;
    bookingConfirmed: boolean;
    whatsappConfirmed: boolean;
    websiteFound: boolean;
    conflicts: number;
  };
  reviewFacts: Array<{
    id: string;
    type: string;
    label: string;
    value: Record<string, unknown>;
    confidence: DeepEnrichmentConfidence;
    evidenceSummary: string | null;
    sourceUrl: string | null;
  }>;
  sources: Array<{
    type: string;
    url: string;
    domain: string;
    title: string | null;
    confidence: DeepEnrichmentConfidence;
  }>;
  metrics: {
    modelCalls: number;
    webSearchCalls: number;
    browserlessCalls: number;
    httpPages: number;
    pagesAnalyzed: number;
    inputTokens: number;
    outputTokens: number;
  };
  errorSummary: string | null;
};
