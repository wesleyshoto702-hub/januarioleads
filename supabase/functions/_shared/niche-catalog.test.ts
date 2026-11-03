import {
  ALL_SEARCH_SEGMENTS,
  SEGMENT_GROUPS,
  resolveSearchSegment,
  searchSegmentMatchesQuery,
  searchTextForSegment,
} from "./niche-catalog.ts";
import { CURRENT_NICHE_COVERAGE } from "./niche-coverage.ts";
import { getNicheCoverageReport, resolveNicheStrategy } from "./niche-strategies.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("catalog has unique selectable niches in distinct groups", () => {
  assert(SEGMENT_GROUPS.length === 16, "Expected 16 organized groups");
  assert(ALL_SEARCH_SEGMENTS.length === 196, "Unexpected total of searchable niches");
  const normalize = (v: string) => v.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const unique = new Set(ALL_SEARCH_SEGMENTS.map(normalize));
  assert(unique.size === ALL_SEARCH_SEGMENTS.length, "Duplicate canonical niche");
  assert(SEGMENT_GROUPS.every((g) => g.label && g.items.length > 0), "Empty category");
});

Deno.test("removed duplications remain usable as legacy search aliases", () => {
  const cases: Array<[string, string]> = [
    ["Dentista", "Clínica Odontológica"],
    ["Odontologia", "Clínica Odontológica"],
    ["Hamburgueria Artesanal", "Hamburgueria"],
    ["Restaurante de Bairro", "Restaurante"],
    ["Barbeiro Especializado", "Barbearia"],
    ["Assistência Técnica Automotiva", "Mecânica Automotiva"],
    ["Instalador de Painel Solar", "Energia Solar"],
  ];
  for (const [alias, canonical] of cases) {
    assert(!ALL_SEARCH_SEGMENTS.includes(alias), `Duplicate label visible: ${alias}`);
    assert(resolveSearchSegment(alias) === canonical, `Alias mismatch: ${alias}`);
    assert(searchSegmentMatchesQuery(canonical, alias), `Alias not searchable: ${alias}`);
  }
});

Deno.test("specialties that differ commercially remain independent", () => {
  for (const [left, right] of [
    ["Restaurante Fine Dining", "Restaurante"],
    ["Buffet Infantil", "Buffet"],
    ["Clínica Veterinária", "Pet Shop"],
    ["Academia de Artes Marciais", "Academia"],
    ["Clínica de Pilates", "Clínica Médica"],
    ["Hotel Fazenda", "Hotel"],
    ["Fotografia de Eventos", "Fotógrafo"],
  ]) {
    assert(ALL_SEARCH_SEGMENTS.includes(left), `Missing ${left}`);
    assert(ALL_SEARCH_SEGMENTS.includes(right), `Missing ${right}`);
    assert(resolveSearchSegment(left) !== resolveSearchSegment(right), "Specialty collapsed");
  }
});

Deno.test("new industries have full mapping, not generic fallback", () => {
  const expected = [
    "Construtora", "Arquiteto / Escritório de Arquitetura",
    "Pousada", "Hotel Fazenda", "Clínica de Imagem",
    "Psiquiatra", "Clínica de Pilates", "Empresa de Recrutamento",
    "Desenvolvimento de Software", "Loja de Pneus",
    "Escola de Robótica", "Hotel para Pets",
    "Cerimonialista", "Loja Agropecuária", "Consultoria Agrícola",
    "Móveis Planejados", "Energia Solar",
  ];
  const mapped = new Map(CURRENT_NICHE_COVERAGE.map((row) => [row.segment, row]));
  for (const segment of expected) {
    const item = mapped.get(segment);
    assert(item !== undefined, `New niche lacks coverage: ${segment}`);
    assert(item.family !== "generic_local_business", `Missing family: ${segment}`);
    assert(resolveNicheStrategy({ segment }).nicheKey === item.nicheKey,
      `Strategy does not resolve ${segment}`);
  }
  const report = getNicheCoverageReport();
  assert(report.total === ALL_SEARCH_SEGMENTS.length, "Coverage total out of sync");
  assert(report.covered === report.total && report.coveragePercent === 100,
    "Some selectable niches have no mapped commercial strategy");
});

Deno.test("Places queries use canonical names and natural language", () => {
  assert(searchTextForSegment("Odontologia") === "Clínica Odontológica",
    "Historical query should resolve to clinic");
  assert(searchTextForSegment("Arquiteto / Escritório de Arquitetura") ===
    "escritório de arquitetura", "Architecture query should not contain slash");
  assert(searchTextForSegment("nicho inexistente") === null,
    "Unknown niche should not be accepted");
});
