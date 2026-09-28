export type SegmentGroup = {
  label: string;
  items: string[];
};

export const SEGMENT_GROUPS: SegmentGroup[] = [
  {
    label: "Alimentação",
    items: [
      "Açaiteria", "Açougue", "Adega", "Buffet", "Buffet Infantil", "Cafeteria",
      "Confeitaria", "Doceria", "Empório", "Hamburgueria", "Hamburgueria Artesanal",
      "Hortifruti", "Marmitaria", "Padaria", "Peixaria", "Pizzaria", "Restaurante",
      "Restaurante de Bairro", "Restaurante Fine Dining", "Sorveteria",
    ],
  },
  {
    label: "Beleza e estética",
    items: [
      "Barbearia", "Barbeiro Especializado", "Clínica de Estética", "Design de Sobrancelhas",
      "Estética / Depilação", "Estúdio de Piercing", "Estúdio de Tatuagem", "Manicure",
      "Salão de Beleza", "Spa",
    ],
  },
  {
    label: "Saúde",
    items: [
      "Acupuntura", "Clínica Odontológica", "Clínica Veterinária", "Dentista", "Farmácia",
      "Fisioterapeuta", "Fonoaudiólogo", "Massoterapeuta", "Nutricionista", "Ótica",
      "Podólogo", "Psicólogo / Terapeuta", "Terapeuta Ocupacional",
    ],
  },
  {
    label: "Serviços residenciais",
    items: [
      "Chaveiro", "Dedetizadora", "Eletricista", "Encanador", "Instalador de Painel Solar",
      "Jardinagem / Paisagismo", "Lavanderia", "Marcenaria", "Personal Organizer", "Pintor",
      "Piscineiro", "Refrigeração / Ar Condicionado", "Segurança Eletrônica / Alarmes",
      "Serralheria", "Vidraçaria",
    ],
  },
  {
    label: "Automotivo",
    items: [
      "Assistência Técnica Automotiva", "Auto Elétrica", "Estacionamento", "Funilaria",
      "Guincho", "Lava-Rápido", "Locadora de Veículos", "Mecânica Automotiva",
    ],
  },
  {
    label: "Educação e esportes",
    items: [
      "Academia", "Academia de Artes Marciais", "Autoescola", "Berçário / Creche",
      "Escola de Dança", "Escola de Idiomas", "Escola de Música", "Escola de Natação",
      "Escola Infantil", "Personal Trainer", "Reforço Escolar",
    ],
  },
  {
    label: "Eventos",
    items: [
      "Casa de Festas", "Decoração de Eventos", "DJ / Som para Eventos",
      "Fotografia de Eventos", "Locadora de Roupas / Festas",
    ],
  },
  {
    label: "Serviços profissionais",
    items: [
      "Assistência Técnica de Celular", "Cartório / Serviços Notariais", "Coach",
      "Consultoria Financeira", "Contabilidade", "Corretor de Seguros", "Costureira / Ateliê",
      "Despachante", "Escritório de Advocacia", "Fotógrafo", "Marketing Digital",
      "Agência de Viagens",
    ],
  },
  {
    label: "Comércio",
    items: [
      "Floricultura", "Gráfica Rápida", "Imobiliária", "Loja de Calçados", "Loja de Informática",
      "Loja de Materiais de Construção", "Loja de Móveis", "Loja de Presentes", "Loja de Roupas",
      "Papelaria / Artesanato", "Pet Shop",
    ],
  },
  {
    label: "Logística",
    items: ["Motoboy / Entregas", "Mudanças", "Transportadora"],
  },
];

export const ALL_SEARCH_SEGMENTS = SEGMENT_GROUPS.flatMap((group) => group.items);

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}
