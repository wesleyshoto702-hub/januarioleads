import type {
  BusinessIdentityFingerprint,
  FactCandidate,
  PageSnapshot,
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

function parsePage(url: URL, html: string, method: "http" | "browserless", updated: string | null): PageSnapshot {
  return {
    url: url.toString(),
    finalUrl: url.toString(),
    domain: url.hostname.toLowerCase().replace(/^www\./, ""),
    title: titleOf(html),
    metaDescription: metaContent(html, ["description","og:description"]),
    text: cleanText(html).slice(0, 80_000),
    html: html.slice(0, MAX_HTML_BYTES),
    jsonLd: jsonLdOf(html),
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

async function fetchWithBrowserless(value: string, token: string) {
  const normalized = safePublicUrl(value);
  if (!normalized || !(await hostnameResolvesPublicly(normalized.hostname))) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 24_000);
  try {
    const response = await fetch(
      `${BROWSERLESS_ENDPOINT}?token=${encodeURIComponent(token)}&timeout=25000`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: browserlessCode(), context: { url: normalized.toString() } }),
      },
    );
    if (!response.ok) return null;
    const raw = await response.json() as Record<string, unknown>;
    const payload = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;
    if (payload.ok !== true || payload.blocked === true || typeof payload.html !== "string") return null;
    const finalUrl = safePublicUrl(typeof payload.finalUrl === "string" ? payload.finalUrl : normalized.toString());
    if (!finalUrl || !(await hostnameResolvesPublicly(finalUrl.hostname))) return null;
    return parsePage(finalUrl, payload.html, "browserless", null);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function meaningful(page: PageSnapshot | null) {
  // A navigation shell with several links is not enough to skip rendering.
  // JS-heavy sites usually expose little real text/structured data initially.
  return Boolean(page && (page.text.length >= 500 || page.jsonLd.length > 0));
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

export async function crawlOfficialWebsite(
  website: string,
  priorities: string[],
  metrics: UsageMetrics,
) {
  const rootUrl = safePublicUrl(website);
  if (!rootUrl) return { pages: [] as PageSnapshot[], errors: ["website_invalid"] };

  const pages: PageSnapshot[] = [];
  const errors: string[] = [];
  const browserlessToken = Deno.env.get("BROWSERLESS_API_TOKEN")?.trim() ?? "";
  let browserlessUsed = 0;

  let root = await fetchPublicHtml(rootUrl.toString());
  if (root?.page) {
    metrics.httpPages += 1;
  }
  let home = root?.page ?? null;
  if (!meaningful(home) && browserlessToken && browserlessUsed < MAX_BROWSERLESS) {
    const rendered = await fetchWithBrowserless(rootUrl.toString(), browserlessToken);
    if (rendered) {
      home = rendered;
      browserlessUsed += 1;
      metrics.browserlessCalls += 1;
    }
  }

  if (!home) {
    errors.push("official_site_unavailable");
    return { pages, errors };
  }

  pages.push(home);
  const links = selectInternalLinks(home, priorities, MAX_PAGES - 1);

  for (const url of links) {
    if (pages.length >= MAX_PAGES) break;
    let result = await fetchPublicHtml(url);
    if (result?.page) metrics.httpPages += 1;
    let page = result?.page ?? null;
    if (!meaningful(page) && browserlessToken && browserlessUsed < MAX_BROWSERLESS) {
      const rendered = await fetchWithBrowserless(url, browserlessToken);
      if (rendered) {
        page = rendered;
        browserlessUsed += 1;
        metrics.browserlessCalls += 1;
      }
    }
    if (page) pages.push(page);
    else errors.push("internal_page_unavailable:" + url.slice(0, 180));
  }

  metrics.pagesAnalyzed += pages.length;
  return { pages, errors };
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
    const identityScore = identityScoreFromText(
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
      if (host === "wa.me" || host === "api.whatsapp.com" || host === "whatsapp.com") type = "channel_whatsapp";
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
          "official_link",
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
          "official_image",
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
          facts.push(fact("service", name, { name, description: typeof row.description === "string" ? row.description.slice(0,500) : "" }, page, "official_schema", "json_ld", name, identityScore));
        }
        if (types.some((t) => /Product|MenuItem/i.test(t)) && name) {
          facts.push(fact(types.some((t)=>/MenuItem/i.test(t)) ? "menu_item" : "product", name, { name, description: typeof row.description === "string" ? row.description.slice(0,500) : "" }, page, "official_schema", "json_ld", name, identityScore));
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
          if (price) facts.push(fact("price", offered || name || "Preço publicado", { name: offered || name, price, currency }, page, "official_schema", "json_ld", [offered || name,price,currency].filter(Boolean).join(" "), identityScore));
        }
        if (typeof row.hasMenu === "string") {
          const menu = safePublicUrl(row.hasMenu);
          if (menu) facts.push(fact("channel_menu", "Cardápio", { url: menu.toString() }, page, "official_schema", "json_ld", menu.toString(), identityScore));
        }
        const sameAs = Array.isArray(row.sameAs) ? row.sameAs : typeof row.sameAs === "string" ? [row.sameAs] : [];
        for (const value of sameAs) {
          const url = safePublicUrl(value);
          if (!url) continue;
          const host = domainOf(url.toString());
          if (host === "instagram.com" && url.pathname.split("/").filter(Boolean).length === 1) {
            facts.push(fact("official_instagram", "Instagram oficial", { url: url.toString() }, page, "official_schema", "json_ld", url.toString(), identityScore));
          }
        }
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
