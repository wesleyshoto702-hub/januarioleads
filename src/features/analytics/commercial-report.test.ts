import { expect, test } from "bun:test";
import type { PersistedLead } from "../leads/remote-leads";
import type { LeadPayment } from "../lead-finance/finance";
import { buildCommercialReport } from "./commercial-report";

function lead(id: string, date: string, status: PersistedLead["status"], segment = "Restaurante", city = "Lavras"): PersistedLead {
  return { id, company: "Empresa " + id, segment, city, state: "MG", status, phone: "",
    notes: "", createdAt: date + "T12:00:00Z", firstContact: date };
}
function payment(id: string, date: string, amount: number): LeadPayment {
  return { id, leadId: "a", paymentDate: date, amount, paymentMethod: "pix",
    paymentMethodOther: null, notes: null, createdAt: date + "T12:00:00Z" };
}

test("cohort counts use registration date while payments use payment date", () => {
  const result = buildCommercialReport([
    lead("a", "2026-11-07", "waiting"),
    lead("b", "2026-11-01", "accepted"),
    lead("c", "2026-10-01", "rejected"),
  ], [payment("1", "2026-11-07", 150), payment("2", "2026-09-01", 90)], "30", "2026-11-07");
  expect(result.registered).toBe(2);
  expect(result.worked).toBe(2);
  expect(result.accepted).toBe(1);
  expect(result.acceptanceRate).toBe(50);
  expect(result.received).toBe(150);
  expect(result.paymentsCount).toBe(1);
  expect(result.bySegment[0]?.count).toBe(2);
  expect(result.byCity[0]?.name).toBe("Lavras / MG");
});

test("inclusive 30-day window excludes older entries and dates in the future", () => {
  const report = buildCommercialReport([
    lead("start", "2026-10-09", "send_message"),
    lead("before", "2026-10-08", "waiting"),
    lead("future", "2026-11-08", "accepted"),
  ], [payment("start", "2026-10-09", 10), payment("future", "2026-11-08", 500)],
    "30", "2026-11-07");
  expect(report.from).toBe("2026-10-09");
  expect(report.registered).toBe(1);
  expect(report.notContacted).toBe(1);
  expect(report.received).toBe(10);
  expect(report.acceptanceRate).toBeNull();
});

test("all-time report retains historic leads, groups top results, and avoids false conversions", () => {
  const result = buildCommercialReport([
    lead("x", "2025-01-01", "send_message", "Academia"),
    lead("y", "2026-03-02", "accepted", "Restaurante"),
    lead("z", "2026-03-02", "rejected", "Restaurante"),
  ], [], "all", "2026-11-07");
  expect(result.from).toBeNull();
  expect(result.registered).toBe(3);
  expect(result.acceptanceRate).toBe(50);
  expect(result.bySegment[0]?.name).toBe("Restaurante");
  expect(result.byStatus.reduce((total, status) => total + status.count, 0)).toBe(3);
});

test("reports tolerate invalid dates and ignore negative and non-finite payments", () => {
  const result = buildCommercialReport([
    lead("bad", "not-a-date", "accepted"),
  ], [payment("bad", "2026-11-01", -500), payment("ok", "2026-11-02", 45)],
    "90", "2026-11-07");
  expect(result.registered).toBe(0);
  expect(result.received).toBe(45);
});
