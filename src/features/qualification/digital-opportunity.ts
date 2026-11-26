import { hasUsableBusinessEmail } from "../search-leads/business-contact.ts";

export type DigitalOpportunityKind =
  | "website-prospect"
  | "contact-research"
  | "channel-review"
  | "multichannel";

export type DigitalOpportunityInput = {
  website?: string | null | undefined;
  phone?: string | null | undefined;
  internationalPhone?: string | null | undefined;
  email?: string | null | undefined;
  instagram?: string | null | undefined;
  instagramConfidence?: "high" | "medium" | "low" | null | undefined;
  instagramNeedsReview?: boolean | null | undefined;
  instagramCandidates?: readonly unknown[] | null | undefined;
};

export type DigitalOpportunity = {
  kind: DigitalOpportunityKind;
  label: string;
  summary: string;
  signals: readonly string[];
};

/**
 * Transparency-first commercial grouping. Not a sales probability or proof of
 * site/WhatsApp absence. Directory fields and possible Instagram candidates
 * are unverified until checked by a person or official website.
 */
export function qualifyDigitalOpportunity(business: DigitalOpportunityInput): DigitalOpportunity {
  const siteIdentified = Boolean(business.website?.trim());
  const phoneDigits = (business.phone || business.internationalPhone || "").replace(/\D/g, "");
  const phoneIdentified = phoneDigits.length >= 10 && phoneDigits.length <= 13;
  const emailIdentified = hasUsableBusinessEmail(business.email);
  const confirmedInstagram = Boolean(
    business.instagram?.trim() &&
    business.instagramConfidence === "high" &&
    !business.instagramNeedsReview
  );
  const potentialInstagram = !confirmedInstagram && Boolean(business.instagram?.trim() || business.instagramCandidates?.length);
  const signals: string[] = [];
  signals.push(siteIdentified ? "Site informado pela fonte" : "Site não identificado nesta fonte");
  if (phoneIdentified) signals.push("Telefone disponível (WhatsApp não confirmado)");
  if (emailIdentified) signals.push("E-mail disponível (não verificado)");
  if (confirmedInstagram) signals.push("Instagram identificado");
  else if (potentialInstagram) signals.push("Possível Instagram para conferência");

  if (!siteIdentified && (phoneIdentified || emailIdentified)) {
    return {
      kind: "website-prospect",
      label: "Potencial para site",
      summary: "Não encontramos site nesta fonte e há um canal de contato para prospecção. Verifique antes de oferecer um serviço.",
      signals,
    };
  }
  if (!siteIdentified) {
    return {
      kind: "contact-research",
      label: "Contato a investigar",
      summary: "Site e contato direto não identificados nesta fonte. Pesquise antes de abordar.",
      signals,
    };
  }
  if (confirmedInstagram && (phoneIdentified || emailIdentified)) {
    return {
      kind: "multichannel",
      label: "Presença digital identificada",
      summary: "Site, Instagram e contato aparecem nos dados. Confirme se os canais pertencem à empresa.",
      signals,
    };
  }
  return {
    kind: "channel-review",
    label: "Canais a revisar",
    summary: "Há um site informado, mas pode haver oportunidades de melhorar os canais de contato. Não pressupõe necessidade de novo site.",
    signals,
  };
}
