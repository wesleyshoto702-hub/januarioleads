type LeadRow = {
  id: string;
  user_id: string;
  company: string;
  segment: string;
  phone: string;
  previous_phone: string | null;
  place_id: string | null;
  address: string | null;
  website: string | null;
  google_maps_url: string | null;
  primary_category: string | null;
  categories: string[];
  description: string | null;
  factual_description: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  international_phone: string | null;
  rating: number | null;
  review_count: number | null;
  is_open_now: boolean | null;
  opening_hours: string[];
  business_status: string | null;
  latitude: number | null;
  longitude: number | null;
};

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
  primaryType?: string;
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
  location?: { latitude?: number; longitude?: number };
  error?: { code?: number; message?: string; status?: string };
};

type CurrentPlace = {
  company: string;
  address: string | null;
  website: string | null;
  googleMapsUrl: string | null;
  primaryCategory: string | null;
  categories: string[];
  description: string | null;
  factualDescription: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  internationalPhone: string | null;
  rating: number | null;
  reviewCount: number | null;
  isOpenNow: boolean | null;
  openingHours: string[];
  businessStatus: string | null;
  latitude: number | null;
  longitude: number | null;
};

type LeadUpdate = {
  lead_id: string;
  user_id: string;
  place_id: string | null;
  change_type: string;
  field_name: string | null;
  old_value: unknown;
  new_value: unknown;
  message: string;
  importance: "normal" | "high";
  source: "google_places_sync";
};

const FIELD_MASK = [
  "id",
  "displayName",
  "primaryType",
  "primaryTypeDisplayName",
  "types",
  "editorialSummary",
  "formattedAddress",
  "addressComponents",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "rating",
  "userRatingCount",
  "businessStatus",
  "currentOpeningHours",
  "regularOpeningHours",
  "websiteUri",
  "googleMapsUri",
  "location",
].join(",");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAdminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const value of Object.values(parsed)) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch {
    return null;
  }

  return null;
}

