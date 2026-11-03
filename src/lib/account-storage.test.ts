/// <reference lib="deno.ns" />
import {
  accountLocalStorage,
  accountSessionStorage,
  currentWorkspaceUserId,
  migrateLegacyWorkspace,
} from "./account-storage.ts";

type MockStorage = Storage & { values: Map<string, string> };

function storage(): MockStorage {
  const values = new Map<string, string>();
  return {
    values,
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key: string) { return values.get(key) ?? null; },
    key(index: number) { return Array.from(values.keys())[index] ?? null; },
    removeItem(key: string) { values.delete(key); },
    setItem(key: string, value: string) { values.set(key, value); },
  };
}

const AUTH = "januarioleads:auth-session";
const ORIGINAL = "531d0690-bdb5-4549-b07a-76da37e2ff96";
const OTHER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function runWithBrowserStorage(test: (local: MockStorage, session: MockStorage, logIn: (id: string) => void) => void) {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldLocal = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const oldSession = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const local = storage();
  const session = storage();
  try {
    Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: local });
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: session });
    const logIn = (id: string) => local.setItem(AUTH, JSON.stringify({ user: { id } }));
    test(local, session, logIn);
  } finally {
    for (const [key, descriptor] of [
      ["window", oldWindow], ["localStorage", oldLocal], ["sessionStorage", oldSession],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("new account starts with zero leads, messages, caches and recent searches", () => {
  runWithBrowserStorage((local, session, logIn) => {
    local.setItem("leadflow:leads", '[{"company":"PRIVATE OLD LEAD"}]');
    local.setItem("leadflow:messages", '[{"text":"PRIVATE OLD MESSAGE"}]');
    local.setItem("leadflow:recent-searches", '["lavras"]');
    session.setItem("leadflow:search-leads-session:v1", '{"private":true}');
    logIn(OTHER);
    migrateLegacyWorkspace();

    for (const key of [
      "leadflow:leads",
      "leadflow:messages",
      "leadflow:recent-searches",
      "januarioleads:business-presence",
    ]) {
      assert(accountLocalStorage.getItem(key) === null, `New user sees ${key}`);
    }
    assert(accountSessionStorage.getItem("leadflow:search-leads-session:v1") === null,
      "New user sees previous user's session search");
    assert(accountLocalStorage.length === 0, "New account local storage must be empty");
    assert(local.getItem("leadflow:leads") === null, "Old unscoped data should be moved");
  });
});

Deno.test("original owner retains old browser data without exposing it to another user", () => {
  runWithBrowserStorage((local, session, logIn) => {
    local.setItem("leadflow:messages", '[{"text":"My own saved message"}]');
    local.setItem("leadflow:leads", '[{"company":"Original lead"}]');
    session.setItem("leadflow:search-leads-session:v1", '{"original":true}');
    logIn(OTHER);
    migrateLegacyWorkspace();
    accountLocalStorage.setItem("leadflow:messages", '[{"text":"Brand new user message"}]');
    accountLocalStorage.setItem("leadflow:leads", '[{"company":"Brand new lead"}]');
    accountSessionStorage.setItem("leadflow:search-leads-session:v1", '{"new":true}');
    assert(accountLocalStorage.length === 2, "Wrong new account workspace count");
    logIn(ORIGINAL);
    assert(accountLocalStorage.getItem("leadflow:messages")?.includes("My own") === true,
      "Original messages lost on migration");
    assert(accountLocalStorage.getItem("leadflow:leads")?.includes("Original lead") === true,
      "Original leads lost on migration");
    assert(accountSessionStorage.getItem("leadflow:search-leads-session:v1")?.includes("original") === true,
      "Original search state lost on migration");
    logIn(OTHER);
    assert(accountLocalStorage.getItem("leadflow:leads")?.includes("Brand new lead") === true,
      "Other account's saved data overwritten");
    assert(accountSessionStorage.getItem("leadflow:search-leads-session:v1")?.includes("new") === true,
      "Other account's search state overwritten");
  });
});

Deno.test("account caches are inaccessible without a signed-in user", () => {
  runWithBrowserStorage((local, _session, logIn) => {
    logIn(ORIGINAL);
    accountLocalStorage.setItem("leadflow:messages", "owner-only");
    local.removeItem(AUTH);
    assert(currentWorkspaceUserId() === null, "Logout should remove workspace identity");
    assert(accountLocalStorage.getItem("leadflow:messages") === null, "Logged-out account can read cache");
    assert(accountLocalStorage.length === 0, "Logged-out cache enumeration leaked");
  });
});
