import { ExternalLink, MapPinned } from "lucide-react";
import { buildGoogleMapsUrl, type MapsLinkBusiness } from "../../lib/google-maps-url";

/** An outbound Maps shortcut, NOT a Google data-source credit or API call. */
export function GoogleMapsLink({ business }: { business: MapsLinkBusiness }) {
  const href = buildGoogleMapsUrl(business);
  if (!href) return null;

  return (
    <a
      className="business-google-maps-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Pesquisar esta empresa no Google Maps"
      aria-label={`Pesquisar ${business.name || business.company || "empresa"} no Google Maps (abre em nova aba)`}
    >
      <MapPinned size={15} aria-hidden="true" />
      <span>Google Maps</span>
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}
