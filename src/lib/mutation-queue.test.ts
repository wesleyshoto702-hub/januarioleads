import { drainMutations, type PendingMutation } from "./mutation-queue.ts";
const mutation = (revision: string): PendingMutation<string> => ({
  id: "lead",
  revision,
  lead: revision,
});
Deno.test("failed writes survive restart and retry", async () => {
  let rows = [mutation("first")];
  const options = {
    read: () => rows,
    write: (next: typeof rows) => {
      rows = next;
    },
    sameOwner: () => Promise.resolve(true),
  };
  try {
    await drainMutations({ ...options, send: () => Promise.reject(new Error("offline")) });
  } catch {
    /* Expected network failure. */
  }
  if (rows.length !== 1) throw new Error("Lost offline edit");
  await drainMutations({ ...options, send: () => Promise.resolve(true) });
  if (rows.length) throw new Error("Retry did not acknowledge");
});
Deno.test(
  "new edits during an in-flight write are sent, not acknowledged prematurely",
  async () => {
    let rows = [mutation("first")];
    const sent: string[] = [];
    await drainMutations({
      read: () => rows,
      write: (next) => {
        rows = next;
      },
      sameOwner: () => Promise.resolve(true),
      send: (item) => {
        sent.push(item.revision);
        if (sent.length === 1) rows = [mutation("second")];
        return Promise.resolve(true);
      },
    });
    if (sent.join(",") !== "first,second" || rows.length) throw new Error("Concurrent edit lost");
  },
);
Deno.test("account switch during request never acknowledges another account's queue", async () => {
  let rows = [mutation("first")],
    owner = true;
  try {
    await drainMutations({
      read: () => rows,
      write: (next) => {
        rows = next;
      },
      sameOwner: () => Promise.resolve(owner),
      send: () => {
        owner = false;
        return Promise.resolve(true);
      },
    });
  } catch {
    if (rows.length === 1) return;
  }
  throw new Error("Account boundary not enforced");
});
Deno.test("deletion tombstones are sent and retained on rejection", async () => {
  let rows: PendingMutation<string>[] = [{ id: "lead", revision: "delete", lead: null }];
  try {
    await drainMutations({
      read: () => rows,
      write: (next) => {
        rows = next;
      },
      sameOwner: () => Promise.resolve(true),
      send: (item) => Promise.resolve(item.lead !== null),
    });
  } catch {
    if (rows.length === 1) return;
  }
  throw new Error("Rejected deletion lost");
});
