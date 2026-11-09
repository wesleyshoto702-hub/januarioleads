import { BRAZIL_STATES, normalizeBrazilianStateCode } from "../../lib/brazil-locations";
import { normalizeLocationText } from "../../lib/location";
import { normalizeSearchText, resolveSearchSegment } from "./segments";
import type { ExistingLeadIdentity } from "./identity";

export type ProspectingMetrics = {
  total: number;
  touched: number;
  waiting: number;
  accepted: number;
  rejected: number;
  pending: number;
  touchedPercent: number;
  waitingPercent: number;
  acceptedPercent: number;
  rejectedPercent: number;
};

export type ProspectingRegion = {
  key: string;
  name: string;
  metrics: ProspectingMetrics;
  children: ProspectingRegion[];
};

export type ProspectingHierarchy = {
  metrics: ProspectingMetrics;
  states: ProspectingRegion[];
};

type MutableNode = {
  key: string;
  name: string;
  counts: Omit<ProspectingMetrics,
    "touchedPercent" | "waitingPercent" | "acceptedPercent" | "rejectedPercent">;
  children: Map<string, MutableNode>;
};

function newNode(key: string, name: string): MutableNode {
  return {
    key, name,
    counts: { total: 0, touched: 0, waiting: 0, accepted: 0, rejected: 0, pending: 0 },
    children: new Map(),
  };
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : Math.round(1000 * part / total) / 10;
}

function metrics(node: MutableNode): ProspectingMetrics {
  return {
    ...node.counts,
    touchedPercent: percentage(node.counts.touched, node.counts.total),
    waitingPercent: percentage(node.counts.waiting, node.counts.total),
    acceptedPercent: percentage(node.counts.accepted, node.counts.total),
    rejectedPercent: percentage(node.counts.rejected, node.counts.total),
  };
}

function count(node: MutableNode, lead: ExistingLeadIdentity, touched: boolean) {
  node.counts.total++;
  if (touched) node.counts.touched++;
  if (lead.status === "waiting") node.counts.waiting++;
  else if (lead.status === "accepted") node.counts.accepted++;
  else if (lead.status === "rejected") node.counts.rejected++;
  else node.counts.pending++;
}

function child(node: MutableNode, key: string, name: string): MutableNode {
  let value = node.children.get(key);
  if (!value) {
    value = newNode(key, name);
    node.children.set(key, value);
  }
  return value;
}

function normalizedNiche(value: string | null | undefined): string {
  const valueText = (value ?? "").trim();
  return normalizeSearchText(resolveSearchSegment(valueText) ?? valueText);
}

function finalRegion(node: MutableNode): ProspectingRegion {
  return {
    key: node.key,
    name: node.name,
    metrics: metrics(node),
    children: [...node.children.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map(finalRegion),
  };
}

/**
 * Aggregates the CURRENT saved CRM by UF → city → neighborhood.
 *
 * The denominator is the user's saved leads, not all businesses in Brazil.
 * Each saved lead contributes at most once per level. A "Mandar mensagem"
 * click is an initiated contact, never a claim that WhatsApp sent anything.
 * Status percentages are computed independently from current lead statuses.
 *
 * Removing a lead changes both numerator and denominator immediately.
 * Deleting an uncontacted lead can increase the rate; we do not fake a drop.
 */
export function buildProspectingHierarchy(
  leads: readonly ExistingLeadIdentity[],
  touchedLeadIds: ReadonlySet<string>,
  selectedNiche?: string,
): ProspectingHierarchy {
  const root = newNode("BR", "Brasil");
  const filterNiche = normalizedNiche(selectedNiche);
  const stateNames = new Map<string, string>(BRAZIL_STATES.map((s): [string, string] => [s.code, s.name]));
  const processed = new Set<string>();
  for (const lead of leads) {
    if (filterNiche && normalizedNiche(lead.segment) !== filterNiche) continue;
    const leadKey = lead.id ?? [
      normalizeLocationText(lead.company),
      normalizeLocationText(lead.address),
      normalizeLocationText(lead.city),
      normalizeBrazilianStateCode(lead.state),
    ].join("|");
    if (processed.has(leadKey)) continue;
    processed.add(leadKey);

    const stateCode = normalizeBrazilianStateCode(lead.state) || "UF?";
    const stateNode = child(
      root,
      stateCode,
      stateNames.get(stateCode) ?? "UF não informada",
    );
    const cityName = lead.city?.trim() || "Cidade não informada";
    const cityNode = child(stateNode, normalizeLocationText(cityName), cityName);
    const neighborhoodName = lead.neighborhood?.trim() || "Bairro não informado";
    const neighborhoodNode = child(cityNode, normalizeLocationText(neighborhoodName), neighborhoodName);
    const touched = Boolean(lead.id && touchedLeadIds.has(lead.id));

    for (const node of [root, stateNode, cityNode, neighborhoodNode]) {
      count(node, lead, touched);
    }
  }
  return {
    metrics: metrics(root),
    states: [...root.children.values()]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map(finalRegion),
  };
}
