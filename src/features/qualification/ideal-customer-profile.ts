import type { PersistedLead } from "../leads/remote-leads";
import { accountLocalStorage } from "../../lib/account-storage";

export type ProspectingFocus = "websites" | "social" | "general";
export type IdealCustomerProfile = {
  focus: ProspectingFocus;
  segment: string;
  city: string;
};
export const ICP_STORAGE_KEY = "januarioleads:ideal-customer:v1";
export const DEFAULT_ICP: IdealCustomerProfile = { focus: "general", segment: "", city: "" };

function simplify(value: string | undefined | null) {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLocaleLowerCase("pt-BR");
}

export function normalizeProfile(value: Partial<IdealCustomerProfile>): IdealCustomerProfile {
  return {
    focus: value.focus === "websites" || value.focus === "social" ? value.focus : "general",
    segment: typeof value.segment === "string" ? value.segment.trim().slice(0, 80) : "",
    city: typeof value.city === "string" ? value.city.trim().slice(0, 80) : "",
  };
}

export function loadIdealCustomerProfile(): IdealCustomerProfile {
  try {
    const saved = accountLocalStorage.getItem(ICP_STORAGE_KEY);
    return saved ? normalizeProfile(JSON.parse(saved) as Partial<IdealCustomerProfile>) : DEFAULT_ICP;
  } catch {
    return DEFAULT_ICP;
  }
}

export function saveIdealCustomerProfile(value: IdealCustomerProfile): IdealCustomerProfile {
  const profile = normalizeProfile(value);
  accountLocalStorage.setItem(ICP_STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

export type ProspectingPriority = {
  score: number;
  reasons: string[];
};

/**
 * Transparent *heuristic* prioritization, not a prediction of sales or
 * verified purchasing intent. Based only on existing CRM attributes.
 */
export function evaluateIdealCustomer(
  lead: PersistedLead,
  profile: IdealCustomerProfile,
): ProspectingPriority {
  const reasons: string[] = [];
  let score = 30;
  const targetSegment = simplify(profile.segment);
  const targetCity = simplify(profile.city);

  if (targetSegment) {
    if (simplify(lead.segment).includes(targetSegment)) {
      score += 24;
      reasons.push("Segmento alinhado ao perfil");
    } else {
      score -= 10;
    }
  }
  if (targetCity) {
    if (simplify(lead.city) === targetCity) {
      score += 18;
      reasons.push("Cidade alinhada ao perfil");
    } else {
      score -= 7;
    }
  }
  if ((lead.phone || lead.internationalPhone)?.trim()) {
    score += 12;
    reasons.push("Telefone identificado");
  }
  if (profile.focus === "websites" && !lead.website?.trim()) {
    score += 20;
    reasons.push("Site não identificado nos dados disponíveis");
  }
  if (profile.focus === "social" && !lead.instagram?.trim()) {
    score += 15;
    reasons.push("Instagram não identificado nos dados disponíveis");
  }
  if (profile.focus === "general" && lead.website?.trim()) {
    score += 5;
    reasons.push("Site identificado");
  }
  if ((lead.reviewCount ?? 0) >= 10) {
    score += 7;
    reasons.push("Empresa com avaliações públicas");
  }
  if (lead.businessStatus === "OPERATIONAL") {
    score += 5;
    reasons.push("Consta como em operação");
  }
  if (lead.businessStatus === "CLOSED_PERMANENTLY") {
    return { score: 0, reasons: ["Empresa registrada como permanentemente fechada"] };
  }
  return { score: Math.min(100, Math.max(0, score)), reasons };
}
