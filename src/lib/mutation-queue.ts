export type PendingMutation<T> = { revision: string; id: string; lead: T | null };
/** Acknowledge exact revisions only; an edit made during a request stays queued. */
export async function drainMutations<T>(options: {
  read: () => PendingMutation<T>[];
  write: (rows: PendingMutation<T>[]) => void;
  sameOwner: () => Promise<boolean>;
  send: (item: PendingMutation<T>) => Promise<boolean>;
}) {
  for (;;) {
    if (!(await options.sameOwner())) throw new Error("ACCOUNT_CHANGED");
    const item = options.read()[0];
    if (!item) return;
    if (!(await options.send(item))) throw new Error("PENDING_WRITE_FAILED");
    if (!(await options.sameOwner())) throw new Error("ACCOUNT_CHANGED");
    options.write(options.read().filter((next) => next.revision !== item.revision));
  }
}
