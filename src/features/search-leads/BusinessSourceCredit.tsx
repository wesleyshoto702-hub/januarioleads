import type { BusinessSearchResult } from "./types";

/**
 * Minimal, legible attribution within the business content container.
 * Required when showing Google Places without a Google map; Geoapify's
 * free tier requires both provider and © OpenStreetMap contributors.
 * Never obscure or suppress credits based on user-facing theme.
 */
export function BusinessSourceCredit({
  source,
}: {
  source: BusinessSearchResult["source"];
}) {
  if (source === "geoapify") {
    return (
      <small className="business-source-credit" aria-label="Atribuição dos dados">
        <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
          Powered by Geoapify
        </a>
        <span aria-hidden="true">·</span>
        <a href="https://www.openstreetmap.org/copyright"
          target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
      </small>
    );
  }
  return (
    <small className="business-source-credit" aria-label="Atribuição dos dados" translate="no">
      Google Maps
    </small>
  );
}
