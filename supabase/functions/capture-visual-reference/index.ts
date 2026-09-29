type CaptureAsset = {
  kind: "full" | "hero" | "middle" | "final";
  width: number;
  height: number;
  base64: string;
};

type BrowserlessPayload = {
  ok?: boolean;
  finalUrl?: string;
  title?: string;
  status?: number;
  pageHeight?: number;
  blocked?: boolean;
  blockedReason?: string;
  captures?: CaptureAsset[];
  error?: string;
  data?: BrowserlessPayload;
};

const BUCKET = "prompt-visual-references";
const BROWSERLESS_FUNCTION_ENDPOINT =
  "https://production-sfo.browserless.io/chromium/function";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function failure(
  code:
    | "AUTH_REQUIRED"
    | "FORBIDDEN"
    | "INVALID_REQUEST"
    | "NOT_CONFIGURED"
    | "URL_BLOCKED"
    | "CAPTURE_TIMEOUT"
    | "CAPTURE_FAILED"
    | "STORAGE_FAILED",
  message: string,
  status: number,
) {
  return json(
    {
      ok: false,
      code,
      message,
      fallbackToScreenshot: true,
    },
    status,
  );
}

function getAllowedPublishableKeys() {
  const keys: string[] = [];
  const currentKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");

  if (currentKeys) {
    try {
      const parsed = JSON.parse(currentKeys) as Record<string, unknown>;
      for (const value of Object.values(parsed)) {
        if (typeof value === "string" && value.trim()) keys.push(value.trim());
      }
    } catch {
      // Legacy anon key below remains available when configured.
    }
  }

  const legacyAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacyAnonKey?.trim()) keys.push(legacyAnonKey.trim());
  return Array.from(new Set(keys));
}

