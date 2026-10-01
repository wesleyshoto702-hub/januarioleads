export type DeepEnrichmentStatus =
  | "not_started"
  | "researching"
  | "completed"
  | "needs_review"
  | "failed";

export type DeepEnrichmentConfidence = "high" | "medium" | "low";
export type DeepExtractionStatus =
  | "successful"
  | "partial"
  | "inconclusive"
  | "blocked"
  | "failed";

export type DeepIdentityStatus =
  | "confirmed"
  | "probable"
  | "insufficient"
  | "mismatch";

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
  summaryIndicators: Array<{
    key: string;
    label: string;
    value: string;
  }>;
  status: DeepEnrichmentStatus;
  quality: DeepEnrichmentConfidence | null;
  checkedAt: string | null;
};

export type DeepEnrichmentSnapshot = DeepEnrichmentApplied & {
  runId: string | null;
  engineVersion: string | null;
  generatedWithOldEngine: boolean;
  completeness: number | null;
  expiresAt: string | null;
  cached: boolean;
  summary: {
    verifiedFacts: number;
    reviewFacts: number;
    lowFacts: number;
    services: number;
    products: number;
    menuItems: number;
    professionals: number;
    portfolioImages: number;
    verifiedImages: number;
    prices: number;
    bookingConfirmed: boolean;
    deliveryConfirmed: boolean;
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
    sourceKind: "official_website" | "official_linked_platform" | "web_search";
    url: string;
    domain: string;
    title: string | null;
    linkedFrom: string | null;
    method: "http" | "http+browserless" | "browserless" | "web_search";
    extractionStatus: DeepExtractionStatus;
    identityStatus: DeepIdentityStatus;
    identityReason: string;
    rejectionReason: string | null;
    browserlessDecision: "used" | "not_needed" | "unavailable" | "failed";
    browserlessReason: string;
    identityScore: number;
    confidence: DeepEnrichmentConfidence;
    htmlBytes: number;
    textLength: number;
    linkCount: number;
    scriptCount: number;
    frameworkSignals: string[];
    jsonLdCount: number;
    embeddedJsonCount: number;
    imageCount: number;
    commercialSignals: number;
    commercialContentDensity: number;
    found: {
      facts: number;
      products: number;
      menuItems: number;
      prices: number;
      images: number;
      services: number;
      channels: number;
    };
  }>;
  metrics: {
    modelCalls: number;
    webSearchCalls: number;
    browserlessCalls: number;
    httpPages: number;
    pagesAnalyzed: number;
    inputTokens: number;
    outputTokens: number;
    httpPagesFetched: number;
    browserlessRenders: number;
    sourcesSuccessful: number;
    sourcesPartial: number;
    sourcesInconclusive: number;
    sourcesBlocked: number;
    sourcesFailed: number;
    sourcesRejected: number;
    factsHigh: number;
    factsMedium: number;
    factsLow: number;
    productsFound: number;
    servicesFound: number;
    imagesFound: number;
  };
  errorSummary: string | null;
};
