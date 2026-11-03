import { refreshSession, signOut } from "./auth.ts";
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
