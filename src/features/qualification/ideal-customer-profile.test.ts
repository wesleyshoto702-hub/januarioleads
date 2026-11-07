import { expect, test } from "bun:test";
import { evaluateIdealCustomer, normalizeProfile } from "./ideal-customer-profile";
import type { PersistedLead } from "../leads/remote-leads";

const base: PersistedLead = {
  id: "a", company: "Restaurante Exemplo", segment: "Restaurante", phone: "35999999999",
  status: "send_message", firstContact: "2026-11-07", createdAt: "2026-11-07T10:00:00Z",
  notes: "", city: "Lavras", state: "MG", reviewCount: 32, businessStatus: "OPERATIONAL",
};

test("ICP prioritizes matching region, niche, and website needs with explicit reasons", () => {
  const score = evaluateIdealCustomer(base, { focus: "websites", segment: "restaurante", city: "Lávrás" });
  expect(score.score).toBeGreaterThan(80);
  expect(score.reasons).toContain("Site não identificado nos dados disponíveis");
  const mismatch = evaluateIdealCustomer({ ...base, website: "https://exemplo.com", city: "Belo Horizonte", segment: "Academia" },
    { focus: "websites", segment: "Restaurante", city: "Lavras" });
  expect(score.score).toBeGreaterThan(mismatch.score);
});
test("closed business never appears as a sales priority", () => {
  expect(evaluateIdealCustomer({ ...base, businessStatus: "CLOSED_PERMANENTLY" }, { focus: "general", city: "", segment: "" }).score).toBe(0);
});
test("invalid ICP configuration is normalized", () => {
  expect(normalizeProfile({ focus: "fake" as "websites", segment: "  comida  ", city: " Lavras " })).toEqual({
    focus: "general", segment: "comida", city: "Lavras",
  });
});
