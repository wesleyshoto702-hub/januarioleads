import { expect, test } from "bun:test";
import { exportManualLeadsCsv, parseManualLeadCsv } from "./manual-leads-csv";
import type { PersistedLead } from "./remote-leads";

const base: PersistedLead = {
  id: "a", company: "Minha Empresa", segment: "Restaurante", city: "Lavras", state: "MG",
  phone: "35999999999", status: "waiting", notes: "=HYPERLINK(\"bad\")", source: "manual",
  firstContact: "2026-11-07", createdAt: "2026-11-07T09:00:00Z",
};
test("quoted multiline CSV and semicolon separators are parsed correctly", () => {
  const input = "\uFEFFempresa;segmento;telefone;cidade;uf;status;observacoes\r\n" +
    '"Novo Cliente";"Barbearia";"35922222222";"Lavras";"MG";"waiting";"linha 1\nlinha 2"\r\n';
  const out = parseManualLeadCsv(input, []);
  expect(out.rows).toHaveLength(1);
  expect(out.rows[0]!.notes).toBe("linha 1\nlinha 2");
});
test("deduplicates against existing leads and validates municipality/state fields", () => {
  const input = "empresa,segmento,telefone,cidade,uf,status,observacoes\n"+
    "Minha Empresa,Restaurante,35999999999,Lavras,MG,waiting,Teste\n"+
    "Empresa B,Oficina,35998882222,Lavras,ZZ,waiting,Teste\n";
  const out = parseManualLeadCsv(input, [base]);
  expect(out.duplicates).toBe(1);
  expect(out.errors).toHaveLength(1);
  expect(out.rows).toHaveLength(0);
});
test("export never includes Google Places records and shields spreadsheet formulas", () => {
  const exported = exportManualLeadsCsv([base,
    { ...base, id: "places", source: "places-search", company: "Google Place", placeId: "123" },
    { ...base, id: "enriched", company: "Enriched", enrichedAt: "2026-11-07" },
  ]);
  expect(exported.count).toBe(1);
  expect(exported.csv).not.toContain("Google Place");
  expect(exported.csv).not.toContain("Enriched");
  expect(exported.csv).toContain("'=HYPERLINK");
});
