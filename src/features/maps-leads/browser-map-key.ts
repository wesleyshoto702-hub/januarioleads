import { accountLocalStorage, isLegacyWorkspaceOwner } from "../../lib/account-storage";

/**
 * Browser-restricted Google Maps JavaScript API key, NOT the private Google Places
 * server key. Never log it or persist it in the CRM / Supabase / repo.
 * A browser key is exposed to users by definition: restrict allowed HTTP
 * referrers and the Maps JavaScript API in Google Cloud.
 */
export const ENV_GOOGLE_MAPS_BROWSER_KEY =
  ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.["VITE_GOOGLE_MAPS_BROWSER_KEY"])?.trim() ?? "";

const MAPS_BROWSER_KEY_STORAGE = "maps-personal-browser-api-key";
const OLD_UNSCOPED_MAPS_KEY = "maps-personal-browser-api-key";

export type BrowserMapsKeySource = "browser" | "site" | "missing";

/** Google's browser API keys have the AIza prefix and 39-character format. */
export function isValidBrowserGoogleMapsKey(value: string): boolean {
  return /^AIza[A-Za-z0-9_-]{35}$/.test(value.trim());
}

function savedBrowserMapKey(): string {
  if (typeof window === "undefined" || !isLegacyWorkspaceOwner()) return "";
  try {
    const scoped = accountLocalStorage.getItem(MAPS_BROWSER_KEY_STORAGE)?.trim() ?? "";
    if (isValidBrowserGoogleMapsKey(scoped)) return scoped;

    // Older owner-only setups may have stored the browser key before storage
    // became account-scoped. Migrate only to this authenticated owner's space.
    const legacy = window.localStorage.getItem(OLD_UNSCOPED_MAPS_KEY)?.trim() ?? "";
    if (!isValidBrowserGoogleMapsKey(legacy)) return "";
    accountLocalStorage.setItem(MAPS_BROWSER_KEY_STORAGE, legacy);
    window.localStorage.removeItem(OLD_UNSCOPED_MAPS_KEY);
    return legacy;
  } catch {
    return "";
  }
}

export function browserGoogleMapsKeySource(): BrowserMapsKeySource {
  if (savedBrowserMapKey()) return "browser";
  if (isValidBrowserGoogleMapsKey(ENV_GOOGLE_MAPS_BROWSER_KEY)) return "site";
  return "missing";
}

export function getBrowserGoogleMapsKey(): string {
  return savedBrowserMapKey() ||
    (isValidBrowserGoogleMapsKey(ENV_GOOGLE_MAPS_BROWSER_KEY) ? ENV_GOOGLE_MAPS_BROWSER_KEY : "");
}

export function saveBrowserGoogleMapsKey(candidate: string): void {
  if (typeof window === "undefined" || !isLegacyWorkspaceOwner())
    throw new Error("Somente o proprietário pode configurar o mapa pessoal.");
  const value = candidate.trim();
  if (!isValidBrowserGoogleMapsKey(value))
    throw new Error("Informe uma chave pública válida da Maps JavaScript API (inicia com AIza).");
  try {
    accountLocalStorage.setItem(MAPS_BROWSER_KEY_STORAGE, value);
    if (accountLocalStorage.getItem(MAPS_BROWSER_KEY_STORAGE) !== value)
      throw new Error("Não foi possível confirmar o salvamento no navegador.");
  } catch {
    throw new Error("Não foi possível salvar a chave neste navegador. Verifique as permissões de armazenamento.");
  }
}

export function clearBrowserGoogleMapsKey(): void {
  if (typeof window === "undefined" || !isLegacyWorkspaceOwner())
    throw new Error("Somente o proprietário pode alterar a configuração.");
  accountLocalStorage.removeItem(MAPS_BROWSER_KEY_STORAGE);
}
