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


/**
 * A single required attribution follows the results within the same visual
 * container. Card borders, not dots, distinguish sources in mixed lists.
 * Per-record attribution remains in the business detail modal.
 */
export function SearchResultsAttribution({
  sources,
}: {
  sources: Array<BusinessSearchResult["source"]>;
}) {
  const google = sources.some(source => source !== "geoapify");
  const geoapify = sources.some(source => source === "geoapify");
  if (!google && !geoapify) return null;
  return (
    <div className="business-results-attribution" role="note" aria-label="Origem dos resultados">
      {google && (
        <span className="business-results-attribution-entry business-results-attribution-entry--places" translate="no">
          <span className="business-results-google-attribution">Google Maps</span>
        </span>
      )}
      {geoapify && (
        <span className="business-results-attribution-entry business-results-attribution-entry--open">
          <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">
            Powered by Geoapify
          </a>
          <span aria-hidden="true">·</span>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
            © OpenStreetMap contributors
          </a>
        </span>
      )}
    </div>
  );
}