function adminHeaders(extra?: Record<string, string>) {
  const key = getAdminKey();
  if (!key) throw new Error("Supabase admin credential unavailable");

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function adminRest(
  path: string,
  init: RequestInit = {},
) {
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!base) throw new Error("SUPABASE_URL unavailable");

  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: {
      ...adminHeaders(),
      ...(init.headers ?? {}),
    },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

function secureEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function authorizeCron(request: Request) {
  const provided = request.headers.get("x-sync-secret")?.trim();
  if (!provided) return false;

  const response = await adminRest(
    "sync_internal_config?select=secret_hash&config_key=eq.sync_leads_cron_secret_sha256&limit=1",
  );
  if (!response.ok) return false;

  const rows = (await response.json()) as Array<{ secret_hash?: string }>;
  const expected = rows[0]?.secret_hash;
  if (!expected) return false;

  return secureEqual(await sha256(provided), expected);
}

function component(place: GooglePlace, type: string) {
  return (
    place.addressComponents?.find((item) => item.types?.includes(type))
      ?.longText ?? null
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

function websiteAndInstagram(value: string | undefined) {
  const website = value?.trim() || null;
  if (!website) return { website: null };

  try {
    const host = new URL(website).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "instagram.com") return { website: null };
  } catch {
    return { website };
  }

  return { website };
}

function formatGoogleType(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildFactualDescription(place: CurrentPlace) {
  const parts: string[] = [];

  if (place.description?.trim()) {
    const summary = place.description.replace(/\s+/g, " ").trim();
    if (summary) parts.push(summary.replace(/[.\s]+$/, ""));
  } else {
    const category =
      place.primaryCategory?.trim() ||
      place.categories
        .map(formatGoogleType)
        .find((item) => item.trim().length > 0) ||
      null;
    const location =
      place.city && place.state
        ? `${place.city} - ${place.state}`
        : place.city ?? place.state;

    if (category && location) {
      parts.push(
        `Estabelecimento em ${location}, classificado no Google como ${category}`,
      );
    } else if (category) {
      parts.push(`Estabelecimento classificado no Google como ${category}`);
    } else if (location) {
      parts.push(`Estabelecimento localizado em ${location}`);
    }
  }

  if (place.businessStatus === "OPERATIONAL") {
    parts.push("O Google indica que o estabelecimento está em funcionamento");
  } else if (place.businessStatus === "CLOSED_TEMPORARILY") {
    parts.push("O Google indica que o estabelecimento está temporariamente fechado");
  } else if (place.businessStatus === "CLOSED_PERMANENTLY") {
    parts.push("O Google indica que o estabelecimento está permanentemente fechado");
  }

  if (place.openingHours.length > 0) {
    parts.push("Possui horários de funcionamento cadastrados no Google");
  }

  if (place.rating !== null && place.reviewCount !== null && place.reviewCount > 0) {
    parts.push(
      `No Google, possui nota ${place.rating.toFixed(1)} com ${place.reviewCount} ${place.reviewCount === 1 ? "avaliação" : "avaliações"}`,
    );
  }

  if (parts.length === 0) {
    return "As informações públicas disponíveis ainda não são suficientes para descrever esta empresa com segurança.";
  }

  return parts
    .slice(0, 4)
    .map((part) => `${part.replace(/[.\s]+$/, "")}.`)
    .join(" ");
}

function parsePlace(place: GooglePlace): CurrentPlace {
  const online = websiteAndInstagram(place.websiteUri);

  const current: CurrentPlace = {
    company: place.displayName?.text?.trim() || "",
    address: place.formattedAddress?.trim() || null,
    website: online.website,
    googleMapsUrl: place.googleMapsUri?.trim() || null,
    primaryCategory: place.primaryTypeDisplayName?.text?.trim() || null,
    categories: Array.from(new Set(place.types ?? [])).sort(),
    description: place.editorialSummary?.text?.trim() || null,
    factualDescription: null,
    neighborhood: parseNeighborhood(place),
    city: parseCity(place),
    state: component(place, "administrative_area_level_1"),
    phone: place.nationalPhoneNumber?.trim() || null,
    internationalPhone: place.internationalPhoneNumber?.trim() || null,
    rating: typeof place.rating === "number" ? place.rating : null,
    reviewCount:
      typeof place.userRatingCount === "number" ? place.userRatingCount : null,
    isOpenNow:
      typeof place.currentOpeningHours?.openNow === "boolean"
        ? place.currentOpeningHours.openNow
        : null,
    openingHours:
      place.regularOpeningHours?.weekdayDescriptions ??
      place.currentOpeningHours?.weekdayDescriptions ??
      [],
    businessStatus: place.businessStatus?.trim() || null,
    latitude:
      typeof place.location?.latitude === "number"
        ? place.location.latitude
        : null,
    longitude:
      typeof place.location?.longitude === "number"
        ? place.location.longitude
        : null,
  };

  current.factualDescription = buildFactualDescription(current);
  return current;
}

async function fetchPlaceDetails(apiKey: string, placeId: string) {
  const delays = [0, 700, 1800];

  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR&regionCode=BR`,
        {
          method: "GET",
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": FIELD_MASK,
          },
        },
      );

      let payload: GooglePlace;
      try {
        payload = (await response.json()) as GooglePlace;
      } catch {
        payload = {};
      }

      if (response.ok) return parsePlace(payload);

      if (
        response.status !== 429 &&
        response.status < 500
      ) {
        throw new Error(
          `Google Places returned ${response.status}: ${payload.error?.status ?? "request_failed"}`,
        );
      }

      if (attempt === delays.length - 1) {
        throw new Error(
          `Google Places returned ${response.status}: ${payload.error?.status ?? "temporary_failure"}`,
        );
      }
    } catch (error) {
      if (attempt === delays.length - 1) throw error;
    }
  }

  throw new Error("Google Places request failed");
}

function sameArray(a: string[] | null | undefined, b: string[] | null | undefined) {
  return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
}

function sameStringSet(
  a: string[] | null | undefined,
  b: string[] | null | undefined,
) {
  const left = Array.from(new Set(a ?? [])).sort();
  const right = Array.from(new Set(b ?? [])).sort();
  return JSON.stringify(left) === JSON.stringify(right);
}

function changed(a: unknown, b: unknown) {
  return a !== b;
}

function updateRecord(
  lead: LeadRow,
  current: CurrentPlace,
) {
  const patch: Record<string, unknown> = {};
  const updates: LeadUpdate[] = [];

  const addUpdate = (
    changeType: string,
    fieldName: string,
    oldValue: unknown,
    newValue: unknown,
    message: string,
    importance: "normal" | "high" = "normal",
  ) => {
    updates.push({
      lead_id: lead.id,
      user_id: lead.user_id,
      place_id: lead.place_id,
      change_type: changeType,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      message,
      importance,
      source: "google_places_sync",
    });
  };

  if (current.company && changed(lead.company, current.company)) {
    patch.company = current.company;
    addUpdate(
      "company_name",
      "company",
      lead.company,
      current.company,
      "Nome da empresa atualizado",
    );
  }

  if (changed(lead.address, current.address)) {
    patch.address = current.address;
    addUpdate(
      "address",
      "address",
      lead.address,
      current.address,
      "Endereço atualizado",
    );
  }

  if (changed(lead.website, current.website)) {
    patch.website = current.website;

    if (!lead.website && current.website) {
      addUpdate(
        "site_identified",
        "website",
        lead.website,
        current.website,
        "Site identificado",
      );
    } else if (lead.website && current.website) {
      addUpdate(
        "site_updated",
        "website",
        lead.website,
        current.website,
        "Site atualizado",
      );
    } else {
      addUpdate(
        "site_removed",
        "website",
        lead.website,
        current.website,
        "Site não está mais identificado no Google",
      );
    }
  }

  if (changed(lead.phone || null, current.phone)) {
    patch.previous_phone = lead.phone || null;
    patch.phone = current.phone ?? "";
    addUpdate(
      "phone",
      "phone",
      lead.phone || null,
      current.phone,
      "Telefone atualizado",
    );
  }

  if (changed(lead.international_phone, current.internationalPhone)) {
    patch.international_phone = current.internationalPhone;
  }

  if (changed(lead.rating, current.rating)) {
    patch.rating = current.rating;
    addUpdate(
      "rating",
      "rating",
      lead.rating,
      current.rating,
      "Nota no Google atualizada",
    );
  }

  if (changed(lead.review_count, current.reviewCount)) {
    patch.review_count = current.reviewCount;

    const oldCount = lead.review_count ?? 0;
    const newCount = current.reviewCount ?? 0;
    const delta = newCount - oldCount;

    addUpdate(
      "review_count",
      "review_count",
      lead.review_count,
      current.reviewCount,
      delta > 0
        ? `+${delta} ${delta === 1 ? "nova avaliação" : "novas avaliações"}`
        : "Quantidade de avaliações atualizada",
    );
  }

  if (!sameArray(lead.opening_hours, current.openingHours)) {
    patch.opening_hours = current.openingHours;
    addUpdate(
      "opening_hours",
      "opening_hours",
      lead.opening_hours,
      current.openingHours,
      "Horários atualizados",
    );
  }

  if (changed(lead.business_status, current.businessStatus)) {
    patch.business_status = current.businessStatus;
    const permanent = current.businessStatus === "CLOSED_PERMANENTLY";
    addUpdate(
      "business_status",
      "business_status",
      lead.business_status,
      current.businessStatus,
      permanent
        ? "Empresa marcada como permanentemente fechada"
        : current.businessStatus === "CLOSED_TEMPORARILY"
          ? "Empresa marcada como temporariamente fechada"
          : "Situação da empresa atualizada",
      permanent || current.businessStatus === "CLOSED_TEMPORARILY"
        ? "high"
        : "normal",
    );
  }

  if (changed(lead.primary_category, current.primaryCategory)) {
    patch.primary_category = current.primaryCategory;
    addUpdate(
      "primary_category",
      "primary_category",
      lead.primary_category,
      current.primaryCategory,
      "Categoria principal atualizada",
    );
  }

  if (!sameStringSet(lead.categories, current.categories)) {
    patch.categories = current.categories;
    addUpdate(
      "categories",
      "categories",
      lead.categories,
      current.categories,
      "Categorias relacionadas atualizadas",
    );
  }

  if (changed(lead.google_maps_url, current.googleMapsUrl)) {
    patch.google_maps_url = current.googleMapsUrl;
  }

  if (changed(lead.description, current.description)) {
    patch.description = current.description;
  }

  if (changed(lead.neighborhood, current.neighborhood)) {
    patch.neighborhood = current.neighborhood;
  }

  if (changed(lead.city, current.city)) patch.city = current.city;
  if (changed(lead.state, current.state)) patch.state = current.state;
  if (changed(lead.latitude, current.latitude)) patch.latitude = current.latitude;
  if (changed(lead.longitude, current.longitude)) patch.longitude = current.longitude;

  patch.is_open_now = current.isOpenNow;
  patch.factual_description = current.factualDescription;
  patch.last_synced_at = new Date().toISOString();
  patch.last_sync_error = null;
  patch.last_sync_error_at = null;

  return { patch, updates };
}

async function updateLead(id: string, patch: Record<string, unknown>) {
  const response = await adminRest(
    `leads?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to persist lead ${id}: ${response.status}`);
  }
}

async function insertUpdates(updates: LeadUpdate[]) {
  if (updates.length === 0) return;

  const response = await adminRest("lead_updates", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Failed to persist lead updates: ${response.status}`);
  }
}

async function recordLeadFailure(lead: LeadRow, error: unknown) {
  const message =
    error instanceof Error ? error.message.slice(0, 500) : "Unknown sync error";
  const now = new Date().toISOString();

  await updateLead(lead.id, {
    last_sync_error: message,
    last_sync_error_at: now,
  }).catch(() => undefined);

  await insertUpdates([
    {
      lead_id: lead.id,
      user_id: lead.user_id,
      place_id: lead.place_id,
      change_type: "sync_error",
      field_name: null,
      old_value: null,
      new_value: null,
      message: "Falha temporária ao atualizar dados públicos",
      importance: "normal",
      source: "google_places_sync",
    },
  ]).catch(() => undefined);
}

async function syncOne(apiKey: string, lead: LeadRow) {
  if (!lead.place_id) return { status: "skipped" as const, updates: 0 };

  try {
    const current = await fetchPlaceDetails(apiKey, lead.place_id);
    const { patch, updates } = updateRecord(lead, current);
    await updateLead(lead.id, patch);
    await insertUpdates(updates);

    return {
      status: updates.length > 0 ? ("updated" as const) : ("unchanged" as const),
      updates: updates.length,
    };
  } catch (error) {
    await recordLeadFailure(lead, error);
    return { status: "failed" as const, updates: 0 };
  }
}

async function fetchEligibleLeads(afterId?: string) {
  const params = new URLSearchParams();
  params.set(
    "select",
    [
      "id",
      "user_id",
      "company",
      "segment",
      "phone",
      "previous_phone",
      "place_id",
      "address",
      "website",
      "google_maps_url",
      "primary_category",
      "categories",
      "description",
      "factual_description",
      "neighborhood",
      "city",
      "state",
      "international_phone",
      "rating",
      "review_count",
      "is_open_now",
      "opening_hours",
      "business_status",
      "latitude",
      "longitude",
    ].join(","),
  );
  params.set("place_id", "not.is.null");
  params.set("auto_sync_enabled", "eq.true");
  params.set("order", "id.asc");
  params.set("limit", "50");
  if (afterId) params.set("id", `gt.${afterId}`);

  const response = await adminRest(`leads?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load eligible leads: ${response.status}`);
  }

  return (await response.json()) as LeadRow[];
}

async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let cursor = 0;

  async function runner() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index]);
      await sleep(120);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => runner(),
    ),
  );
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ ok: false, message: "Method not allowed" }, 405);
  }

  if (!(await authorizeCron(request))) {
    return json({ ok: false, message: "Unauthorized" }, 401);
  }

  const googleApiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!googleApiKey) {
    return json(
      { ok: false, message: "Google Places backend secret is unavailable" },
      503,
    );
  }

  const summary = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    updatesCreated: 0,
  };

  try {
    let afterId: string | undefined;

    for (;;) {
      const leads = await fetchEligibleLeads(afterId);
      if (leads.length === 0) break;

      await runPool(leads, 3, async (lead) => {
        const result = await syncOne(googleApiKey, lead);
        summary.processed += 1;
        summary.updatesCreated += result.updates;

        if (result.status === "updated") summary.updated += 1;
        else if (result.status === "unchanged") summary.unchanged += 1;
        else if (result.status === "failed") summary.failed += 1;
      });

      afterId = leads[leads.length - 1]?.id;
      if (leads.length < 50 || !afterId) break;
    }

    return json({ ok: true, ...summary });
  } catch (error) {
    return json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Unexpected sync failure",
        ...summary,
      },
      500,
    );
  }
});
