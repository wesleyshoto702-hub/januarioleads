/** Convert the exact search result into the saved CRM shape.
 * Pure with injected clock/ID in offline tests; no network or database calls.
 */
import type { PersistedLead } from "./remote-leads.ts";
import type { BusinessSearchResult } from "../search-leads/types.ts";
import { presenceFromBusiness } from "../business-presence/presence-transform.ts";
import { buildFactualBusinessDescription } from "../business-presence/business-description.ts";
import { normalizeBrazilianStateCode } from "../../lib/brazil-locations.ts";

export function buildFoundLead(
  business: BusinessSearchResult,
  selectedSegment: string,
  testInputs?: { id?: string; now?: Date },
): PersistedLead {
    const now=testInputs?.now??new Date();
    const foundPhone = business.phone ?? business.internationalPhone ?? "";
    const details = [
      business.city
        ? `Lead encontrado através do buscador de empresas em ${business.city}${business.state ? ` - ${business.state}` : ""}.`
        : "Lead encontrado através do buscador de empresas.",
      business.address ? `Endereço: ${business.address}` : "",
      business.website ? `Site: ${business.website}` : "",
      business.instagram ? `Instagram: ${business.instagram}` : "",
    ].filter(Boolean);

    const discoveredPresence = presenceFromBusiness(business);
    const factualDescription = buildFactualBusinessDescription(business, selectedSegment);

    const newLead: PersistedLead = {
      id: testInputs?.id??crypto.randomUUID(),
      company: business.name,
      segment: selectedSegment,
      phone: foundPhone,
      status: "send_message",
      firstContact: now.toISOString().slice(0, 10),
      notes: details.join("\n"),
      createdAt: now.toISOString(),
      placeId: business.placeId,
      source: "places-search",
      factualDescription,
      ...(discoveredPresence
        ? {
            instagramCheckedAt: discoveredPresence.instagramCheckedAt,
            instagramUsername: discoveredPresence.instagramUsername ?? undefined,
            instagramDisplayName: discoveredPresence.instagramDisplayName ?? undefined,
            instagramCandidates: discoveredPresence.instagramCandidates,
            instagramRejectedUrls: discoveredPresence.instagramRejectedUrls,
            instagramSearchSignature: discoveredPresence.instagramSearchSignature ?? undefined,
            instagramNeedsReview: discoveredPresence.instagramNeedsReview,
            ...(discoveredPresence.instagramUrl
              ? {
                  instagram: discoveredPresence.instagramUrl,
                  instagramConfidence: discoveredPresence.instagramConfidence ?? "high",
                  instagramSource: discoveredPresence.instagramSource ?? "existing_data",
                }
              : {}),
          }
        : {}),
      ...(business.address ? { address: business.address } : {}),
      ...(business.website ? { website: business.website } : {}),
      ...(business.googleMapsUrl ? { googleMapsUrl: business.googleMapsUrl } : {}),
      ...(business.instagram && !discoveredPresence?.instagramUrl
        ? { instagram: business.instagram }
        : {}),
      ...(business.primaryCategory ? { primaryCategory: business.primaryCategory } : {}),
      ...(business.categories.length ? { categories: business.categories } : {}),
      ...(business.description ? { description: business.description } : {}),
      ...(business.neighborhood ? { neighborhood: business.neighborhood } : {}),
      ...(business.city ? { city: business.city } : {}),
      ...(business.state
        ? {
            state: normalizeBrazilianStateCode(business.state) || business.state,
          }
        : {}),
      ...(business.internationalPhone ? { internationalPhone: business.internationalPhone } : {}),
      ...(business.rating !== null ? { rating: business.rating } : {}),
      ...(business.reviewCount !== null ? { reviewCount: business.reviewCount } : {}),
      ...(business.isOpenNow !== null ? { isOpenNow: business.isOpenNow } : {}),
      ...(business.openingHours.length ? { openingHours: business.openingHours } : {}),
      ...(business.businessStatus ? { businessStatus: business.businessStatus } : {}),
      ...(business.latitude !== null ? { latitude: business.latitude } : {}),
      ...(business.longitude !== null ? { longitude: business.longitude } : {}),
      ...(business.verifiedContent ? { verifiedContent: business.verifiedContent } : {}),
      ...(business.verifiedImages ? { verifiedImages: business.verifiedImages } : {}),
      ...(business.confirmedChannels ? { confirmedChannels: business.confirmedChannels } : {}),
      ...(business.deepEnrichmentStatus
        ? { deepEnrichmentStatus: business.deepEnrichmentStatus }
        : {}),
      ...(business.deepEnrichmentQuality
        ? { deepEnrichmentQuality: business.deepEnrichmentQuality }
        : {}),
      ...(business.deepEnrichmentCheckedAt
        ? { deepEnrichmentCheckedAt: business.deepEnrichmentCheckedAt }
        : {}),
    };
    return newLead;
  }

