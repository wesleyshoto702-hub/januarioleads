import { drainMutations } from "../../lib/mutation-queue";
import { accountLocalStorage } from "../../lib/account-storage";
import { getValidSession } from "../../lib/auth";
import { saveRemoteLead, deleteRemoteLead, type PersistedLead } from "./remote-leads";
let version = 0;
export function leadMutationVersion() {
  return version;
}
const KEY = "leadflow:pending-mutations";
type Mutation = { revision: string; id: string; lead: PersistedLead | null };
function read(): Mutation[] {
  const value = accountLocalStorage.getItem(KEY);
  return value ? JSON.parse(value) : [];
}
export function enqueueLead(id: string, lead: PersistedLead | null) {
  version++;
  const pending = read().filter((item) => item.id !== id);
  pending.push({ id, lead, revision: crypto.randomUUID() });
  accountLocalStorage.setItem(KEY, JSON.stringify(pending));
}
export function mergePendingLeads(remote: PersistedLead[]) {
  const rows = new Map(remote.map((lead) => [lead.id, lead]));
  for (const item of read()) {
    if (item.lead) rows.set(item.id, item.lead);
    else rows.delete(item.id);
  }
  return [...rows.values()];
}
let flushing: Promise<void> | null = null;
export function flushPendingLeads(): Promise<void> {
  if (flushing) return flushing;
  if (!read().length) return Promise.resolve();
  flushing = (async () => {
    const session = await getValidSession();
    if (!session) throw new Error("AUTH_REQUIRED");
    const owner = session.user.id;
    await drainMutations({
      read,
      write: (rows) => accountLocalStorage.setItem(KEY, JSON.stringify(rows)),
      sameOwner: async () => (await getValidSession())?.user.id === owner,
      send: (item) =>
        item.lead ? saveRemoteLead(item.lead, owner) : deleteRemoteLead(item.id, owner),
    });
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}
