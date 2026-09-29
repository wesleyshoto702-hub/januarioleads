export type PromptProjectType =
  | "Landing Page"
  | "Site Institucional"
  | "IA decidir";

export type PromptObjective =
  | "Conseguir pedidos"
  | "Conseguir agendamentos"
  | "Receber contatos"
  | "Solicitar orçamento"
  | "Levar para o WhatsApp"
  | "Apresentar serviços"
  | "Levar pessoas ao estabelecimento"
  | "IA decidir";

export type PromptBusinessContext = {
  key: string;
  company: string;
  segment: string;
  primaryCategory?: string | null;
  categories?: string[];
  description?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  internationalPhone?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  openingHours?: string[];
  businessStatus?: string | null;
  website?: string | null;
  instagram?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  verifiedImages?: Array<{
    url: string;
    alt?: string | null;
    source?: string | null;
  }>;
};

export type GeneratedSitePrompt = {
  analysis: {
    company: string;
    segment: string;
    nicheClassification: string;
    facts: string[];
    digitalPresence: string[];
    opportunities: string[];
    missingInformation: string[];
    dataLimitations: string[];
  };
  strategy: {
    projectType: "Landing Page" | "Site Institucional";
    mainObjective: string;
    primaryCta: string;
    conversionStrategy: string;
    rationale: string;
  };
  visualDirection: {
    style: string;
    personality: string[];
    typography: {
      headings: string;
      body: string;
      rationale: string;
    };
    palette: Array<{
      name: string;
      hex: string;
      role: string;
      reason: string;
    }>;
    photography: string[];
    composition: string;
    rhythm: string;
    signatureDetail: string;
  };
  images: Array<{
    use: string;
    image: string;
    framing: string;
    ratio: string;
    purpose: string;
    sourceGuidance: string;
  }>;
  sections: Array<{
    name: string;
    purpose: string;
    content: string;
    cta: string;
  }>;
  lovablePrompt: string;
};

export type SavedPromptRecord = {
  businessKey: string;
  company: string;
  generatedAt: string;
  projectType: PromptProjectType;
  objective: PromptObjective;
  visualReferenceSetId?: string | null;
  visualReferenceSignature?: string | null;
  result: GeneratedSitePrompt;
};

export type GeneratePromptResponse =
  | { ok: true; result: GeneratedSitePrompt }
  | {
      ok: false;
      code:
        | "AUTH_REQUIRED"
        | "FORBIDDEN"
        | "NOT_CONFIGURED"
        | "INVALID_REQUEST"
        | "PROVIDER_AUTH"
        | "PROVIDER_QUOTA"
        | "PROVIDER_FAILED"
        | "INVALID_AI_RESPONSE";
      message: string;
    };
