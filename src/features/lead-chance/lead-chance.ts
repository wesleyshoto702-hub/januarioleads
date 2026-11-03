export type LeadChanceInput = {
  website?: string | null | undefined;
  instagram?: string | null | undefined;
  instagramConfidence?: "high" | "medium" | "low" | null | undefined;
  phone?: string | null | undefined;
  internationalPhone?: string | null | undefined;
  rating?: number | null | undefined;
  reviewCount?: number | null | undefined;
  businessStatus?: string | null | undefined;
};

export type LeadChanceBand = "very-low" | "low" | "medium" | "high" | "very-high";

export type LeadChanceReason = {
  key: string;
  label: string;
  points: number;
};

export type LeadChanceResult = {
  score: number;
  band: LeadChanceBand;
  reasons: string[];
  breakdown: LeadChanceReason[];
};

export const LEAD_CHANCE_WEIGHTS = {
  base: 20,
  siteNotIdentified: 28,
  siteIdentified: -10,
  contactIdentified: 12,
  noPhoneContact: -18,
  instagramIdentified: 6,
  instagramWithoutSiteBonus: 8,
  reviews: {
    oneToNine: 1,
    tenToThirtyNine: 4,
    fortyToNinetyNine: 7,
    oneHundredPlus: 10,
  },
  ratingStrong: 2,
  ratingWeak: -2,
  operational: 5,
  temporarilyClosed: -12,
  permanentlyClosedCap: 7,
} as const;

/**
 * Reserved for future segment-specific calibration.
 * Keep empty while Chance is driven by real digital-presence signals.
 */
export const SEGMENT_CHANCE_ADJUSTMENTS: Record<string, number> = {};

function reviewPoints(reviewCount: number | null | undefined) {
  if (!reviewCount || reviewCount <= 0) return 0;
  if (reviewCount >= 100) return LEAD_CHANCE_WEIGHTS.reviews.oneHundredPlus;
  if (reviewCount >= 40) return LEAD_CHANCE_WEIGHTS.reviews.fortyToNinetyNine;
  if (reviewCount >= 10) return LEAD_CHANCE_WEIGHTS.reviews.tenToThirtyNine;
  return LEAD_CHANCE_WEIGHTS.reviews.oneToNine;
}

function chanceBand(score: number): LeadChanceBand {
  if (score <= 20) return "very-low";
  if (score <= 40) return "low";
  if (score <= 60) return "medium";
  if (score <= 80) return "high";
  return "very-high";
}

function clampScore(value: number) {
  return Math.min(100, Math.max(1, Math.round(value)));
}

function pushReason(breakdown: LeadChanceReason[], key: string, label: string, points: number) {
  breakdown.push({ key, label, points });
}

