// Operational niche coverage shared by Open Now.
// Kept separate from the retired site/prompt planning system.
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
