import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BusinessSearchResponse, BusinessSearchResult } from "./types";

const inputSchema = z.object({
  segment: z.string().trim().min(2).max(120),
  pageToken: z.string().trim().min(1).max(4096).optional(),
});

type GoogleText = { text?: string };
type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};
type GoogleOpeningHours = {
  openNow?: boolean;
  weekdayDescriptions?: string[];
};
type GooglePlace = {
  id?: string;
  displayName?: GoogleText;
  primaryTypeDisplayName?: GoogleText;
  types?: string[];
  editorialSummary?: GoogleText;
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
  currentOpeningHours?: GoogleOpeningHours;
  regularOpeningHours?: GoogleOpeningHours;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
};
type GoogleResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function component(place: GooglePlace, type: string) {
  return (
    place.addressComponents?.find((item) => item.types?.includes(type))?.longText ?? null
  );
}

function parseNeighborhood(place: GooglePlace) {
  return (
    component(place, "neighborhood") ??
    component(place, "sublocality_level_1") ??
    component(place, "sublocality")
  );
}

function parseCity(place: GooglePlace) {
  return (
    component(place, "locality") ??
    component(place, "administrative_area_level_2")
  );
}

function parsePlace(place: GooglePlace): BusinessSearchResult | null {
  const placeId = place.id?.trim();
  const name = place.displayName?.text?.trim();
  if (!placeId || !name) return null;

  return {
    placeId,
    name,
    primaryCategory: place.primaryTypeDisplayName?.text?.trim() || null,
    categories: place.types ?? [],
    description: place.editorialSummary?.text?.trim() || null,
    address: place.formattedAddress?.trim() || null,
    neighborhood: parseNeighborhood(place),
    city: parseCity(place),
    state:
      component(place, "administrative_area_level_1") ??
      component(place, "administrative_area_level_1"),
    phone: place.nationalPhoneNumber?.trim() || null,
    internationalPhone: place.internationalPhoneNumber?.trim() || null,
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    isOpenNow:
      typeof place.currentOpeningHours?.openNow === "boolean"
        ? place.currentOpeningHours.openNow
        : null,
    openingHours:
      place.regularOpeningHours?.weekdayDescriptions ??
      place.currentOpeningHours?.weekdayDescriptions ??
      [],
    website: place.websiteUri?.trim() || null,
    instagram: null,
    googleMapsUrl: place.googleMapsUri?.trim() || null,
    businessStatus: place.businessStatus?.trim() || null,
  };
}

function isLavras(place: BusinessSearchResult) {
  const city = (place.city ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const address = (place.address ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return city === "lavras" || address.includes("lavras");
}

export const searchBusinesses = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }): Promise<BusinessSearchResponse> => {
    const apiKey =
      process.env.GOOGLE_PLACES_API_KEY ??
      process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return {
        ok: false,
        code: "NOT_CONFIGURED",
        message:
          "A busca real ainda precisa da chave do Google Places configurada no ambiente seguro do projeto.",
      };
    }

    const requestBody: Record<string, unknown> = {
      textQuery: `${data.segment} em Lavras, Minas Gerais, Brasil`,
      pageSize: 20,
      languageCode: "pt-BR",
      regionCode: "BR",
    };

    if (data.pageToken) requestBody.pageToken = data.pageToken;

    try {
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.primaryTypeDisplayName",
            "places.types",
            "places.editorialSummary",
            "places.formattedAddress",
            "places.addressComponents",
            "places.nationalPhoneNumber",
            "places.internationalPhoneNumber",
            "places.rating",
            "places.userRatingCount",
            "places.businessStatus",
            "places.currentOpeningHours",
            "places.regularOpeningHours",
            "places.websiteUri",
            "places.googleMapsUri",
            "nextPageToken",
          ].join(","),
        },
        body: JSON.stringify(requestBody),
      });

      const payload = (await response.json()) as GoogleResponse;

      if (!response.ok) {
        const quota =
          response.status === 429 ||
          payload.error?.status === "RESOURCE_EXHAUSTED";

        return {
          ok: false,
          code: quota ? "QUOTA" : "REQUEST_FAILED",
          message: quota
            ? "O limite da API foi atingido. Tente novamente mais tarde."
            : "Não foi possível buscar empresas agora. Tente novamente.",
        };
      }

      const results = (payload.places ?? [])
        .map(parsePlace)
        .filter((place): place is BusinessSearchResult => Boolean(place))
        .filter(isLavras);

      return {
        ok: true,
        results,
        nextPageToken: payload.nextPageToken ?? null,
      };
    } catch {
      return {
        ok: false,
        code: "REQUEST_FAILED",
        message: "Não foi possível buscar empresas agora. Tente novamente.",
      };
    }
  });
