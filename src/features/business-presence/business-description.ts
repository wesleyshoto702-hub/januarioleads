import type { BusinessSearchResult } from "../search-leads/types";

function formatGoogleType(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
) {
  const parts: string[] = [];

  if (business.description?.trim()) {
    parts.push(...firstSentences(business.description, 2));
  } else {
    const category =
      business.primaryCategory?.trim() ||
      business.categories
        .map(formatGoogleType)
        .find((item) => item.trim().length > 0) ||
      null;
    const location = locationLabel(business);

    if (category && location) {
      parts.push(
        `Estabelecimento em ${location}, classificado no Google como ${category}`,
      );
    } else if (category) {
      parts.push(`Estabelecimento classificado no Google como ${category}`);
    } else if (location) {
      parts.push(`Estabelecimento localizado em ${location}`);
    }

    const ignoredCategories = new Set(["Establishment", "Point Of Interest"]);
    const related = business.categories
      .map(formatGoogleType)
      .filter((item) => !ignoredCategories.has(item))
      .filter(
        (item, index, array) =>
          item &&
          array.indexOf(item) === index &&
          item.toLocaleLowerCase("pt-BR") !==
            business.primaryCategory?.toLocaleLowerCase("pt-BR"),
      )
      .slice(0, 2);

    if (related.length > 0) {
      parts.push(
        `Também aparece no Google nas categorias ${related.join(" e ")}`,
      );
    }
  }

  if (parts.length < 4 && business.businessStatus === "OPERATIONAL") {
    parts.push("O Google indica que o estabelecimento está em funcionamento");
  } else if (
    parts.length < 4 &&
    business.businessStatus === "CLOSED_TEMPORARILY"
  ) {
    parts.push("O Google indica que o estabelecimento está temporariamente fechado");
  } else if (
    parts.length < 4 &&
    business.businessStatus === "CLOSED_PERMANENTLY"
  ) {
    parts.push("O Google indica que o estabelecimento está permanentemente fechado");
  }

  if (parts.length < 4 && business.openingHours.length > 0) {
    parts.push("Possui horários de funcionamento cadastrados no Google");
  }

  if (
    parts.length < 4 &&
    business.rating !== null &&
    business.reviewCount !== null &&
    business.reviewCount > 0
  ) {
    parts.push(
      `No Google, possui nota ${business.rating.toFixed(1)} com ${business.reviewCount} ${business.reviewCount === 1 ? "avaliação" : "avaliações"}`,
    );
  }

  if (parts.length === 0) {
    return "As informações públicas disponíveis ainda não são suficientes para descrever esta empresa com segurança.";
  }

  return parts
    .slice(0, 4)
    .map((part) => `${cleanSentence(part)}.`)
    .join(" ");
}
