import { getValidSession, refreshSession, signOut } from "./auth.ts";
const key = "januarioleads:auth-session";
const id = "11111111-1111-1111-1111-111111111111";
async function browserTest(run: (storage: Map<string, string>) => Promise<void>) {
  const descriptors = ["window", "localStorage", "fetch"].map(
    (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
  );
  const storage = new Map<string, string>();
  const windowMock = Object.assign(new EventTarget(), {
    setTimeout: () => 1,
    clearTimeout: () => {},
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: windowMock });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
      key: (i: number) => [...storage.keys()][i] ?? null,
      get length() {
        return storage.size;
      },
    },
  });
  storage.set(
    key,
    JSON.stringify({
      accessToken: "old",
      refreshToken: "refresh",
      expiresAt: Date.now() + 10000,
      user: { id, email: null },
    }),
  );
  try {
    await run(storage);
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}
Deno.test("concurrent refreshes share one token request", () =>
  browserTest(async () => {
    let calls = 0;
    globalThis.fetch = ((url: string) => {
      if (url.includes("grant_type=refresh_token")) {
        calls++;
        return Promise.resolve(
          Response.json({
            access_token: "new",
            refresh_token: "new-refresh",
            expires_in: 3600,
            user: { id },
          }),
        );
      }
      return Promise.resolve(Response.json([{ user_id: id }]));
    }) as typeof fetch;
    const sessions = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    if (calls !== 1 || sessions.some((s) => s?.accessToken !== "new"))
      throw new Error("Refresh not coordinated");
  }),
);
Deno.test("refresh response cannot restore a signed-out session", () =>
  browserTest(async (storage) => {
    let release!: (r: Response) => void;
    globalThis.fetch = ((url: string) => {
      if (url.includes("grant_type=refresh_token"))
        return new Promise<Response>((resolve) => {
          release = resolve;
        });
      return Promise.resolve(Response.json([{ user_id: id }]));
    }) as typeof fetch;
    const pending = refreshSession();
    await signOut();
    release(
      Response.json({
        access_token: "new",
        refresh_token: "new-refresh",
        expires_in: 3600,
        user: { id },
      }),
    );
    if ((await pending) || storage.has(key)) throw new Error("Logout was undone by refresh");
  }),
);

Deno.test("malformed or forged stored sessions never authorize a browser", () =>
  browserTest(async (storage) => {
    const valid = JSON.parse(storage.get(key)!) as Record<string, unknown>;
    const malformed = [
      "not-json",
      "null",
      "[]",
      JSON.stringify({ ...valid, expiresAt: "soon" }),
      JSON.stringify({ ...valid, expiresAt: "Infinity" }),
      JSON.stringify({ ...valid, expiresAt: -1 }),
      JSON.stringify({ ...valid, accessToken: {} }),
      JSON.stringify({ ...valid, refreshToken: "" }),
      JSON.stringify({ ...valid, user: { id: "not-a-user" } }),
      JSON.stringify({ ...valid, user: { id, email: 42 } }),
    ];
    globalThis.fetch = (() => {
      throw new Error("Malformed session must not hit network");
    }) as typeof fetch;

    for (const malformedSession of malformed) {
      storage.set(key, malformedSession);
      if ((await getValidSession()) !== null) throw new Error("Malformed session accepted");
    }
  }),
);

Deno.test("valid legacy localStorage session remains readable", () =>
  browserTest(async (storage) => {
    const raw = JSON.parse(storage.get(key)!) as { accessToken: string; expiresAt: number };
    raw.expiresAt = Date.now() + 3_600_000;
    storage.set(key, JSON.stringify(raw));
    let called = 0;
    globalThis.fetch = ((url: string) => {
      called++;
      if (url.includes("/auth/v1/user"))
        return Promise.resolve(Response.json({ id, email: null }));
      return Promise.resolve(Response.json([{ user_id: id }]));
    }) as typeof fetch;

    // In-memory session validation should not rewrite the browser's token format.
    const session = await getValidSession();
    if (session?.accessToken !== raw.accessToken || called !== 2) {
      throw new Error("Existing valid session was not preserved");
    }
  }),
);
