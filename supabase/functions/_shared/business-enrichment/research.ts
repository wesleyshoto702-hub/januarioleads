import type {
  BusinessIdentityFingerprint,
  FactCandidate,
  PageSnapshot,
  UsageMetrics,
} from "./types.ts";
import {
  domainOf,
  identityScoreFromText,
  normalizeText,
  safePublicUrl,
} from "./security.ts";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    action?: { type?: string; sources?: Array<{ url?: string }> };
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{ type?: string; url?: string }>;
    }>;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

const FACT_TYPES = [
  "service","product","menu_item","price","professional","credential","facility",
  "team_member","history","region_served","vehicle_type","modality","course",
  "treatment","event_type","property","brand","capacity","process","plan",
  "specialty","portfolio_image","before_after_image","official_website",
  "official_instagram","channel_whatsapp","channel_booking","channel_delivery",
  "channel_reservation","channel_ecommerce","channel_menu","email"
] as const;

const FACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["facts"],
  properties: {
    facts: {
      type: "array",
      maxItems: 48,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type","name","description","price","currency","url","imageUrl",
          "role","detail","evidenceText","sourceUrl"
        ],
        properties: {
          type: { type: "string", enum: FACT_TYPES },
          name: { type: "string" },
          description: { type: "string" },
          price: { type: "string" },
          currency: { type: "string" },
          url: { type: "string" },
          imageUrl: { type: "string" },
          role: { type: "string" },
          detail: { type: "string" },
          evidenceText: { type: "string" },
          sourceUrl: { type: "string" },
        },
      },
    },
  },
};

function outputText(payload: OpenAIResponse) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text.trim();
    }
  }
  return "";
}

function sourceUrls(payload: OpenAIResponse) {
  const urls = new Set<string>();
  for (const item of payload.output ?? []) {
    for (const source of item.action?.sources ?? []) if (source.url) urls.add(source.url);
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) if (annotation.url) urls.add(annotation.url);
    }
  }
  return Array.from(urls);
}

function webSearchCount(payload: OpenAIResponse) {
  return (payload.output ?? []).filter((item) => item.type === "web_search_call").length;
}

function applyUsage(payload: OpenAIResponse, metrics: UsageMetrics, web = false) {
  metrics.modelCalls += 1;
  if (web) metrics.webSearchCalls += webSearchCount(payload);
  metrics.inputTokens += payload.usage?.input_tokens ?? 0;
  metrics.outputTokens += payload.usage?.output_tokens ?? 0;
}

async function openAiRequest(
  apiKey: string,
  payload: Record<string, unknown>,
  timeoutMs = 40_000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseFacts(text: string) {
  try {
    const parsed = JSON.parse(text) as { facts?: unknown };
    return Array.isArray(parsed.facts) ? parsed.facts : [];
  } catch {
    return [];
  }
}

function normalizedEvidence(value: string) {
  return normalizeText(value).slice(0, 500);
}

function candidateFromRaw(
  raw: Record<string, unknown>,
  sourceType: FactCandidate["sourceType"],
  sourceText: string,
  fingerprint: BusinessIdentityFingerprint,
) {
  const sourceUrl = typeof raw.sourceUrl === "string" ? raw.sourceUrl.trim() : "";
  const url = safePublicUrl(sourceUrl);
  if (!url) return null;
  const evidence = typeof raw.evidenceText === "string" ? raw.evidenceText.trim().slice(0,500) : "";
  if (!evidence) return null;

  if (sourceType === "official_text") {
    const needle = normalizedEvidence(evidence);
    if (!needle || !normalizeText(sourceText).includes(needle)) return null;
  }

  const type = typeof raw.type === "string" && FACT_TYPES.includes(raw.type as typeof FACT_TYPES[number])
    ? raw.type : "";
  if (!type) return null;

  const name = typeof raw.name === "string" ? raw.name.trim().slice(0,220) : "";
  const description = typeof raw.description === "string" ? raw.description.trim().slice(0,700) : "";
  const price = typeof raw.price === "string" ? raw.price.trim().slice(0,100) : "";
  const currency = typeof raw.currency === "string" ? raw.currency.trim().slice(0,20) : "";
  const role = typeof raw.role === "string" ? raw.role.trim().slice(0,180) : "";
  const detail = typeof raw.detail === "string" ? raw.detail.trim().slice(0,300) : "";
  const rawUrl = typeof raw.url === "string" ? raw.url.trim() : "";
  const rawImage = typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : "";
  const safeUrl = rawUrl ? safePublicUrl(rawUrl)?.toString() ?? "" : "";
  const safeImage = rawImage ? safePublicUrl(rawImage)?.toString() ?? "" : "";

  const primaryValue = safeUrl || safeImage || [name,price,role,detail].filter(Boolean).join(" ");
  if (!primaryValue) return null;
  const identityScore = identityScoreFromText(fingerprint, sourceUrl, `${evidence} ${name} ${description}`);

  return {
    type,
    label: name || role || type,
    value: {
      name,
      description,
      price,
      currency,
      url: safeUrl,
      imageUrl: safeImage,
      role,
      detail,
    },
    normalizedValue: normalizeText(primaryValue),
    sourceUrl: url.toString(),
    sourceDomain: domainOf(url.toString()),
    sourceType,
    extractionMethod: sourceType === "official_text" ? "openai_text_extraction" : "openai_web_search",
    identityScore,
    confidence:
      sourceType === "official_text" && identityScore >= 80
        ? "high"
        : identityScore >= 40
          ? "medium"
          : "low",
    evidenceSummary: evidence,
  } satisfies FactCandidate;
}

export async function extractOfficialTextFacts(
  apiKey: string,
  pages: PageSnapshot[],
  fingerprint: BusinessIdentityFingerprint,
  priorities: string[],
  metrics: UsageMetrics,
) {
  if (!apiKey || !pages.length) return [] as FactCandidate[];
  const supplied = pages.map((page) => ({
    url: page.finalUrl,
    title: page.title,
    text: page.text.slice(0, 6500),
  }));
  const response = await openAiRequest(apiKey, {
      model: "gpt-5.6-terra",
      reasoning: { effort: "low" },
      max_output_tokens: 3400,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text:
            "Extraia somente fatos comerciais explicitamente presentes nas páginas oficiais fornecidas. Não use conhecimento externo, não infira serviços pelo nicho e não invente. Para cada fato, evidenceText deve ser um trecho curto copiado literalmente do texto da mesma sourceUrl. Se não houver evidência textual exata, não retorne o fato. Credenciais, preços e profissionais exigem menção explícita."
          }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify({
            company: fingerprint.canonicalName,
            city: fingerprint.city,
            researchPriorities: priorities.slice(0,10),
            pages: supplied,
          }) }],
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "official_business_facts",
          strict: true,
          schema: FACT_SCHEMA,
        },
      },
    });
  const payload = await response.json() as OpenAIResponse;
  if (!response.ok) return [] as FactCandidate[];
  applyUsage(payload, metrics, false);
  const pageMap = new Map(pages.map((page) => [page.finalUrl.replace(/\/$/,""), page.text]));
  const result: FactCandidate[] = [];
  for (const item of parseFacts(outputText(payload))) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string,unknown>;
    const source = typeof raw.sourceUrl === "string" ? raw.sourceUrl.replace(/\/$/,"") : "";
    const sourceText = pageMap.get(source);
    if (!sourceText) continue;
    const candidate = candidateFromRaw(raw, "official_text", sourceText, fingerprint);
    if (candidate) result.push(candidate);
  }
  return result.slice(0,48);
}

