import {
  buildContentAvailabilityMatrix,
  resolveNicheStrategy,
} from "../_shared/niche-strategies.ts";
import type {
  BusinessIdentityFingerprint,
  BusinessInput,
  EnrichmentSnapshot,
  FactCandidate,
  PersistedFact,
  SourceDiagnostic,
  UsageMetrics,
} from "../_shared/business-enrichment/types.ts";
import {
  buildFingerprint,
  businessKey,
  domainOf,
  identitySignature,
  normalizeText,
  safePublicUrl,
  withVerifiedIdentityUpdates,
} from "../_shared/business-enrichment/security.ts";
import {
  crawlOfficialWebsite,
  deterministicOfficialFacts,
  finalizeSourceDiagnostics,
} from "../_shared/business-enrichment/website.ts";
import {
  extractOfficialTextFacts,
  researchMissingFacts,
} from "../_shared/business-enrichment/research.ts";
import {
  buildVerifiedSnapshot,
  finalizeCandidates,
  mergeExistingBusiness,
  summaryOf,
} from "../_shared/business-enrichment/consolidate.ts";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEEP_ENRICHMENT_ENGINE_VERSION = "2026-09-30.2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
function failure(code: string, message: string, status = 400) {
  return json({ ok: false, code, message }, status);
}

function getAdminKey() {
  const direct = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (direct) return direct;
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string,unknown>;
    for (const value of Object.values(parsed)) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch {
    return null;
  }
  return null;
}

