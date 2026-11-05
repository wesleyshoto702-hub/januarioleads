import { summarizeRecentLeadUpdates } from "./lead-update-display.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("repeated synchronization failures are grouped without discarding real updates", () => {
  const updates = [
    { id: 5, changeType: "sync_error", createdAt: "2026-11-05T16:02:00Z" },
    { id: 4, changeType: "sync_error", createdAt: "2026-11-05T16:01:00Z" },
    { id: 3, changeType: "phone", createdAt: "2026-11-05T14:00:00Z" },
    { id: 2, changeType: "sync_error", createdAt: "2026-11-05T08:01:00Z" },
    { id: 1, changeType: "business_status", createdAt: "2026-11-04T17:00:00Z" },
  ];

  const result = summarizeRecentLeadUpdates(updates, 6);
  assert(result.syncErrorCount === 3, "Expected three grouped error notices");
  assert(result.lastSyncErrorAt === updates[0].createdAt, "Must preserve most recent error timestamp");
  assert(result.usefulUpdates.map((item) => item.id).join(",") === "3,1",
    "Must retain real CRM changes in order");
  assert(updates.length === 5, "Grouping must not mutate or remove audit records");
});

Deno.test("most recent real changes respect the display limit", () => {
  const updates = [
    { changeType: "sync_error", createdAt: "2026-11-05T16:00:00Z" },
    { changeType: "phone", createdAt: "2026-11-05T15:00:00Z" },
    { changeType: "rating", createdAt: "2026-11-05T14:00:00Z" },
    { changeType: "site_identified", createdAt: "2026-11-05T13:00:00Z" },
  ];
  const result = summarizeRecentLeadUpdates(updates, 2);
  assert(result.usefulUpdates.length === 2, "The list should remain limited");
  assert(result.usefulUpdates[0].changeType === "phone", "Newest real change should appear first");
  assert(result.usefulUpdates[1].changeType === "rating", "Second real change should appear next");
});

Deno.test("empty and all-error batches remain distinguishable", () => {
  const empty = summarizeRecentLeadUpdates([], 6);
  assert(empty.syncErrorCount === 0 && empty.usefulUpdates.length === 0, "Empty input stays empty");
  const errors = summarizeRecentLeadUpdates(
    [{ changeType: "sync_error", createdAt: "2026-11-05T16:00:00Z" }], 6
  );
  assert(errors.syncErrorCount === 1 && errors.usefulUpdates.length === 0,
    "Error-only batch must show a group, not falsely claim no activity");
});
