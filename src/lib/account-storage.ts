/**
 * Per-account browser workspace. Local caches never cross an Auth user boundary.
 * Supabase RLS remains the actual server-side authorization mechanism.
 */
const SESSION_KEY = "januarioleads:auth-session";
const PREFIX = "januarioleads:workspace:v2:";
// The only pre-multitenancy workspace belonged to this already-provisioned account.
// This UUID identifies the one-time data migration target, not an authorization rule.
const LEGACY_WORKSPACE_OWNER = "531d0690-bdb5-4549-b07a-76da37e2ff96";
const LEGACY_PREFIXES = ["leadflow:", "januarioleads:business-presence"];
const CLOUD_SYNCED_KEYS = new Set([
  "proposals:v1","digital-presence:reports:v1",
  ...["campaigns","sequences","enrollments","agenda","objections","projects","goals"]
    .map(key=>"commercial:v1:"+key),
]);
const CLOUD_CHANGE_EVENT = "januarioleads:cloud-document-change";

function workspaceUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const data: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    if (!data || typeof data !== "object") return null;
    const user = (data as { user?: { id?: unknown } }).user;
    return typeof user?.id === "string" && /^[\da-f]{8}-[\da-f-]{27,}$/i.test(user.id)
      ? user.id
      : null;
  } catch {
    return null;
  }
}

function prefix(userId: string) {
  return `${PREFIX}${userId}:`;
}

function scopedKey(key: string): string | null {
  const userId = workspaceUserId();
  return userId ? `${prefix(userId)}${key}` : null;
}

export const accountLocalStorage = {
  getItem(key: string): string | null {
    const scoped = scopedKey(key);
    return scoped === null ? null : localStorage.getItem(scoped);
  },
  setItem(key: string, value: string): void {
    const scoped = scopedKey(key);
    if (!scoped) return;
    localStorage.setItem(scoped, value);
    // The authenticated cloud bridge persists only these explicitly permitted
    // commercial snapshots. Local storage always remains the crash-recovery copy.
    if (CLOUD_SYNCED_KEYS.has(key)) {
      window.dispatchEvent(new CustomEvent(CLOUD_CHANGE_EVENT,{detail:{key}}));
    }
  },
  removeItem(key: string): void {
    const scoped = scopedKey(key);
    if (scoped) localStorage.removeItem(scoped);
  },
  key(index: number): string | null {
    const userId = workspaceUserId();
    if (!userId) return null;
    const head = prefix(userId);
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(head)) keys.push(key.slice(head.length));
    }
    return keys[index] ?? null;
  },
  get length(): number {
    const userId = workspaceUserId();
    if (!userId) return 0;
    const head = prefix(userId);
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      if (localStorage.key(i)?.startsWith(head)) count++;
    }
    return count;
  },
};

export const accountSessionStorage = {
  getItem(key: string): string | null {
    const scoped = scopedKey(key);
    return scoped === null ? null : sessionStorage.getItem(scoped);
  },
  setItem(key: string, value: string): void {
    const scoped = scopedKey(key);
    if (scoped) sessionStorage.setItem(scoped, value);
  },
  removeItem(key: string): void {
    const scoped = scopedKey(key);
    if (scoped) sessionStorage.removeItem(scoped);
  },
};

function migrateKeys(storage: Storage) {
  const legacyKeys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && LEGACY_PREFIXES.some((part) => key.startsWith(part))) legacyKeys.push(key);
  }
  for (const oldKey of legacyKeys) {
    const value = storage.getItem(oldKey);
    if (value === null) continue;
    const destination = `${prefix(LEGACY_WORKSPACE_OWNER)}${oldKey}`;
    // Never overwrite newer scoped state, especially messages and deleted leads.
    if (storage.getItem(destination) === null) storage.setItem(destination, value);
    storage.removeItem(oldKey);
  }
}

/** Move pre-account browser data exclusively into the original owner's namespace. */
export function migrateLegacyWorkspace(): void {
  if (typeof window === "undefined") return;
  try {
    migrateKeys(localStorage);
    migrateKeys(sessionStorage);
  } catch {
    // Preserve legacy data when storage is unavailable or quota is exhausted.
  }
}

export function currentWorkspaceUserId(): string | null {
  return workspaceUserId();
}

export function isLegacyWorkspaceOwner(): boolean {
  return workspaceUserId() === LEGACY_WORKSPACE_OWNER;
}
