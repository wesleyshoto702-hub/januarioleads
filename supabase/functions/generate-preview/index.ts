type PromptProjectType = "Landing Page" | "Site Institucional" | "IA decidir";
type PromptObjective =
  | "Conseguir pedidos"
  | "Conseguir agendamentos"
  | "Receber contatos"
  | "Solicitar orçamento"
  | "Levar para o WhatsApp"
  | "Apresentar serviços"
  | "Levar pessoas ao estabelecimento"
  | "IA decidir";

type BusinessContext = {
  key?: string;
  company?: string;
  segment?: string;
  primaryCategory?: string | null;
  categories?: string[];
  description?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  internationalPhone?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  openingHours?: string[];
  businessStatus?: string | null;
  website?: string | null;
  instagram?: string | null;
  googleMapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  verifiedImages?: Array<{
    url?: string;
    alt?: string;
    source?: string;
  }>;
};

type SavedPrompt = {
  businessKey?: string;
  company?: string;
  generatedAt?: string;
  projectType?: PromptProjectType;
  objective?: PromptObjective;
  result?: Record<string, unknown>;
};

type PreviewSection = {
  id: string;
  kind:
    | "hero"
    | "proof"
    | "info"
    | "location"
    | "contact"
    | "services"
    | "gallery"
    | "content"
    | "footer";
  variant:
    | "text"
    | "split"
    | "editorial"
    | "compact"
    | "full"
    | "stats"
    | "stack"
    | "grid";
  tone: "background" | "surface" | "accent" | "inverse";
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  emphasize: string;
  imageUrl: string;
  imageAlt: string;
};

type PreviewSpec = {
  theme: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    accentText: string;
    border: string;
  };
  typography: {
    headingProfile: string;
    bodyProfile: string;
    headingScale: "compact" | "balanced" | "expressive";
    bodyScale: "compact" | "balanced";
  };
  density: "compact" | "balanced" | "airy";
  contrast: "soft" | "strong";
  primaryAction: {
    label: string;
    href: string;
  };
  sections: PreviewSection[];
  footerNote: "Prévia conceitual";
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string; type?: string; code?: string };
};

const MODEL = "gpt-5.6-terra";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    | "NOT_CONFIGURED"
    | "INVALID_REQUEST"
    | "PROVIDER_AUTH"
    | "PROVIDER_QUOTA"
    | "PROVIDER_FAILED"
    | "INVALID_AI_RESPONSE",
  message: string,
  status: number,
) {
  return json({ ok: false, code, message }, status);
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
      // Fall back to legacy anon key.
    }
  }

  const legacyAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacyAnonKey?.trim()) keys.push(legacyAnonKey.trim());
  return Array.from(new Set(keys));
}

function hasValidClientKey(request: Request) {
  const provided = request.headers.get("apikey")?.trim();
  return Boolean(provided && getAllowedPublishableKeys().includes(provided));
}

async function requireAuthorizedUser(request: Request) {
  if (!hasValidClientKey(request)) {
    return {
      ok: false as const,
      response: failure("AUTH_REQUIRED", "A aplicação não conseguiu autenticar a prévia.", 401),
    };
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
    return {
      ok: false as const,
      response: failure("AUTH_REQUIRED", "Sua sessão expirou. Entre novamente.", 401),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) {
    return {
      ok: false as const,
      response: failure("PROVIDER_FAILED", "O serviço de autenticação não está disponível.", 503),
    };
  }

  const headers = {
    apikey: request.headers.get("apikey") ?? "",
    Authorization: authorization,
  };

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
    if (!userResponse.ok) {
      return {
        ok: false as const,
        response: failure("AUTH_REQUIRED", "Sua sessão expirou. Entre novamente.", 401),
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
        response: failure("PROVIDER_FAILED", "Não foi possível verificar sua autorização.", 503),
      };
    }

    const rows = (await accessResponse.json()) as Array<{ user_id?: string }>;
    if (!rows.some((row) => row.user_id === user.id)) {
      return {
        ok: false as const,
        response: failure("FORBIDDEN", "Esta conta não está autorizada a gerar previews.", 403),
      };
    }

    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      response: failure("PROVIDER_FAILED", "Não foi possível validar sua sessão.", 503),
    };
  }
}

