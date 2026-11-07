import type { LeadStatus, PersistedLead } from "./remote-leads";
import { normalizeBrazilianStateCode } from "../../lib/brazil-locations";

export type ManualLeadCsvRow = {
  company: string;
  segment: string;
  city: string;
  state: string;
  phone: string;
  status: LeadStatus;
  notes: string;
};
export type CsvPreview = { rows: ManualLeadCsvRow[]; errors: string[]; duplicates: number };
const MAX_ROWS = 100;
const HEADERS = ["empresa", "segmento", "telefone", "cidade", "uf", "status", "observacoes"] as const;
const STATES: Record<string, LeadStatus> = {
  send_message: "send_message", "enviar mensagem": "send_message",
  waiting: "waiting", aguardando: "waiting",
  accepted: "accepted", aceito: "accepted",
  rejected: "rejected", recusado: "rejected",
};
function clean(value: string) {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}
export function leadIdentity(value: { company: string; city?: string | undefined; state?: string | undefined }) {
  return [clean(value.company), clean(value.city), normalizeBrazilianStateCode(value.state)].join("|");
}
function parseCells(source: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;
  let starting = true;
  const header = source.split(/\r?\n/, 1)[0] ?? "";
  const sep = (header.match(/;/g)?.length ?? 0) > (header.match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; }
      else if (starting || quoted) quoted = !quoted;
      else throw new Error("Aspas inválidas em uma coluna CSV.");
    } else if (!quoted && ch === sep) {
      row.push(cell); cell = ""; starting = true;
    } else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = []; cell = ""; starting = true;
    } else {
      cell += ch; starting = false;
    }
    if (rows.length > MAX_ROWS + 1) throw new Error("O arquivo ultrapassa o limite de 100 contatos por importação.");
  }
  if (quoted) throw new Error("O CSV contém aspas não fechadas.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

/** CSV contains only user-supplied fields; no Places-derived enrichment. */
export function parseManualLeadCsv(source: string, existing: PersistedLead[]): CsvPreview {
  if (source.length > 500_000) throw new Error("Arquivo muito grande (máximo 500 KB).");
  const lines = parseCells(source.replace(/^\uFEFF/, ""));
  if (!lines.length) throw new Error("O CSV está vazio.");
  const header = lines[0]!.map(clean);
  const field = (name: string) => header.indexOf(name);
  if (!HEADERS.every((key) => field(key) >= 0)) {
    throw new Error("Colunas obrigatórias: " + HEADERS.join(", ") + ". Baixe o modelo.");
  }
  if (lines.length - 1 > MAX_ROWS) throw new Error("Importe no máximo 100 contatos por arquivo.");
  const seen = new Set(existing.map((item) => leadIdentity(item)));
  const rows: ManualLeadCsvRow[] = [];
  const errors: string[] = [];
  let duplicates = 0;
  for (const [idx, columns] of lines.slice(1).entries()) {
    const col = (name: string) => (columns[field(name)] ?? "").trim();
    const company = col("empresa").slice(0, 180);
    const segment = col("segmento").slice(0, 100);
    const city = col("cidade").slice(0, 120);
    const state = normalizeBrazilianStateCode(col("uf"));
    const phone = col("telefone").slice(0, 60);
    const notes = col("observacoes").slice(0, 2000);
    const rawStatus = clean(col("status"));
    const status = STATES[rawStatus || "send_message"];
    if (!company || !segment || !city || !state || !status) {
      errors.push("Linha " + (idx + 2) + ": empresa, segmento, cidade, UF ou status inválido.");
      continue;
    }
    const row: ManualLeadCsvRow = { company, segment, city, state, phone, status, notes };
    const key = leadIdentity(row);
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    rows.push(row);
  }
  return { rows, errors, duplicates };
}

function safeCell(value: string) {
  // Spreadsheet formula-injection protection for Excel/Sheets, including
  // leading whitespace and CR/LF control characters.
  const sanitized = /^[\s\u0000-\u001f]*[=+\-@]/.test(value) ? "'" + value : value;
  return '"' + sanitized.replace(/"/g, '""') + '"';
}

function csvLines(rows: string[][]) {
  return "\uFEFF" + rows.map((row) => row.map(safeCell).join(";")).join("\r\n") + "\r\n";
}
export function manualLeadsCsvTemplate() {
  return csvLines([Array.from(HEADERS), ["Empresa Exemplo", "Restaurante", "35999999999", "Lavras", "MG", "send_message", "Contato próprio"]]);
}
export function exportManualLeadsCsv(leads: PersistedLead[]) {
  // Places content must NOT be exported. Even a manual lead may have been
  // enriched later; exclude anything with Places ID or enrichment metadata.
  const own = leads.filter((lead) =>
    lead.source === "manual" && !lead.placeId && !lead.enrichedAt && !lead.deepEnrichmentCheckedAt
  );
  const records = own.map((lead) => [
    lead.company, lead.segment, lead.phone, lead.city ?? "", lead.state ?? "", lead.status, lead.notes,
  ]);
  return { csv: csvLines([Array.from(HEADERS), ...records]), count: records.length };
}
