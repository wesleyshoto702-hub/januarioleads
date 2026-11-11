/** One site-level optional Google key; no API keys are entered by visitors. */
export const ENV_GOOGLE_MAPS_BROWSER_KEY =
  ((import.meta as ImportMeta & { env?: Record<string, string> }).env?.["VITE_GOOGLE_MAPS_BROWSER_KEY"])?.trim() ?? "";

/** Google JavaScript browser keys use a standard public format. */
export function isValidBrowserGoogleMapsKey(value: string): boolean {
  return /^AIza[A-Za-z0-9_-]{35}$/.test(value.trim());
}

/** Client-side Google Maps always exposes its browser key. Restrict referrers and APIs in Google Cloud. */
export function getBrowserGoogleMapsKey(): string {
  return isValidBrowserGoogleMapsKey(ENV_GOOGLE_MAPS_BROWSER_KEY) ? ENV_GOOGLE_MAPS_BROWSER_KEY : "";
}

/** The map itself is never blocked by a missing Google key. */
export type MapProviderChoice = "google" | "open";
export function chooseMapProvider(siteKey: string): MapProviderChoice {
  return isValidBrowserGoogleMapsKey(siteKey) ? "google" : "open";
}

/**
 * Google Places results must only be requested when their Google basemap
 * can be used. Never spend on Google Places if the site uses an open map.
 */
export function canDisplayGooglePlaces(siteKey: string, googleUnavailable: boolean): boolean {
  return chooseMapProvider(siteKey) === "google" && !googleUnavailable;
}
