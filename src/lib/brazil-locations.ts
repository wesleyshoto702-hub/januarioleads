export type BrazilianState = {
  code: string;
  name: string;
  ibgeCode: string;
};

export const BRAZIL_STATES: BrazilianState[] = [
  { code: "AC", name: "Acre", ibgeCode: "12" },
  { code: "AL", name: "Alagoas", ibgeCode: "27" },
  { code: "AP", name: "Amapá", ibgeCode: "16" },
  { code: "AM", name: "Amazonas", ibgeCode: "13" },
  { code: "BA", name: "Bahia", ibgeCode: "29" },
  { code: "CE", name: "Ceará", ibgeCode: "23" },
  { code: "DF", name: "Distrito Federal", ibgeCode: "53" },
  { code: "ES", name: "Espírito Santo", ibgeCode: "32" },
  { code: "GO", name: "Goiás", ibgeCode: "52" },
  { code: "MA", name: "Maranhão", ibgeCode: "21" },
  { code: "MT", name: "Mato Grosso", ibgeCode: "51" },
  { code: "MS", name: "Mato Grosso do Sul", ibgeCode: "50" },
  { code: "MG", name: "Minas Gerais", ibgeCode: "31" },
  { code: "PA", name: "Pará", ibgeCode: "15" },
  { code: "PB", name: "Paraíba", ibgeCode: "25" },
  { code: "PR", name: "Paraná", ibgeCode: "41" },
  { code: "PE", name: "Pernambuco", ibgeCode: "26" },
  { code: "PI", name: "Piauí", ibgeCode: "22" },
  { code: "RJ", name: "Rio de Janeiro", ibgeCode: "33" },
  { code: "RN", name: "Rio Grande do Norte", ibgeCode: "24" },
  { code: "RS", name: "Rio Grande do Sul", ibgeCode: "43" },
  { code: "RO", name: "Rondônia", ibgeCode: "11" },
  { code: "RR", name: "Roraima", ibgeCode: "14" },
  { code: "SC", name: "Santa Catarina", ibgeCode: "42" },
  { code: "SP", name: "São Paulo", ibgeCode: "35" },
  { code: "SE", name: "Sergipe", ibgeCode: "28" },
  { code: "TO", name: "Tocantins", ibgeCode: "17" },
];

function normalizeStateText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findBrazilianState(value: string | null | undefined) {
  const normalized = normalizeStateText(value);
  if (!normalized) return null;
  return (
    BRAZIL_STATES.find(
      (state) =>
        state.code.toLocaleLowerCase("pt-BR") === normalized ||
        normalizeStateText(state.name) === normalized,
    ) ?? null
  );
}

export function normalizeBrazilianStateCode(
  value: string | null | undefined,
) {
  return findBrazilianState(value)?.code ?? "";
}

export function brazilianStateName(value: string | null | undefined) {
  return findBrazilianState(value)?.name ?? "";
}

export const DEFAULT_BRAZIL_STATE =
  BRAZIL_STATES.find((state) => state.code === "MG")!;
