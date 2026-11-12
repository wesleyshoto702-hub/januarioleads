import { leadNicheEmoji } from "./lead-niche-emoji";

export function LeadNicheIcon({
  segment,
  compact = false,
}: {
  segment: string | null | undefined;
  compact?: boolean;
}) {
  return (
    <span
      className={"jl-lead-niche-icon" + (compact ? " jl-lead-niche-icon--compact" : "")}
      role="img"
      aria-label={"Ícone do nicho: " + (segment?.trim() || "não informado")}
      title={segment?.trim() || "Nicho não informado"}
    >
      {leadNicheEmoji(segment)}
    </span>
  );
}
