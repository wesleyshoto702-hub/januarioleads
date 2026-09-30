// Central deterministic Niche Strategy registry for JanuarioLeads.
// No OpenAI call is used here. Facts decide what may be said; this layer only
// decides what matters commercially and what page structure is eligible.

export const NICHE_STRATEGY_VERSION = "2026-09-30.1";

export type NicheFamily =
  | "generic_local_business"
  | "food"
  | "beauty"
  | "health"
  | "home_services"
  | "automotive"
  | "fitness"
  | "education"
  | "events"
  | "professional_services"
  | "retail"
  | "pets"
  | "logistics"
  | "creative";

export type ActionKind =
  | "booking"
  | "delivery"
  | "reservation"
  | "ecommerce"
  | "whatsapp"
  | "phone"
  | "maps"
  | "website"
  | "instagram"
  | "none";

export type AvailabilityStatus = "verified" | "partial" | "missing" | "unverified";

export type ContentKey =
  | "identity" | "description" | "location" | "phone" | "whatsapp"
  | "hours" | "reviews" | "website" | "instagram" | "maps" | "images"
  | "services" | "products" | "menu" | "prices" | "professionals"
  | "credentials" | "portfolio" | "facilities" | "team" | "history"
  | "delivery" | "booking" | "reservation" | "ecommerce" | "regionsServed"
  | "vehicleTypes" | "modalities" | "courses" | "treatments" | "eventTypes"
  | "properties" | "brands" | "capacity" | "process" | "plans"
  | "specialties" | "beforeAfter";

export type VerifiedImage = { url: string; alt?: string | null; source?: string | null };

export type ConfirmedChannels = {
  whatsappUrl?: string | null;
  bookingUrl?: string | null;
  deliveryUrl?: string | null;
  reservationUrl?: string | null;
  ecommerceUrl?: string | null;
  menuUrl?: string | null;
};

