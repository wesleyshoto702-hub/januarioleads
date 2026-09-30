export type EnrichmentStatus =
  | "not_started"
  | "researching"
  | "completed"
  | "needs_review"
  | "failed";

export type Confidence = "high" | "medium" | "low";
export type Resolution =
  | "auto_verified"
  | "needs_review"
  | "low_confidence"
  | "manual_verified"
  | "rejected";

export type VerifiedImage = {
  url: string;
  alt?: string | null;
  source?: string | null;
};

export type ConfirmedChannels = {
  whatsappUrl?: string | null;
  bookingUrl?: string | null;
  deliveryUrl?: string | null;
  reservationUrl?: string | null;
  ecommerceUrl?: string | null;
  menuUrl?: string | null;
};

export type VerifiedContent = {
  services?: string[];
  products?: string[];
  menuItems?: string[];
  prices?: string[];
  professionals?: string[];
  credentials?: string[];
  portfolioImages?: VerifiedImage[];
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
  beforeAfterImages?: VerifiedImage[];
};

export type BusinessInput = {
  placeId?: string | null;
  company?: string | null;
  name?: string | null;
  segment?: string | null;
  primaryCategory?: string | null;
  categories?: string[];
  description?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  internationalPhone?: string | null;
  website?: string | null;
  instagram?: string | null;
  instagramConfidence?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  openingHours?: string[];
  googleMapsUrl?: string | null;
  verifiedImages?: VerifiedImage[];
  confirmedChannels?: ConfirmedChannels;
  verifiedContent?: VerifiedContent;
};

export type BusinessIdentityFingerprint = {
  placeId: string;
  canonicalName: string;
  aliases: string[];
  phone: string;
  officialDomain: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  confirmedInstagram: string;
  category: string;
  nicheKey: string;
};

export type PageSnapshot = {
  url: string;
  finalUrl: string;
  domain: string;
  title: string;
  metaDescription: string;
  text: string;
  html: string;
  jsonLd: unknown[];
  links: Array<{ url: string; text: string }>;
  images: Array<{ url: string; alt: string }>;
  method: "http" | "browserless";
  checkedAt: string;
  sourceUpdatedAt: string | null;
};

export type FactCandidate = {
  type: string;
  label: string;
  value: {
    name?: string;
    description?: string;
    price?: string;
    currency?: string;
    url?: string;
    imageUrl?: string;
    role?: string;
    detail?: string;
  };
  normalizedValue: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceType:
    | "official_schema"
    | "official_text"
    | "official_link"
    | "official_image"
    | "web_search"
    | "manual";
  extractionMethod: string;
  identityScore: number;
  confidence: Confidence;
  evidenceSummary: string;
  sourceUpdatedAt?: string | null;
};

export type PersistedFact = FactCandidate & {
  id?: string;
  factSignature: string;
  resolution: Resolution;
};

export type UsageMetrics = {
  modelCalls: number;
  webSearchCalls: number;
  browserlessCalls: number;
  httpPages: number;
  pagesAnalyzed: number;
  inputTokens: number;
  outputTokens: number;
};

export type EnrichmentSnapshot = {
  runId: string | null;
  status: EnrichmentStatus;
  quality: Confidence | null;
  completeness: number | null;
  checkedAt: string | null;
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
  verifiedContent: VerifiedContent;
  verifiedImages: VerifiedImage[];
  confirmedChannels: ConfirmedChannels;
  identityUpdates: {
    website?: string | null;
    instagram?: string | null;
  };
  reviewFacts: Array<{
    id: string;
    type: string;
    label: string;
    value: Record<string, unknown>;
    confidence: Confidence;
    evidenceSummary: string | null;
    sourceUrl: string | null;
  }>;
  sources: Array<{
    type: string;
    url: string;
    domain: string;
    title: string | null;
    confidence: Confidence;
  }>;
  metrics: UsageMetrics;
  errorSummary: string | null;
};
