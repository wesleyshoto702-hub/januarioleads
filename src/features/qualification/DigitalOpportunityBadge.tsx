import {
  qualifyDigitalOpportunity,
  type DigitalOpportunityInput,
} from "./digital-opportunity";

/** Evidence-only prospect label. No made-up sales probability or WhatsApp verification. */
export function DigitalOpportunityBadge({
  business,
}: {
  business: DigitalOpportunityInput;
}) {
  const opportunity = qualifyDigitalOpportunity(business);
  return (
    <span
      className={`digital-opportunity-badge digital-opportunity--${opportunity.kind}`}
      title={opportunity.summary}
      aria-label={`Sinal comercial: ${opportunity.label}. ${opportunity.summary}`}
    >
      {opportunity.label}
    </span>
  );
}