function textOrNull(value: unknown, max = 1000) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function stringArray(value: unknown, maxItems = 30, maxLength = 500) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function safeUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().slice(0, 1200);
  } catch {
    return null;
  }
}

function isBlockedWebsiteHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal"
  ) {
    return true;
  }

  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;

  const octets = ipv4.slice(1).map(Number);
  if (octets.some((item) => item > 255)) return true;

  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function safePublicWebsite(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (isBlockedWebsiteHost(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

async function readLimitedHtml(response: Response, maxBytes = 1_200_000) {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      const remaining = maxBytes - total;
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

async function fetchOfficialHtml(value: string) {
  let current = safePublicWebsite(value);
  if (!current) return null;

  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6_000);

    try {
      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "JanuarioLeads/1.0 site-preview",
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        const next = safePublicWebsite(new URL(location, current).toString());
        if (!next) return null;
        current = next;
        continue;
      }

      if (!response.ok) return null;
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (
        contentType &&
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml+xml")
      ) {
        return null;
      }

      const length = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(length) && length > 2_000_000) return null;

      return {
        html: await readLimitedHtml(response),
        finalUrl: current,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

function officialMetaImages(html: string, baseUrl: URL) {
  const candidates: string[] = [];
  const tagRegex = /<meta\s+[^>]*>/gi;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = tagRegex.exec(html)) !== null && candidates.length < 6) {
    const attrs = new Map<string, string>();
    const attrRegex = /([A-Za-z:-]+)\s*=\s*(["'])(.*?)\2/g;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(tagMatch[0])) !== null) {
      attrs.set(attrMatch[1].toLowerCase(), attrMatch[3].trim());
    }

    const key = (attrs.get("property") ?? attrs.get("name") ?? "").toLowerCase();
    if (!["og:image", "og:image:url", "twitter:image", "twitter:image:src"].includes(key)) {
      continue;
    }

    const content = attrs.get("content");
    if (!content) continue;

    try {
      const resolved = safePublicWebsite(new URL(content, baseUrl).toString());
      if (resolved) candidates.push(resolved.toString());
    } catch {
      // Ignore malformed metadata.
    }
  }

  return Array.from(new Set(candidates)).slice(0, 3);
}

async function withOfficialWebsiteImages(business: BusinessContext) {
  const existing = business.verifiedImages ?? [];
  if (!business.website) return business;

  const page = await fetchOfficialHtml(business.website);
  if (!page) return business;

  const discovered = officialMetaImages(page.html, page.finalUrl).map((url) => ({
    url,
    alt: `Imagem oficial associada a ${business.company ?? "empresa"}`,
    source: "official_website",
  }));

  return {
    ...business,
    verifiedImages: [...existing, ...discovered]
      .filter(
        (item, index, array) =>
          Boolean(item.url) &&
          array.findIndex((candidate) => candidate.url === item.url) === index,
      )
      .slice(0, 12),
  };
}

function sanitizeBusiness(input: BusinessContext): BusinessContext {
  const verifiedImages = Array.isArray(input.verifiedImages)
    ? input.verifiedImages
        .map((image) => ({
          url: safeUrl(image?.url),
          alt: textOrNull(image?.alt, 200),
          source: textOrNull(image?.source, 300),
        }))
        .filter((image): image is { url: string; alt: string | null; source: string | null } =>
          Boolean(image.url),
        )
        .slice(0, 12)
    : [];

  return {
    key: textOrNull(input.key, 500),
    company: textOrNull(input.company, 180),
    segment: textOrNull(input.segment, 160),
    primaryCategory: textOrNull(input.primaryCategory, 160),
    categories: stringArray(input.categories, 20, 120),
    description: textOrNull(input.description, 1200),
    address: textOrNull(input.address, 350),
    neighborhood: textOrNull(input.neighborhood, 160),
    city: textOrNull(input.city, 120),
    state: textOrNull(input.state, 120),
    phone: textOrNull(input.phone, 80),
    internationalPhone: textOrNull(input.internationalPhone, 80),
    rating: typeof input.rating === "number" ? input.rating : null,
    reviewCount: typeof input.reviewCount === "number" ? input.reviewCount : null,
    openingHours: stringArray(input.openingHours, 14, 200),
    businessStatus: textOrNull(input.businessStatus, 100),
    website: safeUrl(input.website),
    instagram: safeUrl(input.instagram),
    googleMapsUrl: safeUrl(input.googleMapsUrl),
    latitude: typeof input.latitude === "number" ? input.latitude : null,
    longitude: typeof input.longitude === "number" ? input.longitude : null,
    notes: null,
    verifiedImages,
  };
}

function validateInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as { business?: unknown; prompt?: unknown };
  if (!input.business || typeof input.business !== "object") return null;
  if (!input.prompt || typeof input.prompt !== "object") return null;

  const business = sanitizeBusiness(input.business as BusinessContext);
  const prompt = input.prompt as SavedPrompt;

  const company = textOrNull(business.company, 180);
  const segment = textOrNull(business.segment, 160);
  const businessKey = textOrNull(prompt.businessKey, 500);
  const generatedAt = textOrNull(prompt.generatedAt, 80);
  const promptCompany = textOrNull(prompt.company, 180);

  if (
    !company ||
    !segment ||
    !businessKey ||
    !generatedAt ||
    !promptCompany ||
    !prompt.result ||
    typeof prompt.result !== "object"
  ) {
    return null;
  }

  return {
    business: { ...business, company, segment },
    prompt: {
      businessKey,
      company: promptCompany,
      generatedAt,
      projectType: prompt.projectType,
      objective: prompt.objective,
      result: prompt.result,
    },
  };
}

const SYSTEM_PROMPT = `
Você materializa uma prévia visual a partir de um prompt de landing page JÁ GERADO pelo JanuarioLeads.
Você NÃO cria uma nova estratégia independente. Sua fonte de verdade é, nesta ordem:
1. promptResult estruturado;
2. lovablePrompt salvo;
3. dados reais da empresa.

OBJETIVO
Converter essa direção existente em um PreviewSpec seguro para um renderer React controlado. O resultado deve parecer uma landing page plausível, não documento, dashboard, slide, wireframe ou mockup.

FIDELIDADE
- Preserve objetivo, CTA principal, estrutura, direção visual, hierarquia, ritmo e copy que já estejam definidos.
- Se o prompt não definiu copy exata, escreva somente copy factual derivada dos dados reais.
- Não invente produtos, serviços, preços, equipe, depoimentos, promoções, diferenciais ou história.
- [INFORMAÇÃO A CONFIRMAR], [FOTO], instruções técnicas e comentários de desenvolvimento NUNCA aparecem como grandes elementos visuais.
- Não crie seções vazias só porque o nicho costuma tê-las.
- Se uma seção do prompt depende inteiramente de conteúdo ausente, omita ou integre a intenção em outra seção menor.

SEM TEMPLATE FIXO
- Escolha somente os kinds necessários.
- A Hero pode ser text, split, editorial, compact ou full conforme o prompt.
- Não force 3 cards, Sobre, Serviços, Depoimentos, Galeria ou Footer grande.
- A ordem das seções deve seguir o prompt salvo.
- Use entre 3 e 7 seções visuais na maioria dos casos.

IMAGENS
- Só use imageUrl que apareça EXATAMENTE em verifiedImages.
- Se verifiedImages estiver vazio, TODOS os imageUrl devem ser string vazia.
- Nunca gere URL de banco de imagens nem imagem fictícia.
- Sem imagem real, prefira Hero tipográfica, estatísticas reais, horário, localização, telefone, divisórias e composição editorial.
- Não reserve área vazia para imagem futura.

TEMA
- Traduza a direção visual do prompt para 7 cores HEX seguras: background, surface, text, muted, accent, accentText, border.
- Se o prompt não comprovar identidade oficial, apenas materialize a direção proposta.
- Preserve contraste alto o suficiente para leitura.
- typography descreve perfis; o renderer escolherá famílias seguras equivalentes.
- Não injete CSS, HTML ou nomes de classe.
- Para cada seção, escolha tone conforme o prompt: background, surface, accent ou inverse. Não alterne cores por hábito.

CONTEÚDO
- title/body/items devem ser conteúdo que realmente pode aparecer no site.
- Não copie para a página instruções como "usar grid 12 colunas", "max-width", "SEO", "mobile first" etc.
- Location pode usar endereço/horário/Maps, mas não iframe.
- FooterNote deve ser exatamente "Prévia conceitual".
- CTA href só pode usar dados reais já presentes em verifiedBusinessData. Não use observações privadas, notas internas, Chance, IDs, logs ou comentários do CRM.
- Se não houver href confiável, use string vazia.

RESPONSIVIDADE
O renderer cuidará da implementação, mas escolha variantes que funcionem tanto em 390px quanto em desktop. Evite depender de posicionamento absoluto e de composição que só funcione em uma largura.

REGENERAÇÃO
Pequenas variações de composição são permitidas, mas mantenha a mesma direção estratégica do prompt atual.
`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "theme",
    "typography",
    "density",
    "contrast",
    "primaryAction",
    "sections",
    "footerNote",
  ],
  properties: {
    theme: {
      type: "object",
      additionalProperties: false,
      required: [
        "background",
        "surface",
        "text",
        "muted",
        "accent",
        "accentText",
        "border",
      ],
      properties: {
        background: { type: "string" },
        surface: { type: "string" },
        text: { type: "string" },
        muted: { type: "string" },
        accent: { type: "string" },
        accentText: { type: "string" },
        border: { type: "string" },
      },
    },
    typography: {
      type: "object",
      additionalProperties: false,
      required: ["headingProfile", "bodyProfile", "headingScale", "bodyScale"],
      properties: {
        headingProfile: { type: "string" },
        bodyProfile: { type: "string" },
        headingScale: {
          type: "string",
          enum: ["compact", "balanced", "expressive"],
        },
        bodyScale: { type: "string", enum: ["compact", "balanced"] },
      },
    },
    density: { type: "string", enum: ["compact", "balanced", "airy"] },
    contrast: { type: "string", enum: ["soft", "strong"] },
    primaryAction: {
      type: "object",
      additionalProperties: false,
      required: ["label", "href"],
      properties: {
        label: { type: "string" },
        href: { type: "string" },
      },
    },
    sections: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "kind",
          "variant",
          "tone",
          "eyebrow",
          "title",
          "body",
          "items",
          "primaryCtaLabel",
          "primaryCtaHref",
          "secondaryCtaLabel",
          "secondaryCtaHref",
          "emphasize",
          "imageUrl",
          "imageAlt",
        ],
        properties: {
          id: { type: "string" },
          kind: {
            type: "string",
            enum: [
              "hero",
              "proof",
              "info",
              "location",
              "contact",
              "services",
              "gallery",
              "content",
              "footer",
            ],
          },
          variant: {
            type: "string",
            enum: [
              "text",
              "split",
              "editorial",
              "compact",
              "full",
              "stats",
              "stack",
              "grid",
            ],
          },
          tone: {
            type: "string",
            enum: ["background", "surface", "accent", "inverse"],
          },
          eyebrow: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          items: {
            type: "array",
            maxItems: 8,
            items: { type: "string" },
          },
          primaryCtaLabel: { type: "string" },
          primaryCtaHref: { type: "string" },
          secondaryCtaLabel: { type: "string" },
          secondaryCtaHref: { type: "string" },
          emphasize: { type: "string" },
          imageUrl: { type: "string" },
          imageAlt: { type: "string" },
        },
      },
    },
    footerNote: { type: "string", enum: ["Prévia conceitual"] },
  },
};

