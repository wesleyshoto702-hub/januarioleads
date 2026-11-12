import type { BusinessSearchResult } from "../search-leads/types";

/**
 * Public-facing description is provider-neutral. License attribution remains
 * separately visible in BusinessSourceCredit in the same content container.
 * Do not expose Geoapify classification codes (commercial.*, service.*, etc.).
 */
function cleanCategory(value: string | null | undefined): string | null {
  const label = value?.trim() ?? "";
  if (!label || /[._]/.test(label)) return null;
  return label.slice(0, 100);
}

function cleanSentence(value: string) {
  return value.replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
}

function firstSentences(value: string, limit: number) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map(cleanSentence)
    .filter(Boolean)
    .slice(0, limit);
}

function locationLabel(business: BusinessSearchResult) {
  if (business.city && business.state) return `${business.city} - ${business.state}`;
  if (business.city) return business.city;
  if (business.state) return business.state;
  return null;
}

export function buildFactualBusinessDescription(
  business: BusinessSearchResult,
  selectedSegment?: string | null,
) {
  const parts: string[] = [];

  if (business.description?.trim()) {
    parts.push(...firstSentences(business.description, 2));
  } else {
    const category = cleanCategory(business.primaryCategory) ??
      cleanCategory(selectedSegment);
    const location = locationLabel(business);

    if (category && location) {
      parts.push(`Estabelecimento do segmento ${category} em ${location}`);
    } else if (category) {
      parts.push(`Estabelecimento do segmento ${category}`);
    } else if (location) {
      parts.push(`Estabelecimento localizado em ${location}`);
    }
  }

  if (parts.length < 4 && business.businessStatus === "OPERATIONAL") {
    parts.push("O estabelecimento está registrado como em funcionamento");
  } else if (parts.length < 4 && business.businessStatus === "CLOSED_TEMPORARILY") {
    parts.push("O estabelecimento está registrado como temporariamente fechado");
  } else if (parts.length < 4 && business.businessStatus === "CLOSED_PERMANENTLY") {
    parts.push("O estabelecimento está registrado como permanentemente fechado");
  }

  if (parts.length < 4 && business.openingHours.length > 0) {
    parts.push("Possui horários de funcionamento informados");
  }

  if (parts.length < 4 && business.rating !== null &&
      business.reviewCount !== null && business.reviewCount > 0) {
    parts.push(
      `Tem nota pública de ${business.rating.toFixed(1)} com ${business.reviewCount} ${business.reviewCount === 1 ? "avaliação" : "avaliações"}`,
    );
  }

  if (!parts.length) {
    return "As informações públicas disponíveis ainda não são suficientes para descrever esta empresa com segurança.";
  }

  return parts.slice(0, 4).map(part=>`${cleanSentence(part)}.`).join(" ");
}

/** Re-render previously generated legacy descriptions without provider
 * names or raw classification strings; never changes original CRM records.
 */
export function displayBusinessDescription(
  business: BusinessSearchResult,
  selectedSegment?: string | null,
): string {
  const saved = business.factualDescription;
  if (saved && !/\bgoogle\b|\bgeoapify\b|\bopenstreetmap\b|\b(?:commercial|service|healthcare|sport|catering|office|education)\.[a-z_]+/i.test(saved)) {
    return saved;
  }
  return buildFactualBusinessDescription(business, selectedSegment);
}