function adminHeaders(extra?: Record<string,string>) {
  const key = getAdminKey();
  if (!key) throw new Error("ADMIN_KEY_MISSING");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function adminRest(path: string, init: RequestInit = {}) {
  const base = Deno.env.get("SUPABASE_URL")?.replace(/\/$/,"");
  if (!base) throw new Error("SUPABASE_URL_MISSING");
  return fetch(`${base}/rest/v1/${path}`, {
    ...init,
    headers: { ...adminHeaders(), ...(init.headers ?? {}) },
  });
}

async function requireAuthorizedUser(request: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/,"");
  const anon = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim();
  const authorization = request.headers.get("authorization");
  if (!supabaseUrl || !anon || !authorization) {
    return { ok: false as const, response: failure("AUTH_REQUIRED","Sua sessão expirou.",401) };
  }
  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: authorization },
    });
    if (!userResponse.ok) {
      return { ok: false as const, response: failure("AUTH_REQUIRED","Sua sessão expirou.",401) };
    }
    const user = await userResponse.json() as { id?: string };
    if (!user.id) return { ok: false as const, response: failure("AUTH_REQUIRED","Sua sessão expirou.",401) };
    const access = await fetch(
      `${supabaseUrl}/rest/v1/private_access?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { headers: { apikey: anon, Authorization: authorization } },
    );
    const rows = access.ok ? await access.json() as Array<{user_id?:string}> : [];
    if (!rows.some((row) => row.user_id === user.id)) {
      return { ok: false as const, response: failure("FORBIDDEN","Esta conta não está autorizada.",403) };
    }
    return { ok: true as const, userId: user.id };
  } catch {
    return { ok: false as const, response: failure("AUTH_REQUIRED","Não foi possível validar sua sessão.",503) };
  }
}

function cleanText(value: unknown, max = 600) {
  return typeof value === "string" ? value.trim().slice(0,max) : "";
}

function sanitizeImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string,unknown>;
    const url = safePublicUrl(row.url)?.toString();
    if (!url) return [];
    return [{ url, alt: cleanText(row.alt,220) || null, source: cleanText(row.source,600) || null }];
  }).slice(0,40);
}

function sanitizeBusiness(value: unknown, segmentOverride?: string) : BusinessInput | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string,unknown>;
  const name = cleanText(raw.company ?? raw.name,180);
  if (!name) return null;
  const channelsRaw = raw.confirmedChannels && typeof raw.confirmedChannels === "object"
    ? raw.confirmedChannels as Record<string,unknown> : {};
  const contentRaw = raw.verifiedContent && typeof raw.verifiedContent === "object"
    ? raw.verifiedContent as Record<string,unknown> : {};
  const safeStrings = (input: unknown) =>
    Array.isArray(input) ? input.filter((x):x is string=>typeof x==="string").map((x)=>x.trim().slice(0,240)).filter(Boolean).slice(0,60) : [];
  const safeChannel = (input: unknown) => safePublicUrl(input)?.toString() ?? null;
  return {
    placeId: cleanText(raw.placeId,300) || null,
    company: name,
    name,
    segment: cleanText(segmentOverride ?? raw.segment,160) || cleanText(raw.primaryCategory,160) || "Empresa local",
    primaryCategory: cleanText(raw.primaryCategory,160) || null,
    categories: safeStrings(raw.categories).slice(0,30),
    description: cleanText(raw.description,1500) || null,
    address: cleanText(raw.address,400) || null,
    neighborhood: cleanText(raw.neighborhood,180) || null,
    city: cleanText(raw.city,140) || null,
    state: cleanText(raw.state,140) || null,
    postalCode: cleanText(raw.postalCode,40) || null,
    phone: cleanText(raw.phone,80) || null,
    internationalPhone: cleanText(raw.internationalPhone,80) || null,
    website: safePublicUrl(raw.website)?.toString() ?? null,
    instagram: safePublicUrl(raw.instagram)?.toString() ?? null,
    instagramConfidence: cleanText(raw.instagramConfidence,20) || null,
    rating: typeof raw.rating === "number" ? raw.rating : null,
    reviewCount: typeof raw.reviewCount === "number" ? raw.reviewCount : null,
    openingHours: safeStrings(raw.openingHours).slice(0,14),
    googleMapsUrl: safePublicUrl(raw.googleMapsUrl)?.toString() ?? null,
    verifiedImages: sanitizeImages(raw.verifiedImages),
    confirmedChannels: {
      whatsappUrl: safeChannel(channelsRaw.whatsappUrl),
      bookingUrl: safeChannel(channelsRaw.bookingUrl),
      deliveryUrl: safeChannel(channelsRaw.deliveryUrl),
      reservationUrl: safeChannel(channelsRaw.reservationUrl),
      ecommerceUrl: safeChannel(channelsRaw.ecommerceUrl),
      menuUrl: safeChannel(channelsRaw.menuUrl),
    },
    verifiedContent: {
      services: safeStrings(contentRaw.services),
      products: safeStrings(contentRaw.products),
      menuItems: safeStrings(contentRaw.menuItems),
      prices: safeStrings(contentRaw.prices),
      professionals: safeStrings(contentRaw.professionals),
      credentials: safeStrings(contentRaw.credentials),
      portfolioImages: sanitizeImages(contentRaw.portfolioImages),
      facilities: safeStrings(contentRaw.facilities),
      team: safeStrings(contentRaw.team),
      history: cleanText(contentRaw.history,1800) || null,
      regionsServed: safeStrings(contentRaw.regionsServed),
      vehicleTypes: safeStrings(contentRaw.vehicleTypes),
      modalities: safeStrings(contentRaw.modalities),
      courses: safeStrings(contentRaw.courses),
      treatments: safeStrings(contentRaw.treatments),
      eventTypes: safeStrings(contentRaw.eventTypes),
      properties: safeStrings(contentRaw.properties),
      brands: safeStrings(contentRaw.brands),
      capacity: cleanText(contentRaw.capacity,300) || null,
      process: safeStrings(contentRaw.process),
      plans: safeStrings(contentRaw.plans),
      specialties: safeStrings(contentRaw.specialties),
      beforeAfterImages: sanitizeImages(contentRaw.beforeAfterImages),
    },
  };
}

async function loadLead(userId: string, leadId: string | null) {
  if (!leadId) return null;
  if (!/^[0-9a-f-]{36}$/i.test(leadId)) throw new Error("LEAD_INVALID");
  const response = await adminRest(
    `leads?select=*&id=eq.${encodeURIComponent(leadId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  const rows = response.ok ? await response.json() as Array<Record<string,unknown>> : [];
  if (!rows[0]) throw new Error("LEAD_NOT_FOUND");
  return rows[0];
}

function mergeLeadBusiness(input: BusinessInput, lead: Record<string,unknown> | null) {
  if (!lead) return input;
  return {
    ...input,
    placeId: input.placeId || cleanText(lead.place_id,300),
    company: input.company || cleanText(lead.company,180),
    name: input.name || cleanText(lead.company,180),
    segment: input.segment || cleanText(lead.segment,160),
    primaryCategory: input.primaryCategory || cleanText(lead.primary_category,160),
    categories: input.categories?.length ? input.categories : (Array.isArray(lead.categories) ? lead.categories as string[] : []),
    address: input.address || cleanText(lead.address,400),
    city: input.city || cleanText(lead.city,140),
    state: input.state || cleanText(lead.state,140),
    phone: input.phone || cleanText(lead.phone,80),
    internationalPhone: input.internationalPhone || cleanText(lead.international_phone,80),
    website: input.website || cleanText(lead.website,600),
    instagram: input.instagram || cleanText(lead.instagram,600),
    instagramConfidence: input.instagramConfidence || cleanText(lead.instagram_confidence,20),
    rating: input.rating ?? (typeof lead.rating === "number" ? lead.rating : null),
    reviewCount: input.reviewCount ?? (typeof lead.review_count === "number" ? lead.review_count : null),
    openingHours: input.openingHours?.length ? input.openingHours : (Array.isArray(lead.opening_hours) ? lead.opening_hours as string[] : []),
    googleMapsUrl: input.googleMapsUrl || cleanText(lead.google_maps_url,600),
    verifiedImages: sanitizeImages(lead.verified_images).length ? sanitizeImages(lead.verified_images) : input.verifiedImages,
    confirmedChannels:
      lead.confirmed_channels && typeof lead.confirmed_channels === "object"
        ? lead.confirmed_channels as BusinessInput["confirmedChannels"]
        : input.confirmedChannels,
    verifiedContent:
      lead.verified_content && typeof lead.verified_content === "object"
        ? lead.verified_content as BusinessInput["verifiedContent"]
        : input.verifiedContent,
  } satisfies BusinessInput;
}

async function insertRun(payload: Record<string,unknown>) {
  const response = await adminRest("business_enrichment_runs", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("RUN_CREATE_FAILED");
  const rows = await response.json() as Array<Record<string,unknown>>;
  return rows[0];
}

async function patchRun(id: string, payload: Record<string,unknown>) {
  const response = await adminRest(
    `business_enrichment_runs?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ ...payload, updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok) throw new Error("RUN_UPDATE_FAILED");
  const rows = await response.json() as Array<Record<string,unknown>>;
  return rows[0];
}

async function insertSources(
  runId: string,
  userId: string,
  leadId: string | null,
  candidates: FactCandidate[],
) {
  const unique = new Map<string,{url:string;domain:string;type:string;method:string;score:number;confidence:string;title:string;updated:string|null}>();
  for (const fact of candidates) {
    if (!fact.sourceUrl) continue;
    const current = unique.get(fact.sourceUrl);
    const rank = fact.confidence === "high" ? 3 : fact.confidence === "medium" ? 2 : 1;
    const currentRank = current?.confidence === "high" ? 3 : current?.confidence === "medium" ? 2 : 1;
    if (!current || rank > currentRank) {
      unique.set(fact.sourceUrl,{
        url: fact.sourceUrl,
        domain: fact.sourceDomain || domainOf(fact.sourceUrl),
        type: fact.sourceType,
        method: fact.extractionMethod,
        score: fact.identityScore,
        confidence: fact.confidence,
        title: "",
        updated: fact.sourceUpdatedAt ?? null,
      });
    }
  }
  if (!unique.size) return new Map<string,string>();
  const body = Array.from(unique.values()).map((source)=>({
    run_id: runId,
    user_id: userId,
    lead_id: leadId,
    source_type: source.type,
    source_url: source.url,
    source_domain: source.domain,
    page_title: source.title || null,
    extraction_method: source.method,
    identity_score: source.score,
    confidence: source.confidence,
    source_updated_at: source.updated,
    checked_at: new Date().toISOString(),
  }));
  const response = await adminRest("business_enrichment_sources", {
    method:"POST",
    headers:{Prefer:"return=representation"},
    body:JSON.stringify(body),
  });
  if (!response.ok) throw new Error("SOURCE_SAVE_FAILED");
  const rows = await response.json() as Array<{id:string;source_url:string}>;
  return new Map(rows.map((row)=>[row.source_url,row.id]));
}

async function rejectedSignatures(userId: string, key: string) {
  const params = new URLSearchParams({
    select:"fact_signature",
    user_id:`eq.${userId}`,
    business_key:`eq.${key}`,
    resolution:"eq.rejected",
    limit:"300",
  });
  const response = await adminRest(`business_enrichment_facts?${params}`);
  const rows = response.ok ? await response.json() as Array<{fact_signature:string}> : [];
  return new Set(rows.map((row)=>row.fact_signature));
}

async function insertFacts(
  runId: string,
  userId: string,
  leadId: string | null,
  key: string,
  facts: PersistedFact[],
  sourceIds: Map<string,string>,
) {
  if (!facts.length) return [];
  const response = await adminRest("business_enrichment_facts", {
    method:"POST",
    headers:{Prefer:"return=representation"},
    body:JSON.stringify(facts.map((fact)=>({
      run_id:runId,
      user_id:userId,
      lead_id:leadId,
      business_key:key,
      source_id:sourceIds.get(fact.sourceUrl) ?? null,
      fact_type:fact.type,
      label:fact.label,
      value:fact.value,
      normalized_value:fact.normalizedValue,
      fact_signature:fact.factSignature,
      confidence:fact.confidence,
      resolution:fact.resolution,
      evidence_summary:fact.evidenceSummary || null,
      discovered_at:new Date().toISOString(),
      checked_at:new Date().toISOString(),
    }))),
  });
  if (!response.ok) throw new Error("FACT_SAVE_FAILED");
  return await response.json() as Array<Record<string,unknown>>;
}

function persistedFromRows(rows: Array<Record<string,unknown>>): PersistedFact[] {
  return rows.map((row)=>({
    id: String(row.id ?? ""),
    type:String(row.fact_type ?? ""),
    label:String(row.label ?? ""),
    value:(row.value && typeof row.value==="object" ? row.value : {}) as PersistedFact["value"],
    normalizedValue:String(row.normalized_value ?? ""),
    sourceUrl:String(row.source_url ?? ""),
    sourceDomain:String(row.source_domain ?? ""),
    sourceType:(row.source_type ?? "web_search") as PersistedFact["sourceType"],
    extractionMethod:String(row.extraction_method ?? ""),
    identityScore:typeof row.identity_score==="number" ? row.identity_score : 0,
    confidence:(row.confidence ?? "low") as PersistedFact["confidence"],
    evidenceSummary:String(row.evidence_summary ?? ""),
    factSignature:String(row.fact_signature ?? ""),
    resolution:(row.resolution ?? "low_confidence") as PersistedFact["resolution"],
  }));
}

async function loadRunFacts(runId: string) {
  const response = await adminRest(
    `business_enrichment_facts?select=id,fact_type,label,value,normalized_value,fact_signature,confidence,resolution,evidence_summary,source_id,business_enrichment_sources(source_url,source_domain,source_type,extraction_method,identity_score)&run_id=eq.${encodeURIComponent(runId)}&order=created_at.asc`,
  );
  if (!response.ok) return [] as PersistedFact[];
  const rows = await response.json() as Array<Record<string,unknown>>;
  return rows.map((row)=>{
    const source = row.business_enrichment_sources && typeof row.business_enrichment_sources==="object"
      ? row.business_enrichment_sources as Record<string,unknown> : {};
    return {
      id:String(row.id ?? ""),
      type:String(row.fact_type ?? ""),
      label:String(row.label ?? ""),
      value:(row.value && typeof row.value==="object" ? row.value : {}) as PersistedFact["value"],
      normalizedValue:String(row.normalized_value ?? ""),
      sourceUrl:String(source.source_url ?? ""),
      sourceDomain:String(source.source_domain ?? ""),
      sourceType:(source.source_type ?? "web_search") as PersistedFact["sourceType"],
      extractionMethod:String(source.extraction_method ?? ""),
      identityScore:typeof source.identity_score==="number" ? source.identity_score : 0,
      confidence:(row.confidence ?? "low") as PersistedFact["confidence"],
      evidenceSummary:String(row.evidence_summary ?? ""),
      factSignature:String(row.fact_signature ?? ""),
      resolution:(row.resolution ?? "low_confidence") as PersistedFact["resolution"],
    };
  });
}

async function updateLeadSnapshot(
  leadId: string | null,
  userId: string,
  runStatus: string,
  quality: string,
  checkedAt: string,
  snapshot: ReturnType<typeof buildVerifiedSnapshot>,
) {
  if (!leadId) return;
  const patch: Record<string,unknown> = {
    verified_content:snapshot.verifiedContent,
    verified_images:snapshot.verifiedImages,
    confirmed_channels:snapshot.confirmedChannels,
    deep_enrichment_status:runStatus,
    deep_enrichment_quality:quality,
    deep_enrichment_checked_at:checkedAt,
  };
  if (snapshot.identityUpdates.website) patch.website = snapshot.identityUpdates.website;
  if (snapshot.identityUpdates.instagram) {
    patch.instagram = snapshot.identityUpdates.instagram;
    patch.instagram_confidence = "high";
    patch.instagram_source = "official_website";
    patch.instagram_checked_at = checkedAt;
  }
  await adminRest(
    `leads?id=eq.${encodeURIComponent(leadId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { method:"PATCH", headers:{Prefer:"return=minimal"}, body:JSON.stringify(patch) },
  );
}

async function addHistory(
  leadId: string | null,
  userId: string,
  type: string,
  title: string,
  description: string,
  metadata: Record<string,unknown>,
) {
  if (!leadId) return;
  await adminRest("lead_activities", {
    method:"POST",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify({
      lead_id:leadId,
      user_id:userId,
      type,
      title,
      description,
      metadata,
    }),
  }).catch(()=>undefined);
}

function qualityFrom(completeness: number, verified: number, officialSources: number) {
  if (completeness >= 0.55 && verified >= 5 && officialSources > 0) return "high";
  if (completeness >= 0.25 || verified >= 2) return "medium";
  return "low";
}

function baseMetrics(): UsageMetrics {
  return {
    modelCalls:0,
    webSearchCalls:0,
    browserlessCalls:0,
    httpPages:0,
    pagesAnalyzed:0,
    inputTokens:0,
    outputTokens:0,
    httpPagesFetched:0,
    browserlessRenders:0,
    sourcesSuccessful:0,
    sourcesPartial:0,
    sourcesInconclusive:0,
    sourcesBlocked:0,
    sourcesFailed:0,
    factsHigh:0,
    factsMedium:0,
    factsLow:0,
    productsFound:0,
    servicesFound:0,
    imagesFound:0,
  };
}

const RESEARCH_LABELS: Record<string,string> = {
  website: "site oficial",
  instagram: "Instagram oficial",
  images: "fotos reais ambiente trabalhos",
  services: "serviços",
  products: "produtos",
  menu: "cardápio",
  prices: "preços",
  professionals: "profissionais equipe",
  credentials: "formação especializações credenciais",
  portfolio: "portfólio trabalhos",
  facilities: "estrutura ambiente",
  team: "equipe",
  delivery: "delivery pedido",
  booking: "agendamento",
  reservation: "reservas",
  ecommerce: "loja online e-commerce",
  regionsServed: "região atendida",
  vehicleTypes: "tipos de veículos atendidos",
  modalities: "modalidades",
  courses: "cursos",
  treatments: "tratamentos",
  eventTypes: "tipos de eventos",
  properties: "imóveis",
  brands: "marcas",
  capacity: "capacidade",
  process: "processo de atendimento",
  plans: "planos",
  specialties: "especialidades estilos",
  beforeAfter: "antes e depois",
};

const RESEARCH_PRIORITY_PATTERNS: Array<{
  key: string;
  patterns: string[];
}> = [
  { key: "services", patterns: ["servic", "procediment"] },
  { key: "products", patterns: ["produto", "colecao"] },
  { key: "menu", patterns: ["cardap", "menu"] },
  { key: "prices", patterns: ["preco", "valor", "plano"] },
  { key: "professionals", patterns: ["profission", "barbeir", "dentist", "equipe", "artista"] },
  { key: "credentials", patterns: ["credencial", "formacao", "especializacao", "registro"] },
  { key: "portfolio", patterns: ["portfolio", "trabalho", "resultado"] },
  { key: "facilities", patterns: ["estrutura", "ambiente", "oficina", "clinica"] },
  { key: "images", patterns: ["foto", "fotografia", "imagem", "ambiente"] },
  { key: "delivery", patterns: ["delivery", "pedido", "entrega"] },
  { key: "booking", patterns: ["agendamento", "agendar", "consulta"] },
  { key: "reservation", patterns: ["reserva"] },
  { key: "ecommerce", patterns: ["ecommerce", "e commerce", "comprar online"] },
  { key: "regionsServed", patterns: ["regiao atendida", "area atendida"] },
  { key: "vehicleTypes", patterns: ["veiculo", "carro", "moto"] },
  { key: "modalities", patterns: ["modalidade"] },
  { key: "courses", patterns: ["curso", "aula"] },
  { key: "treatments", patterns: ["tratamento"] },
  { key: "eventTypes", patterns: ["tipo de evento", "eventos"] },
  { key: "properties", patterns: ["imovel", "imoveis"] },
  { key: "brands", patterns: ["marca"] },
  { key: "capacity", patterns: ["capacidade"] },
  { key: "process", patterns: ["processo", "metodologia"] },
  { key: "plans", patterns: ["plano"] },
  { key: "specialties", patterns: ["especialidade", "estilo"] },
  { key: "beforeAfter", patterns: ["antes e depois", "before after"] },
];

function researchGaps(
  business: BusinessInput,
  strategy: ReturnType<typeof resolveNicheStrategy>,
) {
  const matrix = buildContentAvailabilityMatrix(business);
  const scored = new Map<string,number>();

  const add = (key: string, score: number) => {
    const status = matrix[key as keyof typeof matrix]?.status;
    if (
      (status === "missing" || status === "unverified") &&
      RESEARCH_LABELS[key]
    ) {
      scored.set(key, Math.max(scored.get(key) ?? 0, score));
    }
  };

  // The existing Page Planner strategy remains the strongest signal.
  for (const section of strategy.idealSections) {
    for (const key of section.requiresAny) {
      add(key, section.priority + 25);
    }
  }

  // Visual priorities tell enrichment which missing factual assets would
  // materially change the landing page, without creating a second strategy.
  const visualWeight: Record<string,number> = {
    critical: 125,
    high: 112,
    medium: 92,
    secondary: 70,
  };
  for (const [key, priority] of strategy.visualContentPriorities) {
    add(key, visualWeight[priority] ?? 70);
  }

  // Specific niche overrides often carry useful commercial needs that are not
  // mandatory section gates (e.g. prices for a barbershop). Translate those
  // existing priorities into the same bounded research queue.
  strategy.contentPriorities.forEach((priority, index) => {
    const normalized = normalizeText(priority);
    for (const entry of RESEARCH_PRIORITY_PATTERNS) {
      if (entry.patterns.some((pattern) => normalized.includes(pattern))) {
        add(entry.key, 120 - Math.min(index, 20));
      }
    }
  });

  // Website is a high-value discovery surface. Instagram remains useful but
  // does not outrank niche-critical factual gaps.
  add("website", 118);
  add("instagram", 76);

  return Array.from(scored.entries())
    .sort((a,b) => b[1] - a[1])
    .slice(0,6)
    .map(([key]) => RESEARCH_LABELS[key]);
}

function computeCompleteness(
  business: BusinessInput,
  strategy: ReturnType<typeof resolveNicheStrategy>,
) {
  const matrix = buildContentAvailabilityMatrix(business);
  const important = new Set<string>();
  for (const section of strategy.idealSections) {
    for (const key of section.requiresAny) {
      if (!["identity","description"].includes(key)) important.add(key);
    }
  }
  if (!important.size) return 0;
  let score = 0;
  for (const key of important) {
    const status = matrix[key as keyof typeof matrix]?.status;
    if (status === "verified") score += 1;
    else if (status === "partial") score += 0.5;
  }
  return Math.round((score / important.size) * 10000) / 10000;
}

async function snapshotFromRun(row: Record<string,unknown>, cached: boolean): Promise<EnrichmentSnapshot> {
  const runId = String(row.id ?? "");
  const facts = runId ? await loadRunFacts(runId) : [];
  const reviewFacts = facts.filter((fact)=>fact.resolution==="needs_review").map((fact)=>({
    id:fact.id ?? "",
    type:fact.type,
    label:fact.label,
    value:fact.value as Record<string,unknown>,
    confidence:fact.confidence,
    evidenceSummary:fact.evidenceSummary || null,
    sourceUrl:fact.sourceUrl || null,
  }));
  const sourceResponse = runId ? await adminRest(
    `business_enrichment_sources?select=source_type,source_url,source_domain,page_title,confidence&run_id=eq.${encodeURIComponent(runId)}&order=created_at.asc&limit=30`
  ) : null;
  const sourceRows = sourceResponse?.ok ? await sourceResponse.json() as Array<Record<string,unknown>> : [];
  return {
    runId:runId || null,
    status:(row.status ?? "not_started") as EnrichmentSnapshot["status"],
    quality:(row.quality ?? null) as EnrichmentSnapshot["quality"],
    completeness:typeof row.completeness==="number" ? row.completeness : row.completeness ? Number(row.completeness) : null,
    checkedAt:typeof row.checked_at==="string" ? row.checked_at : null,
    expiresAt:typeof row.expires_at==="string" ? row.expires_at : null,
    cached,
    summary:(row.summary && typeof row.summary==="object" ? row.summary : {
      verifiedFacts:0,reviewFacts:0,lowFacts:0,services:0,products:0,professionals:0,portfolioImages:0,verifiedImages:0,prices:0,bookingConfirmed:false,whatsappConfirmed:false,websiteFound:false,conflicts:0,
    }) as EnrichmentSnapshot["summary"],
    verifiedContent:(row.verified_content && typeof row.verified_content==="object" ? row.verified_content : {}) as EnrichmentSnapshot["verifiedContent"],
    verifiedImages:Array.isArray(row.verified_images) ? row.verified_images as EnrichmentSnapshot["verifiedImages"] : [],
    confirmedChannels:(row.confirmed_channels && typeof row.confirmed_channels==="object" ? row.confirmed_channels : {}) as EnrichmentSnapshot["confirmedChannels"],
    identityUpdates:(row.identity_updates && typeof row.identity_updates==="object" ? row.identity_updates : {}) as EnrichmentSnapshot["identityUpdates"],
    reviewFacts,
    sources:sourceRows.map((source)=>({
      type:String(source.source_type ?? ""),
      url:String(source.source_url ?? ""),
      domain:String(source.source_domain ?? ""),
      title:typeof source.page_title==="string" ? source.page_title : null,
      confidence:(source.confidence ?? "low") as EnrichmentSnapshot["sources"][number]["confidence"],
    })),
    metrics:(row.metrics && typeof row.metrics==="object" ? row.metrics : baseMetrics()) as UsageMetrics,
    errorSummary:typeof row.error_summary==="string" ? row.error_summary : null,
  };
}

async function latestRun(userId: string, key: string, signature?: string) {
  const params = new URLSearchParams({
    select:"*",
    user_id:`eq.${userId}`,
    business_key:`eq.${key}`,
    order:"created_at.desc",
    limit:"1",
  });
  if (signature) params.set("identity_signature",`eq.${signature}`);
  const response = await adminRest(`business_enrichment_runs?${params}`);
  const rows = response.ok ? await response.json() as Array<Record<string,unknown>> : [];
  return rows[0] ?? null;
}

async function runEnrichment(
  userId: string,
  leadId: string | null,
  rawBusiness: BusinessInput,
  force: boolean,
) {
  const strategy = resolveNicheStrategy({
    ...rawBusiness,
    company: rawBusiness.company ?? rawBusiness.name ?? "",
  });
  const fingerprint = buildFingerprint(rawBusiness,strategy.nicheKey);
  const signature = await identitySignature(fingerprint);
  const key = await businessKey(fingerprint);

  if (!force) {
    const cached = await latestRun(userId,key,signature);
    if (cached && ["completed","needs_review"].includes(String(cached.status))) {
      const expires = Date.parse(String(cached.expires_at ?? ""));
      if (Number.isFinite(expires) && expires > Date.now()) {
        return snapshotFromRun(cached,true);
      }
    }
  }

  const metrics = baseMetrics();
  const run = await insertRun({
    user_id:userId,
    lead_id:leadId,
    business_key:key,
    place_id:fingerprint.placeId || null,
    identity_signature:signature,
    identity:fingerprint,
    niche_key:strategy.nicheKey,
    niche_family:strategy.family,
    engine_version:DEEP_ENRICHMENT_ENGINE_VERSION,
    status:"researching",
    force_refresh:force,
    started_at:new Date().toISOString(),
  });
  const runId = String(run.id);
  const stageErrors:string[] = [];
  const candidates:FactCandidate[] = [];

  try {
    const rejected = await rejectedSignatures(userId,key);
    let officialPages: Awaited<ReturnType<typeof crawlOfficialWebsite>>["pages"] = [];
    let crawlDiagnostics: SourceDiagnostic[] = [];

    if (rawBusiness.website) {
      const crawled = await crawlOfficialWebsite(
        rawBusiness.website,
        [
          ...strategy.contentPriorities,
          ...strategy.trustSignals,
          ...strategy.idealSections.map((section)=>section.type),
        ],
        metrics,
        fingerprint,
      );
      officialPages = crawled.pages;
      crawlDiagnostics = crawled.diagnostics;
      stageErrors.push(...crawled.errors);
      candidates.push(...deterministicOfficialFacts(crawled.pages,fingerprint));
    }

    let staged = await finalizeCandidates(candidates,rejected);
    let snapshotForGaps = buildVerifiedSnapshot(staged,{
      verifiedContent:rawBusiness.verifiedContent,
      verifiedImages:rawBusiness.verifiedImages,
      confirmedChannels:rawBusiness.confirmedChannels,
    });
    let enrichedForGaps = mergeExistingBusiness(rawBusiness,snapshotForGaps);
    let missing = researchGaps(enrichedForGaps,strategy);
    const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim() ?? "";

    // Only ask the model to extract unstructured official text if deterministic
    // HTML/JSON-LD parsing did not already fill the relevant commercial gaps.
    if (apiKey && officialPages.length && missing.length) {
      try {
        candidates.push(...await extractOfficialTextFacts(
          apiKey,officialPages,fingerprint,missing,metrics
        ));
      } catch {
        stageErrors.push("official_text_extraction_failed");
      }

      staged = await finalizeCandidates(candidates,rejected);
      snapshotForGaps = buildVerifiedSnapshot(staged,{
        verifiedContent:rawBusiness.verifiedContent,
        verifiedImages:rawBusiness.verifiedImages,
        confirmedChannels:rawBusiness.confirmedChannels,
      });
      enrichedForGaps = mergeExistingBusiness(rawBusiness,snapshotForGaps);
      missing = researchGaps(enrichedForGaps,strategy);
    }

    // Public Web Search is the last resort and only sees the remaining gaps.
    if (missing.length) {
      if (apiKey) {
        try {
          candidates.push(...await researchMissingFacts(apiKey,fingerprint,missing,metrics));
        } catch {
          stageErrors.push("web_research_failed");
        }
      } else {
        stageErrors.push("web_research_not_configured");
      }
    }

    staged = await finalizeCandidates(candidates,rejected);
    const sourceIds = await insertSources(runId,userId,leadId,candidates);
    const inserted = await insertFacts(runId,userId,leadId,key,staged,sourceIds);
    const facts = inserted.length ? await loadRunFacts(runId) : staged;
    const snapshot = buildVerifiedSnapshot(facts,{
      verifiedContent:rawBusiness.verifiedContent,
      verifiedImages:rawBusiness.verifiedImages,
      confirmedChannels:rawBusiness.confirmedChannels,
    });
    const enrichedBusiness = mergeExistingBusiness(rawBusiness,snapshot);
    const finalFingerprint = withVerifiedIdentityUpdates(
      fingerprint,
      snapshot.identityUpdates,
    );
    const finalIdentitySignature = await identitySignature(finalFingerprint);
    const completeness = computeCompleteness(enrichedBusiness,strategy);
    const summary = summaryOf(facts,snapshot);
    const officialSources = new Set(
      facts.filter((fact)=>fact.sourceType.startsWith("official_")).map((fact)=>fact.sourceUrl)
    ).size;
    const quality = qualityFrom(completeness,summary.verifiedFacts,officialSources);
    const needsReview = summary.reviewFacts > 0;
    const status = needsReview ? "needs_review" : "completed";
    const now = new Date();
    const expires = new Date(now.getTime()+CACHE_TTL_MS).toISOString();

    const updated = await patchRun(runId,{
      status,
      quality,
      completeness,
      identity_signature:finalIdentitySignature,
      identity:finalFingerprint,
      verified_content:snapshot.verifiedContent,
      verified_images:snapshot.verifiedImages,
      confirmed_channels:snapshot.confirmedChannels,
      identity_updates:snapshot.identityUpdates,
      summary,
      metrics,
      error_summary:stageErrors.length ? stageErrors.join(" · ").slice(0,1500) : null,
      checked_at:now.toISOString(),
      completed_at:now.toISOString(),
      expires_at:expires,
    });
    await updateLeadSnapshot(leadId,userId,status,quality,now.toISOString(),snapshot);
    await addHistory(
      leadId,userId,"deep_enrichment",
      "Pesquisa aprofundada concluída",
      `${summary.verifiedFacts} informações verificadas${summary.reviewFacts ? ` · ${summary.reviewFacts} para revisar` : ""}`,
      { runId, quality, completeness, verifiedFacts:summary.verifiedFacts, reviewFacts:summary.reviewFacts },
    );
    return snapshotFromRun(updated,false);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0,1200) : "Falha inesperada";
    const failed = await patchRun(runId,{
      status:"failed",
      metrics,
      error_summary:[...stageErrors,message].join(" · ").slice(0,1500),
      completed_at:new Date().toISOString(),
      checked_at:new Date().toISOString(),
    }).catch(()=>run);
    return snapshotFromRun(failed,false);
  }
}

async function reviewFact(
  userId:string,
  factId:string,
  decision:"confirm"|"reject",
) {
  const params = new URLSearchParams({
    select:"id,run_id,lead_id,business_key,resolution",
    id:`eq.${factId}`,
    user_id:`eq.${userId}`,
    limit:"1",
  });
  const response = await adminRest(`business_enrichment_facts?${params}`);
  const rows = response.ok ? await response.json() as Array<Record<string,unknown>> : [];
  const fact = rows[0];
  if (!fact) throw new Error("FACT_NOT_FOUND");
  const runId = String(fact.run_id);
  const leadId = fact.lead_id ? String(fact.lead_id) : null;
  await adminRest(
    `business_enrichment_facts?id=eq.${encodeURIComponent(factId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method:"PATCH",
      headers:{Prefer:"return=minimal"},
      body:JSON.stringify({
        resolution:decision==="confirm" ? "manual_verified" : "rejected",
        confidence:decision==="confirm" ? "high" : undefined,
        reviewed_at:new Date().toISOString(),
      }),
    },
  );
  const runResp = await adminRest(
    `business_enrichment_runs?select=*&id=eq.${encodeURIComponent(runId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  const runRows = runResp.ok ? await runResp.json() as Array<Record<string,unknown>> : [];
  const run = runRows[0];
  if (!run) throw new Error("RUN_NOT_FOUND");
  const facts = await loadRunFacts(runId);
  const snapshot = buildVerifiedSnapshot(facts,{
    verifiedContent:(run.verified_content ?? {}) as BusinessInput["verifiedContent"],
    verifiedImages:Array.isArray(run.verified_images) ? run.verified_images as BusinessInput["verifiedImages"] : [],
    confirmedChannels:(run.confirmed_channels ?? {}) as BusinessInput["confirmedChannels"],
  });
  const summary = summaryOf(facts,snapshot);
  const status = summary.reviewFacts > 0 ? "needs_review" : "completed";
  const storedIdentity =
    run.identity && typeof run.identity === "object"
      ? run.identity as BusinessIdentityFingerprint
      : null;
  const finalIdentity = storedIdentity
    ? withVerifiedIdentityUpdates(storedIdentity,snapshot.identityUpdates)
    : null;
  const finalIdentitySignature = finalIdentity
    ? await identitySignature(finalIdentity)
    : String(run.identity_signature ?? "");

  const updated = await patchRun(runId,{
    status,
    ...(finalIdentity
      ? {
          identity:finalIdentity,
          identity_signature:finalIdentitySignature,
        }
      : {}),
    verified_content:snapshot.verifiedContent,
    verified_images:snapshot.verifiedImages,
    confirmed_channels:snapshot.confirmedChannels,
    identity_updates:snapshot.identityUpdates,
    summary,
  });
  await updateLeadSnapshot(
    leadId,userId,status,String(run.quality ?? "medium"),
    new Date().toISOString(),snapshot
  );
  await addHistory(
    leadId,userId,"deep_enrichment_review",
    decision==="confirm" ? "Informação aprofundada confirmada" : "Informação aprofundada ignorada",
    decision==="confirm" ? "Uma informação foi confirmada manualmente." : "Uma informação foi marcada como não pertencente a esta empresa.",
    { runId, factId, decision },
  );
  return snapshotFromRun(updated,false);
}

Deno.serve(async (request)=>{
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  if (request.method !== "POST") return failure("INVALID_REQUEST","Este serviço aceita somente POST.",405);
  const authorized = await requireAuthorizedUser(request);
  if (!authorized.ok) return authorized.response;

  let body:Record<string,unknown>;
  try { body = await request.json() as Record<string,unknown>; }
  catch { return failure("INVALID_REQUEST","A solicitação está em formato inválido.",400); }

  const mode = cleanText(body.mode,40) || "status";
  const leadId = cleanText(body.leadId,80) || null;

  try {
    if (mode === "review") {
      const factId = cleanText(body.factId,80);
      const decision = body.decision === "confirm" ? "confirm" : body.decision === "reject" ? "reject" : null;
      if (!factId || !decision) return failure("INVALID_REQUEST","Revisão inválida.",400);
      const snapshot = await reviewFact(authorized.userId,factId,decision);
      return json({ok:true,snapshot});
    }

    const input = sanitizeBusiness(body.business,cleanText(body.segment,160));
    if (!input) return failure("INVALID_REQUEST","Informe uma empresa válida.",400);
    const lead = await loadLead(authorized.userId,leadId);
    const business = mergeLeadBusiness(input,lead);
    const strategy = resolveNicheStrategy({ ...business, company: business.company ?? business.name ?? "" });
    const fingerprint = buildFingerprint(business,strategy.nicheKey);
    const signature = await identitySignature(fingerprint);
    const key = await businessKey(fingerprint);

    if (mode === "status") {
      let latest = await latestRun(authorized.userId,key);

      if (
        latest &&
        latest.status === "researching" &&
        Date.now() - Date.parse(String(latest.started_at ?? "")) > 10 * 60 * 1000
      ) {
        latest = await patchRun(String(latest.id), {
          status: "failed",
          error_summary:
            "A pesquisa anterior foi interrompida antes de concluir. Você pode tentar novamente.",
          completed_at: new Date().toISOString(),
          checked_at: new Date().toISOString(),
        }).catch(() => latest);
      }

      const identityChanged =
        Boolean(latest) && String(latest.identity_signature) !== signature;

      if (!latest || identityChanged) {
        const empty:EnrichmentSnapshot = {
          runId:null,status:"not_started",quality:null,completeness:null,checkedAt:null,expiresAt:null,cached:false,
          summary:{verifiedFacts:0,reviewFacts:0,lowFacts:0,services:0,products:0,professionals:0,portfolioImages:0,verifiedImages:0,prices:0,bookingConfirmed:false,whatsappConfirmed:false,websiteFound:false,conflicts:0},
          // Do not replay a previous run when the fingerprint changed.
          // Existing lead snapshot remains available to the rest of the CRM,
          // but this panel requires a fresh explicit run for the new identity.
          verifiedContent:identityChanged ? {} : business.verifiedContent ?? {},
          verifiedImages:identityChanged ? [] : business.verifiedImages ?? [],
          confirmedChannels:identityChanged ? {} : business.confirmedChannels ?? {},
          identityUpdates:{},
          reviewFacts:[],sources:[],metrics:baseMetrics(),errorSummary:null,
        };
        return json({ok:true,snapshot:empty,identityChanged});
      }
      const snap = await snapshotFromRun(latest,false);
      return json({ok:true,snapshot:snap,identityChanged:false});
    }

    if (mode !== "run") return failure("INVALID_REQUEST","Modo inválido.",400);
    const snapshot = await runEnrichment(
      authorized.userId,leadId,business,body.force === true
    );
    return json({ok:true,snapshot});
  } catch (error) {
    const code = error instanceof Error ? error.message : "ENRICHMENT_FAILED";
    if (code === "LEAD_NOT_FOUND") return failure("FORBIDDEN","Este lead não pertence à sua conta.",403);
    return failure("ENRICHMENT_FAILED","Não foi possível concluir a pesquisa aprofundada agora.",502);
  }
});
