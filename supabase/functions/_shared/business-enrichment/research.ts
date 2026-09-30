import type {
  BusinessIdentityFingerprint,
  FactCandidate,
  PageSnapshot,
  UsageMetrics,
} from "./types.ts";
import {
  branchIdentityScoreFromText,
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

function channelUrlForType(
  type: string,
  rawUrl: string,
) {
  const safe = rawUrl ? safePublicUrl(rawUrl) : null;
  if (!safe) return "";

  const host = domainOf(safe.toString());
  if (type === "channel_whatsapp") {
    return host === "wa.me" ||
      host === "api.whatsapp.com" ||
      host === "whatsapp.com"
      ? safe.toString()
      : "";
  }
  if (type === "official_instagram") {
    return host === "instagram.com" ? safe.toString() : "";
  }
  if (
    type === "official_website" ||
    type.startsWith("channel_")
  ) {
    return safe.toString();
  }
  return "";
}

function candidateFromRaw(
  raw: Record<string, unknown>,
  sourceType: FactCandidate["sourceType"],
  sourceText: string,
  fingerprint: BusinessIdentityFingerprint,
  identityScoreOverride?: number,
) {
  const sourceUrl = typeof raw.sourceUrl === "string" ? raw.sourceUrl.trim() : "";
  const source = safePublicUrl(sourceUrl);
  if (!source) return null;
  const evidence =
    typeof raw.evidenceText === "string"
      ? raw.evidenceText.trim().slice(0, 500)
      : "";
  if (!evidence) return null;

  const officialText =
    sourceType === "official_text" ||
    sourceType === "official_platform_text";
  if (officialText) {
    const needle = normalizedEvidence(evidence);
    if (!needle || !normalizeText(sourceText).includes(needle)) return null;
  }

  const type =
    typeof raw.type === "string" &&
    FACT_TYPES.includes(raw.type as typeof FACT_TYPES[number])
      ? raw.type
      : "";
  if (!type) return null;

  const name =
    typeof raw.name === "string" ? raw.name.trim().slice(0, 220) : "";
  const description =
    typeof raw.description === "string"
      ? raw.description.trim().slice(0, 700)
      : "";
  const price =
    typeof raw.price === "string" ? raw.price.trim().slice(0, 100) : "";
  const currency =
    typeof raw.currency === "string" ? raw.currency.trim().slice(0, 20) : "";
  const role =
    typeof raw.role === "string" ? raw.role.trim().slice(0, 180) : "";
  const detail =
    typeof raw.detail === "string" ? raw.detail.trim().slice(0, 300) : "";
  const rawUrl = typeof raw.url === "string" ? raw.url.trim() : "";
  const rawImage =
    typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : "";
  const actionUrl = channelUrlForType(type, rawUrl);
  const safeImage = rawImage
    ? safePublicUrl(rawImage)?.toString() ?? ""
    : "";

  const primaryValue =
    actionUrl ||
    safeImage ||
    [name, price, role, detail, description.slice(0, 180)]
      .filter(Boolean)
      .join(" ");
  if (!primaryValue) return null;

  const identityScore =
    typeof identityScoreOverride === "number"
      ? identityScoreOverride
      : sourceType === "official_platform_text"
        ? branchIdentityScoreFromText(
            fingerprint,
            `${evidence} ${name} ${description}`,
          )
        : identityScoreFromText(
          fingerprint,
          sourceUrl,
          `${evidence} ${name} ${description}`,
        );

  return {
    type,
    label: name || role || type,
    value: {
      name,
      description,
      price,
      currency,
      url: actionUrl,
      imageUrl: safeImage,
      role,
      detail,
    },
    normalizedValue: normalizeText(primaryValue),
    sourceUrl: source.toString(),
    sourceDomain: domainOf(source.toString()),
    sourceType,
    extractionMethod: officialText
      ? "openai_text_extraction"
      : "openai_web_search",
    identityScore,
    confidence:
      officialText && identityScore >= 80
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
  const pageMap = new Map(
    pages.map((page) => [page.finalUrl.replace(/\/$/,""), page]),
  );
  const result: FactCandidate[] = [];
  for (const item of parseFacts(outputText(payload))) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string,unknown>;
    const source =
      typeof raw.sourceUrl === "string"
        ? raw.sourceUrl.replace(/\/$/,"")
        : "";
    const page = pageMap.get(source);
    if (!page) continue;
    const candidate = candidateFromRaw(
      raw,
      page.sourceKind === "official_linked_platform"
        ? "official_platform_text"
        : "official_text",
      page.text,
      fingerprint,
      page.sourceIdentityScore,
    );
    if (candidate) result.push(candidate);
  }
  return result.slice(0,48);
}

type ResearchQueryPlan = {
  query: string;
  priorities: string[];
};

function quotedIdentity(fingerprint: BusinessIdentityFingerprint) {
  const name = fingerprint.canonicalName.replace(/"/g, "").trim();
  const city = fingerprint.city.trim();
  return `"${name}"${city ? ` ${city}` : ""}`;
}

function priorityMatches(value: string, patterns: string[]) {
  const normalized = normalizeText(value);
  return patterns.some((pattern) => normalized.includes(pattern));
}

export function planWebResearchQueries(
  fingerprint: BusinessIdentityFingerprint,
  priorities: string[],
) {
  const remaining = priorities.slice(0, 6);
  if (!remaining.length) return [] as ResearchQueryPlan[];

  const base = quotedIdentity(fingerprint);
  const plans: ResearchQueryPlan[] = [];
  const add = (patterns: string[], suffix: string) => {
    const covered = remaining.filter((priority) =>
      priorityMatches(priority, patterns)
    );
    if (!covered.length) return;
    plans.push({
      query: `${base} ${suffix}`.trim(),
      priorities: covered,
    });
  };

  add(
    ["produto","cardap","menu","preco"],
    "cardápio preços produtos",
  );
  add(
    ["delivery","pedido","entrega","retirada"],
    "pedido delivery entrega retirada",
  );
  add(
    ["instagram"],
    "Instagram",
  );
  add(
    ["servic","tratamento","profission","equipe","especial"],
    "serviços profissionais equipe",
  );
  add(
    ["agend","booking","reserva"],
    "agendamento reserva",
  );
  add(
    ["site oficial","website"],
    "site oficial",
  );
  add(
    ["foto","imagem","portfolio","trabalho","ambiente"],
    "fotos portfólio trabalhos",
  );

  const assigned = new Set(plans.flatMap((plan) => plan.priorities));
  const fallback = remaining.filter((priority) => !assigned.has(priority));
  if (fallback.length) {
    plans.push({
      query: `${base} ${fallback.slice(0, 2).join(" ")}`,
      priorities: fallback.slice(0, 2),
    });
  }

  const unique = new Map<string, ResearchQueryPlan>();
  for (const plan of plans) {
    const key = normalizeText(plan.query);
    if (!unique.has(key)) unique.set(key, plan);
  }
  return Array.from(unique.values()).slice(0, 3);
}

function factCoversPriority(
  fact: FactCandidate,
  priority: string,
) {
  const value = normalizeText(priority);
  if (/produto/.test(value)) return fact.type === "product" || fact.type === "menu_item";
  if (/cardap|menu/.test(value)) {
    return fact.type === "menu_item" || fact.type === "channel_menu" || fact.type === "product";
  }
  if (/preco/.test(value)) return fact.type === "price" || Boolean(fact.value.price);
  if (/delivery|pedido|entrega|retirada/.test(value)) {
    return fact.type === "channel_delivery" || fact.type === "menu_item" || fact.type === "product";
  }
  if (/instagram/.test(value)) return fact.type === "official_instagram";
  if (/agend|booking/.test(value)) return fact.type === "channel_booking";
  if (/reserva/.test(value)) return fact.type === "channel_reservation";
  if (/profission|equipe/.test(value)) {
    return fact.type === "professional" || fact.type === "team_member";
  }
  if (/servic|tratamento/.test(value)) {
    return fact.type === "service" || fact.type === "treatment";
  }
  if (/portfolio|trabalho|foto|imagem|ambiente/.test(value)) {
    return fact.type.endsWith("_image");
  }
  if (/site oficial|website/.test(value)) return fact.type === "official_website";
  return false;
}

async function runWebQuery(
  apiKey: string,
  fingerprint: BusinessIdentityFingerprint,
  plan: ResearchQueryPlan,
  metrics: UsageMetrics,
) {
  const response = await openAiRequest(apiKey, {
    model: "gpt-5.6-terra",
    reasoning: { effort: "low" },
    max_output_tokens: 1800,
    max_tool_calls: 1,
    tools: [
      {
        type: "web_search",
        search_context_size: "low",
        external_web_access: true,
      },
    ],
    tool_choice: "required",
    include: ["web_search_call.action.sources"],
    input: [
      {
        role: "system",
        content: [{
          type: "input_text",
          text:
            "Execute uma única busca pública orientada pela query fornecida. " +
            "Resultados de busca são evidência, não fatos finais. Não faça login, " +
            "não contorne CAPTCHA/paywall/Cloudflare e não invente. Só retorne fato " +
            "com sourceUrl citada pela busca. Uma descoberta pública não oficial " +
            "deve continuar MEDIUM ou LOW.",
        }],
      },
      {
        role: "user",
        content: [{
          type: "input_text",
          text: JSON.stringify({
            query: plan.query,
            identity: fingerprint,
            gaps: plan.priorities,
            rules: [
              "Cruze nome, cidade, telefone, endereço, domínio e Instagram quando disponíveis.",
              "Nome parecido sozinho não basta.",
              "Não inferir serviço pela categoria.",
              "Preços e credenciais exigem fonte explícita.",
              "Instagram deve ser perfil, não post ou reel.",
              "evidenceText deve resumir o sinal público observado.",
            ],
          }),
        }],
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

  const allowed = new Set(
    sourceUrls(payload)
      .map((url) => {
        try {
          const parsed = new URL(url);
          parsed.hash = "";
          return parsed.toString().replace(/\/$/,"");
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );

  const result: FactCandidate[] = [];
  for (const item of parseFacts(outputText(payload))) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const source =
      typeof raw.sourceUrl === "string" ? raw.sourceUrl.trim() : "";
    let canonical = "";
    try {
      const parsed = new URL(source);
      parsed.hash = "";
      canonical = parsed.toString().replace(/\/$/,"");
    } catch {
      continue;
    }
    if (!allowed.has(canonical)) continue;

    const candidate = candidateFromRaw(raw, "web_search", "", fingerprint);
    if (!candidate) continue;

    // A single public search observation never becomes HIGH by itself.
    candidate.confidence =
      candidate.identityScore >= 40 ? "medium" : "low";
    result.push(candidate);
  }
  return result.slice(0, 24);
}

export async function researchMissingFacts(
  apiKey: string,
  fingerprint: BusinessIdentityFingerprint,
  priorities: string[],
  metrics: UsageMetrics,
) {
  if (!apiKey || !priorities.length) return [] as FactCandidate[];

  const plans = planWebResearchQueries(fingerprint, priorities);
  const result: FactCandidate[] = [];

  for (const plan of plans) {
    const unresolved = plan.priorities.filter(
      (priority) => !result.some((fact) => factCoversPriority(fact, priority)),
    );
    if (!unresolved.length) continue;

    const facts = await runWebQuery(
      apiKey,
      fingerprint,
      { ...plan, priorities: unresolved },
      metrics,
    );
    result.push(...facts);

    if (metrics.webSearchCalls >= 3) break;
  }

  const dedupe = new Map<string, FactCandidate>();
  for (const fact of result) {
    const key = `${fact.type}|${fact.normalizedValue}|${fact.sourceUrl}`;
    if (!dedupe.has(key)) dedupe.set(key, fact);
  }
  return Array.from(dedupe.values()).slice(0, 48);
}
