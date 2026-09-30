import type {
  BrowserlessReason,
  BusinessIdentityFingerprint,
  EnrichmentSourceKind,
  FactCandidate,
  PageSnapshot,
  SourceDiagnostic,
  UsageMetrics,
} from "./types.ts";
import {
  branchIdentityScoreFromText,
  domainOf,
  hostnameResolvesPublicly,
  identityScoreFromText,
  normalizeText,
  safePublicUrl,
} from "./security.ts";

const BROWSERLESS_ENDPOINT =
  "https://production-sfo.browserless.io/chromium/function";
const MAX_HTML_BYTES = 1_500_000;
const MAX_PAGES = 5;
const MAX_BROWSERLESS = 2;

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/");
}

function cleanText(value: string) {
  return decodeEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2]?.trim() ?? "";
}

function metaContent(html: string, keys: string[]) {
  const tags = html.match(/<meta\s+[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const key = (attr(tag, "property") || attr(tag, "name")).toLowerCase();
    if (keys.includes(key)) return decodeEntities(attr(tag, "content"));
  }
  return "";
}

function titleOf(html: string) {
  const value = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return cleanText(value).slice(0, 300);
}

function jsonLdOf(html: string) {
  const out: unknown[] = [];
  const regex = /<script[^>]+type\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && out.length < 30) {
    try {
      const parsed = JSON.parse(match[2]);
      if (Array.isArray(parsed)) out.push(...parsed.slice(0, 10));
      else out.push(parsed);
    } catch {
      // Invalid structured data is ignored.
    }
  }
  return out.slice(0, 30);
}