export async function researchMissingFacts(
  apiKey: string,
  fingerprint: BusinessIdentityFingerprint,
  priorities: string[],
  metrics: UsageMetrics,
) {
  if (!apiKey || !priorities.length) return [] as FactCandidate[];
  const response = await openAiRequest(apiKey, {
      model: "gpt-5.6-terra",
      reasoning: { effort: "low" },
      max_output_tokens: 3000,
      max_tool_calls: 3,
      tools: [{ type: "web_search", search_context_size: "low", external_web_access: true }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text:
            "Pesquise dados públicos de uma empresa local para complementar lacunas. Use no máximo 3 buscas. Resultados de busca são evidência, não fatos finais. Não faça login, não tente contornar CAPTCHA/paywall/Cloudflare, não invente e não retorne dado sem uma sourceUrl pública citada. Priorize o nome exato + cidade + uma lacuna por consulta. Se a identidade for ambígua, omita."
          }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: JSON.stringify({
            task: "Encontre somente informações ausentes e relevantes para esta empresa.",
            identity: fingerprint,
            missingPriorities: priorities.slice(0,6),
            rules: [
              "Não inferir serviço pela categoria.",
              "Não transformar nome em avaliação em profissional.",
              "Preços e credenciais exigem fonte explícita.",
              "Instagram deve ser perfil, não post/reel.",
              "Se encontrar website oficial não informado, retorne official_website como candidato para revisão.",
              "evidenceText deve resumir o sinal público observado; sourceUrl precisa ser uma fonte citada pela pesquisa.",
            ],
          }) }],
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "public_business_facts",
          strict: true,
          schema: FACT_SCHEMA,
        },
      },
    });
  const payload = await response.json() as OpenAIResponse;
  if (!response.ok) return [] as FactCandidate[];
  applyUsage(payload, metrics, true);
  const allowed = new Set(sourceUrls(payload).map((url) => {
    try { const u = new URL(url); u.hash = ""; return u.toString().replace(/\/$/,""); }
    catch { return ""; }
  }).filter(Boolean));
  const result: FactCandidate[] = [];
  for (const item of parseFacts(outputText(payload))) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string,unknown>;
    const source = typeof raw.sourceUrl === "string" ? raw.sourceUrl.trim() : "";
    let canonical = "";
    try { const u = new URL(source); u.hash = ""; canonical = u.toString().replace(/\/$/,""); } catch { continue; }
    if (!allowed.has(canonical)) continue;
    const candidate = candidateFromRaw(raw, "web_search", "", fingerprint);
    if (!candidate) continue;
    // Web search never becomes HIGH from a single AI-returned observation.
    candidate.confidence = candidate.identityScore >= 40 ? "medium" : "low";
    result.push(candidate);
  }
  return result.slice(0,40);
}
