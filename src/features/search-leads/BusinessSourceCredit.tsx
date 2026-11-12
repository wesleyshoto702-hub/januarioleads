import type { BusinessSearchResult } from "./types";

/**
 * Keep the mandatory attribution for every provider, including mixed searches.
 * Overture Places uses CDLA Permissive 2.0 / Apache 2.0 per upstream dataset.
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
  if (source === "overture") {
    return (
      <small className="business-source-credit" aria-label="Atribuição dos dados">
        <a href="https://docs.overturemaps.org/attribution/"
           target="_blank" rel="noopener noreferrer">
          Dados © Overture Maps Foundation e colaboradores
        </a>
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
 * Credits appear below the search results, never hidden or replaced by
 * a generic Google label when the result actually came from Overture.
 */
export function SearchResultsAttribution({
  sources,
}: {
  sources: Array<BusinessSearchResult["source"]>;
}) {
  const google = sources.some(source => source === "google_places" || !source);
  const geoapify = sources.some(source => source === "geoapify");
  const overture = sources.some(source => source === "overture");
  if (!google && !geoapify && !overture) return null;
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
      {overture && (
        <span className="business-results-attribution-entry business-results-attribution-entry--open">
          <a href="https://docs.overturemaps.org/attribution/"
             target="_blank" rel="noopener noreferrer">
            Dados © Overture Maps Foundation e colaboradores
          </a>
        </span>
      )}
    </div>
  );
}