export function calculateLeadChance(
  business: LeadChanceInput,
  segment?: string | null,
): LeadChanceResult {
  const breakdown: LeadChanceReason[] = [];
  let score: number = LEAD_CHANCE_WEIGHTS.base;

  const hasSite = Boolean(business.website?.trim());
  const hasInstagram = Boolean(
    business.instagram?.trim() &&
    business.instagramConfidence !== "medium" &&
    business.instagramConfidence !== "low",
  );
  const hasPhone = Boolean(business.phone?.trim() || business.internationalPhone?.trim());
  const reviews =
    typeof business.reviewCount === "number" && business.reviewCount > 0 ? business.reviewCount : 0;

  if (hasSite) {
    score += LEAD_CHANCE_WEIGHTS.siteIdentified;
    pushReason(breakdown, "site", "Site identificado", LEAD_CHANCE_WEIGHTS.siteIdentified);
  } else {
    score += LEAD_CHANCE_WEIGHTS.siteNotIdentified;
    pushReason(breakdown, "site", "Site não identificado", LEAD_CHANCE_WEIGHTS.siteNotIdentified);
  }

  if (hasPhone) {
    score += LEAD_CHANCE_WEIGHTS.contactIdentified;
    pushReason(
      breakdown,
      "contact",
      "Telefone identificado",
      LEAD_CHANCE_WEIGHTS.contactIdentified,
    );
  } else {
    score += LEAD_CHANCE_WEIGHTS.noPhoneContact;
    pushReason(
      breakdown,
      "contact",
      "Telefone/WhatsApp não identificado",
      LEAD_CHANCE_WEIGHTS.noPhoneContact,
    );
  }

  if (hasInstagram) {
    score += LEAD_CHANCE_WEIGHTS.instagramIdentified;
    pushReason(
      breakdown,
      "instagram",
      "Instagram identificado",
      LEAD_CHANCE_WEIGHTS.instagramIdentified,
    );

    if (!hasSite) {
      score += LEAD_CHANCE_WEIGHTS.instagramWithoutSiteBonus;
      pushReason(
        breakdown,
        "instagram-no-site",
        "Instagram identificado + site não identificado",
        LEAD_CHANCE_WEIGHTS.instagramWithoutSiteBonus,
      );
    }
  }

  const reviewsScore = reviewPoints(reviews);
  if (reviewsScore > 0) {
    score += reviewsScore;
    pushReason(
      breakdown,
      "reviews",
      `${reviews} ${reviews === 1 ? "avaliação" : "avaliações"} no Google`,
      reviewsScore,
    );
  }

  if (reviews >= 10 && typeof business.rating === "number" && business.rating >= 4.2) {
    score += LEAD_CHANCE_WEIGHTS.ratingStrong;
    pushReason(
      breakdown,
      "rating",
      "Boa avaliação com volume mínimo de avaliações",
      LEAD_CHANCE_WEIGHTS.ratingStrong,
    );
  } else if (reviews >= 10 && typeof business.rating === "number" && business.rating < 3.5) {
    score += LEAD_CHANCE_WEIGHTS.ratingWeak;
    pushReason(breakdown, "rating", "Avaliação baixa no Google", LEAD_CHANCE_WEIGHTS.ratingWeak);
  }

  if (business.businessStatus === "OPERATIONAL") {
    score += LEAD_CHANCE_WEIGHTS.operational;
    pushReason(breakdown, "status", "Empresa operacional", LEAD_CHANCE_WEIGHTS.operational);
  } else if (business.businessStatus === "CLOSED_TEMPORARILY") {
    score += LEAD_CHANCE_WEIGHTS.temporarilyClosed;
    pushReason(
      breakdown,
      "status",
      "Empresa temporariamente fechada",
      LEAD_CHANCE_WEIGHTS.temporarilyClosed,
    );
  }

  const segmentAdjustment =
    segment && SEGMENT_CHANCE_ADJUSTMENTS[segment] ? SEGMENT_CHANCE_ADJUSTMENTS[segment] : 0;

  if (segmentAdjustment) {
    score += segmentAdjustment;
    pushReason(
      breakdown,
      "segment",
      `Ajuste configurado para o segmento ${segment}`,
      segmentAdjustment,
    );
  }

  if (business.businessStatus === "CLOSED_PERMANENTLY") {
    score = Math.min(score, LEAD_CHANCE_WEIGHTS.permanentlyClosedCap);
    pushReason(breakdown, "status", "Empresa permanentemente fechada", -100);
  }

  const finalScore = clampScore(score);
  const orderedReasons = [...breakdown]
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points))
    .slice(0, 5)
    .map((item) => item.label);

  return {
    score: finalScore,
    band: chanceBand(finalScore),
    reasons: orderedReasons,
    breakdown,
  };
}

export function hasEnoughDataForLeadChance(
  business: LeadChanceInput & {
    placeId?: string | null | undefined;
    enrichedAt?: string | null | undefined;
    source?: string | null | undefined;
  },
) {
  return Boolean(business.placeId || business.enrichedAt || business.source === "lavras-search");
}