function embeddedJsonOf(html: string) {
  const out: unknown[] = [];
  const candidates: string[] = [];

  const next = html.match(
    /<script[^>]+id\s*=\s*(["'])__NEXT_DATA__\1[^>]*>([\s\S]*?)<\/script>/i,
  )?.[2];
  if (next) candidates.push(next);

  const scripts =
    html.match(
      /<script[^>]+type\s*=\s*(["'])application\/json\1[^>]*>[\s\S]*?<\/script>/gi,
    ) ?? [];
  for (const script of scripts.slice(0, 20)) {
    const raw = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "");
    if (raw.trim()) candidates.push(raw);
  }

  const assignmentPatterns = [
    /(?:window\.)?__INITIAL_STATE__\s*=\s*({[\s\S]{20,250000}?})\s*;?\s*<\/script>/gi,
    /(?:window\.)?__NUXT__\s*=\s*({[\s\S]{20,250000}?})\s*;?\s*<\/script>/gi,
  ];
  for (const pattern of assignmentPatterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null && candidates.length < 30) {
      candidates.push(match[1]);
    }
  }

  for (const raw of candidates.slice(0, 30)) {
    try {
      const parsed = JSON.parse(decodeEntities(raw).trim());
      out.push(parsed);
    } catch {
      // Public hydration state that is not valid JSON is ignored.
    }
  }
  return out.slice(0, 30);
}

function linksOf(html: string, base: URL) {
  const out: Array<{ url: string; text: string }> = [];
  const regex = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null && out.length < 500) {
    try {
      const resolved = new URL(decodeEntities(match[2]), base);
      if (!["http:","https:"].includes(resolved.protocol)) continue;
      resolved.hash = "";
      out.push({ url: resolved.toString(), text: cleanText(match[3]).slice(0, 160) });
    } catch {
      // Ignore malformed links.
    }
  }
  return out;
}

function imagesOf(html: string, base: URL) {
  const out: Array<{ url: string; alt: string }> = [];
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  for (const tag of tags.slice(0, 160)) {
    const raw = attr(tag, "src") || attr(tag, "data-src") || attr(tag, "data-lazy-src");
    if (!raw) continue;
    try {
      const resolved = new URL(decodeEntities(raw), base);
      if (!["http:","https:"].includes(resolved.protocol)) continue;
      out.push({ url: resolved.toString(), alt: decodeEntities(attr(tag, "alt")).slice(0, 220) });
    } catch {
      // Ignore malformed images.
    }
  }
  return out;
}

function parsePage(
  url: URL,
  html: string,
  method: "http" | "browserless",
  updated: string | null,
): PageSnapshot {
  return {
    url: url.toString(),
    finalUrl: url.toString(),
    domain: url.hostname.toLowerCase().replace(/^www\./, ""),
    title: titleOf(html),
    metaDescription: metaContent(html, ["description","og:description"]),
    text: cleanText(html).slice(0, 80_000),
    html: html.slice(0, MAX_HTML_BYTES),
    jsonLd: jsonLdOf(html),
    embeddedJson: embeddedJsonOf(html),
    links: linksOf(html, url),
    images: imagesOf(html, url),
    method,
    checkedAt: new Date().toISOString(),
    sourceUpdatedAt: updated,
  };
}

async function readLimited(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_HTML_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = MAX_HTML_BYTES - total;
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
      chunks.push(chunk);
      total += chunk.byteLength;
      if (value.byteLength > remaining) break;
    }
  } finally {
    reader.cancel().catch(() => undefined);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function fetchPublicHtml(value: string, timeoutMs = 7_000) {
  let current = safePublicUrl(value);
  if (!current) return null;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (!(await hostnameResolvesPublicly(current.hostname))) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "JanuarioLeads/1.0 business-deep-enrichment",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        const next = safePublicUrl(new URL(location, current).toString());
        if (!next) return null;
        current = next;
        continue;
      }
      if (!response.ok) return null;
      const type = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (type && !type.includes("text/html") && !type.includes("application/xhtml+xml")) return null;
      const length = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(length) && length > 2_000_000) return null;
      const html = await readLimited(response);
      return {
        page: parsePage(current, html, "http", response.headers.get("last-modified")),
        status: response.status,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

function browserlessCode() {
  return String.raw`
export default async ({ page, context }) => {
  const target = context.url;
  const blocked = (host) => {
    host = String(host || "").toLowerCase().replace(/\.$/, "");
    return host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      host === "metadata.google.internal" || host === "instance-data" ||
      /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "::1" || host.startsWith("fc") || host.startsWith("fd") ||
      /^fe[89ab]/.test(host);
  };
  const allowed = (value) => {
    try {
      const u = new URL(value);
      return (u.protocol === "http:" || u.protocol === "https:") &&
        !u.username && !u.password && !blocked(u.hostname);
    } catch { return false; }
  };
  if (!allowed(target)) return { data: { ok: false, blocked: true } };
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const u = req.url();
    if (u.startsWith("data:") || u.startsWith("blob:") || u === "about:blank") return req.continue();
    if (!allowed(u)) return req.abort();
    req.continue();
  });
  let status = 0;
  try {
    const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 18000 });
    status = response ? response.status() : 0;
  } catch {
    return { data: { ok: false, error: "NAVIGATION_FAILED" } };
  }
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const protectedPage = await page.evaluate(() => {
    const title = (document.title || "").toLowerCase();
    const text = (document.body?.innerText || "").slice(0, 5000).toLowerCase();
    return Boolean(document.querySelector("input[type='password'],iframe[src*='recaptcha'],iframe[src*='hcaptcha'],[class*='captcha'],[id*='captcha']")) ||
      title.includes("just a moment") || title.includes("attention required") ||
      text.includes("verify you are human") || text.includes("checking your browser");
  });
  if (protectedPage) return { data: { ok: false, blocked: true, status } };
  const html = (await page.content()).slice(0, 1500000);
  return { data: { ok: true, status, finalUrl: page.url(), html } };
};`;
}

type BrowserlessFetchResult = {
  page: PageSnapshot | null;
  blocked: boolean;
  error: string | null;
};

async function fetchWithBrowserless(
  value: string,
  token: string,
): Promise<BrowserlessFetchResult> {
  const normalized = safePublicUrl(value);
  if (!normalized || !(await hostnameResolvesPublicly(normalized.hostname))) {
    return { page: null, blocked: true, error: "unsafe_target" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 24_000);
  try {
    const response = await fetch(
      `${BROWSERLESS_ENDPOINT}?token=${encodeURIComponent(token)}&timeout=25000`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: browserlessCode(),
          context: { url: normalized.toString() },
        }),
      },
    );
    if (!response.ok) {
      return { page: null, blocked: false, error: "browserless_http_error" };
    }
    const raw = await response.json() as Record<string, unknown>;
    const payload = (
      raw.data && typeof raw.data === "object" ? raw.data : raw
    ) as Record<string, unknown>;
    if (payload.blocked === true) {
      return { page: null, blocked: true, error: "protected_page" };
    }
    if (payload.ok !== true || typeof payload.html !== "string") {
      return {
        page: null,
        blocked: false,
        error:
          typeof payload.error === "string"
            ? payload.error
            : "browserless_invalid_payload",
      };
    }
    const finalUrl = safePublicUrl(
      typeof payload.finalUrl === "string"
        ? payload.finalUrl
        : normalized.toString(),
    );
    if (!finalUrl || !(await hostnameResolvesPublicly(finalUrl.hostname))) {
      return { page: null, blocked: true, error: "unsafe_final_url" };
    }
    return {
      page: parsePage(finalUrl, payload.html, "browserless", null),
      blocked: false,
      error: null,
    };
  } catch {
    return { page: null, blocked: false, error: "browserless_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

const COMMERCIAL_URL_RE =
  /(?:^|[./_-])(pedido|pedidos|cardapio|menu|delivery|order|ordering|booking|agendamento|reservas?|shop|store|loja)(?:[./_-]|$)/i;

export function isCommercialPlatformUrl(value: string) {
  const url = safePublicUrl(value);
  if (!url) return false;
  const hay = `${url.hostname}${url.pathname}`;
  if (COMMERCIAL_URL_RE.test(hay)) return true;
  const domain = domainOf(url.toString());
  return [
    "ifood.com.br",
    "anota.ai",
    "goomer.app",
    "menuintegrado.com.br",
    "deliverydireto.com.br",
    "brendi.com.br",
    "booksy.com",
    "trinks.com",
    "sympla.com.br",
  ].some((known) => domain === known || domain.endsWith(`.${known}`));
}

function scriptStats(html: string) {
  const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) ?? [];
  const external = scripts.filter((tag) => /\bsrc\s*=/.test(tag)).length;
  const bytes = scripts.reduce((sum, tag) => sum + tag.length, 0);
  return { count: scripts.length, external, bytes };
}

function frameworkSignals(html: string) {
  const out = new Set<string>();
  if (/__NEXT_DATA__|\/_next\//i.test(html)) out.add("nextjs");
  if (/__NUXT__|\/_nuxt\//i.test(html)) out.add("nuxt");
  if (/data-reactroot|react(?:\.production)?\.min|react-dom|react-refresh/i.test(html)) out.add("react");
  if (/data-v-[a-f0-9]+|vue(?:\.runtime)?|__VUE__/i.test(html)) out.add("vue");
  if (/ng-version|<app-root\b|angular/i.test(html)) out.add("angular");
  if (/@vite|vite\/client|react-refresh/i.test(html)) out.add("vite");
  return Array.from(out);
}

function appContainerText(html: string) {
  const patterns = [
    /<(?:div|main)[^>]+id\s*=\s*(["'])(?:root|app|__next)\1[^>]*>([\s\S]*?)<\/(?:div|main)>/i,
    /<app-root\b[^>]*>([\s\S]*?)<\/app-root>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    const raw = match?.[2] ?? match?.[1] ?? "";
    if (raw) return cleanText(raw).slice(0, 20_000);
  }
  return "";
}

function priceSignalCount(text: string) {
  return (text.match(/R\$\s*\d{1,5}(?:[.,]\d{2})?/gi) ?? []).length;
}

function commercialTokens(priorities: string[]) {
  const base = [
    "produto","item","cardapio","menu","preco","pedido","adicionar","carrinho",
    "categoria","bebida","lanche","entrega","retirada","delivery","agendamento",
    "reserv","comprar","shop","servico","tratamento","portfolio",
  ];
  return Array.from(
    new Set([
      ...base,
      ...priorities.flatMap((value) =>
        normalizeText(value).split(" ").filter((token) => token.length >= 4)
      ),
    ]),
  ).slice(0, 60);
}

export function analyzeCommercialPage(
  page: PageSnapshot,
  priorities: string[],
) {
  const html = page.html;
  const normalizedText = normalizeText(page.text);
  const words = normalizedText.split(" ").filter(Boolean);
  const tokens = commercialTokens(priorities);
  let signals = 0;
  for (const token of tokens) {
    const matches = normalizedText.match(new RegExp(`\\b${token}`, "g"));
    signals += Math.min(matches?.length ?? 0, 8);
  }
  const prices = priceSignalCount(page.text);
  signals += Math.min(prices * 2, 20);

  const scripts = scriptStats(html);
  const frameworks = frameworkSignals(html);
  const mainText = appContainerText(html);
  const hasAppContainer =
    /id\s*=\s*(["'])(?:root|app|__next)\1|<app-root\b/i.test(html);
  const spaShell =
    hasAppContainer &&
    mainText.length < 180 &&
    (frameworks.length > 0 || scripts.count >= 4);
  const scriptDominance =
    html.length > 0 &&
    scripts.bytes / html.length >= 0.35 &&
    page.text.length < 2500;
  const loadingShell =
    /(?:skeleton|loading|loader|carregando|aguarde)/i.test(
      `${mainText} ${page.text.slice(0, 1200)}`,
    );
  const clientSideSignals =
    /\b(fetch\s*\(|axios\.|XMLHttpRequest|graphql|hydrateRoot|createRoot\s*\()/i.test(
      html,
    );
  const routeCommercial = isCommercialPlatformUrl(page.finalUrl);
  const commercialContentDensity =
    Math.round((signals / Math.max(words.length, 1)) * 1000 * 100) / 100;

  return {
    htmlBytes: new TextEncoder().encode(html).byteLength,
    textLength: page.text.length,
    linkCount: page.links.length,
    scriptCount: scripts.count,
    externalScriptCount: scripts.external,
    frameworkSignals: frameworks,
    jsonLdCount: page.jsonLd.length,
    embeddedJsonCount: page.embeddedJson?.length ?? 0,
    imageCount: page.images.length,
    commercialSignals: signals,
    commercialContentDensity,
    explicitPriceSignals: prices,
    hasAppContainer,
    spaShell,
    scriptDominance,
    loadingShell,
    clientSideSignals,
    routeCommercial,
  };
}

export function shouldUseBrowserless(
  page: PageSnapshot | null,
  priorities: string[],
  deterministicFacts: FactCandidate[] = [],
): { use: boolean; reason: BrowserlessReason } {
  if (!page) return { use: true, reason: "html_insufficient" };

  const profile = analyzeCommercialPage(page, priorities);
  const commercialFacts = deterministicFacts.filter((fact) =>
    [
      "product","menu_item","price","service","treatment",
      "channel_delivery","channel_menu","channel_booking",
      "channel_reservation","channel_ecommerce",
    ].includes(fact.type)
  ).length;
  const dynamicScore =
    (profile.spaShell ? 4 : 0) +
    (profile.scriptDominance ? 2 : 0) +
    (profile.clientSideSignals ? 1 : 0) +
    (profile.loadingShell ? 2 : 0) +
    (profile.frameworkSignals.length > 0 ? 1 : 0);
  const commerciallyRelevant =
    profile.routeCommercial ||
    profile.commercialSignals >= 4 ||
    profile.explicitPriceSignals > 0;

  if (page.text.length < 350 && page.jsonLd.length === 0) {
    return { use: true, reason: "html_insufficient" };
  }
  if (profile.spaShell && commercialFacts <= 1) {
    return { use: true, reason: "spa_shell" };
  }
  if (
    commerciallyRelevant &&
    commercialFacts === 0 &&
    dynamicScore >= 2
  ) {
    return { use: true, reason: "commercial_content_missing" };
  }
  if (
    commerciallyRelevant &&
    commercialFacts <= 1 &&
    dynamicScore >= 4
  ) {
    return { use: true, reason: "dynamic_app_detected" };
  }
  if (
    profile.routeCommercial &&
    commercialFacts === 0 &&
    profile.commercialContentDensity < 3
  ) {
    return { use: true, reason: "js_render_required" };
  }

  return {
    use: false,
    reason:
      commercialFacts > 0 || profile.commercialSignals >= 4
        ? "commercial_content_present"
        : "sufficient_static_content",
  };
}

const COMMON_RELEVANT = [
  "servic","service","tratament","especial","equipe","team","profission","barbeir",
  "dentist","menu","cardap","produto","portfolio","galeria","trabalho","preco","price",
  "plano","agend","booking","reserv","contato","contact","sobre","about","facility",
];

export function selectInternalLinks(
  home: PageSnapshot,
  priorities: string[],
  limit = 4,
) {
  const base = new URL(home.finalUrl);
  const priorityTokens = priorities
    .flatMap((value) => normalizeText(value).split(" "))
    .filter((token) => token.length >= 4)
    .slice(0, 30);
  const seen = new Set<string>();
  const scored: Array<{ url: string; score: number }> = [];

  for (const link of home.links) {
    try {
      const url = new URL(link.url);
      if (url.origin !== base.origin) continue;
      url.hash = "";
      url.search = "";
      if (/\.(pdf|jpg|jpeg|png|webp|gif|svg|zip|rar)$/i.test(url.pathname)) continue;
      if (/\/(login|signin|admin|wp-admin|cart|checkout)(\/|$)/i.test(url.pathname)) continue;
      const normalized = url.toString().replace(/\/$/, "");
      if (normalized === base.toString().replace(/\/$/, "") || seen.has(normalized)) continue;
      seen.add(normalized);
      const hay = normalizeText(url.pathname + " " + link.text);
      let score = 0;
      for (const token of COMMON_RELEVANT) if (hay.includes(token)) score += 3;
      for (const token of priorityTokens) if (hay.includes(token)) score += 4;
      if (score > 0) scored.push({ url: url.toString(), score });
    } catch {
      // Ignore malformed links.
    }
  }
  return scored.sort((a,b) => b.score - a.score).slice(0, limit).map((item) => item.url);
}

function assignSource(
  page: PageSnapshot,
  sourceKind: EnrichmentSourceKind,
  linkedFrom: string | null,
) {
  page.sourceKind = sourceKind;
  page.linkedFrom = linkedFrom;
  return page;
}

function linkedCommercialPlatforms(page: PageSnapshot, limit = 2) {
  if (page.sourceKind !== "official_website") return [] as string[];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const link of page.links) {
    const url = safePublicUrl(link.url);
    if (!url || !isCommercialPlatformUrl(url.toString())) continue;
    if (url.origin === new URL(page.finalUrl).origin) continue;
    const canonical = url.toString().replace(/#.*$/, "");
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(canonical);
    if (out.length >= limit) break;
  }
  return out;
}

function emptyFound() {
  return {
    facts: 0,
    products: 0,
    menuItems: 0,
    prices: 0,
    images: 0,
    services: 0,
    channels: 0,
  };
}

function sourceDiagnostic(
  page: PageSnapshot,
  priorities: string[],
  sourceKind: EnrichmentSourceKind,
  linkedFrom: string | null,
  identityScore: number,
  decision: SourceDiagnostic["browserlessDecision"],
  reason: BrowserlessReason,
  method: SourceDiagnostic["method"],
): SourceDiagnostic {
  const profile = analyzeCommercialPage(page, priorities);
  return {
    url: page.finalUrl,
    domain: page.domain,
    title: page.title || null,
    sourceKind,
    linkedFrom,
    method,
    extractionStatus: "partial",
    browserlessDecision: decision,
    browserlessReason: reason,
    identityScore,
    confidence:
      identityScore >= 80 ? "high" : identityScore >= 45 ? "medium" : "low",
    htmlBytes: profile.htmlBytes,
    textLength: profile.textLength,
    linkCount: profile.linkCount,
    scriptCount: profile.scriptCount,
    frameworkSignals: profile.frameworkSignals,
    jsonLdCount: profile.jsonLdCount,
    embeddedJsonCount: profile.embeddedJsonCount,
    imageCount: profile.imageCount,
    commercialSignals: profile.commercialSignals,
    commercialContentDensity: profile.commercialContentDensity,
    found: emptyFound(),
  };
}

function platformIdentityScore(
  fingerprint: BusinessIdentityFingerprint,
  page: PageSnapshot,
) {
  return branchIdentityScoreFromText(
    fingerprint,
    `${page.title} ${page.metaDescription} ${page.text.slice(0, 16000)}`,
  );
}

async function materializePage(
  url: string,
  sourceKind: EnrichmentSourceKind,
  linkedFrom: string | null,
  priorities: string[],
  fingerprint: BusinessIdentityFingerprint,
  browserlessToken: string,
  browserlessBudget: { used: number },
  metrics: UsageMetrics,
) {
  const http = await fetchPublicHtml(url);
  if (http?.page) {
    metrics.httpPages += 1;
    metrics.httpPagesFetched += 1;
  }
  let page = http?.page
    ? assignSource(http.page, sourceKind, linkedFrom)
    : null;

  let identityScore =
    page && sourceKind === "official_linked_platform"
      ? platformIdentityScore(fingerprint, page)
      : page
        ? identityScoreFromText(
            fingerprint,
            page.finalUrl,
            `${page.title} ${page.metaDescription} ${page.text.slice(0, 12000)}`,
          )
        : 0;

  const initialFacts = page
    ? deterministicOfficialFacts([page], fingerprint)
    : [];
  const decision = shouldUseBrowserless(page, priorities, initialFacts);
  let browserlessDecision: SourceDiagnostic["browserlessDecision"] =
    decision.use ? "unavailable" : "not_needed";
  let browserlessReason = decision.reason;
  let method: SourceDiagnostic["method"] = "http";

  if (
    decision.use &&
    browserlessToken &&
    browserlessBudget.used < MAX_BROWSERLESS
  ) {
    const rendered = await fetchWithBrowserless(url, browserlessToken);
    browserlessBudget.used += 1;
    metrics.browserlessCalls += 1;
    metrics.browserlessRenders += 1;

    if (rendered.page) {
      page = assignSource(rendered.page, sourceKind, linkedFrom);
      method = http?.page ? "http+browserless" : "browserless";
      browserlessDecision = "used";
      identityScore =
        sourceKind === "official_linked_platform"
          ? platformIdentityScore(fingerprint, page)
          : identityScoreFromText(
              fingerprint,
              page.finalUrl,
              `${page.title} ${page.metaDescription} ${page.text.slice(0, 12000)}`,
            );
    } else {
      browserlessDecision = rendered.blocked ? "failed" : "failed";
      browserlessReason = rendered.blocked
        ? "browserless_failed"
        : "browserless_failed";
    }
  } else if (decision.use && !browserlessToken) {
    browserlessDecision = "unavailable";
    browserlessReason = "browserless_unavailable";
  }

  if (!page) {
    return {
      page: null,
      diagnostic: null as SourceDiagnostic | null,
      error: "source_unavailable",
    };
  }

  const diagnostic = sourceDiagnostic(
    page,
    priorities,
    sourceKind,
    linkedFrom,
    identityScore,
    browserlessDecision,
    browserlessReason,
    method,
  );

  if (sourceKind === "official_linked_platform" && identityScore < 45) {
    diagnostic.extractionStatus = "failed";
    diagnostic.browserlessReason = "identity_mismatch";
    return {
      page: null,
      diagnostic,
      error: "linked_platform_identity_mismatch",
    };
  }

  return { page, diagnostic, error: null };
}

export async function crawlOfficialWebsite(
  website: string,
  priorities: string[],
  metrics: UsageMetrics,
  fingerprint: BusinessIdentityFingerprint,
) {
  const rootUrl = safePublicUrl(website);
  if (!rootUrl) {
    return {
      pages: [] as PageSnapshot[],
      diagnostics: [] as SourceDiagnostic[],
      errors: ["website_invalid"],
    };
  }

  const pages: PageSnapshot[] = [];
  const diagnostics: SourceDiagnostic[] = [];
  const errors: string[] = [];
  const browserlessToken = Deno.env.get("BROWSERLESS_API_TOKEN")?.trim() ?? "";
  const browserlessBudget = { used: 0 };
  const rootKind: EnrichmentSourceKind = isCommercialPlatformUrl(
    rootUrl.toString(),
  )
    ? "official_linked_platform"
    : "official_website";

  const root = await materializePage(
    rootUrl.toString(),
    rootKind,
    rootKind === "official_linked_platform" ? "google_places_website" : null,
    priorities,
    fingerprint,
    browserlessToken,
    browserlessBudget,
    metrics,
  );

  if (root.diagnostic) diagnostics.push(root.diagnostic);
  if (!root.page) {
    errors.push(root.error ?? "official_site_unavailable");
    return { pages, diagnostics, errors };
  }

  pages.push(root.page);

  // A third-party commercial destination explicitly linked from an official
  // page is valuable evidence, but it remains a linked platform rather than
  // becoming the company's official website.
  const linkedPlatforms = linkedCommercialPlatforms(root.page, 1);
  for (const url of linkedPlatforms) {
    if (pages.length >= MAX_PAGES) break;
    const linked = await materializePage(
      url,
      "official_linked_platform",
      root.page.finalUrl,
      priorities,
      fingerprint,
      browserlessToken,
      browserlessBudget,
      metrics,
    );
    if (linked.diagnostic) diagnostics.push(linked.diagnostic);
    if (linked.page) pages.push(linked.page);
    else errors.push(linked.error ?? "linked_platform_unavailable");
  }

  const links = selectInternalLinks(
    root.page,
    priorities,
    Math.max(0, MAX_PAGES - pages.length),
  );
  for (const url of links) {
    if (pages.length >= MAX_PAGES) break;
    const internal = await materializePage(
      url,
      rootKind,
      root.page.finalUrl,
      priorities,
      fingerprint,
      browserlessToken,
      browserlessBudget,
      metrics,
    );
    if (internal.diagnostic) diagnostics.push(internal.diagnostic);
    if (internal.page) pages.push(internal.page);
    else errors.push(internal.error ?? "internal_page_unavailable");
  }

  metrics.pagesAnalyzed += pages.length;
  return { pages, diagnostics, errors };
}

export function finalizeSourceDiagnostics(
  diagnostics: SourceDiagnostic[],
  facts: FactCandidate[],
) {
  const byUrl = new Map(
    diagnostics.map((item) => [item.url.replace(/\/$/, ""), { ...item, found: { ...item.found } }]),
  );

  for (const fact of facts) {
    const item = byUrl.get(fact.sourceUrl.replace(/\/$/, ""));
    if (!item) continue;
    item.found.facts += 1;
    if (fact.type === "product") item.found.products += 1;
    if (fact.type === "menu_item") item.found.menuItems += 1;
    if (fact.type === "price" || fact.value.price) item.found.prices += 1;
    if (fact.type.endsWith("_image")) item.found.images += 1;
    if (fact.type === "service" || fact.type === "treatment") item.found.services += 1;
    if (fact.type.startsWith("channel_")) item.found.channels += 1;
  }

  for (const item of byUrl.values()) {
    if (item.extractionStatus === "failed" || item.extractionStatus === "blocked") {
      continue;
    }
    const commercialFacts =
      item.found.products +
      item.found.menuItems +
      item.found.prices +
      item.found.services +
      item.found.channels;

    if (item.found.facts >= 4 || commercialFacts >= 3) {
      item.extractionStatus = "successful";
    } else if (item.found.facts > 0) {
      item.extractionStatus = "partial";
    } else if (
      isCommercialPlatformUrl(item.url) ||
      item.commercialSignals >= 4 ||
      item.browserlessReason === "commercial_content_missing" ||
      item.browserlessReason === "spa_shell" ||
      item.browserlessReason === "dynamic_app_detected"
    ) {
      item.extractionStatus = "inconclusive";
    } else {
      item.extractionStatus = "successful";
    }
  }

  return Array.from(byUrl.values());
}

function fact(
  type: string,
  label: string,
  value: FactCandidate["value"],
  page: PageSnapshot,
  sourceType: FactCandidate["sourceType"],
  extractionMethod: string,
  evidence: string,
  identityScore = 100,
): FactCandidate {
  const normalizedValue = normalizeText(
    value.url || value.imageUrl || [value.name,value.price,value.role,value.detail].filter(Boolean).join(" "),
  );
  return {
    type,
    label: label.slice(0, 220),
    value,
    normalizedValue,
    sourceUrl: page.finalUrl,
    sourceDomain: page.domain,
    sourceType,
    extractionMethod,
    identityScore,
    confidence: identityScore >= 80 ? "high" : identityScore >= 45 ? "medium" : "low",
    evidenceSummary: evidence.slice(0, 500),
    sourceUpdatedAt: page.sourceUpdatedAt,
  };
}

function schemaObjects(input: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const row = value as Record<string, unknown>;
    out.push(row);
    for (const key of ["@graph","itemListElement","makesOffer","hasOfferCatalog","itemOffered","employee","founder","member","department","menuSection","hasMenuSection","hasMenuItem"]) {
      if (key in row) visit(row[key]);
    }
  };
  visit(input);
  return out.slice(0, 160);
}

function schemaType(row: Record<string, unknown>) {
  const raw = row["@type"];
  return Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
}

function schemaName(row: Record<string, unknown>) {
  return typeof row.name === "string" ? row.name.trim().slice(0, 220) : "";
}

export function deterministicOfficialFacts(
  pages: PageSnapshot[],
  fingerprint: BusinessIdentityFingerprint,
) {
  const facts: FactCandidate[] = [];
  for (const page of pages) {
    const isPlatform = page.sourceKind === "official_linked_platform";
    const sourceType = (
      websiteType: FactCandidate["sourceType"],
      platformType: FactCandidate["sourceType"],
    ) => isPlatform ? platformType : websiteType;
    const identityScore = isPlatform
      ? platformIdentityScore(fingerprint, page)
      : identityScoreFromText(
          fingerprint,
          page.finalUrl,
          `${page.title} ${page.metaDescription} ${page.text.slice(0,8000)}`,
        );

    const localIdentityScore = branchIdentityScoreFromText(
      fingerprint,
      `${page.title} ${page.metaDescription} ${page.text.slice(0,12000)}`,
    );

    for (const link of page.links) {
      const url = safePublicUrl(link.url);
      if (!url) continue;
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const hay = normalizeText(link.text + " " + url.pathname + " " + host);
      let type = "";
      if (
        host === "wa.me" ||
        host === "api.whatsapp.com" ||
        host === "whatsapp.com" ||
        /\bwhats(app)?\b/.test(hay)
      ) type = "channel_whatsapp";
      else if (host.includes("ifood.com") || /delivery|pedido|order/.test(hay)) type = "channel_delivery";
      else if (/agend|booking|booksy|trinks/.test(hay)) type = "channel_booking";
      else if (/reserv/.test(hay)) type = "channel_reservation";
      else if (/cardap|menu/.test(hay)) type = "channel_menu";
      else if (/checkout|ecommerce|e-commerce|comprar|shop|store/.test(hay)) type = "channel_ecommerce";
      else if (host === "instagram.com" && url.pathname.split("/").filter(Boolean).length === 1) type = "official_instagram";
      if (!type) continue;

      let linkIdentityScore = identityScore;
      if (
        type === "channel_booking" ||
        type === "channel_reservation" ||
        type === "channel_whatsapp"
      ) {
        linkIdentityScore = localIdentityScore;

        if (type === "channel_whatsapp" && fingerprint.phone) {
          const targetDigits = url.toString().replace(/\D/g, "");
          if (targetDigits.includes(fingerprint.phone.slice(-10))) {
            linkIdentityScore = 100;
          }
        }
      }

      facts.push(
        fact(
          type,
          link.text || type,
          { url: url.toString() },
          page,
          sourceType("official_link", "official_platform_link"),
          "html_anchor",
          link.text || url.toString(),
          linkIdentityScore,
        ),
      );
    }

    for (const image of page.images) {
      const hay = normalizeText(image.alt + " " + image.url);
      if (/logo|icon|favicon|sprite|placeholder|banner/.test(hay)) continue;
      let type = "";
      if (/antes.*depois|before.*after|beforeafter/.test(hay)) type = "before_after_image";
      else if (/portfolio|portifolio|galeria|trabalho|resultado|cliente/.test(hay)) type = "portfolio_image";
      else if (/equipe|team|profission|barbeir|dentist|doctor|dra |dr /.test(hay)) type = "professional_image";
      else if (/ambiente|fachada|interior|clinica|salao|loja|oficina|facility/.test(hay)) type = "facility_image";
      else if (/produto|product|burger|pizza|prato|dish|roupa|shoe/.test(hay)) type = "product_image";
      if (!type) continue;
      const imageIdentityScore =
        type === "professional_image" || type === "facility_image"
          ? localIdentityScore
          : identityScore;
      facts.push(
        fact(
          type,
          image.alt || type,
          { imageUrl: image.url },
          page,
          sourceType("official_image", "official_platform_image"),
          "html_img",
          image.alt || image.url,
          imageIdentityScore,
        ),
      );
    }

    for (const root of page.jsonLd) {
      for (const row of schemaObjects(root)) {
        const types = schemaType(row);
        const name = schemaName(row);
        if (types.some((t) => /Service/i.test(t)) && name) {
          facts.push(fact("service", name, { name, description: typeof row.description === "string" ? row.description.slice(0,500) : "" }, page, sourceType("official_schema", "official_platform_schema"), "json_ld", name, identityScore));
        }
        if (types.some((t) => /Product|MenuItem/i.test(t)) && name) {
          facts.push(fact(types.some((t)=>/MenuItem/i.test(t)) ? "menu_item" : "product", name, { name, description: typeof row.description === "string" ? row.description.slice(0,500) : "" }, page, sourceType("official_schema", "official_platform_schema"), "json_ld", name, identityScore));
        }
        if (types.some((t) => /Person/i.test(t)) && name) {
          const role = typeof row.jobTitle === "string" ? row.jobTitle.slice(0,180) : "";
          facts.push(
            fact(
              "professional",
              name,
              { name, role },
              page,
              "official_schema",
              "json_ld",
              [name,role].filter(Boolean).join(" — "),
              localIdentityScore,
            ),
          );
        }
        if (types.some((t) => /Offer/i.test(t))) {
          const price = typeof row.price === "string" || typeof row.price === "number" ? String(row.price) : "";
          const currency = typeof row.priceCurrency === "string" ? row.priceCurrency : "BRL";
          const offered = row.itemOffered && typeof row.itemOffered === "object" ? schemaName(row.itemOffered as Record<string,unknown>) : "";
          if (price) facts.push(fact("price", offered || name || "Preço publicado", { name: offered || name, price, currency }, page, sourceType("official_schema", "official_platform_schema"), "json_ld", [offered || name,price,currency].filter(Boolean).join(" "), identityScore));
        }
        if (typeof row.hasMenu === "string") {
          const menu = safePublicUrl(row.hasMenu);
          if (menu) facts.push(fact("channel_menu", "Cardápio", { url: menu.toString() }, page, sourceType("official_schema", "official_platform_schema"), "json_ld", menu.toString(), identityScore));
        }
        const sameAs = Array.isArray(row.sameAs) ? row.sameAs : typeof row.sameAs === "string" ? [row.sameAs] : [];
        for (const value of sameAs) {
          const url = safePublicUrl(value);
          if (!url) continue;
          const host = domainOf(url.toString());
          if (host === "instagram.com" && url.pathname.split("/").filter(Boolean).length === 1) {
            facts.push(fact("official_instagram", "Instagram oficial", { url: url.toString() }, page, sourceType("official_schema", "official_platform_schema"), "json_ld", url.toString(), identityScore));
          }
        }
      }
    }
  }

  for (const page of pages) {
    const isPlatform = page.sourceKind === "official_linked_platform";
    const sourceType: FactCandidate["sourceType"] = isPlatform
      ? "official_platform_embedded_data"
      : "official_embedded_data";
    const identityScore = isPlatform
      ? platformIdentityScore(fingerprint, page)
      : identityScoreFromText(
          fingerprint,
          page.finalUrl,
          `${page.title} ${page.metaDescription} ${page.text.slice(0, 12000)}`,
        );

    const visit = (value: unknown, depth = 0) => {
      if (depth > 8 || value === null || value === undefined) return;
      if (Array.isArray(value)) {
        for (const item of value.slice(0, 200)) visit(item, depth + 1);
        return;
      }
      if (typeof value !== "object") return;
      const row = value as Record<string, unknown>;
      const name =
        typeof row.name === "string"
          ? row.name.trim()
          : typeof row.title === "string"
            ? row.title.trim()
            : typeof row.nome === "string"
              ? row.nome.trim()
              : "";
      const priceRaw =
        row.price ?? row.preco ?? row.valor ?? row.amount ?? row.unitPrice;
      const price =
        typeof priceRaw === "number" || typeof priceRaw === "string"
          ? String(priceRaw).replace(/^R\$\s*/i, "").trim()
          : "";
      const description =
        typeof row.description === "string"
          ? row.description.trim()
          : typeof row.descricao === "string"
            ? row.descricao.trim()
            : "";
      const imageRaw =
        typeof row.imageUrl === "string"
          ? row.imageUrl
          : typeof row.image === "string"
            ? row.image
            : typeof row.imagem === "string"
              ? row.imagem
              : "";
      const imageUrl = imageRaw
        ? safePublicUrl(imageRaw)?.toString() ?? ""
        : "";

      if (
        name &&
        name.length >= 2 &&
        name.length <= 180 &&
        price &&
        /^\d{1,6}(?:[.,]\d{1,2})?$/.test(price.replace(/\s/g, ""))
      ) {
        facts.push(
          fact(
            "menu_item",
            name,
            { name, description: description.slice(0, 500), price, currency: "BRL" },
            page,
            sourceType,
            "embedded_public_json",
            `${name} R$ ${price}`,
            identityScore,
          ),
        );
        if (imageUrl) {
          facts.push(
            fact(
              "product_image",
              name,
              { name, imageUrl },
              page,
              isPlatform ? "official_platform_image" : "official_image",
              "embedded_public_json",
              name,
              identityScore,
            ),
          );
        }
      }

      for (const child of Object.values(row)) {
        if (child && typeof child === "object") visit(child, depth + 1);
      }
    };

    for (const payload of page.embeddedJson ?? []) visit(payload);

    const blockRegex =
      /<(article|li)\b[^>]*>([\s\S]{0,5000}?)<\/\1>/gi;
    const cards: Array<{ name: string; price: string; description: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = blockRegex.exec(page.html)) !== null && cards.length < 80) {
      const text = cleanText(match[2]);
      const price = text.match(/R\$\s*(\d{1,5}(?:[.,]\d{2})?)/i)?.[1] ?? "";
      if (!price) continue;
      const heading =
        match[2].match(/<h[1-6][^>]*>([\s\S]{1,240}?)<\/h[1-6]>/i)?.[1] ??
        match[2].match(/<strong[^>]*>([\s\S]{1,240}?)<\/strong>/i)?.[1] ??
        "";
      const name = cleanText(heading).slice(0, 180);
      if (!name || name.length < 2 || /^R\$/i.test(name)) continue;
      cards.push({
        name,
        price,
        description: text.replace(name, "").replace(/R\$\s*\d{1,5}(?:[.,]\d{2})?/i, "").trim().slice(0, 500),
      });
    }
    const distinctCards = new Map(cards.map((card) => [`${normalizeText(card.name)}|${card.price}`, card]));
    if (
      distinctCards.size >= 2 ||
      (isCommercialPlatformUrl(page.finalUrl) && distinctCards.size >= 1)
    ) {
      for (const card of Array.from(distinctCards.values()).slice(0, 40)) {
        facts.push(
          fact(
            "menu_item",
            card.name,
            {
              name: card.name,
              description: card.description,
              price: card.price,
              currency: "BRL",
            },
            page,
            isPlatform ? "official_platform_text" : "official_text",
            "repeated_commercial_card",
            `${card.name} R$ ${card.price}`,
            identityScore,
          ),
        );
      }
    }
  }

  const dedupe = new Map<string, FactCandidate>();
  for (const item of facts) {
    const key = `${item.type}|${item.normalizedValue}|${item.sourceUrl}`;
    if (!dedupe.has(key)) dedupe.set(key,item);
  }
  return Array.from(dedupe.values()).slice(0,120);
}