export type VerifiedNicheContent = {
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

export type NicheBusinessInput = {
  company?: string | null;
  segment?: string | null;
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
  website?: string | null;
  instagram?: string | null;
  googleMapsUrl?: string | null;
  verifiedImages?: VerifiedImage[];
  confirmedChannels?: ConfirmedChannels;
  verifiedContent?: VerifiedNicheContent;
};

export type AvailabilityEntry = {
  status: AvailabilityStatus;
  evidence: string[];
};

export type ContentAvailabilityMatrix = Record<ContentKey, AvailabilityEntry>;

export type SectionRule = {
  type: string;
  purpose: string;
  priority: number;
  requiresAny: ContentKey[];
  visualRole: string;
  requiresActionKinds: ActionKind[];
};

export type FamilyStrategy = {
  conversionGoals: string[];
  preferredPrimaryActions: ActionKind[];
  contentPriorities: string[];
  trustSignals: string[];
  idealSections: SectionRule[];
  visualContentPriorities: Array<[ContentKey, "critical" | "high" | "medium" | "secondary"]>;
  practicalInformation: string[];
  prohibitedInferences: string[];
  nicheSpecificCopyRules: string[];
  conversionFlow: string[];
};

export type NicheStrategyOverride = Partial<Omit<FamilyStrategy, "idealSections">> & {
  idealSections?: SectionRule[];
};

export const SEARCH_SEGMENT_GROUPS = [
  {
    "label": "Alimentação",
    "items": [
      "Açaiteria",
      "Açougue",
      "Adega",
      "Buffet",
      "Buffet Infantil",
      "Cafeteria",
      "Confeitaria",
      "Doceria",
      "Empório",
      "Hamburgueria",
      "Hamburgueria Artesanal",
      "Hortifruti",
      "Marmitaria",
      "Padaria",
      "Peixaria",
      "Pizzaria",
      "Restaurante",
      "Restaurante de Bairro",
      "Restaurante Fine Dining",
      "Sorveteria"
    ]
  },
  {
    "label": "Beleza e estética",
    "items": [
      "Barbearia",
      "Barbeiro Especializado",
      "Clínica de Estética",
      "Design de Sobrancelhas",
      "Estética / Depilação",
      "Estúdio de Piercing",
      "Estúdio de Tatuagem",
      "Manicure",
      "Salão de Beleza",
      "Spa"
    ]
  },
  {
    "label": "Saúde",
    "items": [
      "Acupuntura",
      "Clínica Odontológica",
      "Clínica Veterinária",
      "Dentista",
      "Farmácia",
      "Fisioterapeuta",
      "Fonoaudiólogo",
      "Massoterapeuta",
      "Nutricionista",
      "Ótica",
      "Podólogo",
      "Psicólogo / Terapeuta",
      "Terapeuta Ocupacional"
    ]
  },
  {
    "label": "Serviços residenciais",
    "items": [
      "Chaveiro",
      "Dedetizadora",
      "Eletricista",
      "Encanador",
      "Instalador de Painel Solar",
      "Jardinagem / Paisagismo",
      "Lavanderia",
      "Marcenaria",
      "Personal Organizer",
      "Pintor",
      "Piscineiro",
      "Refrigeração / Ar Condicionado",
      "Segurança Eletrônica / Alarmes",
      "Serralheria",
      "Vidraçaria"
    ]
  },
  {
    "label": "Automotivo",
    "items": [
      "Assistência Técnica Automotiva",
      "Auto Elétrica",
      "Estacionamento",
      "Funilaria",
      "Guincho",
      "Lava-Rápido",
      "Locadora de Veículos",
      "Mecânica Automotiva"
    ]
  },
  {
    "label": "Educação e esportes",
    "items": [
      "Academia",
      "Academia de Artes Marciais",
      "Autoescola",
      "Berçário / Creche",
      "Escola de Dança",
      "Escola de Idiomas",
      "Escola de Música",
      "Escola de Natação",
      "Escola Infantil",
      "Personal Trainer",
      "Reforço Escolar"
    ]
  },
  {
    "label": "Eventos",
    "items": [
      "Casa de Festas",
      "Decoração de Eventos",
      "DJ / Som para Eventos",
      "Fotografia de Eventos",
      "Locadora de Roupas / Festas"
    ]
  },
  {
    "label": "Serviços profissionais",
    "items": [
      "Assistência Técnica de Celular",
      "Cartório / Serviços Notariais",
      "Coach",
      "Consultoria Financeira",
      "Contabilidade",
      "Corretor de Seguros",
      "Costureira / Ateliê",
      "Despachante",
      "Escritório de Advocacia",
      "Fotógrafo",
      "Marketing Digital",
      "Agência de Viagens"
    ]
  },
  {
    "label": "Comércio",
    "items": [
      "Floricultura",
      "Gráfica Rápida",
      "Imobiliária",
      "Loja de Calçados",
      "Loja de Informática",
      "Loja de Materiais de Construção",
      "Loja de Móveis",
      "Loja de Presentes",
      "Loja de Roupas",
      "Papelaria / Artesanato",
      "Pet Shop"
    ]
  },
  {
    "label": "Logística",
    "items": [
      "Motoboy / Entregas",
      "Mudanças",
      "Transportadora"
    ]
  }
] as const;

export const CURRENT_NICHE_COVERAGE = [
  {
    "segment": "Açaiteria",
    "nicheKey": "acai_shop",
    "family": "food"
  },
  {
    "segment": "Açougue",
    "nicheKey": "butcher_shop",
    "family": "retail"
  },
  {
    "segment": "Adega",
    "nicheKey": "beverage_store",
    "family": "retail"
  },
  {
    "segment": "Buffet",
    "nicheKey": "buffet",
    "family": "events"
  },
  {
    "segment": "Buffet Infantil",
    "nicheKey": "children_buffet",
    "family": "events"
  },
  {
    "segment": "Cafeteria",
    "nicheKey": "cafe",
    "family": "food"
  },
  {
    "segment": "Confeitaria",
    "nicheKey": "confectionery",
    "family": "food"
  },
  {
    "segment": "Doceria",
    "nicheKey": "dessert_shop",
    "family": "food"
  },
  {
    "segment": "Empório",
    "nicheKey": "specialty_grocery",
    "family": "retail"
  },
  {
    "segment": "Hamburgueria",
    "nicheKey": "hamburger",
    "family": "food"
  },
  {
    "segment": "Hamburgueria Artesanal",
    "nicheKey": "hamburger",
    "family": "food"
  },
  {
    "segment": "Hortifruti",
    "nicheKey": "produce_market",
    "family": "retail"
  },
  {
    "segment": "Marmitaria",
    "nicheKey": "meal_shop",
    "family": "food"
  },
  {
    "segment": "Padaria",
    "nicheKey": "bakery",
    "family": "food"
  },
  {
    "segment": "Peixaria",
    "nicheKey": "fish_market",
    "family": "retail"
  },
  {
    "segment": "Pizzaria",
    "nicheKey": "pizzeria",
    "family": "food"
  },
  {
    "segment": "Restaurante",
    "nicheKey": "restaurant",
    "family": "food"
  },
  {
    "segment": "Restaurante de Bairro",
    "nicheKey": "restaurant",
    "family": "food"
  },
  {
    "segment": "Restaurante Fine Dining",
    "nicheKey": "fine_dining",
    "family": "food"
  },
  {
    "segment": "Sorveteria",
    "nicheKey": "ice_cream_shop",
    "family": "food"
  },
  {
    "segment": "Barbearia",
    "nicheKey": "barbershop",
    "family": "beauty"
  },
  {
    "segment": "Barbeiro Especializado",
    "nicheKey": "barbershop",
    "family": "beauty"
  },
  {
    "segment": "Clínica de Estética",
    "nicheKey": "aesthetic_clinic",
    "family": "beauty"
  },
  {
    "segment": "Design de Sobrancelhas",
    "nicheKey": "eyebrow_design",
    "family": "beauty"
  },
  {
    "segment": "Estética / Depilação",
    "nicheKey": "beauty_aesthetics",
    "family": "beauty"
  },
  {
    "segment": "Estúdio de Piercing",
    "nicheKey": "piercing",
    "family": "creative"
  },
  {
    "segment": "Estúdio de Tatuagem",
    "nicheKey": "tattoo",
    "family": "creative"
  },
  {
    "segment": "Manicure",
    "nicheKey": "manicure",
    "family": "beauty"
  },
  {
    "segment": "Salão de Beleza",
    "nicheKey": "beauty_salon",
    "family": "beauty"
  },
  {
    "segment": "Spa",
    "nicheKey": "spa",
    "family": "beauty"
  },
  {
    "segment": "Acupuntura",
    "nicheKey": "acupuncture",
    "family": "health"
  },
  {
    "segment": "Clínica Odontológica",
    "nicheKey": "dentist",
    "family": "health"
  },
  {
    "segment": "Clínica Veterinária",
    "nicheKey": "veterinary",
    "family": "pets"
  },
  {
    "segment": "Dentista",
    "nicheKey": "dentist",
    "family": "health"
  },
  {
    "segment": "Farmácia",
    "nicheKey": "pharmacy",
    "family": "retail"
  },
  {
    "segment": "Fisioterapeuta",
    "nicheKey": "physiotherapy",
    "family": "health"
  },
  {
    "segment": "Fonoaudiólogo",
    "nicheKey": "speech_therapy",
    "family": "health"
  },
  {
    "segment": "Massoterapeuta",
    "nicheKey": "massage_therapy",
    "family": "health"
  },
  {
    "segment": "Nutricionista",
    "nicheKey": "nutritionist",
    "family": "health"
  },
  {
    "segment": "Ótica",
    "nicheKey": "optical_store",
    "family": "retail"
  },
  {
    "segment": "Podólogo",
    "nicheKey": "podiatry",
    "family": "health"
  },
  {
    "segment": "Psicólogo / Terapeuta",
    "nicheKey": "psychology",
    "family": "health"
  },
  {
    "segment": "Terapeuta Ocupacional",
    "nicheKey": "occupational_therapy",
    "family": "health"
  },
  {
    "segment": "Chaveiro",
    "nicheKey": "locksmith",
    "family": "home_services"
  },
  {
    "segment": "Dedetizadora",
    "nicheKey": "pest_control",
    "family": "home_services"
  },
  {
    "segment": "Eletricista",
    "nicheKey": "electrician",
    "family": "home_services"
  },
  {
    "segment": "Encanador",
    "nicheKey": "plumber",
    "family": "home_services"
  },
  {
    "segment": "Instalador de Painel Solar",
    "nicheKey": "solar_installer",
    "family": "home_services"
  },
  {
    "segment": "Jardinagem / Paisagismo",
    "nicheKey": "landscaping",
    "family": "home_services"
  },
  {
    "segment": "Lavanderia",
    "nicheKey": "laundry",
    "family": "home_services"
  },
  {
    "segment": "Marcenaria",
    "nicheKey": "carpentry",
    "family": "home_services"
  },
  {
    "segment": "Personal Organizer",
    "nicheKey": "personal_organizer",
    "family": "home_services"
  },
  {
    "segment": "Pintor",
    "nicheKey": "painter",
    "family": "home_services"
  },
  {
    "segment": "Piscineiro",
    "nicheKey": "pool_service",
    "family": "home_services"
  },
  {
    "segment": "Refrigeração / Ar Condicionado",
    "nicheKey": "hvac",
    "family": "home_services"
  },
  {
    "segment": "Segurança Eletrônica / Alarmes",
    "nicheKey": "security_systems",
    "family": "home_services"
  },
  {
    "segment": "Serralheria",
    "nicheKey": "metalwork",
    "family": "home_services"
  },
  {
    "segment": "Vidraçaria",
    "nicheKey": "glasswork",
    "family": "home_services"
  },
  {
    "segment": "Assistência Técnica Automotiva",
    "nicheKey": "automotive_service",
    "family": "automotive"
  },
  {
    "segment": "Auto Elétrica",
    "nicheKey": "auto_electric",
    "family": "automotive"
  },
  {
    "segment": "Estacionamento",
    "nicheKey": "parking",
    "family": "automotive"
  },
  {
    "segment": "Funilaria",
    "nicheKey": "body_shop",
    "family": "automotive"
  },
  {
    "segment": "Guincho",
    "nicheKey": "tow_service",
    "family": "automotive"
  },
  {
    "segment": "Lava-Rápido",
    "nicheKey": "car_wash",
    "family": "automotive"
  },
  {
    "segment": "Locadora de Veículos",
    "nicheKey": "car_rental",
    "family": "automotive"
  },
  {
    "segment": "Mecânica Automotiva",
    "nicheKey": "mechanic",
    "family": "automotive"
  },
  {
    "segment": "Academia",
    "nicheKey": "gym",
    "family": "fitness"
  },
  {
    "segment": "Academia de Artes Marciais",
    "nicheKey": "martial_arts_gym",
    "family": "fitness"
  },
  {
    "segment": "Autoescola",
    "nicheKey": "driving_school",
    "family": "education"
  },
  {
    "segment": "Berçário / Creche",
    "nicheKey": "daycare",
    "family": "education"
  },
  {
    "segment": "Escola de Dança",
    "nicheKey": "dance_school",
    "family": "education"
  },
  {
    "segment": "Escola de Idiomas",
    "nicheKey": "language_school",
    "family": "education"
  },
  {
    "segment": "Escola de Música",
    "nicheKey": "music_school",
    "family": "education"
  },
  {
    "segment": "Escola de Natação",
    "nicheKey": "swim_school",
    "family": "fitness"
  },
  {
    "segment": "Escola Infantil",
    "nicheKey": "preschool",
    "family": "education"
  },
  {
    "segment": "Personal Trainer",
    "nicheKey": "personal_trainer",
    "family": "fitness"
  },
  {
    "segment": "Reforço Escolar",
    "nicheKey": "tutoring",
    "family": "education"
  },
  {
    "segment": "Casa de Festas",
    "nicheKey": "party_venue",
    "family": "events"
  },
  {
    "segment": "Decoração de Eventos",
    "nicheKey": "event_decor",
    "family": "events"
  },
  {
    "segment": "DJ / Som para Eventos",
    "nicheKey": "event_dj",
    "family": "events"
  },
  {
    "segment": "Fotografia de Eventos",
    "nicheKey": "event_photography",
    "family": "creative"
  },
  {
    "segment": "Locadora de Roupas / Festas",
    "nicheKey": "formalwear_rental",
    "family": "events"
  },
  {
    "segment": "Assistência Técnica de Celular",
    "nicheKey": "phone_repair",
    "family": "professional_services"
  },
  {
    "segment": "Cartório / Serviços Notariais",
    "nicheKey": "notary",
    "family": "professional_services"
  },
  {
    "segment": "Coach",
    "nicheKey": "coach",
    "family": "professional_services"
  },
  {
    "segment": "Consultoria Financeira",
    "nicheKey": "financial_consulting",
    "family": "professional_services"
  },
  {
    "segment": "Contabilidade",
    "nicheKey": "accounting",
    "family": "professional_services"
  },
  {
    "segment": "Corretor de Seguros",
    "nicheKey": "insurance_broker",
    "family": "professional_services"
  },
  {
    "segment": "Costureira / Ateliê",
    "nicheKey": "tailor",
    "family": "creative"
  },
  {
    "segment": "Despachante",
    "nicheKey": "dispatcher",
    "family": "professional_services"
  },
  {
    "segment": "Escritório de Advocacia",
    "nicheKey": "law_firm",
    "family": "professional_services"
  },
  {
    "segment": "Fotógrafo",
    "nicheKey": "photographer",
    "family": "creative"
  },
  {
    "segment": "Marketing Digital",
    "nicheKey": "digital_marketing",
    "family": "professional_services"
  },
  {
    "segment": "Agência de Viagens",
    "nicheKey": "travel_agency",
    "family": "professional_services"
  },
  {
    "segment": "Floricultura",
    "nicheKey": "florist",
    "family": "retail"
  },
  {
    "segment": "Gráfica Rápida",
    "nicheKey": "quick_print",
    "family": "creative"
  },
  {
    "segment": "Imobiliária",
    "nicheKey": "real_estate",
    "family": "professional_services"
  },
  {
    "segment": "Loja de Calçados",
    "nicheKey": "shoe_store",
    "family": "retail"
  },
  {
    "segment": "Loja de Informática",
    "nicheKey": "computer_store",
    "family": "retail"
  },
  {
    "segment": "Loja de Materiais de Construção",
    "nicheKey": "building_materials",
    "family": "retail"
  },
  {
    "segment": "Loja de Móveis",
    "nicheKey": "furniture_store",
    "family": "retail"
  },
  {
    "segment": "Loja de Presentes",
    "nicheKey": "gift_store",
    "family": "retail"
  },
  {
    "segment": "Loja de Roupas",
    "nicheKey": "clothing_store",
    "family": "retail"
  },
  {
    "segment": "Papelaria / Artesanato",
    "nicheKey": "stationery_crafts",
    "family": "retail"
  },
  {
    "segment": "Pet Shop",
    "nicheKey": "pet_shop",
    "family": "pets"
  },
  {
    "segment": "Motoboy / Entregas",
    "nicheKey": "courier",
    "family": "logistics"
  },
  {
    "segment": "Mudanças",
    "nicheKey": "moving",
    "family": "logistics"
  },
  {
    "segment": "Transportadora",
    "nicheKey": "transport_company",
    "family": "logistics"
  }
] as const;

const FAMILY_STRATEGIES: Record<NicheFamily, FamilyStrategy> = {
  "generic_local_business": {
    "conversionGoals": [
      "contato",
      "visita"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "maps",
      "website",
      "instagram"
    ],
    "contentPriorities": [
      "identidade",
      "contato confirmado",
      "localização",
      "horários",
      "avaliações"
    ],
    "trustSignals": [
      "avaliações verificadas",
      "endereço",
      "presença digital oficial"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Explicar em segundos o negócio, a localização e a ação possível.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "overview",
        "purpose": "Contextualizar a empresa somente com descrição factual disponível.",
        "priority": 62,
        "requiresAny": [
          "description"
        ],
        "visualRole": "narrative",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Usar prova quantitativa real para reduzir incerteza.",
        "priority": 72,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "practical_info",
        "purpose": "Concentrar localização, horários e dados operacionais.",
        "priority": 82,
        "requiresAny": [
          "location",
          "hours",
          "maps"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      },
      {
        "type": "contact",
        "purpose": "Encerrar com o melhor canal realmente confirmado.",
        "priority": 90,
        "requiresAny": [
          "phone",
          "whatsapp",
          "website",
          "instagram",
          "maps"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "images",
        "secondary"
      ]
    ],
    "practicalInformation": [
      "endereço",
      "horários",
      "telefone",
      "Google Maps"
    ],
    "prohibitedInferences": [
      "serviços não informados",
      "preços",
      "equipe",
      "tempo de mercado",
      "canais não confirmados"
    ],
    "nicheSpecificCopyRules": [
      "Use linguagem local e factual; não transforme presença básica em autoridade inventada."
    ],
    "conversionFlow": [
      "identificar o negócio",
      "estabelecer confiança factual",
      "facilitar a próxima ação confirmada"
    ]
  },
  "food": {
    "conversionGoals": [
      "pedido",
      "visita",
      "contato"
    ],
    "preferredPrimaryActions": [
      "delivery",
      "whatsapp",
      "phone",
      "maps",
      "website"
    ],
    "contentPriorities": [
      "produtos",
      "cardápio",
      "fotografia real",
      "forma de pedido",
      "avaliações",
      "horários",
      "localização"
    ],
    "trustSignals": [
      "fotografia real",
      "cardápio real",
      "avaliações",
      "horário atual",
      "localização"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Apresentar o estabelecimento e a ação de pedido ou visita.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "products",
        "purpose": "Mostrar produtos reais que ajudam a decidir.",
        "priority": 82,
        "requiresAny": [
          "products"
        ],
        "visualRole": "merchandising",
        "requiresActionKinds": []
      },
      {
        "type": "menu",
        "purpose": "Dar acesso ao cardápio ou itens verificados.",
        "priority": 88,
        "requiresAny": [
          "menu"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "gallery",
        "purpose": "Criar apetite visual apenas com imagens reais.",
        "priority": 74,
        "requiresAny": [
          "images"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Exibir prova social quantitativa real.",
        "priority": 70,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "order",
        "purpose": "Facilitar pedido somente por canal confirmado.",
        "priority": 95,
        "requiresAny": [
          "delivery",
          "whatsapp"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "delivery",
          "whatsapp"
        ]
      },
      {
        "type": "location_hours",
        "purpose": "Apoiar visita presencial com horário e localização.",
        "priority": 84,
        "requiresAny": [
          "location",
          "hours",
          "maps"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      },
      {
        "type": "contact",
        "purpose": "Oferecer contato factual quando pedido direto não estiver confirmado.",
        "priority": 65,
        "requiresAny": [
          "phone",
          "website",
          "instagram"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "products",
        "critical"
      ],
      [
        "menu",
        "high"
      ],
      [
        "images",
        "high"
      ],
      [
        "reviews",
        "medium"
      ]
    ],
    "practicalInformation": [
      "horários",
      "endereço",
      "Maps",
      "telefone",
      "pedido/delivery somente quando confirmado"
    ],
    "prohibitedInferences": [
      "pratos",
      "ingredientes",
      "preços",
      "promoções",
      "delivery",
      "retirada",
      "reserva"
    ],
    "nicheSpecificCopyRules": [
      "Não prometa sabor, tamanho, ingredientes ou experiência sem evidência."
    ],
    "conversionFlow": [
      "despertar interesse com conteúdo real",
      "reduzir fricção de escolha",
      "levar ao canal real de pedido ou visita"
    ]
  },
  "beauty": {
    "conversionGoals": [
      "agendamento",
      "contato"
    ],
    "preferredPrimaryActions": [
      "booking",
      "whatsapp",
      "phone",
      "instagram",
      "maps"
    ],
    "contentPriorities": [
      "serviços",
      "trabalhos reais",
      "profissionais",
      "portfólio",
      "avaliações",
      "agendamento",
      "localização"
    ],
    "trustSignals": [
      "portfólio real",
      "profissionais identificados",
      "avaliações",
      "Instagram confirmado"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Apresentar serviço, contexto local e ação de contato/agendamento.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "services",
        "purpose": "Explicar serviços somente quando verificados.",
        "priority": 86,
        "requiresAny": [
          "services",
          "treatments"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "portfolio",
        "purpose": "Mostrar resultados e trabalhos somente com portfólio verificado.",
        "priority": 91,
        "requiresAny": [
          "portfolio"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "professional",
        "purpose": "Apresentar profissional/equipe quando houver dados.",
        "priority": 76,
        "requiresAny": [
          "professionals",
          "team"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Adicionar confiança com avaliações reais.",
        "priority": 72,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "appointment",
        "purpose": "Destacar agendamento somente quando o canal estiver confirmado.",
        "priority": 94,
        "requiresAny": [
          "booking",
          "whatsapp"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "booking",
          "whatsapp"
        ]
      },
      {
        "type": "location_hours",
        "purpose": "Facilitar visita com endereço e horários.",
        "priority": 80,
        "requiresAny": [
          "location",
          "hours",
          "maps"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      },
      {
        "type": "contact",
        "purpose": "Usar telefone/Instagram quando forem os canais disponíveis.",
        "priority": 66,
        "requiresAny": [
          "phone",
          "instagram",
          "website"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "portfolio",
        "critical"
      ],
      [
        "images",
        "high"
      ],
      [
        "professionals",
        "high"
      ]
    ],
    "practicalInformation": [
      "agendamento confirmado",
      "horários",
      "endereço",
      "telefone",
      "Instagram"
    ],
    "prohibitedInferences": [
      "técnicas",
      "tratamentos",
      "preços",
      "profissionais",
      "resultados"
    ],
    "nicheSpecificCopyRules": [
      "Resultados visuais só podem ser descritos quando sustentados por trabalhos reais."
    ],
    "conversionFlow": [
      "mostrar trabalho real",
      "estabelecer confiança",
      "explicar serviços disponíveis",
      "converter no canal confirmado"
    ]
  },
  "health": {
    "conversionGoals": [
      "agendamento",
      "contato"
    ],
    "preferredPrimaryActions": [
      "booking",
      "whatsapp",
      "phone",
      "maps",
      "website"
    ],
    "contentPriorities": [
      "profissional",
      "serviços/tratamentos",
      "credenciais",
      "estrutura",
      "avaliações",
      "agendamento",
      "localização"
    ],
    "trustSignals": [
      "profissional identificado",
      "credenciais verificadas",
      "avaliações",
      "estrutura real"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Estabelecer clareza, confiança e próxima ação.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "professional",
        "purpose": "Apresentar o profissional somente com identificação real.",
        "priority": 90,
        "requiresAny": [
          "professionals"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "treatments",
        "purpose": "Organizar tratamentos/serviços confirmados.",
        "priority": 88,
        "requiresAny": [
          "treatments",
          "services"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "credentials",
        "purpose": "Evidenciar formação e credenciais somente quando verificadas.",
        "priority": 86,
        "requiresAny": [
          "credentials"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "facilities",
        "purpose": "Mostrar estrutura apenas com dados ou imagens reais.",
        "priority": 68,
        "requiresAny": [
          "facilities",
          "images"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Usar avaliações factuais como prova de confiança.",
        "priority": 75,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "appointment",
        "purpose": "Destacar agendamento quando existir canal confirmado.",
        "priority": 96,
        "requiresAny": [
          "booking",
          "whatsapp"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "booking",
          "whatsapp"
        ]
      },
      {
        "type": "location_hours",
        "purpose": "Fechar dúvidas operacionais de localização e horário.",
        "priority": 82,
        "requiresAny": [
          "location",
          "hours",
          "maps"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "professionals",
        "high"
      ],
      [
        "facilities",
        "high"
      ],
      [
        "images",
        "medium"
      ]
    ],
    "practicalInformation": [
      "agendamento",
      "telefone",
      "horários",
      "endereço",
      "Maps"
    ],
    "prohibitedInferences": [
      "diagnósticos",
      "especializações",
      "registro profissional",
      "procedimentos",
      "resultados clínicos",
      "números de procedimentos"
    ],
    "nicheSpecificCopyRules": [
      "Evite promessas de resultado e linguagem médica não sustentada pelos dados."
    ],
    "conversionFlow": [
      "identificar profissional/serviço",
      "provar confiança",
      "reduzir incerteza",
      "facilitar contato/agendamento"
    ]
  },
  "home_services": {
    "conversionGoals": [
      "orçamento",
      "contato"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "website"
    ],
    "contentPriorities": [
      "serviços",
      "região atendida",
      "disponibilidade confirmada",
      "avaliações",
      "contato"
    ],
    "trustSignals": [
      "serviços claros",
      "avaliações",
      "região atendida",
      "estrutura/trabalho real"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Explicar rapidamente o serviço e como entrar em contato.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "services",
        "purpose": "Listar serviços comprovados.",
        "priority": 92,
        "requiresAny": [
          "services"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "service_area",
        "purpose": "Informar área de atendimento somente quando confirmada.",
        "priority": 78,
        "requiresAny": [
          "regionsServed"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      },
      {
        "type": "gallery",
        "purpose": "Mostrar execução/estrutura somente com imagens reais.",
        "priority": 62,
        "requiresAny": [
          "images"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Adicionar prova social factual.",
        "priority": 72,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "quote",
        "purpose": "Direcionar a orçamento/contato pelo canal existente.",
        "priority": 94,
        "requiresAny": [
          "whatsapp",
          "phone",
          "website"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "whatsapp",
          "phone",
          "website"
        ]
      },
      {
        "type": "practical_info",
        "purpose": "Exibir localização/horários quando relevantes.",
        "priority": 55,
        "requiresAny": [
          "location",
          "hours",
          "maps"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "services",
        "high"
      ],
      [
        "images",
        "medium"
      ]
    ],
    "practicalInformation": [
      "telefone/WhatsApp confirmado",
      "região atendida",
      "horários quando aplicável"
    ],
    "prohibitedInferences": [
      "atendimento 24h",
      "emergência",
      "regiões atendidas",
      "prazo",
      "preço"
    ],
    "nicheSpecificCopyRules": [
      "Não usar urgência ou disponibilidade que não esteja confirmada."
    ],
    "conversionFlow": [
      "identificar problema atendido",
      "provar capacidade",
      "encurtar caminho para orçamento"
    ]
  },
  "automotive": {
    "conversionGoals": [
      "orçamento",
      "contato",
      "agendamento"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "booking",
      "maps"
    ],
    "contentPriorities": [
      "serviços",
      "veículos atendidos",
      "estrutura",
      "avaliações",
      "orçamento",
      "localização",
      "horários"
    ],
    "trustSignals": [
      "serviços reais",
      "estrutura/oficina",
      "avaliações",
      "tipos de veículos confirmados"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Apresentar oficina/serviço e ação principal.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "services",
        "purpose": "Organizar serviços comprovados.",
        "priority": 94,
        "requiresAny": [
          "services"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "vehicles",
        "purpose": "Especificar veículos atendidos somente quando confirmado.",
        "priority": 78,
        "requiresAny": [
          "vehicleTypes"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "facilities",
        "purpose": "Mostrar oficina/estrutura com evidência real.",
        "priority": 70,
        "requiresAny": [
          "facilities",
          "images"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "before_after",
        "purpose": "Mostrar antes/depois somente quando explicitamente verificado.",
        "priority": 66,
        "requiresAny": [
          "beforeAfter"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Usar avaliações como confiança.",
        "priority": 72,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "quote",
        "purpose": "Levar a orçamento ou contato pelo canal real.",
        "priority": 96,
        "requiresAny": [
          "whatsapp",
          "phone",
          "booking"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "whatsapp",
          "phone",
          "booking"
        ]
      },
      {
        "type": "location_hours",
        "purpose": "Facilitar chegada e informar funcionamento.",
        "priority": 84,
        "requiresAny": [
          "location",
          "hours",
          "maps"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "facilities",
        "high"
      ],
      [
        "services",
        "high"
      ],
      [
        "beforeAfter",
        "medium"
      ]
    ],
    "practicalInformation": [
      "veículos atendidos",
      "horários",
      "endereço",
      "telefone",
      "Maps"
    ],
    "prohibitedInferences": [
      "serviços",
      "marcas atendidas",
      "garantia",
      "prazo",
      "preços",
      "socorro 24h"
    ],
    "nicheSpecificCopyRules": [
      "Não transformar categoria ampla em lista específica de reparos."
    ],
    "conversionFlow": [
      "identificar serviço",
      "demonstrar confiança operacional",
      "converter em orçamento/contato"
    ]
  },
  "fitness": {
    "conversionGoals": [
      "visita",
      "matrícula",
      "contato"
    ],
    "preferredPrimaryActions": [
      "booking",
      "whatsapp",
      "phone",
      "maps",
      "website"
    ],
    "contentPriorities": [
      "modalidades",
      "estrutura",
      "horários",
      "planos",
      "profissionais",
      "avaliações",
      "visita"
    ],
    "trustSignals": [
      "estrutura real",
      "modalidades confirmadas",
      "profissionais",
      "avaliações"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Apresentar proposta e ação de visita/matrícula.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "modalities",
        "purpose": "Mostrar modalidades verificadas.",
        "priority": 90,
        "requiresAny": [
          "modalities",
          "services"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "facilities",
        "purpose": "Mostrar estrutura com conteúdo real.",
        "priority": 82,
        "requiresAny": [
          "facilities",
          "images"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "professionals",
        "purpose": "Apresentar profissionais quando verificados.",
        "priority": 72,
        "requiresAny": [
          "professionals"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "plans",
        "purpose": "Exibir planos/preços apenas quando confirmados.",
        "priority": 84,
        "requiresAny": [
          "plans",
          "prices"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Adicionar confiança factual.",
        "priority": 68,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "conversion",
        "purpose": "Direcionar visita/matrícula pelo canal confirmado.",
        "priority": 95,
        "requiresAny": [
          "booking",
          "whatsapp",
          "phone",
          "maps"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "booking",
          "whatsapp",
          "phone",
          "maps"
        ]
      },
      {
        "type": "location_hours",
        "purpose": "Informar horários e localização.",
        "priority": 86,
        "requiresAny": [
          "location",
          "hours",
          "maps"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "facilities",
        "high"
      ],
      [
        "modalities",
        "high"
      ],
      [
        "professionals",
        "medium"
      ]
    ],
    "practicalInformation": [
      "horários",
      "endereço",
      "planos quando confirmados",
      "contato"
    ],
    "prohibitedInferences": [
      "modalidades",
      "planos",
      "preços",
      "profissionais",
      "resultados físicos"
    ],
    "nicheSpecificCopyRules": [
      "Não prometer transformação corporal ou desempenho."
    ],
    "conversionFlow": [
      "mostrar estrutura/modalidades",
      "reduzir dúvidas práticas",
      "estimular visita ou matrícula"
    ]
  },
  "education": {
    "conversionGoals": [
      "matrícula",
      "contato",
      "visita"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "booking",
      "website",
      "maps"
    ],
    "contentPriorities": [
      "cursos",
      "público",
      "metodologia factual",
      "professores",
      "estrutura",
      "turmas/horários",
      "contato"
    ],
    "trustSignals": [
      "cursos reais",
      "professores identificados",
      "estrutura",
      "avaliações"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Apresentar oferta educacional e próximo passo.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "courses",
        "purpose": "Organizar cursos/aulas confirmados.",
        "priority": 94,
        "requiresAny": [
          "courses",
          "services"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "methodology",
        "purpose": "Explicar processo/metodologia somente quando documentado.",
        "priority": 74,
        "requiresAny": [
          "process"
        ],
        "visualRole": "narrative",
        "requiresActionKinds": []
      },
      {
        "type": "professionals",
        "purpose": "Apresentar professores/equipe quando verificados.",
        "priority": 70,
        "requiresAny": [
          "professionals",
          "team"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "facilities",
        "purpose": "Mostrar estrutura real.",
        "priority": 65,
        "requiresAny": [
          "facilities",
          "images"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Adicionar prova social quando disponível.",
        "priority": 66,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "enrollment",
        "purpose": "Levar a contato/matrícula pelo canal confirmado.",
        "priority": 95,
        "requiresAny": [
          "whatsapp",
          "phone",
          "booking",
          "website"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "whatsapp",
          "phone",
          "booking",
          "website"
        ]
      },
      {
        "type": "location_hours",
        "purpose": "Exibir endereço e horários.",
        "priority": 80,
        "requiresAny": [
          "location",
          "hours",
          "maps"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "courses",
        "high"
      ],
      [
        "professionals",
        "medium"
      ],
      [
        "facilities",
        "medium"
      ]
    ],
    "practicalInformation": [
      "turmas/horários quando confirmados",
      "endereço",
      "contato"
    ],
    "prohibitedInferences": [
      "cursos",
      "certificados",
      "metodologia",
      "professores",
      "carga horária",
      "preços"
    ],
    "nicheSpecificCopyRules": [
      "Não criar metodologia ou promessa educacional sem fonte."
    ],
    "conversionFlow": [
      "clarificar oferta",
      "provar adequação",
      "facilitar matrícula/contato"
    ]
  },
  "events": {
    "conversionGoals": [
      "orçamento",
      "contato",
      "reserva"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "reservation",
      "website"
    ],
    "contentPriorities": [
      "tipos de eventos",
      "serviços",
      "estrutura",
      "galeria",
      "capacidade",
      "avaliações",
      "orçamento"
    ],
    "trustSignals": [
      "galeria real",
      "estrutura",
      "eventos atendidos",
      "avaliações"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Apresentar serviço de eventos e caminho para orçamento.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "event_types",
        "purpose": "Mostrar tipos de eventos confirmados.",
        "priority": 90,
        "requiresAny": [
          "eventTypes",
          "services"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "services",
        "purpose": "Detalhar serviços reais.",
        "priority": 88,
        "requiresAny": [
          "services"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "gallery",
        "purpose": "Mostrar estrutura/trabalhos com imagens verificadas.",
        "priority": 86,
        "requiresAny": [
          "portfolio",
          "images"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "capacity",
        "purpose": "Informar capacidade somente quando confirmada.",
        "priority": 68,
        "requiresAny": [
          "capacity"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Adicionar prova social.",
        "priority": 66,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "quote",
        "purpose": "Direcionar orçamento/reserva por canal confirmado.",
        "priority": 96,
        "requiresAny": [
          "whatsapp",
          "phone",
          "reservation",
          "website"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "whatsapp",
          "phone",
          "reservation",
          "website"
        ]
      },
      {
        "type": "contact",
        "purpose": "Exibir localização e informações práticas quando úteis.",
        "priority": 58,
        "requiresAny": [
          "location",
          "maps",
          "hours"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "portfolio",
        "high"
      ],
      [
        "images",
        "high"
      ],
      [
        "eventTypes",
        "medium"
      ]
    ],
    "practicalInformation": [
      "capacidade quando confirmada",
      "localização",
      "contato",
      "horários"
    ],
    "prohibitedInferences": [
      "capacidade",
      "tipos de evento",
      "pacotes",
      "preços",
      "disponibilidade",
      "itens inclusos"
    ],
    "nicheSpecificCopyRules": [
      "Galeria deve provar estrutura/trabalho, nunca preencher espaço."
    ],
    "conversionFlow": [
      "mostrar adequação ao evento",
      "provar estrutura",
      "converter em orçamento/reserva"
    ]
  },
  "professional_services": {
    "conversionGoals": [
      "lead comercial",
      "contato",
      "orçamento"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "website",
      "maps"
    ],
    "contentPriorities": [
      "serviços",
      "perfil do cliente",
      "profissionais",
      "credenciais",
      "processo",
      "contato"
    ],
    "trustSignals": [
      "credenciais verificadas",
      "profissionais",
      "processo claro",
      "avaliações quando apropriadas"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Explicar especialidade real e ação de contato.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "services",
        "purpose": "Apresentar serviços/áreas reais.",
        "priority": 92,
        "requiresAny": [
          "services",
          "specialties"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "professional",
        "purpose": "Identificar profissionais/equipe quando disponível.",
        "priority": 78,
        "requiresAny": [
          "professionals",
          "team"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "credentials",
        "purpose": "Mostrar credenciais verificadas.",
        "priority": 80,
        "requiresAny": [
          "credentials"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "process",
        "purpose": "Explicar processo somente quando documentado.",
        "priority": 68,
        "requiresAny": [
          "process"
        ],
        "visualRole": "narrative",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Usar avaliações quando adequadas e verificadas.",
        "priority": 55,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "contact",
        "purpose": "Converter em contato pelo canal confirmado.",
        "priority": 96,
        "requiresAny": [
          "whatsapp",
          "phone",
          "website"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "whatsapp",
          "phone",
          "website"
        ]
      },
      {
        "type": "location",
        "purpose": "Informar localização quando relevante.",
        "priority": 52,
        "requiresAny": [
          "location",
          "maps",
          "hours"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "professionals",
        "medium"
      ],
      [
        "images",
        "secondary"
      ]
    ],
    "practicalInformation": [
      "contato",
      "localização quando aplicável",
      "horários"
    ],
    "prohibitedInferences": [
      "credenciais",
      "áreas de atuação",
      "clientes",
      "resultados",
      "taxas",
      "garantias"
    ],
    "nicheSpecificCopyRules": [
      "Priorize clareza e credibilidade factual em vez de adjetivos corporativos."
    ],
    "conversionFlow": [
      "definir problema atendido",
      "demonstrar credibilidade",
      "explicar processo",
      "gerar contato"
    ]
  },
  "retail": {
    "conversionGoals": [
      "visita",
      "compra",
      "contato"
    ],
    "preferredPrimaryActions": [
      "ecommerce",
      "whatsapp",
      "phone",
      "maps",
      "website",
      "instagram"
    ],
    "contentPriorities": [
      "produtos",
      "coleções/marcas quando verificadas",
      "fotografia",
      "Instagram",
      "contato",
      "localização"
    ],
    "trustSignals": [
      "produtos reais",
      "marcas verificadas",
      "fotografia real",
      "avaliações"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Apresentar loja, categoria e ação disponível.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "products",
        "purpose": "Mostrar produtos/categorias reais.",
        "priority": 92,
        "requiresAny": [
          "products"
        ],
        "visualRole": "merchandising",
        "requiresActionKinds": []
      },
      {
        "type": "gallery",
        "purpose": "Usar imagens reais para apoiar escolha.",
        "priority": 76,
        "requiresAny": [
          "images"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "brands",
        "purpose": "Exibir marcas somente quando confirmadas.",
        "priority": 72,
        "requiresAny": [
          "brands"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Adicionar confiança factual.",
        "priority": 66,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "instagram",
        "purpose": "Aproveitar Instagram confirmado quando tiver papel comercial.",
        "priority": 58,
        "requiresAny": [
          "instagram"
        ],
        "visualRole": "discovery",
        "requiresActionKinds": []
      },
      {
        "type": "conversion",
        "purpose": "Levar a compra/contato/visita pelo canal existente.",
        "priority": 95,
        "requiresAny": [
          "ecommerce",
          "whatsapp",
          "phone",
          "maps",
          "website"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "ecommerce",
          "whatsapp",
          "phone",
          "maps",
          "website"
        ]
      },
      {
        "type": "location_hours",
        "purpose": "Facilitar visita presencial.",
        "priority": 80,
        "requiresAny": [
          "location",
          "hours",
          "maps"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "products",
        "critical"
      ],
      [
        "images",
        "high"
      ],
      [
        "brands",
        "medium"
      ]
    ],
    "practicalInformation": [
      "endereço",
      "horários",
      "telefone",
      "canais de compra confirmados"
    ],
    "prohibitedInferences": [
      "produtos",
      "marcas",
      "preços",
      "estoque",
      "e-commerce",
      "formas de pagamento"
    ],
    "nicheSpecificCopyRules": [
      "Não transformar categoria da loja em catálogo inventado."
    ],
    "conversionFlow": [
      "mostrar oferta real",
      "reduzir incerteza",
      "levar à compra, contato ou visita"
    ]
  },
  "pets": {
    "conversionGoals": [
      "agendamento",
      "contato",
      "visita"
    ],
    "preferredPrimaryActions": [
      "booking",
      "whatsapp",
      "phone",
      "maps",
      "website"
    ],
    "contentPriorities": [
      "serviços",
      "espécies/atendimentos confirmados",
      "profissionais",
      "estrutura",
      "avaliações",
      "contato",
      "localização"
    ],
    "trustSignals": [
      "profissionais",
      "estrutura real",
      "avaliações",
      "serviços claros"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Apresentar cuidado/serviço e ação principal.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "services",
        "purpose": "Organizar serviços confirmados.",
        "priority": 92,
        "requiresAny": [
          "services",
          "treatments"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "professional",
        "purpose": "Apresentar profissionais quando verificados.",
        "priority": 82,
        "requiresAny": [
          "professionals"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "facilities",
        "purpose": "Mostrar estrutura real.",
        "priority": 72,
        "requiresAny": [
          "facilities",
          "images"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Usar avaliações como confiança.",
        "priority": 72,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "appointment",
        "purpose": "Facilitar agendamento somente por canal confirmado.",
        "priority": 95,
        "requiresAny": [
          "booking",
          "whatsapp"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "booking",
          "whatsapp"
        ]
      },
      {
        "type": "contact",
        "purpose": "Usar telefone/website como contato alternativo.",
        "priority": 68,
        "requiresAny": [
          "phone",
          "website"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": []
      },
      {
        "type": "location_hours",
        "purpose": "Exibir localização e horários.",
        "priority": 82,
        "requiresAny": [
          "location",
          "hours",
          "maps"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      }
    ],
    "visualContentPriorities": [
      [
        "facilities",
        "high"
      ],
      [
        "professionals",
        "high"
      ],
      [
        "images",
        "medium"
      ]
    ],
    "practicalInformation": [
      "horários",
      "telefone",
      "endereço",
      "agendamento confirmado"
    ],
    "prohibitedInferences": [
      "emergência 24h",
      "especialidades",
      "exames",
      "cirurgias",
      "espécies atendidas",
      "preços"
    ],
    "nicheSpecificCopyRules": [
      "Não usar linguagem veterinária específica sem dados."
    ],
    "conversionFlow": [
      "clarificar atendimento",
      "provar confiança",
      "facilitar contato/agendamento"
    ]
  },
  "logistics": {
    "conversionGoals": [
      "orçamento",
      "contato"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "website"
    ],
    "contentPriorities": [
      "serviços",
      "região atendida",
      "tipos de carga/veículo",
      "processo",
      "avaliações",
      "contato"
    ],
    "trustSignals": [
      "área atendida",
      "processo claro",
      "veículos/estrutura quando verificados",
      "avaliações"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Explicar serviço logístico e ação de contato.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "services",
        "purpose": "Organizar serviços confirmados.",
        "priority": 92,
        "requiresAny": [
          "services"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "service_area",
        "purpose": "Mostrar região atendida quando verificada.",
        "priority": 82,
        "requiresAny": [
          "regionsServed"
        ],
        "visualRole": "utility",
        "requiresActionKinds": []
      },
      {
        "type": "vehicles",
        "purpose": "Apresentar veículos/capacidade somente quando confirmados.",
        "priority": 70,
        "requiresAny": [
          "vehicleTypes",
          "capacity"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "process",
        "purpose": "Explicar processo quando documentado.",
        "priority": 68,
        "requiresAny": [
          "process"
        ],
        "visualRole": "narrative",
        "requiresActionKinds": []
      },
      {
        "type": "reviews",
        "purpose": "Adicionar prova factual.",
        "priority": 60,
        "requiresAny": [
          "reviews"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "quote",
        "purpose": "Converter em orçamento/contato.",
        "priority": 96,
        "requiresAny": [
          "whatsapp",
          "phone",
          "website"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "whatsapp",
          "phone",
          "website"
        ]
      }
    ],
    "visualContentPriorities": [
      [
        "vehicleTypes",
        "medium"
      ],
      [
        "images",
        "secondary"
      ]
    ],
    "practicalInformation": [
      "região atendida",
      "telefone",
      "horários quando aplicável"
    ],
    "prohibitedInferences": [
      "prazo",
      "cobertura geográfica",
      "capacidade",
      "seguro",
      "preços",
      "rastreamento"
    ],
    "nicheSpecificCopyRules": [
      "Não prometer prazo, segurança ou cobertura sem confirmação."
    ],
    "conversionFlow": [
      "definir serviço",
      "mostrar cobertura/capacidade real",
      "converter em orçamento"
    ]
  },
  "creative": {
    "conversionGoals": [
      "orçamento",
      "contato"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "instagram",
      "website"
    ],
    "contentPriorities": [
      "portfólio",
      "especialidades/estilos",
      "profissional",
      "processo",
      "Instagram",
      "contato"
    ],
    "trustSignals": [
      "portfólio real",
      "trabalhos",
      "profissional identificado",
      "Instagram confirmado"
    ],
    "idealSections": [
      {
        "type": "hero",
        "purpose": "Apresentar autoria, serviço e ação de orçamento/contato.",
        "priority": 100,
        "requiresAny": [
          "identity"
        ],
        "visualRole": "opening",
        "requiresActionKinds": []
      },
      {
        "type": "professional",
        "purpose": "Apresentar artista/profissional quando houver dados.",
        "priority": 82,
        "requiresAny": [
          "professionals"
        ],
        "visualRole": "trust",
        "requiresActionKinds": []
      },
      {
        "type": "specialties",
        "purpose": "Mostrar estilos/especialidades somente quando verificados.",
        "priority": 86,
        "requiresAny": [
          "specialties",
          "services"
        ],
        "visualRole": "decision",
        "requiresActionKinds": []
      },
      {
        "type": "portfolio",
        "purpose": "Dar protagonismo ao portfólio real.",
        "priority": 96,
        "requiresAny": [
          "portfolio"
        ],
        "visualRole": "visual",
        "requiresActionKinds": []
      },
      {
        "type": "process",
        "purpose": "Explicar processo de trabalho/orçamento quando documentado.",
        "priority": 70,
        "requiresAny": [
          "process"
        ],
        "visualRole": "narrative",
        "requiresActionKinds": []
      },
      {
        "type": "instagram",
        "purpose": "Usar Instagram confirmado como prova/continuação de portfólio.",
        "priority": 64,
        "requiresAny": [
          "instagram"
        ],
        "visualRole": "discovery",
        "requiresActionKinds": []
      },
      {
        "type": "quote",
        "purpose": "Converter em orçamento/contato por canal real.",
        "priority": 94,
        "requiresAny": [
          "whatsapp",
          "phone",
          "website",
          "instagram"
        ],
        "visualRole": "conversion",
        "requiresActionKinds": [
          "whatsapp",
          "phone",
          "website",
          "instagram"
        ]
      }
    ],
    "visualContentPriorities": [
      [
        "portfolio",
        "critical"
      ],
      [
        "images",
        "high"
      ],
      [
        "professionals",
        "medium"
      ]
    ],
    "practicalInformation": [
      "contato",
      "Instagram",
      "localização quando relevante"
    ],
    "prohibitedInferences": [
      "estilos",
      "técnicas",
      "preços",
      "profissionais",
      "prazos",
      "resultados"
    ],
    "nicheSpecificCopyRules": [
      "O portfólio deve carregar a prova; não substitua trabalho real por descrição genérica."
    ],
    "conversionFlow": [
      "mostrar autoria/trabalho",
      "explicar adequação",
      "converter em orçamento/contato"
    ]
  }
} as Record<NicheFamily, FamilyStrategy>;

const NICHE_OVERRIDES: Record<string, NicheStrategyOverride> = {
  "dentist": {
    "conversionGoals": [
      "agendamento"
    ],
    "preferredPrimaryActions": [
      "booking",
      "whatsapp",
      "phone",
      "maps"
    ],
    "contentPriorities": [
      "profissional/clínica",
      "tratamentos",
      "especializações/credenciais verificadas",
      "estrutura",
      "avaliações",
      "agendamento",
      "localização"
    ],
    "trustSignals": [
      "profissional real",
      "credenciais verificadas",
      "avaliações",
      "estrutura clínica"
    ],
    "prohibitedInferences": [
      "tratamentos",
      "especialização",
      "CRO",
      "resultados",
      "antes/depois",
      "número de procedimentos"
    ],
    "nicheSpecificCopyRules": [
      "Não use autoridade clínica, especialidade ou registro profissional sem evidência."
    ],
    "visualContentPriorities": [
      [
        "professionals",
        "high"
      ],
      [
        "facilities",
        "high"
      ],
      [
        "images",
        "medium"
      ]
    ]
  },
  "beauty_salon": {
    "conversionGoals": [
      "agendamento"
    ],
    "preferredPrimaryActions": [
      "booking",
      "whatsapp",
      "phone",
      "instagram"
    ],
    "contentPriorities": [
      "serviços",
      "resultados/trabalhos reais",
      "profissional/equipe",
      "portfólio",
      "avaliações",
      "Instagram",
      "agendamento",
      "localização"
    ],
    "trustSignals": [
      "trabalhos reais",
      "portfólio",
      "profissionais",
      "avaliações"
    ],
    "prohibitedInferences": [
      "técnicas",
      "preços",
      "profissionais",
      "tratamentos"
    ]
  },
  "barbershop": {
    "conversionGoals": [
      "agendamento"
    ],
    "preferredPrimaryActions": [
      "booking",
      "whatsapp",
      "phone",
      "maps"
    ],
    "contentPriorities": [
      "serviços",
      "preços verificados",
      "trabalhos",
      "ambiente",
      "avaliações",
      "horários",
      "localização",
      "contato"
    ],
    "trustSignals": [
      "trabalhos reais",
      "ambiente",
      "avaliações",
      "preços quando confirmados"
    ]
  },
  "aesthetic_clinic": {
    "conversionGoals": [
      "avaliação",
      "agendamento"
    ],
    "preferredPrimaryActions": [
      "booking",
      "whatsapp",
      "phone"
    ],
    "contentPriorities": [
      "procedimentos",
      "profissional",
      "credenciais",
      "tecnologia/estrutura",
      "resultados reais apropriados",
      "avaliações",
      "agendamento"
    ],
    "prohibitedInferences": [
      "procedimentos",
      "aparelhos",
      "resultados",
      "formação",
      "qualificações"
    ]
  },
  "tattoo": {
    "conversionGoals": [
      "orçamento"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "instagram",
      "website"
    ],
    "contentPriorities": [
      "artista",
      "estilos",
      "portfólio",
      "trabalhos",
      "processo de orçamento",
      "Instagram",
      "contato"
    ],
    "trustSignals": [
      "portfólio real",
      "trabalhos",
      "artista identificado",
      "Instagram"
    ],
    "visualContentPriorities": [
      [
        "portfolio",
        "critical"
      ],
      [
        "images",
        "high"
      ],
      [
        "professionals",
        "high"
      ]
    ],
    "prohibitedInferences": [
      "estilos",
      "técnicas",
      "artistas",
      "preços"
    ],
    "nicheSpecificCopyRules": [
      "Quando houver portfólio real, ele deve ser uma das áreas dominantes da página."
    ]
  },
  "piercing": {
    "conversionGoals": [
      "orçamento",
      "agendamento"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "instagram"
    ],
    "contentPriorities": [
      "profissional",
      "trabalhos",
      "procedimentos confirmados",
      "portfólio",
      "processo",
      "contato"
    ],
    "prohibitedInferences": [
      "materiais",
      "procedimentos",
      "técnicas",
      "preços",
      "biossegurança específica sem evidência"
    ]
  },
  "pet_shop": {
    "conversionGoals": [
      "contato",
      "agendamento",
      "visita"
    ],
    "contentPriorities": [
      "serviços",
      "espécies/atendimentos confirmados",
      "estrutura",
      "avaliações",
      "contato",
      "localização",
      "horário"
    ]
  },
  "veterinary": {
    "conversionGoals": [
      "agendamento",
      "contato"
    ],
    "preferredPrimaryActions": [
      "booking",
      "whatsapp",
      "phone",
      "maps"
    ],
    "contentPriorities": [
      "serviços",
      "especialidades",
      "profissionais",
      "estrutura",
      "horários",
      "contato",
      "localização"
    ],
    "prohibitedInferences": [
      "emergência 24h",
      "especialidades",
      "exames",
      "cirurgias"
    ]
  },
  "gym": {
    "conversionGoals": [
      "visita",
      "matrícula"
    ],
    "preferredPrimaryActions": [
      "booking",
      "whatsapp",
      "phone",
      "maps"
    ],
    "contentPriorities": [
      "modalidades",
      "estrutura",
      "horários",
      "planos verificados",
      "profissionais",
      "avaliações",
      "visita"
    ]
  },
  "restaurant": {
    "conversionGoals": [
      "pedido",
      "reserva",
      "visita"
    ],
    "preferredPrimaryActions": [
      "delivery",
      "reservation",
      "whatsapp",
      "phone",
      "maps"
    ],
    "contentPriorities": [
      "gastronomia/produtos",
      "menu",
      "fotografias",
      "experiência/ambiente",
      "avaliações",
      "horário",
      "localização",
      "pedido/reserva"
    ],
    "prohibitedInferences": [
      "reserva",
      "delivery",
      "pratos",
      "preços"
    ]
  },
  "fine_dining": {
    "conversionGoals": [
      "reserva",
      "visita"
    ],
    "preferredPrimaryActions": [
      "reservation",
      "phone",
      "maps",
      "website"
    ],
    "contentPriorities": [
      "menu real",
      "ambiente",
      "fotografia",
      "reserva confirmada",
      "avaliações",
      "horários",
      "localização"
    ]
  },
  "hamburger": {
    "conversionGoals": [
      "pedido",
      "contato",
      "visita"
    ],
    "preferredPrimaryActions": [
      "delivery",
      "whatsapp",
      "phone",
      "maps"
    ],
    "contentPriorities": [
      "produtos",
      "cardápio",
      "fotografia real",
      "forma de pedido",
      "avaliações",
      "horário",
      "localização"
    ],
    "prohibitedInferences": [
      "hambúrgueres",
      "ingredientes",
      "preços",
      "promoções",
      "delivery",
      "retirada"
    ],
    "nicheSpecificCopyRules": [
      "Se produtos, cardápio, fotos e pedido estiverem ausentes, assumir conscientemente uma página ESSENTIAL em vez de preencher espaço."
    ]
  },
  "pizzeria": {
    "conversionGoals": [
      "pedido"
    ],
    "preferredPrimaryActions": [
      "delivery",
      "whatsapp",
      "phone"
    ],
    "contentPriorities": [
      "pizzas",
      "sabores",
      "cardápio",
      "preços",
      "pedido",
      "delivery/retirada",
      "avaliações",
      "horário"
    ],
    "prohibitedInferences": [
      "sabores",
      "tamanhos",
      "preços",
      "delivery",
      "retirada"
    ]
  },
  "acai_shop": {
    "conversionGoals": [
      "pedido",
      "visita"
    ],
    "preferredPrimaryActions": [
      "delivery",
      "whatsapp",
      "phone",
      "maps"
    ],
    "contentPriorities": [
      "produtos",
      "tamanhos",
      "complementos",
      "fotos",
      "pedido",
      "horários",
      "localização"
    ],
    "prohibitedInferences": [
      "tamanhos",
      "complementos",
      "preços",
      "delivery"
    ]
  },
  "ice_cream_shop": {
    "conversionGoals": [
      "pedido",
      "visita"
    ],
    "contentPriorities": [
      "produtos",
      "sabores/tamanhos confirmados",
      "fotos",
      "horários",
      "localização"
    ],
    "prohibitedInferences": [
      "sabores",
      "tamanhos",
      "preços",
      "delivery"
    ]
  },
  "cafe": {
    "conversionGoals": [
      "visita",
      "pedido"
    ],
    "contentPriorities": [
      "produtos",
      "fotografia",
      "menu",
      "ambiente",
      "horário",
      "localização"
    ]
  },
  "confectionery": {
    "conversionGoals": [
      "encomenda",
      "contato",
      "visita"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "website",
      "maps"
    ],
    "contentPriorities": [
      "produtos",
      "fotografia",
      "menu",
      "encomendas confirmadas",
      "ambiente",
      "horário",
      "localização"
    ],
    "prohibitedInferences": [
      "encomendas",
      "produtos",
      "preços",
      "prazos"
    ]
  },
  "clothing_store": {
    "conversionGoals": [
      "visita",
      "contato",
      "compra"
    ],
    "preferredPrimaryActions": [
      "ecommerce",
      "whatsapp",
      "maps",
      "instagram",
      "phone"
    ],
    "contentPriorities": [
      "produtos",
      "coleções",
      "estilo",
      "fotos",
      "Instagram",
      "contato",
      "localização"
    ],
    "prohibitedInferences": [
      "marcas",
      "preços",
      "e-commerce",
      "estoque"
    ]
  },
  "pharmacy": {
    "conversionGoals": [
      "visita",
      "contato"
    ],
    "preferredPrimaryActions": [
      "maps",
      "phone",
      "website"
    ],
    "contentPriorities": [
      "produtos/categorias somente quando verificados",
      "serviços confirmados",
      "horários",
      "localização",
      "contato"
    ],
    "trustSignals": [
      "localização",
      "horários",
      "avaliações",
      "presença oficial"
    ],
    "prohibitedInferences": [
      "medicamentos",
      "preços",
      "estoque",
      "delivery",
      "vacinação",
      "serviços clínicos"
    ],
    "nicheSpecificCopyRules": [
      "Não transforme a categoria Farmácia em catálogo de medicamentos nem atribua serviços de saúde não confirmados."
    ]
  },
  "optical_store": {
    "conversionGoals": [
      "visita",
      "orçamento"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "maps",
      "website"
    ],
    "contentPriorities": [
      "produtos",
      "marcas confirmadas",
      "serviços",
      "exames somente confirmados",
      "avaliações",
      "localização"
    ],
    "prohibitedInferences": [
      "marcas",
      "exames",
      "graus",
      "preços"
    ]
  },
  "real_estate": {
    "conversionGoals": [
      "lead comercial"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "website"
    ],
    "contentPriorities": [
      "imóveis reais",
      "tipos de imóveis",
      "regiões",
      "corretor",
      "CRECI confirmado",
      "prova social",
      "contato"
    ],
    "prohibitedInferences": [
      "imóveis",
      "valores",
      "disponibilidade",
      "CRECI",
      "rentabilidade"
    ]
  },
  "law_firm": {
    "conversionGoals": [
      "contato"
    ],
    "preferredPrimaryActions": [
      "phone",
      "whatsapp",
      "website"
    ],
    "contentPriorities": [
      "áreas reais de atuação",
      "profissionais",
      "credenciais",
      "atendimento",
      "localização/contato"
    ],
    "trustSignals": [
      "credenciais verificadas",
      "profissionais identificados",
      "áreas reais"
    ],
    "prohibitedInferences": [
      "promessas de resultado",
      "especialista sem evidência",
      "percentuais de sucesso",
      "depoimentos inadequados"
    ]
  },
  "accounting": {
    "conversionGoals": [
      "lead comercial"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "website"
    ],
    "contentPriorities": [
      "perfil de cliente",
      "serviços",
      "processo",
      "credenciais",
      "contato",
      "localização"
    ],
    "visualContentPriorities": [
      [
        "images",
        "secondary"
      ],
      [
        "professionals",
        "medium"
      ]
    ]
  },
  "mechanic": {
    "conversionGoals": [
      "orçamento",
      "contato"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "maps"
    ],
    "contentPriorities": [
      "serviços",
      "tipos de veículos",
      "estrutura",
      "avaliações",
      "contato",
      "localização",
      "horários"
    ]
  },
  "auto_electric": {
    "conversionGoals": [
      "orçamento",
      "contato"
    ],
    "contentPriorities": [
      "serviços",
      "problemas atendidos",
      "veículos",
      "avaliações",
      "contato",
      "localização"
    ]
  },
  "car_wash": {
    "conversionGoals": [
      "agendamento",
      "contato"
    ],
    "preferredPrimaryActions": [
      "booking",
      "whatsapp",
      "phone",
      "maps"
    ],
    "contentPriorities": [
      "serviços",
      "pacotes confirmados",
      "antes/depois real",
      "avaliações",
      "contato",
      "localização"
    ],
    "visualContentPriorities": [
      [
        "beforeAfter",
        "high"
      ],
      [
        "images",
        "high"
      ]
    ],
    "prohibitedInferences": [
      "pacotes",
      "preços",
      "antes/depois",
      "agendamento"
    ]
  },
  "photographer": {
    "conversionGoals": [
      "orçamento"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "instagram",
      "website"
    ],
    "contentPriorities": [
      "especialidades",
      "portfólio",
      "apresentação",
      "processo",
      "trabalhos",
      "Instagram",
      "contato"
    ],
    "visualContentPriorities": [
      [
        "portfolio",
        "critical"
      ],
      [
        "images",
        "high"
      ]
    ]
  },
  "event_photography": {
    "conversionGoals": [
      "orçamento"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "instagram",
      "website"
    ],
    "contentPriorities": [
      "portfólio",
      "tipos de evento",
      "processo",
      "trabalhos",
      "Instagram",
      "contato"
    ],
    "visualContentPriorities": [
      [
        "portfolio",
        "critical"
      ],
      [
        "images",
        "high"
      ]
    ]
  },
  "buffet": {
    "conversionGoals": [
      "orçamento",
      "reserva"
    ],
    "preferredPrimaryActions": [
      "whatsapp",
      "phone",
      "reservation"
    ],
    "contentPriorities": [
      "tipos de eventos",
      "serviços",
      "estrutura",
      "galeria",
      "capacidade confirmada",
      "avaliações",
      "contato"
    ]
  }
};

const CUSTOM_ALIASES: Record<string, string[]> = {
  "dentist": [
    "dentista",
    "odontologia",
    "clinica odontologica",
    "dental clinic",
    "dental_clinic",
    "dentist"
  ],
  "hamburger": [
    "hamburgueria",
    "hamburgueria artesanal",
    "hamburger restaurant",
    "burger restaurant",
    "burger"
  ],
  "barbershop": [
    "barbearia",
    "barbeiro",
    "barber shop",
    "barber_shop",
    "barbershop"
  ],
  "beauty_salon": [
    "salao de beleza",
    "beauty salon",
    "beauty_salon",
    "hair salon",
    "hair_salon",
    "hairdresser"
  ],
  "aesthetic_clinic": [
    "clinica de estetica",
    "estetica",
    "beauty clinic",
    "medical spa"
  ],
  "tattoo": [
    "estudio de tatuagem",
    "tatuagem",
    "tatuador",
    "tattoo shop",
    "tattoo_shop",
    "tattoo studio"
  ],
  "piercing": [
    "estudio de piercing",
    "piercing studio",
    "body piercing"
  ],
  "veterinary": [
    "clinica veterinaria",
    "veterinary care",
    "veterinary_care",
    "veterinarian",
    "animal hospital"
  ],
  "pet_shop": [
    "pet shop",
    "pet_store",
    "pet store"
  ],
  "gym": [
    "academia",
    "gym",
    "fitness center",
    "fitness_center"
  ],
  "restaurant": [
    "restaurante",
    "restaurant"
  ],
  "fine_dining": [
    "fine dining",
    "fine_dining",
    "fine dining restaurant"
  ],
  "pizzeria": [
    "pizzaria",
    "pizza restaurant",
    "pizza_restaurant"
  ],
  "cafe": [
    "cafeteria",
    "cafe",
    "coffee shop",
    "coffee_shop"
  ],
  "mechanic": [
    "mecanica automotiva",
    "auto repair shop",
    "car repair",
    "car_repair",
    "mechanic"
  ],
  "auto_electric": [
    "auto eletrica",
    "auto electrical",
    "auto electrician"
  ],
  "car_wash": [
    "lava rapido",
    "lava-rapido",
    "car wash",
    "car_wash"
  ],
  "electrician": [
    "eletricista",
    "electrician"
  ],
  "plumber": [
    "encanador",
    "plumber"
  ],
  "law_firm": [
    "escritorio de advocacia",
    "advocacia",
    "law firm",
    "lawyer",
    "attorney"
  ],
  "accounting": [
    "contabilidade",
    "accounting",
    "accountant"
  ],
  "real_estate": [
    "imobiliaria",
    "real estate agency",
    "real_estate_agency",
    "real estate"
  ],
  "photographer": [
    "fotografo",
    "photographer",
    "photography service"
  ],
  "optical_store": [
    "otica",
    "optical store",
    "optician"
  ],
  "pharmacy": [
    "farmacia",
    "pharmacy",
    "drugstore"
  ],
  "physiotherapy": [
    "fisioterapeuta",
    "physiotherapist",
    "physical therapy"
  ],
  "psychology": [
    "psicologo",
    "terapeuta",
    "psychologist",
    "psychotherapist"
  ],
  "nutritionist": [
    "nutricionista",
    "nutritionist"
  ],
  "locksmith": [
    "chaveiro",
    "locksmith"
  ],
  "hvac": [
    "refrigeracao",
    "ar condicionado",
    "hvac",
    "air conditioning contractor"
  ],
  "florist": [
    "floricultura",
    "florist"
  ],
  "clothing_store": [
    "loja de roupas",
    "clothing store",
    "clothing_store"
  ],
  "driving_school": [
    "autoescola",
    "driving school",
    "driving_school"
  ],
  "daycare": [
    "creche",
    "bercario",
    "day care center",
    "daycare"
  ],
  "language_school": [
    "escola de idiomas",
    "language school"
  ],
  "music_school": [
    "escola de musica",
    "music school"
  ],
  "swim_school": [
    "escola de natacao",
    "swimming school"
  ],
  "personal_trainer": [
    "personal trainer"
  ],
  "notary": [
    "cartorio",
    "notary public",
    "notary"
  ],
  "travel_agency": [
    "agencia de viagens",
    "travel agency"
  ],
  "phone_repair": [
    "assistencia tecnica de celular",
    "mobile phone repair",
    "phone repair"
  ],
  "generic_local_business": [
    "empresa local",
    "local business"
  ]
};

const LEGACY_SEGMENT_ALIASES: Record<string, string> = {
  odontologia: "dentist",
  pastelaria: "meal_shop",
  lanchonete: "meal_shop",
  loja: "generic_retail",
  outro: "generic_local_business",
};

const SEGMENT_INDEX = new Map(
  CURRENT_NICHE_COVERAGE.map((item) => [normalizeSignal(item.segment), item] as const),
);

const NICHE_FAMILY_INDEX = new Map<string, NicheFamily>();
for (const item of CURRENT_NICHE_COVERAGE) {
  if (!NICHE_FAMILY_INDEX.has(item.nicheKey)) {
    NICHE_FAMILY_INDEX.set(item.nicheKey, item.family as NicheFamily);
  }
}

function normalizeSignal(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_/\\-]+/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function safeHttpUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeString(value: unknown, max = 240) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function safeStrings(value: unknown, maxItems = 40, maxLength = 220) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function safeImages(value: unknown, maxItems = 16): VerifiedImage[] {
  if (!Array.isArray(value)) return [];
  const result: VerifiedImage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = safeHttpUrl(row.url);
    if (!url) continue;
    result.push({
      url,
      alt: safeString(row.alt, 200),
      source: safeString(row.source, 240),
    });
    if (result.length >= maxItems) break;
  }
  return result;
}

export function sanitizeNicheBusinessExtensions(input: Record<string, unknown>) {
  const channels =
    input.confirmedChannels && typeof input.confirmedChannels === "object"
      ? (input.confirmedChannels as Record<string, unknown>)
      : {};
  const content =
    input.verifiedContent && typeof input.verifiedContent === "object"
      ? (input.verifiedContent as Record<string, unknown>)
      : {};

  return {
    verifiedImages: safeImages(input.verifiedImages, 16),
    confirmedChannels: {
      whatsappUrl: safeHttpUrl(channels.whatsappUrl),
      bookingUrl: safeHttpUrl(channels.bookingUrl),
      deliveryUrl: safeHttpUrl(channels.deliveryUrl),
      reservationUrl: safeHttpUrl(channels.reservationUrl),
      ecommerceUrl: safeHttpUrl(channels.ecommerceUrl),
      menuUrl: safeHttpUrl(channels.menuUrl),
    },
    verifiedContent: {
      services: safeStrings(content.services),
      products: safeStrings(content.products),
      menuItems: safeStrings(content.menuItems),
      prices: safeStrings(content.prices),
      professionals: safeStrings(content.professionals),
      credentials: safeStrings(content.credentials),
      portfolioImages: safeImages(content.portfolioImages, 20),
      facilities: safeStrings(content.facilities),
      team: safeStrings(content.team),
      history: safeString(content.history, 1200),
      regionsServed: safeStrings(content.regionsServed),
      vehicleTypes: safeStrings(content.vehicleTypes),
      modalities: safeStrings(content.modalities),
      courses: safeStrings(content.courses),
      treatments: safeStrings(content.treatments),
      eventTypes: safeStrings(content.eventTypes),
      properties: safeStrings(content.properties),
      brands: safeStrings(content.brands),
      capacity: safeString(content.capacity, 240),
      process: safeStrings(content.process),
      plans: safeStrings(content.plans),
      specialties: safeStrings(content.specialties),
      beforeAfterImages: safeImages(content.beforeAfterImages, 20),
    },
  };
}

function mergeStrategy(nicheKey: string, family: NicheFamily, fallback: boolean, matchedBy: string) {
  const base = FAMILY_STRATEGIES[family] ?? FAMILY_STRATEGIES.generic_local_business;
  const override = NICHE_OVERRIDES[nicheKey] ?? {};
  const overrideKeys = Object.keys(override);

  return {
    nicheKey,
    family,
    strategyVersion: NICHE_STRATEGY_VERSION,
    strategyMode: overrideKeys.length > 0 ? "specific" : "inherited",
    fallback,
    matchedBy,
    conversionGoals: override.conversionGoals ?? base.conversionGoals,
    preferredPrimaryActions:
      (override.preferredPrimaryActions as ActionKind[] | undefined) ??
      base.preferredPrimaryActions,
    contentPriorities: unique([
      ...(override.contentPriorities ?? []),
      ...base.contentPriorities,
    ]),
    trustSignals: unique([...(override.trustSignals ?? []), ...base.trustSignals]),
    idealSections: override.idealSections ?? base.idealSections,
    visualContentPriorities:
      (override.visualContentPriorities as FamilyStrategy["visualContentPriorities"] | undefined) ??
      base.visualContentPriorities,
    practicalInformation: unique([
      ...(override.practicalInformation ?? []),
      ...base.practicalInformation,
    ]),
    prohibitedInferences: unique([
      ...(override.prohibitedInferences ?? []),
      ...base.prohibitedInferences,
    ]),
    nicheSpecificCopyRules: unique([
      ...(override.nicheSpecificCopyRules ?? []),
      ...base.nicheSpecificCopyRules,
    ]),
    conversionFlow: override.conversionFlow ?? base.conversionFlow,
  };
}

export function resolveNicheStrategy(input: NicheBusinessInput) {
  const segment = normalizeSignal(input.segment);
  const direct = SEGMENT_INDEX.get(segment);
  if (direct) {
    return mergeStrategy(direct.nicheKey, direct.family as NicheFamily, false, "selected_segment");
  }

  const legacyKey = LEGACY_SEGMENT_ALIASES[segment];
  if (legacyKey) {
    const family =
      NICHE_FAMILY_INDEX.get(legacyKey) ??
      (legacyKey === "generic_retail" ? "retail" : "generic_local_business");
    return mergeStrategy(
      legacyKey === "generic_retail" ? "generic_local_business" : legacyKey,
      family,
      legacyKey === "generic_local_business",
      "legacy_segment_alias",
    );
  }

  const signals = [input.primaryCategory, ...(input.categories ?? [])]
    .map(normalizeSignal)
    .filter(Boolean);

  let best: { nicheKey: string; score: number; signal: string } | null = null;
  const nicheKeys = new Set([
    ...Array.from(NICHE_FAMILY_INDEX.keys()),
    ...Object.keys(CUSTOM_ALIASES),
  ]);

  for (const nicheKey of nicheKeys) {
    const aliases = unique([
      nicheKey.replace(/_/g, " "),
      ...(CUSTOM_ALIASES[nicheKey] ?? []),
      ...CURRENT_NICHE_COVERAGE
        .filter((item) => item.nicheKey === nicheKey)
        .map((item) => item.segment),
    ]).map(normalizeSignal);

    for (const signal of signals) {
      for (const alias of aliases) {
        if (!alias) continue;
        const exact = signal === alias;
        const contains = alias.length >= 5 && signal.includes(alias);
        if (!exact && !contains) continue;
        const score = (exact ? 1000 : 100) + alias.length;
        if (!best || score > best.score) best = { nicheKey, score, signal };
      }
    }
  }

  if (best) {
    const family = NICHE_FAMILY_INDEX.get(best.nicheKey) ?? "generic_local_business";
    return mergeStrategy(best.nicheKey, family, false, "google_category_alias");
  }

  return mergeStrategy(
    "generic_local_business",
    "generic_local_business",
    true,
    "fallback",
  );
}

function entry(status: AvailabilityStatus, evidence: string[] = []): AvailabilityEntry {
  return { status, evidence };
}

function countArray(value: unknown) {
  return Array.isArray(value) ? value.filter(Boolean).length : 0;
}

export function buildContentAvailabilityMatrix(
  business: NicheBusinessInput,
): ContentAvailabilityMatrix {
  const content = business.verifiedContent ?? {};
  const channels = business.confirmedChannels ?? {};
  const verifiedImages = business.verifiedImages ?? [];
  const phone = Boolean(business.phone || business.internationalPhone);
  const locationVerified = Boolean(business.address);
  const locationPartial = !locationVerified && Boolean(business.city);
  const reviewVerified =
    typeof business.rating === "number" &&
    typeof business.reviewCount === "number" &&
    business.reviewCount > 0;
  const reviewPartial = typeof business.rating === "number" && !reviewVerified;

  const portfolioCount = countArray(content.portfolioImages);
  const beforeAfterCount = countArray(content.beforeAfterImages);

  return {
    identity: entry(
      business.company && business.segment ? "verified" : "partial",
      unique([business.company ? "nome" : "", business.segment ? "segmento" : ""]),
    ),
    description: entry(business.description ? "partial" : "missing", business.description ? ["descrição factual"] : []),
    location: entry(locationVerified ? "verified" : locationPartial ? "partial" : "missing", locationVerified ? ["endereço"] : locationPartial ? ["cidade"] : []),
    phone: entry(phone ? "verified" : "missing", phone ? ["telefone"] : []),
    whatsapp: entry(channels.whatsappUrl ? "verified" : phone ? "unverified" : "missing", channels.whatsappUrl ? ["WhatsApp explicitamente confirmado"] : phone ? ["telefone existe, WhatsApp não confirmado"] : []),
    hours: entry(business.openingHours?.length ? "verified" : "missing", business.openingHours?.length ? ["horários"] : []),
    reviews: entry(reviewVerified ? "verified" : reviewPartial ? "partial" : "missing", reviewVerified ? ["nota + quantidade de avaliações"] : reviewPartial ? ["nota sem volume confirmado"] : []),
    website: entry(business.website ? "verified" : "missing", business.website ? ["website"] : []),
    instagram: entry(business.instagram ? "verified" : "missing", business.instagram ? ["Instagram confirmado"] : []),
    maps: entry(business.googleMapsUrl ? "verified" : "missing", business.googleMapsUrl ? ["Google Maps"] : []),
    images: entry(verifiedImages.length ? "verified" : "missing", verifiedImages.length ? [`${verifiedImages.length} imagem(ns) verificada(s)`] : []),
    services: entry(countArray(content.services) ? "verified" : "missing", countArray(content.services) ? [`${countArray(content.services)} serviço(s)`] : []),
    products: entry(countArray(content.products) ? "verified" : "missing", countArray(content.products) ? [`${countArray(content.products)} produto(s)`] : []),
    menu: entry(countArray(content.menuItems) || channels.menuUrl ? "verified" : "missing", countArray(content.menuItems) ? [`${countArray(content.menuItems)} item(ns) de menu`] : channels.menuUrl ? ["URL de menu confirmada"] : []),
    prices: entry(countArray(content.prices) ? "verified" : "missing", countArray(content.prices) ? ["preços verificados"] : []),
    professionals: entry(countArray(content.professionals) ? "verified" : "missing", countArray(content.professionals) ? ["profissionais verificados"] : []),
    credentials: entry(countArray(content.credentials) ? "verified" : "missing", countArray(content.credentials) ? ["credenciais verificadas"] : []),
    portfolio: entry(portfolioCount ? "verified" : "missing", portfolioCount ? [`${portfolioCount} item(ns) de portfólio`] : []),
    facilities: entry(countArray(content.facilities) ? "verified" : "missing", countArray(content.facilities) ? ["estrutura verificada"] : []),
    team: entry(countArray(content.team) ? "verified" : "missing", countArray(content.team) ? ["equipe verificada"] : []),
    history: entry(content.history ? "verified" : "missing", content.history ? ["história factual"] : []),
    delivery: entry(channels.deliveryUrl ? "verified" : "missing", channels.deliveryUrl ? ["delivery confirmado"] : []),
    booking: entry(channels.bookingUrl ? "verified" : "missing", channels.bookingUrl ? ["agendamento confirmado"] : []),
    reservation: entry(channels.reservationUrl ? "verified" : "missing", channels.reservationUrl ? ["reserva confirmada"] : []),
    ecommerce: entry(channels.ecommerceUrl ? "verified" : "missing", channels.ecommerceUrl ? ["e-commerce confirmado"] : []),
    regionsServed: entry(countArray(content.regionsServed) ? "verified" : "missing", countArray(content.regionsServed) ? ["regiões atendidas"] : []),
    vehicleTypes: entry(countArray(content.vehicleTypes) ? "verified" : "missing", countArray(content.vehicleTypes) ? ["tipos de veículos"] : []),
    modalities: entry(countArray(content.modalities) ? "verified" : "missing", countArray(content.modalities) ? ["modalidades"] : []),
    courses: entry(countArray(content.courses) ? "verified" : "missing", countArray(content.courses) ? ["cursos"] : []),
    treatments: entry(countArray(content.treatments) ? "verified" : "missing", countArray(content.treatments) ? ["tratamentos"] : []),
    eventTypes: entry(countArray(content.eventTypes) ? "verified" : "missing", countArray(content.eventTypes) ? ["tipos de eventos"] : []),
    properties: entry(countArray(content.properties) ? "verified" : "missing", countArray(content.properties) ? ["imóveis"] : []),
    brands: entry(countArray(content.brands) ? "verified" : "missing", countArray(content.brands) ? ["marcas"] : []),
    capacity: entry(content.capacity ? "verified" : "missing", content.capacity ? ["capacidade"] : []),
    process: entry(countArray(content.process) ? "verified" : "missing", countArray(content.process) ? ["processo documentado"] : []),
    plans: entry(countArray(content.plans) ? "verified" : "missing", countArray(content.plans) ? ["planos"] : []),
    specialties: entry(countArray(content.specialties) ? "verified" : "missing", countArray(content.specialties) ? ["especialidades/estilos"] : []),
    beforeAfter: entry(beforeAfterCount ? "verified" : "missing", beforeAfterCount ? [`${beforeAfterCount} antes/depois verificado(s)`] : []),
  };
}

const DEPTH_WEIGHTS: Partial<Record<ContentKey, number>> = {
  identity: 0.5,
  description: 0.5,
  location: 1,
  phone: 1,
  whatsapp: 2,
  hours: 1,
  reviews: 1,
  website: 0.5,
  instagram: 0.5,
  maps: 0.5,
  images: 2,
  services: 3,
  products: 3,
  menu: 3,
  prices: 1,
  professionals: 2,
  credentials: 2,
  portfolio: 3,
  facilities: 1.5,
  team: 1.5,
  history: 1,
  delivery: 2,
  booking: 2,
  reservation: 2,
  ecommerce: 2,
  regionsServed: 1.5,
  vehicleTypes: 1.5,
  modalities: 2,
  courses: 2.5,
  treatments: 3,
  eventTypes: 2,
  properties: 3,
  brands: 1,
  capacity: 1,
  process: 1.5,
  plans: 2,
  specialties: 2,
  beforeAfter: 2.5,
};

export function resolvePageDepth(
  matrix: ContentAvailabilityMatrix,
  resolvedStrategy?: ReturnType<typeof resolveNicheStrategy>,
) {
  // Depth is based on commercial value for THIS niche, never raw field count.
  // Core operational facts always matter; niche-specific keys come from section
  // eligibility so irrelevant structured fields cannot inflate the page.
  const relevantKeys = new Set<ContentKey>([
    "identity",
    "description",
    "location",
    "phone",
    "whatsapp",
    "hours",
    "reviews",
    "website",
    "instagram",
    "maps",
    "images",
  ]);

  if (resolvedStrategy) {
    for (const rule of resolvedStrategy.idealSections as SectionRule[]) {
      for (const key of rule.requiresAny) relevantKeys.add(key);
    }
  }

  let score = 0;
  for (const key of relevantKeys) {
    const weight = DEPTH_WEIGHTS[key] ?? 0;
    const status = matrix[key].status;
    if (status === "verified") score += weight;
    else if (status === "partial") score += weight * 0.45;
  }

  if (score >= 15) {
    return { depth: "RICH" as const, score: Math.round(score * 10) / 10 };
  }
  if (score >= 7) {
    return { depth: "STANDARD" as const, score: Math.round(score * 10) / 10 };
  }
  return {
    depth: "ESSENTIAL" as const,
    score: Math.round(score * 10) / 10,
  };
}

function phoneHref(business: NicheBusinessInput) {
  const raw = business.internationalPhone || business.phone || "";
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
    digits = "55" + digits;
  }
  return "tel:+" + digits;
}

function objectiveOrder(objective: string): ActionKind[] | null {
  const map: Record<string, ActionKind[]> = {
    "Conseguir pedidos": ["delivery","whatsapp","phone","website","maps"],
    "Conseguir agendamentos": ["booking","whatsapp","phone","website","maps"],
    "Receber contatos": ["whatsapp","phone","website","instagram","maps"],
    "Solicitar orçamento": ["whatsapp","phone","website","instagram","maps"],
    "Levar para o WhatsApp": ["whatsapp","phone","website","maps"],
    "Apresentar serviços": ["website","whatsapp","phone","maps"],
    "Levar pessoas ao estabelecimento": ["maps","phone","website","instagram"],
  };
  return map[objective] ?? null;
}

function actionLabel(kind: ActionKind, nicheFamily: NicheFamily, goal: string) {
  if (kind === "delivery") return "Pedir agora";
  if (kind === "reservation") return "Reservar";
  if (kind === "ecommerce") return "Comprar online";
  if (kind === "booking") {
    return nicheFamily === "health" || nicheFamily === "pets"
      ? "Agendar consulta"
      : "Agendar horário";
  }
  if (kind === "whatsapp") {
    return nicheFamily === "food" && /pedido/i.test(goal)
      ? "Pedir pelo WhatsApp"
      : "Falar pelo WhatsApp";
  }
  if (kind === "phone") return "Ligar agora";
  if (kind === "maps") return "Ver como chegar";
  if (kind === "website") return "Acessar site";
  if (kind === "instagram") return "Abrir Instagram";
  return "";
}

export function resolvePrimaryAction(
  business: NicheBusinessInput,
  resolvedStrategy: ReturnType<typeof resolveNicheStrategy>,
  requestedObjective: string,
) {
  const channels = business.confirmedChannels ?? {};
  const available: Partial<Record<ActionKind, string>> = {
    booking: channels.bookingUrl ?? undefined,
    delivery: channels.deliveryUrl ?? undefined,
    reservation: channels.reservationUrl ?? undefined,
    ecommerce: channels.ecommerceUrl ?? undefined,
    whatsapp: channels.whatsappUrl ?? undefined,
    phone: phoneHref(business) ?? undefined,
    maps: business.googleMapsUrl ?? undefined,
    website: business.website ?? undefined,
    instagram: business.instagram ?? undefined,
  };

  const preferred =
    requestedObjective !== "IA decidir"
      ? objectiveOrder(requestedObjective) ?? resolvedStrategy.preferredPrimaryActions
      : resolvedStrategy.preferredPrimaryActions;

  const ordered = unique([
    ...preferred,
    ...resolvedStrategy.preferredPrimaryActions,
    "whatsapp","phone","maps","website","instagram",
  ]) as ActionKind[];

  const kind = ordered.find((candidate) => Boolean(available[candidate])) ?? "none";
  const goal =
    requestedObjective !== "IA decidir"
      ? requestedObjective
      : resolvedStrategy.conversionGoals[0] ?? "contato";

  return {
    kind,
    label: actionLabel(kind, resolvedStrategy.family, goal),
    href: kind === "none" ? "" : available[kind] ?? "",
    goal,
    reason:
      kind === "none"
        ? "Nenhum canal de ação foi confirmado."
        : `Ação ${kind} escolhida entre os canais realmente confirmados para o objetivo ${goal}.`,
  };
}

function statusEligible(status: AvailabilityStatus) {
  return status === "verified" || status === "partial";
}

function evaluateRule(
  rule: SectionRule,
  matrix: ContentAvailabilityMatrix,
  primaryAction: ReturnType<typeof resolvePrimaryAction>,
) {
  const evidence = rule.requiresAny.filter((key) => statusEligible(matrix[key].status));
  const contentEligible = rule.requiresAny.length === 0 || evidence.length > 0;
  const actionEligible =
    rule.requiresActionKinds.length === 0 ||
    rule.requiresActionKinds.includes(primaryAction.kind);
  return {
    eligible: contentEligible && actionEligible,
    evidence,
    reason: !contentEligible
      ? `Sem evidência mínima: ${rule.requiresAny.join(", ")}.`
      : !actionEligible
        ? `Canal necessário não confirmado: ${rule.requiresActionKinds.join(", ")}.`
        : "Evidência suficiente e compatível com a ação principal.",
  };
}

const FALLBACK_SECTIONS: SectionRule[] = [
  {
    type: "overview",
    purpose: "Dar contexto factual sem inventar conteúdo.",
    priority: 64,
    requiresAny: ["description","identity"],
    visualRole: "narrative",
    requiresActionKinds: [],
  },
  {
    type: "practical_info",
    purpose: "Agrupar informações operacionais realmente disponíveis.",
    priority: 76,
    requiresAny: ["location","hours","reviews","maps"],
    visualRole: "utility",
    requiresActionKinds: [],
  },
  {
    type: "contact",
    purpose: "Encerrar com a melhor ação confirmada.",
    priority: 88,
    requiresAny: ["phone","whatsapp","website","instagram","maps"],
    visualRole: "conversion",
    requiresActionKinds: [],
  },
];

export function buildLandingPagePlan(
  business: NicheBusinessInput,
  resolvedStrategy: ReturnType<typeof resolveNicheStrategy>,
  matrix: ContentAvailabilityMatrix,
  primaryAction: ReturnType<typeof resolvePrimaryAction>,
) {
  const { depth, score } = resolvePageDepth(matrix, resolvedStrategy);
  const evaluated = resolvedStrategy.idealSections.map((rule: SectionRule, index: number) => ({
    rule,
    index,
    evaluation: evaluateRule(rule, matrix, primaryAction),
  }));

  const candidates = evaluated
    .filter((item: { evaluation: { eligible: boolean } }) => item.evaluation.eligible)
    .map((item: any) => ({
      type: item.rule.type,
      purpose: item.rule.purpose,
      priority: item.rule.priority,
      evidence: item.evaluation.evidence,
      visualRole: item.rule.visualRole,
      included: true,
      reason: item.evaluation.reason,
      order: item.index,
    }));

  const present = new Set(candidates.map((item: any) => item.type));
  for (const fallback of FALLBACK_SECTIONS) {
    if (candidates.length >= 3 || present.has(fallback.type)) continue;
    const evaluation = evaluateRule(fallback, matrix, primaryAction);
    if (!evaluation.eligible) continue;
    candidates.push({
      type: fallback.type,
      purpose: fallback.purpose,
      priority: fallback.priority,
      evidence: evaluation.evidence,
      visualRole: fallback.visualRole,
      included: true,
      reason: "Seção de sustentação adicionada porque a página possui poucos dados ricos.",
      order: 100 + candidates.length,
    });
    present.add(fallback.type);
  }

  const maxSections = depth === "RICH" ? 8 : depth === "STANDARD" ? 6 : 4;
  const selected =
    candidates.length <= maxSections
      ? candidates
      : candidates
          .slice()
          .sort((a: any,b: any) => b.priority - a.priority)
          .slice(0, maxSections)
          .sort((a: any,b: any) => a.order - b.order);

  const selectedTypes = new Set(selected.map((item: any) => item.type));
  const omitted = evaluated
    .filter((item: any) => !selectedTypes.has(item.rule.type))
    .map((item: any) => ({
      type: item.rule.type,
      reason: item.evaluation.eligible
        ? `Elegível, mas omitida para manter profundidade ${depth} e prioridade comercial.`
        : item.evaluation.reason,
    }));

  return {
    niche: resolvedStrategy.nicheKey,
    family: resolvedStrategy.family,
    conversionGoal:
      primaryAction.goal || resolvedStrategy.conversionGoals[0] || "contato",
    primaryAction,
    depth,
    depthScore: score,
    sections: selected.map(({ order: _order, ...section }: any) => section),
    omittedSections: omitted,
  };
}

export function compactNicheStrategy(
  resolvedStrategy: ReturnType<typeof resolveNicheStrategy>,
) {
  return {
    version: resolvedStrategy.strategyVersion,
    nicheKey: resolvedStrategy.nicheKey,
    family: resolvedStrategy.family,
    strategyMode: resolvedStrategy.strategyMode,
    fallback: resolvedStrategy.fallback,
    conversionGoals: resolvedStrategy.conversionGoals.slice(0, 3),
    preferredPrimaryActions: resolvedStrategy.preferredPrimaryActions.slice(0, 5),
    contentPriorities: resolvedStrategy.contentPriorities.slice(0, 8),
    trustSignals: resolvedStrategy.trustSignals.slice(0, 6),
    visualContentPriorities: resolvedStrategy.visualContentPriorities.slice(0, 5),
    prohibitedInferences: resolvedStrategy.prohibitedInferences.slice(0, 8),
    copyRules: resolvedStrategy.nicheSpecificCopyRules.slice(0, 4),
    conversionFlow: resolvedStrategy.conversionFlow.slice(0, 5),
  };
}

export function compactAvailability(
  matrix: ContentAvailabilityMatrix,
  resolvedStrategy: ReturnType<typeof resolveNicheStrategy>,
) {
  const relevant = new Set<ContentKey>([
    "identity","location","phone","whatsapp","hours","reviews","website",
    "instagram","maps","images","delivery","booking","reservation","ecommerce",
  ]);
  for (const rule of resolvedStrategy.idealSections as SectionRule[]) {
    for (const key of rule.requiresAny) relevant.add(key);
  }

  const result: Partial<Record<ContentKey, AvailabilityStatus>> = {};
  for (const key of relevant) result[key] = matrix[key].status;
  return result;
}

export function compactPagePlan(plan: ReturnType<typeof buildLandingPagePlan>) {
  return {
    niche: plan.niche,
    family: plan.family,
    conversionGoal: plan.conversionGoal,
    primaryAction: {
      kind: plan.primaryAction.kind,
      label: plan.primaryAction.label,
      reason: plan.primaryAction.reason,
    },
    depth: plan.depth,
    sections: plan.sections.map((section: any) => ({
      type: section.type,
      purpose: section.purpose,
      evidence: section.evidence,
      visualRole: section.visualRole,
    })),
    omittedSections: plan.omittedSections.map((section: any) => ({
      type: section.type,
      reason: section.reason,
    })),
  };
}

export function buildNichePlanningContext(
  business: NicheBusinessInput,
  requestedObjective: string,
) {
  const resolvedStrategy = resolveNicheStrategy(business);
  const contentAvailability = buildContentAvailabilityMatrix(business);
  const primaryAction = resolvePrimaryAction(
    business,
    resolvedStrategy,
    requestedObjective,
  );
  const pagePlan = buildLandingPagePlan(
    business,
    resolvedStrategy,
    contentAvailability,
    primaryAction,
  );

  return {
    resolvedStrategy,
    contentAvailability,
    primaryAction,
    pagePlan,
    promptSummary: {
      nicheStrategy: compactNicheStrategy(resolvedStrategy),
      contentAvailability: compactAvailability(contentAvailability, resolvedStrategy),
      pagePlan: compactPagePlan(pagePlan),
    },
    telemetry: {
      nicheKey: resolvedStrategy.nicheKey,
      family: resolvedStrategy.family,
      strategyVersion: NICHE_STRATEGY_VERSION,
      strategyMode: resolvedStrategy.strategyMode,
      usedFallback: resolvedStrategy.fallback,
      matchedBy: resolvedStrategy.matchedBy,
      pageDepth: pagePlan.depth,
      depthScore: pagePlan.depthScore,
      primaryAction: {
        kind: primaryAction.kind,
        label: primaryAction.label,
      },
      includedSections: pagePlan.sections.map((section: any) => section.type),
      omittedSections: pagePlan.omittedSections,
    },
  };
}

export function getNicheCoverageReport() {
  const currentSegments = SEARCH_SEGMENT_GROUPS.flatMap((group) => group.items);
  const mapped = new Map(CURRENT_NICHE_COVERAGE.map((item) => [item.segment, item]));
  const rows = currentSegments.map((segment) => {
    const match = mapped.get(segment);
    if (!match) {
      return {
        segment,
        nicheKey: "generic_local_business",
        family: "generic_local_business",
        strategyMode: "fallback",
        covered: false,
      };
    }
    return {
      segment,
      nicheKey: match.nicheKey,
      family: match.family,
      strategyMode: Object.prototype.hasOwnProperty.call(NICHE_OVERRIDES, match.nicheKey)
        ? "specific"
        : "inherited",
      covered: true,
    };
  });
  const covered = rows.filter((row) => row.covered).length;
  return {
    strategyVersion: NICHE_STRATEGY_VERSION,
    total: rows.length,
    covered,
    coveragePercent: rows.length ? Math.round((covered / rows.length) * 10000) / 100 : 100,
    rows,
  };
}