function extractOutputText(response: OpenAIResponse) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text.trim();
      }
    }
  }

  return "";
}

function safeHex(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized : fallback;
}

function normalizeDigits(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function safeHref(value: unknown, business: BusinessContext) {
  if (typeof value !== "string" || !value.trim()) return "";
  const href = value.trim();

  if (/^tel:/i.test(href)) {
    const requested = normalizeDigits(href.slice(4));
    const local = normalizeDigits(business.phone);
    const international = normalizeDigits(business.internationalPhone);

    const allowed = new Set(
      [local, international]
        .filter(Boolean)
        .flatMap((phone) => {
          if (phone.length === 10 || phone.length === 11) {
            return [phone, "55" + phone];
          }
          return [phone];
        }),
    );

    if (requested && allowed.has(requested)) {
      return "tel:+" + (requested.startsWith("55") ? requested : "55" + requested);
    }

    return "";
  }

  const trusted = new Set(
    [
      business.website,
      business.instagram,
      business.googleMapsUrl,
    ].filter((item): item is string => typeof item === "string" && Boolean(item)),
  );

  if (trusted.has(href)) return href;
  return "";
}

function sanitizeSpec(value: unknown, business: BusinessContext): PreviewSpec | null {
  if (!value || typeof value !== "object") return null;
  const input = value as PreviewSpec;
  if (!Array.isArray(input.sections) || input.sections.length < 3) return null;

  const verifiedUrls = new Set(
    (business.verifiedImages ?? [])
      .map((item) => item.url)
      .filter((item): item is string => typeof item === "string" && Boolean(item)),
  );

  const fallbackTheme = {
    background: "#111111",
    surface: "#1B1B1B",
    text: "#F5F5F2",
    muted: "#A4A4A4",
    accent: "#C82832",
    accentText: "#FFFFFF",
    border: "#343434",
  };

  return {
    theme: {
      background: safeHex(input.theme?.background, fallbackTheme.background),
      surface: safeHex(input.theme?.surface, fallbackTheme.surface),
      text: safeHex(input.theme?.text, fallbackTheme.text),
      muted: safeHex(input.theme?.muted, fallbackTheme.muted),
      accent: safeHex(input.theme?.accent, fallbackTheme.accent),
      accentText: safeHex(input.theme?.accentText, fallbackTheme.accentText),
      border: safeHex(input.theme?.border, fallbackTheme.border),
    },
    typography: {
      headingProfile: textOrNull(input.typography?.headingProfile, 180) ?? "Display expressiva",
      bodyProfile: textOrNull(input.typography?.bodyProfile, 180) ?? "Sans neutra e legível",
      headingScale:
        input.typography?.headingScale === "compact" ||
        input.typography?.headingScale === "expressive"
          ? input.typography.headingScale
          : "balanced",
      bodyScale: input.typography?.bodyScale === "compact" ? "compact" : "balanced",
    },
    density:
      input.density === "compact" || input.density === "airy"
        ? input.density
        : "balanced",
    contrast: input.contrast === "soft" ? "soft" : "strong",
    primaryAction: {
      label: textOrNull(input.primaryAction?.label, 100) ?? "",
      href: safeHref(input.primaryAction?.href, business),
    },
    sections: input.sections.slice(0, 8).map((section, index) => ({
      id: textOrNull(section.id, 80) ?? `section-${index + 1}`,
      kind: section.kind,
      variant: section.variant,
      tone:
        section.tone === "surface" ||
        section.tone === "accent" ||
        section.tone === "inverse"
          ? section.tone
          : "background",
      eyebrow: textOrNull(section.eyebrow, 120) ?? "",
      title: textOrNull(section.title, 220) ?? "",
      body: textOrNull(section.body, 800) ?? "",
      items: stringArray(section.items, 8, 240),
      primaryCtaLabel: textOrNull(section.primaryCtaLabel, 100) ?? "",
      primaryCtaHref: safeHref(section.primaryCtaHref, business),
      secondaryCtaLabel: textOrNull(section.secondaryCtaLabel, 100) ?? "",
      secondaryCtaHref: safeHref(section.secondaryCtaHref, business),
      emphasize: textOrNull(section.emphasize, 180) ?? "",
      imageUrl:
        typeof section.imageUrl === "string" && verifiedUrls.has(section.imageUrl)
          ? section.imageUrl
          : "",
      imageAlt: textOrNull(section.imageAlt, 220) ?? "",
    })),
    footerNote: "Prévia conceitual",
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return failure("INVALID_REQUEST", "Este serviço aceita somente geração por POST.", 405);
  }

  const authorized = await requireAuthorizedUser(request);
  if (!authorized.ok) return authorized.response;

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    return failure("NOT_CONFIGURED", "O provedor de IA não está configurado.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return failure("INVALID_REQUEST", "A solicitação está em formato inválido.", 400);
  }

  const input = validateInput(body);
  if (!input) {
    return failure(
      "INVALID_REQUEST",
      "O preview precisa de uma empresa válida e de um prompt salvo.",
      400,
    );
  }

  const materializationBusiness = await withOfficialWebsiteImages(input.business);

  const userPayload = {
    verifiedBusinessData: {
      ...materializationBusiness,
      notes: null,
    },
    savedPromptVersion: input.prompt.generatedAt,
    promptResult: input.prompt.result,
    lovablePrompt:
      typeof input.prompt.result.lovablePrompt === "string"
        ? input.prompt.result.lovablePrompt
        : "",
    instructions: [
      "Materialize o prompt salvo, não crie uma estratégia concorrente.",
      "Não exiba instruções técnicas como conteúdo visual.",
      "Omitir visualmente conteúdo ausente é melhor que criar placeholder.",
      "Sem verifiedImages, nenhuma seção pode reservar espaço para foto.",
      "O preview deve parecer uma landing page finalizada e responsiva.",
    ],
  };

  try {
    const providerResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        reasoning: { effort: "medium" },
        max_output_tokens: 6500,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [{ type: "input_text", text: JSON.stringify(userPayload) }],
          },
        ],
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "januario_preview_spec",
            description:
              "Especificação visual segura e dinâmica para materializar o prompt salvo.",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      }),
    });

    const providerPayload = (await providerResponse.json()) as OpenAIResponse;

    if (!providerResponse.ok) {
      if (providerResponse.status === 401 || providerResponse.status === 403) {
        return failure("PROVIDER_AUTH", "A credencial do provedor de IA foi recusada.", 502);
      }
      if (providerResponse.status === 429) {
        return failure(
          "PROVIDER_QUOTA",
          "O limite do provedor de IA foi atingido. Tente novamente mais tarde.",
          429,
        );
      }
      return failure("PROVIDER_FAILED", "A IA não conseguiu gerar a prévia agora.", 502);
    }

    const outputText = extractOutputText(providerPayload);
    if (!outputText) {
      return failure("INVALID_AI_RESPONSE", "A IA não retornou uma prévia utilizável.", 502);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return failure("INVALID_AI_RESPONSE", "A prévia retornada não pôde ser validada.", 502);
    }

    const spec = sanitizeSpec(parsed, materializationBusiness);
    if (!spec) {
      return failure(
        "INVALID_AI_RESPONSE",
        "A estrutura visual retornada não corresponde ao formato esperado.",
        502,
      );
    }

    const generatedAt = new Date().toISOString();
    return json({
      ok: true,
      preview: {
        businessKey: input.prompt.businessKey,
        company: input.business.company,
        promptVersion: input.prompt.generatedAt,
        previewVersion: crypto.randomUUID(),
        generatedAt,
        spec,
      },
    });
  } catch {
    return failure("PROVIDER_FAILED", "Não foi possível comunicar com o gerador de prévia.", 502);
  }
});
