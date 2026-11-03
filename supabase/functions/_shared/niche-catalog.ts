// Canonical niche catalog shared by Buscar Leads, Open Now and Supabase.
// Keep labels distinct by business activity, not by marketing modifiers.
export type SegmentGroup = {
  label: string;
  items: string[];
};

export const SEGMENT_GROUPS: SegmentGroup[] = [
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
      "Hortifruti",
      "Marmitaria",
      "Padaria",
      "Peixaria",
      "Pizzaria",
      "Restaurante",
      "Restaurante Fine Dining",
      "Sorveteria"
    ]
  },
  {
    "label": "Beleza e estética",
    "items": [
      "Barbearia",
      "Bronzeamento",
      "Clínica Capilar",
      "Clínica de Estética",
      "Depilação a Laser",
      "Design de Sobrancelhas",
      "Estética / Depilação",
      "Estúdio de Piercing",
      "Estúdio de Tatuagem",
      "Manicure",
      "Maquiagem Profissional",
      "Micropigmentação",
      "Salão de Beleza",
      "Spa"
    ]
  },
  {
    "label": "Saúde",
    "items": [
      "Acupuntura",
      "Cardiologista",
      "Clínica de Exames",
      "Clínica de Imagem",
      "Clínica de Pilates",
      "Clínica Médica",
      "Clínica Odontológica",
      "Dermatologista",
      "Farmácia",
      "Fisioterapeuta",
      "Fonoaudiólogo",
      "Ginecologista",
      "Home Care / Cuidados Domiciliares",
      "Laboratório de Análises Clínicas",
      "Massoterapeuta",
      "Nutricionista",
      "Ortopedista",
      "Ótica",
      "Pediatra",
      "Podólogo",
      "Psicólogo / Terapeuta",
      "Psiquiatra",
      "Terapeuta Ocupacional"
    ]
  },
  {
    "label": "Serviços residenciais",
    "items": [
      "Chaveiro",
      "Dedetizadora",
      "Desentupidora",
      "Eletricista",
      "Empresa de Limpeza Residencial",
      "Encanador",
      "Instalação de Portões Automáticos",
      "Jardinagem / Paisagismo",
      "Lavanderia",
      "Limpeza de Caixa-d'Água",
      "Marcenaria",
      "Montador de Móveis",
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
    "label": "Construção e reformas",
    "items": [
      "Arquiteto / Escritório de Arquitetura",
      "Construtora",
      "Empreiteira",
      "Empresa de Construção de Piscinas",
      "Energia Solar",
      "Engenharia Civil",
      "Esquadrias de Alumínio",
      "Gesso / Drywall",
      "Impermeabilização",
      "Loja de Tintas",
      "Marmoraria",
      "Reformas Residenciais"
    ]
  },
  {
    "label": "Casa e decoração",
    "items": [
      "Estofaria",
      "Loja de Colchões",
      "Loja de Cortinas",
      "Loja de Iluminação",
      "Loja de Persianas",
      "Móveis Planejados",
      "Tapeçaria"
    ]
  },
  {
    "label": "Automotivo",
    "items": [
      "Acessórios Automotivos",
      "Auto Elétrica",
      "Estacionamento",
      "Estética Automotiva",
      "Funilaria",
      "Guincho",
      "Lava-Rápido",
      "Locadora de Veículos",
      "Loja de Pneus",
      "Loja de Veículos Seminovos",
      "Mecânica Automotiva",
      "Oficina de Motos",
      "Vistoria Veicular"
    ]
  },
  {
    "label": "Educação e esportes",
    "items": [
      "Academia",
      "Academia de Artes Marciais",
      "Autoescola",
      "Berçário / Creche",
      "Curso Preparatório para Concursos",
      "Curso Profissionalizante",
      "Escola de Dança",
      "Escola de Futebol",
      "Escola de Idiomas",
      "Escola de Informática",
      "Escola de Música",
      "Escola de Natação",
      "Escola de Robótica",
      "Escola Infantil",
      "Personal Trainer",
      "Reforço Escolar"
    ]
  },
  {
    "label": "Eventos",
    "items": [
      "Aluguel de Brinquedos para Festas",
      "Assessoria de Casamentos",
      "Casa de Festas",
      "Cerimonialista",
      "Decoração de Eventos",
      "DJ / Som para Eventos",
      "Fotografia de Eventos",
      "Locadora de Equipamentos para Eventos",
      "Locadora de Roupas / Festas"
    ]
  },
  {
    "label": "Turismo e hospedagem",
    "items": [
      "Agência de Turismo Receptivo",
      "Agência de Viagens",
      "Aluguel de Temporada",
      "Chalés para Temporada",
      "Hostel",
      "Hotel",
      "Hotel Fazenda",
      "Operadora de Turismo",
      "Passeios Turísticos",
      "Pousada",
      "Resort"
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
      "Marketing Digital"
    ]
  },
  {
    "label": "Serviços empresariais",
    "items": [
      "Agência de Publicidade",
      "Consultoria de RH",
      "Consultoria Empresarial",
      "Coworking",
      "Desenvolvimento de Software",
      "Empresa de Limpeza Comercial",
      "Empresa de Recrutamento",
      "Empresa de Uniformes",
      "Medicina e Segurança do Trabalho",
      "Produtora Audiovisual",
      "Serviços de TI para Empresas",
      "Terceirização de Serviços"
    ]
  },
  {
    "label": "Comércio",
    "items": [
      "Floricultura",
      "Gráfica Rápida",
      "Imobiliária",
      "Joalheria",
      "Loja de Bicicletas",
      "Loja de Calçados",
      "Loja de Informática",
      "Loja de Instrumentos Musicais",
      "Loja de Materiais de Construção",
      "Loja de Moda Infantil",
      "Loja de Móveis",
      "Loja de Presentes",
      "Loja de Produtos Naturais",
      "Loja de Roupas",
      "Loja de Suplementos",
      "Papelaria / Artesanato"
    ]
  },
  {
    "label": "Pets",
    "items": [
      "Adestramento",
      "Banho e Tosa",
      "Clínica Veterinária",
      "Creche para Cães",
      "Hotel para Pets",
      "Pet Shop",
      "Pet Sitter"
    ]
  },
  {
    "label": "Agronegócio",
    "items": [
      "Consultoria Agrícola",
      "Loja Agropecuária",
      "Loja de Rações",
      "Máquinas Agrícolas",
      "Sistemas de Irrigação"
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
];

export const ALL_SEARCH_SEGMENTS = SEGMENT_GROUPS.flatMap((group) => group.items);

// Historical labels and overlapping search terms resolve to one selectable niche.
// Existing CRM entries are never deleted or rewritten.
export const SEARCH_SEGMENT_ALIASES: Record<string, readonly string[]> = {
  "Hamburgueria": [
    "Hamburgueria Artesanal"
  ],
  "Restaurante": [
    "Restaurante de Bairro"
  ],
  "Barbearia": [
    "Barbeiro Especializado"
  ],
  "Clínica Odontológica": [
    "Dentista",
    "Odontologia"
  ],
  "Mecânica Automotiva": [
    "Assistência Técnica Automotiva"
  ],
  "Energia Solar": [
    "Instalador de Painel Solar",
    "Empresa de Energia Solar"
  ],
  "Curso Profissionalizante": [
    "Escola de Cursos Profissionalizantes"
  ]
};

// Plain-language Google Places queries for labels that contain slashes,
// descriptions or uncommon terminology. One user action = one API call.
const SEARCH_TERMS: Record<string, string> = {
  "Arquiteto / Escritório de Arquitetura": "escritório de arquitetura",
  "Home Care / Cuidados Domiciliares": "serviços de home care",
  "Refrigeração / Ar Condicionado": "instalação de ar condicionado",
  "Psicólogo / Terapeuta": "psicólogo terapeuta",
  "Fotografia de Eventos": "fotógrafo de eventos",
  "DJ / Som para Eventos": "DJ e sonorização de eventos",
  "Cartório / Serviços Notariais": "cartório",
  "Loja de Veículos Seminovos": "loja de carros seminovos",
  "Hotel para Pets": "hotel para animais",
  "Creche para Cães": "creche para cães",
  "Jardinagem / Paisagismo": "jardinagem e paisagismo",
  "Loja de Rações": "loja de ração animal",
  "Papelaria / Artesanato": "papelaria artesanato",
  "Estética / Depilação": "estética e depilação",
  "Berçário / Creche": "berçário e creche",
  "Segurança Eletrônica / Alarmes": "instalação de alarmes e segurança eletrônica",
  "Empresa de Construção de Piscinas": "construção de piscinas"
};

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\\s+/g, " ")
    .trim();
}

const canonicalByNormalized = new Map<string, string>();
for (const segment of ALL_SEARCH_SEGMENTS) {
  canonicalByNormalized.set(normalizeSearchText(segment), segment);
  for (const alias of SEARCH_SEGMENT_ALIASES[segment] ?? []) {
    canonicalByNormalized.set(normalizeSearchText(alias), segment);
  }
}

export function resolveSearchSegment(value: string): string | null {
  return canonicalByNormalized.get(normalizeSearchText(value)) ?? null;
}

export function searchSegmentMatchesQuery(segment: string, query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return true;
  return [segment, ...(SEARCH_SEGMENT_ALIASES[segment] ?? [])]
    .some((value) => normalizeSearchText(value).includes(normalized));
}

export function searchTextForSegment(value: string) {
  const segment = resolveSearchSegment(value);
  if (!segment) return null;
  return SEARCH_TERMS[segment] ?? segment;
}
