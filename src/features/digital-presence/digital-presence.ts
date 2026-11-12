import { accountLocalStorage } from "../../lib/account-storage.ts";

export type AuditDevice = "mobile" | "desktop";
export type AuditCategory = "performance" | "accessibility" | "bestPractices" | "seo";
export type DigitalFinding = { id: string; title: string; category: string; score: number };
export type DigitalReport = {
  url: string;
  finalUrl: string;
  checkedAt: string;
  device: AuditDevice;
  scores: Record<AuditCategory, number | null>;
  metrics: Array<{ id: string; label: string; value: string }>;
  findings: DigitalFinding[];
};

const CACHE_KEY = "digital-presence:reports:v1";
const BUDGET_KEY = "digital-presence:requests:v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DAILY_REQUESTS = 8;
const categories = ["performance", "accessibility", "best-practices", "seo"] as const;

export function normalizePublicWebsite(value: string): string {
  const raw = value.trim();
  if (!raw || raw.length > 500) throw new Error("Informe o endereço público do site (até 500 caracteres).");
  const candidate = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Endereço de site inválido. Exemplo: https://empresa.com.br");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username || url.password ||
    !hostname.includes(".") || hostname.endsWith(".local") ||
    hostname.endsWith(".internal") || hostname.endsWith(".test") ||
    hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname) ||
    hostname.includes("[") || hostname.includes("]") ||
    url.port && !["80", "443"].includes(url.port)
  ) throw new Error("Use um domínio público HTTP ou HTTPS, sem usuário, senha ou porta personalizada.");
  // URL fragments and search parameters often contain private tokens and are
  // unnecessary to analyze a public landing page.
  url.search = "";
  url.hash = "";
  return url.toString();
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
function safeScore(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 1
    ? Math.round(raw * 100) : null;
}
function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
const keyToScore: Record<(typeof categories)[number], AuditCategory> = {
  performance: "performance",
  accessibility: "accessibility",
  "best-practices": "bestPractices",
  seo: "seo",
};
export function parsePageSpeedResponse(
  payload: unknown, requestedUrl: string, device: AuditDevice,
): DigitalReport {
  const root = object(payload);
  const lighthouse = object(root["lighthouseResult"]);
  const groups = object(lighthouse["categories"]);
  const auditMap = object(lighthouse["audits"]);
  if (!Object.keys(groups).length || !Object.keys(auditMap).length)
    throw new Error("O PageSpeed não retornou medições suficientes para esta página.");
  const scores = {} as DigitalReport["scores"];
  for (const cat of categories) scores[keyToScore[cat]] = safeScore(object(groups[cat])["score"]);
  const metricDefinitions: ReadonlyArray<readonly [string,string]> = [
    ["first-contentful-paint", "Primeiro conteúdo"],
    ["largest-contentful-paint", "Maior conteúdo (LCP)"],
    ["cumulative-layout-shift", "Estabilidade visual (CLS)"],
    ["total-blocking-time", "Tempo de bloqueio"],
  ];
  const metrics = metricDefinitions.flatMap(([id,label]) => {
    const audit = object(auditMap[id]);
    const raw = audit["displayValue"];
    return typeof raw === "string" && raw.length < 65
      ? [{ id, label, value: raw }] : [];
  });

  const findings = Object.entries(auditMap).flatMap(([id,raw]) => {
    const audit = object(raw);
    const score = finiteNumber(audit["score"]);
    const title = audit["title"];
    const mode = audit["scoreDisplayMode"];
    if (
      score === null || score >= 0.9 || score < 0 || score > 1 ||
      typeof title !== "string" || !title.trim() || title.length > 180 ||
      ["informative", "notApplicable", "manual"].includes(String(mode)) ||
      id.includes("screenshot") || id === "final-screenshot"
    ) return [];
    return [{ id, title: title.trim(), score: Math.round(score * 100), category: "Lighthouse" }];
  }).sort((a,b) => a.score-b.score).slice(0,7);

  let final = requestedUrl;
  const responseId = root["id"];
  if (typeof responseId === "string") {
    try { final = normalizePublicWebsite(responseId); }
    catch { /* Never display or cache private URL parameters from redirects. */ }
  }
  const analysisTimestamp = root["analysisUTCTimestamp"];
  return {
    url: requestedUrl,
    finalUrl: final,
    device,
    checkedAt: typeof analysisTimestamp === "string"
      && Number.isFinite(Date.parse(analysisTimestamp))
      ? analysisTimestamp : new Date().toISOString(),
    scores,
    metrics,
    findings,
  };
}
function readCache(): DigitalReport[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(accountLocalStorage.getItem(CACHE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is DigitalReport => {
      const data = object(item);
      const time = Date.parse(String(data["checkedAt"] ?? ""));
      return typeof data["url"] === "string" && typeof data["finalUrl"] === "string" &&
        (data["device"] === "mobile" || data["device"] === "desktop") &&
        Boolean(data["scores"] && typeof data["scores"] === "object") &&
        Array.isArray(data["findings"]) && Array.isArray(data["metrics"]) &&
        Number.isFinite(time) && Date.now() >= time &&
        Date.now() - time <= CACHE_TTL_MS;
    }).slice(0,15) : [];
  } catch { return []; }
}
export function getCachedDigitalReport(url: string, device: AuditDevice): DigitalReport | null {
  return readCache().find(x => x.url === url && x.device === device) ?? null;
}
export function rememberDigitalReport(report: DigitalReport): void {
  if (typeof window === "undefined") return;
  const others = readCache().filter(x => x.url !== report.url || x.device !== report.device);
  try { accountLocalStorage.setItem(CACHE_KEY, JSON.stringify([report,...others].slice(0,15))); }
  catch { /* Browser storage is optional; never block the report display. */ }
}
function dailyCalls(): { date: string; count: number } {
  const today = new Intl.DateTimeFormat("sv-SE",{
    timeZone: "America/Sao_Paulo", year:"numeric", month:"2-digit",day:"2-digit",
  }).format(new Date());
  try {
    const data = object(JSON.parse(accountLocalStorage.getItem(BUDGET_KEY) ?? "{}"));
    if (data["date"] === today && typeof data["count"] === "number")
      return { date: today, count: Math.max(0, data["count"]) };
  } catch { /* Use today's counter */ }
  return {date:today,count:0};
}
export function remainingDigitalAnalyses(): number {
  if (typeof window === "undefined") return MAX_DAILY_REQUESTS;
  return Math.max(0,MAX_DAILY_REQUESTS-dailyCalls().count);
}
export async function analyzeDigitalPresence(
  publicUrl: string, device: AuditDevice, signal?: AbortSignal,
): Promise<DigitalReport> {
  const normalized = normalizePublicWebsite(publicUrl);
  if (remainingDigitalAnalyses() <= 0)
    throw new Error("Limite pessoal de 8 análises por dia neste navegador. Volte amanhã ou consulte um relatório salvo.");
  const counter = dailyCalls();
  // Count before sending, so repeated failures never create an unbounded retry loop.
  try {accountLocalStorage.setItem(BUDGET_KEY,JSON.stringify({date:counter.date,count:counter.count+1}));}
  catch {/* Quota on Google still applies, even if local storage is blocked. */}
  const query = new URL("https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed");
  query.searchParams.set("url",normalized);
  query.searchParams.set("strategy",device);
  query.searchParams.set("locale","pt-BR");
  for (const category of categories) query.searchParams.append("category",category);
  let response: Response;
  try {
    response = await fetch(query.toString(), {
      method:"GET", cache:"no-store", ...(signal === undefined ? {} : {signal}),
    });
  } catch (reason) {
    if (signal?.aborted) throw new Error("Análise cancelada.");
    throw new Error("O PageSpeed está inacessível neste navegador. Tente mais tarde ou abra o relatório no site oficial.");
  }
  if (response.status === 429)
    throw new Error("O PageSpeed atingiu o limite de consultas. Tente novamente mais tarde.");
  if (!response.ok)
    throw new Error("O PageSpeed não conseguiu analisar esta página (HTTP "+response.status+"). Confira se o site é público.");
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new Error("O PageSpeed retornou uma resposta incompleta."); }
  const report = parsePageSpeedResponse(data,normalized,device);
  rememberDigitalReport(report);
  return report;
}
export function officialPageSpeedUrl(url: string, device: AuditDevice): string {
  const query = new URL("https://pagespeed.web.dev/analysis");
  query.searchParams.set("url",normalizePublicWebsite(url));
  query.searchParams.set("form_factor",device);
  return query.toString();
}
