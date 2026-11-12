/**
 * Universal Google Maps outbound link for companies from any data source.
 *
 * Maps URLs are free browser links, not Places API requests. A search URL for
 * Overture/Geoapify is NOT evidence that the company has a verified Google
 * Business Profile. Preserve data provenance in source attribution instead.
 *
 * https://developers.google.com/maps/documentation/urls/get-started
 */
export type MapsLinkBusiness = {
  name?: string | null;
  company?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  source?: "google_places" | "geoapify" | "overture" | string | null;
  placeId?: string | null;
  googleMapsUrl?: string | null;
};

function officialMapsUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.trim() ||
      /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    const official = (host === "google.com" || host === "www.google.com" ||
      host === "maps.google.com") && url.pathname.startsWith("/maps");
    const shortLink = host === "maps.app.goo.gl";
    if (url.protocol !== "https:" || url.username || url.password ||
        url.port || (!official && !shortLink)) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function buildGoogleMapsUrl(business: MapsLinkBusiness): string | null {
  // Google Places can return a deep link directly to the verified location.
  const direct = officialMapsUrl(business.googleMapsUrl);
  if (direct) return direct;

  const name = (business.name || business.company || "").trim();
  if (!name) return null;

  const address = (business.address || "").trim();
  const city = (business.city || "").trim();
  const state = (business.state || "").trim();
  const location = address || [city, state, "Brasil"].filter(Boolean).join(", ");
  // Bound URL length and ensure that external provider strings are encoded.
  const query = [name, location].filter(Boolean).join(", ").slice(0, 750);
  const params = new URLSearchParams({ api: "1", query });
  const placeId = (business.placeId || "").trim();
  if (business.source === "google_places" &&
      /^[A-Za-z0-9_-]{5,200}$/.test(placeId)) {
    params.set("query_place_id", placeId);
  }
  return "https://www.google.com/maps/search/?" + params.toString();
}