async function requireAuthorizedUser(request: Request) {
  const providedKey = request.headers.get("apikey")?.trim();
  if (!providedKey || !getAllowedPublishableKeys().includes(providedKey)) {
    return {
      ok: false as const,
      response: failure(
        "AUTH_REQUIRED",
        "A aplicação não conseguiu autenticar a captura.",
        401,
      ),
    };
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return {
      ok: false as const,
      response: failure(
        "AUTH_REQUIRED",
        "Sua sessão expirou. Entre novamente para analisar sites.",
        401,
      ),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) {
    return {
      ok: false as const,
      response: failure(
        "CAPTURE_FAILED",
        "O backend não está disponível agora.",
        503,
      ),
    };
  }

  const headers = {
    apikey: providedKey,
    Authorization: authorization,
  };

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers,
    });
    if (!userResponse.ok) {
      return {
        ok: false as const,
        response: failure(
          "AUTH_REQUIRED",
          "Sua sessão expirou. Entre novamente para analisar sites.",
          401,
        ),
      };
    }

    const user = (await userResponse.json()) as { id?: unknown };
    if (typeof user.id !== "string" || !user.id) {
      return {
        ok: false as const,
        response: failure("AUTH_REQUIRED", "Sua sessão não é válida.", 401),
      };
    }

    const accessResponse = await fetch(
      `${supabaseUrl}/rest/v1/private_access?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,
      { headers },
    );
    if (!accessResponse.ok) {
      return {
        ok: false as const,
        response: failure(
          "CAPTURE_FAILED",
          "Não foi possível verificar sua autorização agora.",
          503,
        ),
      };
    }

    const rows = (await accessResponse.json()) as Array<{ user_id?: string }>;
    if (!rows.some((row) => row.user_id === user.id)) {
      return {
        ok: false as const,
        response: failure(
          "FORBIDDEN",
          "Esta conta não está autorizada a analisar sites.",
          403,
        ),
      };
    }

    return {
      ok: true as const,
      userId: user.id,
      supabaseUrl,
      headers,
    };
  } catch {
    return {
      ok: false as const,
      response: failure(
        "CAPTURE_FAILED",
        "Não foi possível validar sua sessão agora.",
        503,
      ),
    };
  }
}

function blockedIpv4(host: string) {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;

  const [a, b, c, d] = match.slice(1).map(Number);
  if ([a, b, c, d].some((part) => part > 255)) return true;

  return (
    a === 0 ||
    a === 10 ||
    a === 100 && b >= 64 && b <= 127 ||
    a === 127 ||
    a === 169 && b === 254 ||
    a === 172 && b >= 16 && b <= 31 ||
    a === 192 && b === 0 && c === 0 ||
    a === 192 && b === 0 && c === 2 ||
    a === 192 && b === 88 && c === 99 ||
    a === 192 && b === 168 ||
    a === 198 && (b === 18 || b === 19) ||
    a === 198 && b === 51 && c === 100 ||
    a === 203 && b === 0 && c === 113 ||
    a >= 224
  );
}

function blockedIpv6(host: string) {
  const value = host.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("fc") ||
    value.startsWith("fd") ||
    value.startsWith("fe8") ||
    value.startsWith("fe9") ||
    value.startsWith("fea") ||
    value.startsWith("feb") ||
    value.startsWith("2001:db8")
  );
}

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    host === "metadata.google" ||
    host === "instance-data" ||
    blockedIpv4(host) ||
    blockedIpv6(host)
  );
}

function normalizeAndValidateUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (isBlockedHostname(url.hostname)) return null;

  url.hash = "";
  if (url.protocol === "http:" && url.port === "80") url.port = "";
  if (url.protocol === "https:" && url.port === "443") url.port = "";
  return url;
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function sha256Bytes(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Text(value: string) {
  return sha256Bytes(new TextEncoder().encode(value));
}

function browserlessFunctionSource() {
  return String.raw`
export default async ({ page, context }) => {
  const target = context.url;
  const blockedIpv4 = (host) => {
    const m = host.match(/^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/);
    if (!m) return false;
    const [a,b,c,d] = m.slice(1).map(Number);
    if ([a,b,c,d].some((v) => v > 255)) return true;
    return a===0 || a===10 || (a===100 && b>=64 && b<=127) || a===127 ||
      (a===169 && b===254) || (a===172 && b>=16 && b<=31) ||
      (a===192 && b===168) || (a===192 && b===0 && c===0) ||
      (a===192 && b===0 && c===2) || (a===198 && (b===18 || b===19)) ||
      (a===198 && b===51 && c===100) || (a===203 && b===0 && c===113) || a>=224;
  };
  const blockedHost = (hostname) => {
    const host = hostname.toLowerCase().replace(/\\.$/, "");
    const ipv6 = host.replace(/^\\[|\\]$/g, "");
    return host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      host === "metadata.google.internal" || host === "instance-data" ||
      blockedIpv4(host) || ipv6 === "::1" || ipv6 === "::" ||
      ipv6.startsWith("fc") || ipv6.startsWith("fd") ||
      /^fe[89ab]/.test(ipv6) || ipv6.startsWith("2001:db8");
  };
  const allowedUrl = (value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username && !url.password && !blockedHost(url.hostname);
    } catch { return false; }
  };

  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const requestUrl = request.url();
    if (
      requestUrl.startsWith("data:") ||
      requestUrl.startsWith("blob:") ||
      requestUrl === "about:blank"
    ) {
      request.continue();
      return;
    }

    if (!allowedUrl(requestUrl)) request.abort("blockedbyclient");
    else request.continue();
  });

  let response;
  try {
    response = await page.goto(target, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
  } catch (error) {
    return {
      data: { ok: false, error: "NAVIGATION_FAILED" },
      type: "application/json",
    };
  }

  const status = response?.status?.() ?? 0;
  const finalUrl = page.url();
  if (!allowedUrl(finalUrl)) {
    return {
      data: { ok: false, blocked: true, blockedReason: "REDIRECT_BLOCKED" },
      type: "application/json",
    };
  }

  if (status === 401 || status === 403 || status === 407 || status >= 500) {
    return {
      data: { ok: false, blocked: true, blockedReason: "HTTP_" + status, status },
      type: "application/json",
    };
  }

  try {
    await page.waitForNetworkIdle({
      idleTime: 700,
      concurrency: 2,
      timeout: 5000,
    });
  } catch {}

  await new Promise((resolve) => setTimeout(resolve, 900));

  try {
    await page.evaluate(() => {
      const accepted = [
        "accept", "accept all", "allow all", "agree", "i agree",
        "aceitar", "aceitar todos", "permitir todos", "concordo",
        "ok", "entendi"
      ];
      const elements = Array.from(
        document.querySelectorAll("button,[role='button']")
      );
      for (const element of elements) {
        const text = (element.textContent || "")
          .trim().toLowerCase().replace(/\\s+/g, " ");
        const rect = element.getBoundingClientRect();
        if (
          accepted.includes(text) &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight
        ) {
          element.click();
          break;
        }
      }
    });
    await new Promise((resolve) => setTimeout(resolve, 450));
  } catch {}

  const blocked = await page.evaluate(() => {
    const title = document.title.toLowerCase();
    const text = (document.body?.innerText || "").slice(0, 6000).toLowerCase();
    const captcha = Boolean(
      document.querySelector(
        "iframe[src*='recaptcha'],iframe[src*='hcaptcha'],[class*='captcha'],[id*='captcha']"
      )
    );
    const password = Boolean(document.querySelector("input[type='password']"));
    const challenge =
      title.includes("just a moment") ||
      title.includes("attention required") ||
      text.includes("checking your browser") ||
      text.includes("verify you are human") ||
      text.includes("verifique se você é humano");
    return captcha || password || challenge;
  });

  if (blocked) {
    return {
      data: { ok: false, blocked: true, blockedReason: "PROTECTED_PAGE", status },
      type: "application/json",
    };
  }

  try {
    await page.evaluate(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const root = document.scrollingElement || document.documentElement;
      const limit = Math.min(root.scrollHeight, 60000);
      const step = Math.max(700, Math.round(window.innerHeight * 0.8));
      let iterations = 0;
      for (let y = 0; y < limit && iterations < 50; y += step) {
        window.scrollTo(0, y);
        await sleep(75);
        iterations += 1;
      }
      window.scrollTo(0, 0);
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
  } catch {}

  const pageHeight = await page.evaluate(() => {
    const body = document.body;
    const root = document.documentElement;
    return Math.min(
      60000,
      Math.max(
        body?.scrollHeight || 0,
        root?.scrollHeight || 0,
        body?.offsetHeight || 0,
        root?.offsetHeight || 0,
        window.innerHeight
      )
    );
  });

  const title = await page.title();
  const quality = 72;
  const captures = [];

  const makeCapture = async (kind, y, height) => {
    const base64 = await page.screenshot({
      type: "webp",
      quality,
      encoding: "base64",
      clip: { x: 0, y, width: 1440, height },
      captureBeyondViewport: true,
    });
    return {
      kind,
      width: 1440,
      height,
      base64,
      byteSize: Math.floor((base64.length * 3) / 4),
    };
  };

  if (pageHeight <= 5200) {
    const full = await page.screenshot({
      type: "webp",
      quality,
      encoding: "base64",
      fullPage: true,
      captureBeyondViewport: true,
    });

    const fullByteSize = Math.floor((full.length * 3) / 4);
    if (fullByteSize <= 2900000) {
      captures.push({
        kind: "full",
        width: 1440,
        height: pageHeight,
        base64: full,
        byteSize: fullByteSize,
      });
    }
  }

  if (captures.length === 0) {
    const sliceHeight = Math.min(2200, pageHeight);
    const maxY = Math.max(0, pageHeight - sliceHeight);
    const positions = [
      { kind: "hero", y: 0 },
      { kind: "middle", y: Math.round(maxY / 2) },
      { kind: "final", y: maxY },
    ];
    const seen = new Set();
    for (const item of positions) {
      if (seen.has(item.y)) continue;
      seen.add(item.y);
      captures.push(await makeCapture(item.kind, item.y, sliceHeight));
    }
  }

  return {
    data: {
      ok: true,
      status,
      finalUrl,
      title,
      pageHeight,
      captures,
    },
    type: "application/json",
  };
};
`;
}

async function updateCaptureState(
  authorized: {
    supabaseUrl: string;
    headers: Record<string, string>;
  },
  referenceId: string,
  payload: Record<string, unknown>,
) {
  return fetch(
    `${authorized.supabaseUrl}/rest/v1/prompt_visual_references?id=eq.${encodeURIComponent(referenceId)}`,
    {
      method: "PATCH",
      headers: {
        ...authorized.headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
    },
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return failure("INVALID_REQUEST", "Este serviço aceita somente POST.", 405);
  }

  const authorized = await requireAuthorizedUser(request);
  if (!authorized.ok) return authorized.response;

  let body: { referenceId?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return failure("INVALID_REQUEST", "A solicitação está em formato inválido.", 400);
  }

  if (
    typeof body.referenceId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.referenceId) ||
    (body.force !== undefined && typeof body.force !== "boolean")
  ) {
    return failure("INVALID_REQUEST", "A referência de site é inválida.", 400);
  }

  const refParams = new URLSearchParams({
    select:
      "id,set_id,user_id,reference_type,original_name,note,sort_order,created_at,source_url,source_domain,capture_status,capture_error,capture_hash,capture_final_url,capture_title,captured_at",
    id: `eq.${body.referenceId}`,
    user_id: `eq.${authorized.userId}`,
    limit: "1",
  });

  const referenceResponse = await fetch(
    `${authorized.supabaseUrl}/rest/v1/prompt_visual_references?${refParams}`,
    { headers: authorized.headers },
  );
  if (!referenceResponse.ok) {
    return failure("CAPTURE_FAILED", "Não foi possível carregar esta referência.", 502);
  }

  const references = (await referenceResponse.json()) as Array<{
    id: string;
    set_id: string;
    user_id: string;
    reference_type: string;
    original_name: string;
    note: string;
    sort_order: number;
    created_at: string;
    source_url: string | null;
    source_domain: string | null;
    capture_status: "pending" | "ready" | "failed" | null;
    capture_error: string | null;
    capture_hash: string | null;
    capture_final_url: string | null;
    capture_title: string | null;
    captured_at: string | null;
  }>;

  const reference = references[0];
  if (!reference || reference.reference_type !== "url" || !reference.source_url) {
    return failure("FORBIDDEN", "Esta referência de site não está disponível.", 403);
  }

  const normalized = normalizeAndValidateUrl(reference.source_url);
  if (!normalized) {
    await updateCaptureState(authorized, reference.id, {
      capture_status: "failed",
      capture_error: "URL bloqueada por segurança.",
    });
    return failure(
      "URL_BLOCKED",
      "Esta URL não pode ser processada por segurança. Envie um screenshot.",
      400,
    );
  }

  const oldAssetParams = new URLSearchParams({
    select:
      "id,reference_id,storage_path,file_hash,mime_type,byte_size,width,height,segment_kind,sort_order,created_at",
    reference_id: `eq.${reference.id}`,
    order: "sort_order.asc",
  });
  const oldAssetsResponse = await fetch(
    `${authorized.supabaseUrl}/rest/v1/prompt_visual_reference_assets?${oldAssetParams}`,
    { headers: authorized.headers },
  );
  const oldAssets = oldAssetsResponse.ok
    ? ((await oldAssetsResponse.json()) as Array<{
        id: string;
        reference_id: string;
        storage_path: string;
        file_hash: string;
        mime_type: "image/webp";
        byte_size: number;
        width: number;
        height: number;
        segment_kind: "full" | "hero" | "middle" | "final";
        sort_order: number;
        created_at: string;
      }>)
    : [];

  if (
    body.force !== true &&
    reference.capture_status === "ready" &&
    reference.capture_hash &&
    oldAssets.length > 0
  ) {
    return json({
      ok: true,
      cached: true,
      reference: {
        id: reference.id,
        setId: reference.set_id,
        referenceType: "url",
        fileHash: null,
        storagePath: null,
        originalName: reference.original_name,
        mimeType: null,
        byteSize: null,
        width: null,
        height: null,
        note: reference.note,
        sortOrder: reference.sort_order,
        createdAt: reference.created_at,
        sourceUrl: reference.source_url,
        sourceDomain: reference.source_domain,
        captureStatus: reference.capture_status,
        captureError: reference.capture_error,
        captureHash: reference.capture_hash,
        captureFinalUrl: reference.capture_final_url,
        captureTitle: reference.capture_title,
        capturedAt: reference.captured_at,
        assets: oldAssets.map((asset) => ({
          id: asset.id,
          referenceId: asset.reference_id,
          storagePath: asset.storage_path,
          fileHash: asset.file_hash,
          mimeType: asset.mime_type,
          byteSize: asset.byte_size,
          width: asset.width,
          height: asset.height,
          segmentKind: asset.segment_kind,
          sortOrder: asset.sort_order,
          createdAt: asset.created_at,
        })),
      },
    });
  }

  const token = Deno.env.get("BROWSERLESS_API_TOKEN")?.trim();
  if (!token) {
    await updateCaptureState(authorized, reference.id, {
      capture_status: "failed",
      capture_error:
        "A captura por URL ainda não está configurada no backend.",
    });
    return failure(
      "NOT_CONFIGURED",
      "A captura por URL ainda não está configurada. Envie um screenshot por enquanto.",
      503,
    );
  }

  await updateCaptureState(authorized, reference.id, {
    capture_status: "pending",
    capture_error: null,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

  let browserlessResponse: Response;
  try {
    browserlessResponse = await fetch(
      `${BROWSERLESS_FUNCTION_ENDPOINT}?token=${encodeURIComponent(token)}&timeout=60000`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify({
          code: browserlessFunctionSource(),
          context: { url: normalized.toString() },
        }),
      },
    );
  } catch (error) {
    clearTimeout(timeout);
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    if (oldAssets.length === 0) {
      await updateCaptureState(authorized, reference.id, {
        capture_status: "failed",
        capture_error: timedOut
          ? "A captura excedeu o tempo limite."
          : "Não foi possível capturar o site.",
      });
    }
    return failure(
      timedOut ? "CAPTURE_TIMEOUT" : "CAPTURE_FAILED",
      "Não foi possível analisar automaticamente este site. Envie um screenshot.",
      timedOut ? 504 : 502,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!browserlessResponse.ok) {
    if (oldAssets.length === 0) {
      await updateCaptureState(authorized, reference.id, {
        capture_status: "failed",
        capture_error: "O navegador remoto não conseguiu renderizar o site.",
      });
    }
    return failure(
      "CAPTURE_FAILED",
      "Não foi possível analisar automaticamente este site. Envie um screenshot.",
      502,
    );
  }

  let rawPayload: BrowserlessPayload;
  try {
    rawPayload = (await browserlessResponse.json()) as BrowserlessPayload;
  } catch {
    return failure(
      "CAPTURE_FAILED",
      "Não foi possível interpretar a captura do site. Envie um screenshot.",
      502,
    );
  }

  const payload = rawPayload.data ?? rawPayload;
  if (
    payload.ok !== true ||
    payload.blocked === true ||
    !Array.isArray(payload.captures) ||
    payload.captures.length < 1
  ) {
    if (oldAssets.length === 0) {
      await updateCaptureState(authorized, reference.id, {
        capture_status: "failed",
        capture_error: payload.blocked
          ? "O site exige acesso ou proteção que não será contornada."
          : "Não foi possível capturar o site.",
      });
    }
    return failure(
      payload.blocked ? "CAPTURE_FAILED" : "CAPTURE_FAILED",
      "Não foi possível analisar automaticamente este site. Envie um screenshot.",
      502,
    );
  }

  const finalUrl = normalizeAndValidateUrl(payload.finalUrl ?? "");
  if (!finalUrl) {
    return failure(
      "URL_BLOCKED",
      "A página redirecionou para um endereço bloqueado por segurança. Envie um screenshot.",
      400,
    );
  }

  const captureId = crypto.randomUUID();
  const prepared: Array<{
    bytes: Uint8Array;
    hash: string;
    storagePath: string;
    kind: CaptureAsset["kind"];
    width: number;
    height: number;
  }> = [];

  try {
    for (let index = 0; index < payload.captures.length; index += 1) {
      const capture = payload.captures[index];
      const bytes = base64ToBytes(capture.base64);
      if (bytes.byteLength < 1 || bytes.byteLength > 3145728) {
        throw new Error("CAPTURE_TOO_LARGE");
      }

      const hash = await sha256Bytes(bytes);
      prepared.push({
        bytes,
        hash,
        storagePath:
          `${authorized.userId}/${reference.set_id}/url/${reference.id}/${captureId}-${index}.webp`,
        kind: capture.kind,
        width: capture.width,
        height: capture.height,
      });
    }
  } catch {
    return failure(
      "CAPTURE_FAILED",
      "A captura ficou grande demais para ser processada com segurança. Envie um screenshot.",
      502,
    );
  }

  const uploadedPaths: string[] = [];
  try {
    for (const item of prepared) {
      const upload = await fetch(
        `${authorized.supabaseUrl}/storage/v1/object/${BUCKET}/${item.storagePath}`,
        {
          method: "POST",
          headers: {
            ...authorized.headers,
            "Content-Type": "image/webp",
            "x-upsert": "false",
          },
          body: item.bytes,
        },
      );
      if (!upload.ok) throw new Error("UPLOAD_FAILED");
      uploadedPaths.push(item.storagePath);
    }

    const insertAssets = await fetch(
      `${authorized.supabaseUrl}/rest/v1/prompt_visual_reference_assets`,
      {
        method: "POST",
        headers: {
          ...authorized.headers,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(
          prepared.map((item, index) => ({
            reference_id: reference.id,
            user_id: authorized.userId,
            storage_path: item.storagePath,
            file_hash: item.hash,
            mime_type: "image/webp",
            byte_size: item.bytes.byteLength,
            width: item.width,
            height: item.height,
            segment_kind: item.kind,
            sort_order: index,
          })),
        ),
      },
    );
    if (!insertAssets.ok) throw new Error("ASSET_METADATA_FAILED");

    const assetRows = (await insertAssets.json()) as Array<{
      id: string;
      reference_id: string;
      storage_path: string;
      file_hash: string;
      mime_type: "image/webp";
      byte_size: number;
      width: number;
      height: number;
      segment_kind: CaptureAsset["kind"];
      sort_order: number;
      created_at: string;
    }>;

    const captureHash = await sha256Text(
      JSON.stringify({
        url: normalized.toString(),
        finalUrl: finalUrl.toString(),
        assets: assetRows.map((asset) => asset.file_hash),
      }),
    );
    const capturedAt = new Date().toISOString();

    const updateReference = await updateCaptureState(authorized, reference.id, {
      capture_status: "ready",
      capture_error: null,
      capture_hash: captureHash,
      capture_final_url: finalUrl.toString(),
      capture_title:
        typeof payload.title === "string" ? payload.title.slice(0, 300) : null,
      captured_at: capturedAt,
    });
    if (!updateReference.ok) throw new Error("REFERENCE_UPDATE_FAILED");

    const invalidateSet = await fetch(
      `${authorized.supabaseUrl}/rest/v1/prompt_visual_reference_sets?id=eq.${encodeURIComponent(reference.set_id)}`,
      {
        method: "PATCH",
        headers: {
          ...authorized.headers,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          analysis: null,
          analysis_signature: null,
          analysis_model: null,
          analyzed_at: null,
          updated_at: capturedAt,
        }),
      },
    );
    if (!invalidateSet.ok) throw new Error("SET_INVALIDATION_FAILED");

    for (const asset of oldAssets) {
      await fetch(
        `${authorized.supabaseUrl}/storage/v1/object/${BUCKET}/${asset.storage_path}`,
        { method: "DELETE", headers: authorized.headers },
      );
      await fetch(
        `${authorized.supabaseUrl}/rest/v1/prompt_visual_reference_assets?id=eq.${encodeURIComponent(asset.id)}`,
        {
          method: "DELETE",
          headers: {
            ...authorized.headers,
            Prefer: "return=minimal",
          },
        },
      );
    }

    return json({
      ok: true,
      cached: false,
      reference: {
        id: reference.id,
        setId: reference.set_id,
        referenceType: "url",
        fileHash: null,
        storagePath: null,
        originalName: reference.original_name,
        mimeType: null,
        byteSize: null,
        width: null,
        height: null,
        note: reference.note,
        sortOrder: reference.sort_order,
        createdAt: reference.created_at,
        sourceUrl: reference.source_url,
        sourceDomain: reference.source_domain,
        captureStatus: "ready",
        captureError: null,
        captureHash,
        captureFinalUrl: finalUrl.toString(),
        captureTitle:
          typeof payload.title === "string" ? payload.title.slice(0, 300) : null,
        capturedAt,
        assets: assetRows.map((asset) => ({
          id: asset.id,
          referenceId: asset.reference_id,
          storagePath: asset.storage_path,
          fileHash: asset.file_hash,
          mimeType: asset.mime_type,
          byteSize: asset.byte_size,
          width: asset.width,
          height: asset.height,
          segmentKind: asset.segment_kind,
          sortOrder: asset.sort_order,
          createdAt: asset.created_at,
        })),
      },
    });
  } catch {
    for (const storagePath of uploadedPaths) {
      await fetch(
        `${authorized.supabaseUrl}/storage/v1/object/${BUCKET}/${storagePath}`,
        { method: "DELETE", headers: authorized.headers },
      );
    }

    if (oldAssets.length === 0) {
      await updateCaptureState(authorized, reference.id, {
        capture_status: "failed",
        capture_error: "A captura ocorreu, mas não pôde ser salva com segurança.",
      });
    }

    return failure(
      "STORAGE_FAILED",
      "A captura ocorreu, mas não pôde ser salva. Envie um screenshot ou tente novamente.",
      502,
    );
  }
});
