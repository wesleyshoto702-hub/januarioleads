import { expect, test } from "bun:test";
import { buildDailyProspectingQueue } from "./daily-queue";
import type { PersistedLead } from "../leads/remote-leads";

function lead(id: string, status: PersistedLead["status"], date?: string): PersistedLead {
  return { id, status, company: "Empresa " + id, segment: "Serviços", phone: "",
    createdAt: "2026-11-01T00:00:00Z", firstContact: "2026-10-30", notes: "",
    ...(date ? { nextActionType: "follow_up", nextActionDate: date } : {}),
  };
}

test("daily queue prioritizes overdue, then today, then unplanned prospecting", () => {
  const entries = buildDailyProspectingQueue([
    lead("new", "send_message"), lead("today", "waiting", "2026-11-07"),
    lead("late", "waiting", "2026-11-04"), lead("won", "accepted", "2026-11-01"),
  ], "2026-11-07");
  expect(entries.map((item) => item.lead.id)).toEqual(["late", "today", "new"]);
  expect(entries.map((item) => item.category)).toEqual(["overdue", "today", "suggested"]);
});
test("future actions are excluded and completed deals never leak into the daily queue", () => {
  expect(buildDailyProspectingQueue([
    lead("future", "waiting", "2026-11-12"), lead("lost", "rejected", "2026-11-01"),
  ], "2026-11-07")).toEqual([]);
});
