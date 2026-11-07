import { expect, test } from "bun:test";
import { buildProspectingInsights } from "./prospecting-insights";
import type { PersistedLead } from "../leads/remote-leads";
const profile = { focus: "general" as const, segment: "", city: "" };
function lead(id: string, status: PersistedLead["status"], createdAt: string): PersistedLead {
  return { id, company: "Empresa " + id, segment: "Restaurante", phone: "",
    status, firstContact: "2026-10-01", createdAt, notes: "" };
}
test("weekly trend counts registrations by createdAt without inventing historical conversion", () => {
  const result = buildProspectingInsights([
    lead("a", "accepted", "2026-11-07T10:00:00Z"),
    lead("b", "send_message", "2026-11-07T10:00:00Z"),
    lead("c", "waiting", "2026-08-01T10:00:00Z"),
  ], profile, "2026-11-07");
  expect(result.trend).toHaveLength(8);
  expect(result.trend[7]!.count).toBe(2);
  expect(result.trend[7]!.accepted).toBe(1);
  expect(result.topSegments[0]!.total).toBe(3);
  expect(result.topSegments[0]!.accepted).toBe(1);
  expect(result.due.unplanned).toBe(1);
});
test("priority excludes won/lost leads and weekly boundaries are non-overlapping", () => {
  const result = buildProspectingInsights([lead("a", "accepted", "2026-11-07T10:00:00Z")], profile, "2026-11-07");
  expect(result.highPriority).toBe(0);
  for (let i = 1; i < result.trend.length; i++) {
    expect(result.trend[i]!.start > result.trend[i - 1]!.end).toBe(true);
  }
});
