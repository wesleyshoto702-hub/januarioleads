import { migrateLegacyWorkspace } from "./account-storage.ts";

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.ts";
const STORAGE_KEY = "januarioleads:auth-session";

export type AuthUser = {
  id: string;
  email: string | null;
};

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
};

type PasswordResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string; email?: string | null };
  error?: string;
  error_description?: string;
  msg?: string;
};

let refreshTimer: number | null = null;

function readSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.expiresAt || !parsed.user?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(session: StoredSession | null, notify = true) {
  if (typeof window === "undefined") return;
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    migrateLegacyWorkspace();
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  scheduleRefresh(session);
  if (notify) window.dispatchEvent(new Event("januarioleads:auth-change"));
}

function scheduleRefresh(session: StoredSession | null) {
  if (typeof window === "undefined") return;
  if (refreshTimer !== null) window.clearTimeout(refreshTimer);
  refreshTimer = null;
  if (!session) return;

  const delay = Math.max(5_000, session.expiresAt - Date.now() - 60_000);
  refreshTimer = window.setTimeout(() => {
    void refreshSession();
  }, delay);
}

async function request(path: string, init: RequestInit) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function isAuthorizedUser(accessToken: string, userId: string) {
  const response = await request(
    `/rest/v1/private_access?select=user_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ user_id?: string }>;
  return rows.some((row) => row.user_id === userId);
}

async function validateUser(accessToken: string): Promise<AuthUser | null> {
  const response = await request("/auth/v1/user", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { id?: string; email?: string | null };
  if (!data.id) return null;
  return { id: data.id, email: data.email ?? null };
}

function fromAuthResponse(data: PasswordResponse): StoredSession | null {
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expiresIn = data.expires_in;
  const id = data.user?.id;

  if (!accessToken || !refreshToken || !expiresIn || !id) return null;

  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    user: { id, email: data.user?.email ?? null },
  };
}

export async function signIn(email: string, password: string) {
  const response = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = (await response.json()) as PasswordResponse;

  if (!response.ok) {
    return {
      ok: false as const,
      message: "E-mail ou senha incorretos.",
    };
  }

  const session = fromAuthResponse(data);
  if (!session) {
    return {
      ok: false as const,
      message: "Não foi possível iniciar a sessão.",
    };
  }

  if (!(await isAuthorizedUser(session.accessToken, session.user.id))) {
    await revokeSession(session.accessToken);
    writeSession(null);
    return {
      ok: false as const,
      message: "Esta conta não está autorizada a acessar o JanuarioLeads.",
    };
  }

  writeSession(session);
  return { ok: true as const, user: session.user };
}

async function revokeSession(accessToken: string) {
  try {
    await request("/auth/v1/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Local logout still proceeds if the network request fails.
  }
}

export async function signOut() {
  const session = readSession();
  writeSession(null);
  if (session?.accessToken) await revokeSession(session.accessToken);
}

let refreshInFlight: Promise<StoredSession | null> | null = null;
export function refreshSession() {
  return (refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  }));
}
async function performRefresh() {
  const current = readSession();
  if (!current?.refreshToken) {
    writeSession(null);
    return null;
  }

  try {
    const response = await request("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: current.refreshToken }),
    });
    const data = (await response.json()) as PasswordResponse;
    if (!response.ok) {
      if (readSession()?.refreshToken === current.refreshToken) writeSession(null);
      return null;
    }

    const session = fromAuthResponse(data);
    if (!session) {
      if (readSession()?.refreshToken === current.refreshToken) writeSession(null);
      return null;
    }

    if (!(await isAuthorizedUser(session.accessToken, session.user.id))) {
      await revokeSession(session.accessToken);
      if (readSession()?.refreshToken === current.refreshToken) writeSession(null);
      return null;
    }

    if (readSession()?.refreshToken !== current.refreshToken) return null;
    writeSession(session);
    return session;
  } catch {
    return readSession()?.refreshToken === current.refreshToken && current.expiresAt > Date.now()
      ? current
      : null;
  }
}

let validation: { token: string; promise: Promise<StoredSession | null> } | null = null;
export function getValidSession(): Promise<StoredSession | null> {
  const session = readSession();
  if (!session) return Promise.resolve(null);
  if (validation?.token === session.accessToken) return validation.promise;
  const promise = validateSession().finally(() => {
    if (validation?.promise === promise) validation = null;
  });
  validation = { token: session.accessToken, promise };
  return promise;
}
async function validateSession() {
  const session = readSession();
  if (!session) return null;

  if (session.expiresAt <= Date.now() + 60_000) {
    return refreshSession();
  }

  const user = await validateUser(session.accessToken);
  if (!user || !(await isAuthorizedUser(session.accessToken, user.id))) {
    if (readSession()?.accessToken === session.accessToken) writeSession(null);
    return null;
  }

  if (readSession()?.accessToken !== session.accessToken) return null;
  const next = { ...session, user };
  writeSession(next, false);
  return next;
}

export async function getAccessToken() {
  const session = await getValidSession();
  return session?.accessToken ?? null;
}

export function subscribeAuthChange(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => callback();
  const onStorage = (event: StorageEvent) => {
    // Cross-tab cache updates are not auth changes.
    if (event.key === STORAGE_KEY || event.key === null) callback();
  };
  window.addEventListener("januarioleads:auth-change", handler);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("januarioleads:auth-change", handler);
    window.removeEventListener("storage", onStorage);
  };
}
