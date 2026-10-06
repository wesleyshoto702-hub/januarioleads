export const WITHOUT_SITE_RATE_WEIGHT = 35;
export const WITHOUT_SITE_VOLUME_WEIGHT = 20;
export const CONTACTABILITY_WEIGHT = 25;
export const ACTIVITY_WEIGHT = 10;
export const SAMPLE_WEIGHT = 10;
export const WITHOUT_SITE_VOLUME_TARGET = 30;
export const OPPORTUNITY_STALE_AFTER_DAYS = 30;

export type OpportunityLevel = "low" | "moderate" | "high" | "very_high";
export type SampleConfidence = "insufficient" | "low" | "medium" | "good";

export type OpportunityStatsInput = {
  sampleSize: number;
  withoutSiteCount: number;
  withoutSiteWithPhoneCount: number;
  activeWithoutSiteCount: number;
};

export type OpportunityScoreResult = {
  score: number;
  level: OpportunityLevel;
  sampleConfidence: SampleConfidence;
  reasons: string[];
};

function ratio(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, value / total));
}

export function sampleConfidenceForSize(sampleSize: number): SampleConfidence {
  if (sampleSize <= 4) return "insufficient";
  if (sampleSize <= 9) return "low";
  if (sampleSize <= 19) return "medium";
  return "good";
}

export function opportunityLevelForScore(score: number): OpportunityLevel {
  if (score <= 39) return "low";
  if (score <= 59) return "moderate";
  if (score <= 79) return "high";
  return "very_high";
}

function confidenceCap(confidence: SampleConfidence) {
  if (confidence === "insufficient") return 39;
  if (confidence === "low") return 59;
  if (confidence === "medium") return 79;
  return 100;
}

export function calculateOpportunityScore(
  stats: OpportunityStatsInput,
): OpportunityScoreResult {
  const sampleSize = Math.max(0, stats.sampleSize);
  const withoutSiteCount = Math.max(0, stats.withoutSiteCount);
  const withoutSiteRateComponent = ratio(withoutSiteCount, sampleSize);
  const volumeComponent = Math.min(
    withoutSiteCount / WITHOUT_SITE_VOLUME_TARGET,
    1,
  );
  const contactabilityComponent = ratio(
    stats.withoutSiteWithPhoneCount,
    withoutSiteCount,
  );
  const activityComponent = ratio(
    stats.activeWithoutSiteCount,
    withoutSiteCount,
  );
  const sampleComponent = Math.min(sampleSize / 20, 1);

  const raw =
    WITHOUT_SITE_RATE_WEIGHT * withoutSiteRateComponent +
    WITHOUT_SITE_VOLUME_WEIGHT * volumeComponent +
    CONTACTABILITY_WEIGHT * contactabilityComponent +
    ACTIVITY_WEIGHT * activityComponent +
    SAMPLE_WEIGHT * sampleComponent;

  const sampleConfidence = sampleConfidenceForSize(sampleSize);
  const score = Math.min(
    confidenceCap(sampleConfidence),
    Math.max(0, Math.min(100, Math.round(raw))),
  );
  const withoutSiteRate = Math.round(withoutSiteRateComponent * 100);

  const reasons = [
    `${withoutSiteRate}% das empresas analisadas estão sem site identificado.`,
    `${Math.max(0, stats.withoutSiteWithPhoneCount)} empresas sem site identificado possuem telefone.`,
    `${Math.max(0, stats.activeWithoutSiteCount)} empresas sem site identificado apresentam sinais de atividade.`,
    `A amostra possui ${sampleSize} empresas.`,
    `Amostra considerada ${sampleConfidence === "insufficient" ? "insuficiente" : sampleConfidence === "low" ? "baixa" : sampleConfidence === "medium" ? "média" : "boa"}.`,
  ];

  return {
    score,
    level: opportunityLevelForScore(score),
    sampleConfidence,
    reasons,
  };
}

export function dedupeByPlaceId<T extends { placeId: string }>(items: T[]) {
  const unique = new Map<string, T>();
  for (const item of items) {
    if (!item.placeId) continue;
    if (!unique.has(item.placeId)) unique.set(item.placeId, item);
  }
  return Array.from(unique.values());
}
