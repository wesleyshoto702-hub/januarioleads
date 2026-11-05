/**
 * Keeps machine-generated synchronization failures from obscuring genuine
 * changes to a user's leads. Original records remain stored for audit.
 */
export function summarizeRecentLeadUpdates<T extends {
  changeType: string;
  createdAt: string;
}>(updates: readonly T[], maxItems: number) {
  const usefulUpdates: T[] = [];
  let syncErrorCount = 0;
  let lastSyncErrorAt: string | null = null;

  for (const update of updates) {
    if (update.changeType === "sync_error") {
      syncErrorCount += 1;
      if (!lastSyncErrorAt || update.createdAt > lastSyncErrorAt) {
        lastSyncErrorAt = update.createdAt;
      }
    } else if (usefulUpdates.length < maxItems) {
      usefulUpdates.push(update);
    }
  }

  return { usefulUpdates, syncErrorCount, lastSyncErrorAt };
}
