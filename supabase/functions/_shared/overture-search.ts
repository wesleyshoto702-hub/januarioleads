import { resolveSearchSegment } from "./niche-catalog.ts";

/**
 * Read-only lookup over imported Overture places. NEVER sends service credentials
 * to the browser. The DB table is inaccessible to anon/authenticated roles.
 * A missing table, disabled feature or upstream error fails open to the existing
 * Geoapify/Google search, not to a synthetic lead.
 */
export type OvertureBusiness = {
  placeId: string;
  source: "overture";
  sourceUrl: string | null;
  name: string;
  primaryCategory: string | null;
  categories: string[];
  description: null;
  address: string | null;
  neighborhood: null;
  city: string;
  state: string;
  phone: string | null;
  internationalPhone: string | null;
  rating: null;
  reviewCount: null;
  isOpenNow: null;
  openingHours: string[];
  currentOpeningHours: null;
  regularOpeningHours: null;
  website: string | null;
  email: string | null;
  instagram: string | null;
  googleMapsUrl: null;
  businessStatus: string | null;
  latitude: number;
  longitude: number;
};

type Row = {
  id: string; name: string; category: string | null; city: string; state: string;
  address: string | null; latitude: number; longitude: number; phone: string | null;
  website: string | null; email: string | null; instagram: string | null; operating_status: string | null;
};

const MAX_PAGE = 20;
const MAX_OFFSET = 80;
// Narrow Overture taxonomy matches. If a niche lacks a safe map, search by
// explicit business name instead of claiming broad/unrelated category matches.
const CATEGORY_TERMS: Record<string, readonly string[]> = {
  "Barbearia": ["barber"],
  "Salão de Beleza": ["beauty_salon", "hair_salon", "hairdresser"],
  "Academia": ["gym", "fitness_center", "fitness_centre"],
  "Restaurante": ["restaurant"],
  "Pizzaria": ["pizza"],
  "Hamburgueria": ["burger"],
  "Padaria": ["bakery"],
  "Cafeteria": ["cafe", "coffee_shop"],
  "Farmácia": ["pharmacy"],
  "Clínica Odontológica": ["dentist", "dental"],
  "Clínica Veterinária": ["veterinar"],
  "Pet Shop": ["pet_store", "pet_shop"],
  "Hotel": ["hotel"],
  "Hostel": ["hostel"],
  "Pousada": ["guest_house", "inn"],
  "Ótica": ["optician"],
  "Escritório de Advocacia": ["lawyer", "law_firm"],
  "Contabilidade": ["accountant", "accounting"],
  "Imobiliária": ["real_estate"],
  "Mecânica Automotiva": ["car_repair", "auto_repair", "mechanic"],
  "Lava-Rápido": ["car_wash"],
  "Floricultura": ["florist"],
  "Papelaria / Artesanato": ["stationery"],
  "Loja de Roupas": ["clothing_store", "clothes_store"],
  "Loja de Calçados": ["shoe_store"],
  "Loja de Bicicletas": ["bicycle_shop"],
  "Escola de Idiomas": ["language_school"],
  "Autoescola": ["driving_school"],
  "Lavanderia": ["laundry"],
  "Estúdio de Tatuagem": ["tattoo"],
  "Sorveteria": ["ice_cream"],
  "Açougue": ["butcher"],
  "Loja de Móveis": ["furniture_store"],
  "Fotógrafo": ["photograph"],
  "Estacionamento": ["parking"],
  "Spa": ["spa"],
  "Joalheria": ["jewelry"],
  "Loja de Materiais de Construção": ["building_material"],
};

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function apiCredentials(): { url: string; key: string } | null {
  if (Deno.env.get("OVERTURE_SEARCH_ENABLED") === "false") return null;
  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  let modern: string | null = null;
  if (!legacy) {
    try {
      const secrets = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}") as Record<string, unknown>;
      const values = [secrets.default, ...Object.values(secrets)];
      modern = values.find(v => typeof v === "string" && v.trim()) as string || null;
    } catch { /* no modern secret available */ }
  }
  const key = legacy || modern;
  if (!url || !key) return null;
  return { url, key };
}

export type OvertureSearchOutcome = {
  ok: boolean;
  results: OvertureBusiness[];
  nextPageToken: string | null;
};

export async function searchOverture(input: {
  city: string; state: string; segment: string; offset?: number;
}): Promise<OvertureSearchOutcome> {
  const empty: OvertureSearchOutcome = { ok: false, results: [], nextPageToken: null };
  const credentials = apiCredentials();
  if (!credentials) return empty;
  const offset = input.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET ||
      offset % MAX_PAGE !== 0) return empty;

  const canonical = resolveSearchSegment(input.segment);
  if (!canonical) return empty;
  const terms = CATEGORY_TERMS[canonical] || [];
  const nameTerm = normalize(canonical).replace(/^(loja de |clinica de |empresa de )/, "");
  // Every value is sanitized before constructing a PostgREST filter.
  const filters = [
    ...terms.map(term => "category.ilike.*" + term.replace(/[^a-z0-9_]/g, "") + "*"),
    "name_key.ilike.*" + nameTerm + "*",
  ];
  const query = new URLSearchParams({
    select: "id,name,category,city,state,address,latitude,longitude,phone,email,website,instagram,operating_status",
    state: "eq." + input.state.toUpperCase(),
    city_key: "eq." + normalize(input.city),
    or: "(" + filters.join(",") + ")",
    order: "id.asc",
    limit: String(MAX_PAGE + 1),
    offset: String(offset),
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2400);
  try {
    const response = await fetch(credentials.url + "/rest/v1/overture_places?" + query, {
      headers: {
        apikey: credentials.key,
        ...(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ? {
          Authorization: "Bearer " + credentials.key,
        } : {}),
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) return empty;
    const rows = await response.json() as Row[];
    if (!Array.isArray(rows)) return empty;
    const hasMore = rows.length > MAX_PAGE;
    const results: OvertureBusiness[] = rows.slice(0, MAX_PAGE).map(row => ({
      placeId: "overture:" + row.id,
      source: "overture" as const,
      sourceUrl: "https://explore.overturemaps.org/",
      name: row.name,
      primaryCategory: row.category,
      categories: row.category ? [row.category] : [],
      description: null, address: row.address, neighborhood: null,
      city: row.city, state: row.state,
      phone: row.phone, internationalPhone: row.phone,
      rating: null, reviewCount: null,
      isOpenNow: null, openingHours: [],
      currentOpeningHours: null, regularOpeningHours: null,
      website: row.website, email: row.email, instagram: row.instagram, googleMapsUrl: null,
      businessStatus: row.operating_status,
      latitude: row.latitude, longitude: row.longitude,
    }));
    return {
      ok: true,
      results,
      nextPageToken: hasMore && offset < MAX_OFFSET
        ? "overture:" + (offset + MAX_PAGE) : null,
    };
  } catch (err) {
    console.warn("[search-places] overture_unavailable",
      err instanceof Error ? err.name : "unknown");
    return empty;
  } finally {
    clearTimeout(timeout);
  }
}
