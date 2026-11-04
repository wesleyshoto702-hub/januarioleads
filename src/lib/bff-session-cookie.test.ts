import {
  COOKIE_NAME, allowsMutatingRequest, getSessionCookie, openSession,
  sealSession, sessionClearCookie, sessionSetCookie,
  type BffSession,
} from "./bff-session-cookie.server.ts";

const secret = btoa("0123456789abcdef0123456789abcdef")
  .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const another = btoa("abcdef0123456789abcdef0123456789")
  .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
const user: BffSession = {
  accessToken: "private-access-token",
  refreshToken: "private-refresh-token",
  expiresAt: Date.now() + 3600000,
  user: { id: "11111111-1111-1111-1111-111111111111", email: null },
};

Deno.test("AES-GCM session is encrypted and authenticates", async () => {
  const one = await sealSession(user, secret);
  const two = await sealSession(user, secret);
  if (one === two || one.includes("private") || !one.length) {
    throw new Error("Session tokens exposed or nonce reused");
  }
  const opened = await openSession(one, secret);
  if (opened?.accessToken !== user.accessToken || opened.refreshToken !== user.refreshToken) {
    throw new Error("Session could not be restored");
  }
});

Deno.test("tampering or incorrect encryption key fails closed", async () => {
  const value = await sealSession(user, secret);
  if (await openSession(value, another) !== null) throw new Error("Wrong key accepted");
  const tampered = value.slice(0, -2) + (value.endsWith("AB") ? "CD" : "AB");
  if (await openSession(tampered, secret) !== null) throw new Error("Tampered cookie accepted");
  if (await openSession("not-valid!", secret) !== null) throw new Error("Invalid cookie accepted");
});

Deno.test("cookies always use HttpOnly Secure SameSite and Host prefix", async () => {
  const value = await sealSession(user, secret);
  const cookie = sessionSetCookie(value);
  if (!cookie.startsWith(COOKIE_NAME + "=") ||
      !cookie.includes("HttpOnly") || !cookie.includes("Secure") ||
      !cookie.includes("SameSite=Lax") || !cookie.includes("Path=/") ||
      cookie.includes("Domain=")) {
    throw new Error("Insecure cookie flags");
  }
  if (getSessionCookie("other=x; " + cookie) !== value) {
    throw new Error("Cookie not parsed");
  }
  if (!sessionClearCookie().includes("Max-Age=0")) throw new Error("Logout not clearing cookie");
});

Deno.test("CSRF requires matching Origin or explicit same-origin browser metadata", () => {
  const url = "https://staging.example.test/api/session";
  const allowed = new Request(url, { method: "POST", headers: { origin: "https://staging.example.test" }});
  const rejected = new Request(url, { method: "POST", headers: { origin: "https://evil.test" }});
  const missing = new Request(url, { method: "POST" });
  const meta = new Request(url, { method: "POST", headers: { "sec-fetch-site": "same-origin" }});
  if (!allowsMutatingRequest(allowed) || allowsMutatingRequest(rejected) ||
      allowsMutatingRequest(missing) || !allowsMutatingRequest(meta)) {
    throw new Error("Origin validation broken");
  }
});

Deno.test("invalid or oversized sessions and secrets fail closed", async () => {
  let count = 0;
  try { await sealSession({ ...user, accessToken: "" }, secret); } catch { count++; }
  try { await sealSession(user, "invalid"); } catch { count++; }
  try { await sealSession({ ...user, refreshToken: "x".repeat(5000) }, secret); } catch { count++; }
  if (count !== 3) throw new Error("Invalid values accepted");
});
