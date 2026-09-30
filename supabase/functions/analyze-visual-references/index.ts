type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

type StructuralVisualDNA = {
  hero: {
    relativeHeight: "compact" | "medium" | "high" | "tall" | "unknown";
    dominantAxis: "left" | "center" | "right" | "split" | "mixed" | "unknown";
    contentPosition:
      | "left"
      | "center"
      | "center_left"
      | "center_right"
      | "split"
      | "mixed"
      | "unknown";
    headlineDominance: "low" | "medium" | "high" | "very_high" | "unknown";
    layering:
      | "flat"
      | "stacked"
      | "vertical_layers"
      | "overlap"
      | "layered_overlap"
      | "mixed"
      | "unknown";
    negativeSpace: "low" | "medium" | "high" | "unknown";
    imageRelationship: string;
    supportingInfoPosition: string;
  };
  typography: {
    headlineToBodyContrast: "low" | "medium" | "high" | "extreme" | "unknown";
    headlineWidth: "narrow" | "medium" | "wide" | "unknown";
    bodyDensity: "low" | "medium" | "compact" | "unknown";
    microTypography: "absent" | "present" | "unknown";
    heroAlignment: "left" | "center" | "right" | "mixed" | "unknown";
    contentAlignment:
      | "left"
      | "center"
      | "right"
      | "alternating"
      | "mixed"
      | "unknown";
  };
  layout: {
    symmetry: "symmetric" | "asymmetric" | "mixed" | "unknown";
    gridBehavior:
      | "rigid"
      | "fluid"
      | "controlled_breaks"
      | "overlapping"
      | "mixed"
      | "unknown";
    sectionAlignmentPattern: string;
    contentWidthPattern: string;
    overlaps: string;
    elementsBreakingGrid: string;
  };
  sectionFlow: {
    backgroundSequence: string[];
    transitionFrequency: "none" | "single" | "few" | "repeated" | "unknown";
    transitionTypes: string[];
    densityPattern: string[];
  };
  cta: {
    quantity: "low" | "medium" | "high" | "unknown";
    hierarchy:
      | "single_dominant_action"
      | "primary_secondary"
      | "distributed"
      | "unknown";
    placement: string;
    shape: string;
    relativeScale: "small" | "medium" | "large" | "unknown";
  };
  decorativeSystem: {
    amount: "none" | "low" | "low_to_medium" | "medium" | "high" | "unknown";
    recurringMotifs: string[];
    texture: "none" | "subtle" | "pronounced" | "mixed" | "unknown";
  };
  imagery: {
    role: "structural" | "supporting" | "decorative" | "absent" | "mixed" | "unknown";
    cropStrategy: string;
    placementPattern: string;
    textImageRelationship: string;
  };
};

type VisualAnalysis = {
  overallDirection: string;
  structuralVisualDNA?: StructuralVisualDNA;
  composition: {
    hero: string;
    grid: string;
    alignment: string;
    density: string;
    sectionRhythm: string;
  };
  typography: {
    style: string;
    hierarchy: string;
    scale: string;
    alignment: string;
  };
  imagery: {
    usage: string;
    crop: string;
    placement: string;
  };
  interface: {
    buttons: string;
    navigation: string;
    borders: string;
    cards: string;
  };
  commonPatterns: string[];
  meaningfulDifferences: string[];
  conflicts: string[];
  visualMechanismsToReuse: string[];
  avoidCopying: string[];
};

const MODEL = "gpt-5.6-terra";
const BUCKET = "prompt-visual-references";

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
    | "NO_REFERENCES"
    | "REFERENCE_LOAD_FAILED"
    | "NOT_CONFIGURED"
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
      // Legacy key below remains available when configured.
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
        "A aplicação não conseguiu autenticar a chamada.",
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
        "Sua sessão expirou. Entre novamente para analisar referências.",
        401,
      ),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!supabaseUrl) {
    return {
      ok: false as const,
      response: failure(
        "PROVIDER_FAILED",
        "O serviço de autenticação não está disponível.",
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
          "Sua sessão expirou. Entre novamente para analisar referências.",
          401,
        ),
      };
    }

    const user = (await userResponse.json()) as { id?: unknown };
    if (typeof user.id !== "string" || !user.id) {
      return {
        ok: false as const,
        response: failure(
          "AUTH_REQUIRED",
          "Sua sessão não é válida para analisar referências.",
          401,
        ),
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
          "PROVIDER_FAILED",
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
          "Esta conta não está autorizada a utilizar o gerador.",
          403,
        ),
      };
    }

    return {
      ok: true as const,
      userId: user.id,
      supabaseUrl,
      headers,
      authorization,
    };
  } catch {
    return {
      ok: false as const,
      response: failure(
        "PROVIDER_FAILED",
        "Não foi possível validar sua sessão agora.",
        503,
      ),
    };
  }
}

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

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)),
    );
  }
  return btoa(binary);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function stringArray(value: unknown, max = 8) {
  return Array.isArray(value) &&
    value.length <= max &&
    value.every((item) => typeof item === "string" && item.trim().length > 0);
}

function isValidStructuralVisualDNA(value: unknown): value is StructuralVisualDNA {
  if (!value || typeof value !== "object") return false;
  const dna = value as Record<string, unknown>;
  const hero = dna.hero as Record<string, unknown> | null;
  const typography = dna.typography as Record<string, unknown> | null;
  const layout = dna.layout as Record<string, unknown> | null;
  const sectionFlow = dna.sectionFlow as Record<string, unknown> | null;
  const cta = dna.cta as Record<string, unknown> | null;
  const decorative = dna.decorativeSystem as Record<string, unknown> | null;
  const imagery = dna.imagery as Record<string, unknown> | null;

  const text = (target: Record<string, unknown> | null, key: string) =>
    Boolean(
      target &&
        typeof target[key] === "string" &&
        (target[key] as string).trim().length > 0 &&
        (target[key] as string).length <= 500,
    );
  const stringList = (
    target: Record<string, unknown> | null,
    key: string,
    max: number,
  ) =>
    Boolean(
      target &&
        Array.isArray(target[key]) &&
        (target[key] as unknown[]).length <= max &&
        (target[key] as unknown[]).every(
          (item) =>
            typeof item === "string" &&
            item.trim().length > 0 &&
            item.length <= 120,
        ),
    );

  return Boolean(
    hero &&
      ["relativeHeight", "dominantAxis", "contentPosition", "headlineDominance", "layering", "negativeSpace"].every(
        (key) => text(hero, key),
      ) &&
      text(hero, "imageRelationship") &&
      text(hero, "supportingInfoPosition") &&
      typography &&
      ["headlineToBodyContrast", "headlineWidth", "bodyDensity", "microTypography", "heroAlignment", "contentAlignment"].every(
        (key) => text(typography, key),
      ) &&
      layout &&
      ["symmetry", "gridBehavior", "sectionAlignmentPattern", "contentWidthPattern", "overlaps", "elementsBreakingGrid"].every(
        (key) => text(layout, key),
      ) &&
      sectionFlow &&
      text(sectionFlow, "transitionFrequency") &&
      stringList(sectionFlow, "backgroundSequence", 5) &&
      stringList(sectionFlow, "transitionTypes", 4) &&
      stringList(sectionFlow, "densityPattern", 5) &&
      cta &&
      ["quantity", "hierarchy", "placement", "shape", "relativeScale"].every(
        (key) => text(cta, key),
      ) &&
      decorative &&
      text(decorative, "amount") &&
      text(decorative, "texture") &&
      stringList(decorative, "recurringMotifs", 5) &&
      imagery &&
      ["role", "cropStrategy", "placementPattern", "textImageRelationship"].every(
        (key) => text(imagery, key),
      )
  );
}

function isValidAnalysis(value: unknown): value is VisualAnalysis {
  if (!value || typeof value !== "object") return false;
  const analysis = value as Record<string, unknown>;
  const composition = analysis.composition as Record<string, unknown> | null;
  const typography = analysis.typography as Record<string, unknown> | null;
  const imagery = analysis.imagery as Record<string, unknown> | null;
  const ui = analysis.interface as Record<string, unknown> | null;

  return Boolean(
    typeof analysis.overallDirection === "string" &&
      composition &&
      ["hero", "grid", "alignment", "density", "sectionRhythm"].every(
        (key) => typeof composition[key] === "string",
      ) &&
      typography &&
      ["style", "hierarchy", "scale", "alignment"].every(
        (key) => typeof typography[key] === "string",
      ) &&
      imagery &&
      ["usage", "crop", "placement"].every(
        (key) => typeof imagery[key] === "string",
      ) &&
      ui &&
      ["buttons", "navigation", "borders", "cards"].every(
        (key) => typeof ui[key] === "string",
      ) &&
      stringArray(analysis.commonPatterns) &&
      stringArray(analysis.meaningfulDifferences) &&
      stringArray(analysis.conflicts) &&
      stringArray(analysis.visualMechanismsToReuse) &&
      stringArray(analysis.avoidCopying) &&
      (analysis.structuralVisualDNA === undefined ||
        isValidStructuralVisualDNA(analysis.structuralVisualDNA)),
  );
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "overallDirection",
    "structuralVisualDNA",
    "composition",
    "typography",
    "imagery",
    "interface",
    "commonPatterns",
    "meaningfulDifferences",
    "conflicts",
    "visualMechanismsToReuse",
    "avoidCopying",
  ],
  properties: {
    overallDirection: { type: "string" },
    structuralVisualDNA: {
      type: "object",
      additionalProperties: false,
      required: [
        "hero",
        "typography",
        "layout",
        "sectionFlow",
        "cta",
        "decorativeSystem",
        "imagery",
      ],
      properties: {
        hero: {
          type: "object",
          additionalProperties: false,
          required: [
            "relativeHeight",
            "dominantAxis",
            "contentPosition",
            "headlineDominance",
            "layering",
            "negativeSpace",
            "imageRelationship",
            "supportingInfoPosition",
          ],
          properties: {
            relativeHeight: {
              type: "string",
              enum: ["compact", "medium", "high", "tall", "unknown"],
            },
            dominantAxis: {
              type: "string",
              enum: ["left", "center", "right", "split", "mixed", "unknown"],
            },
            contentPosition: {
              type: "string",
              enum: [
                "left",
                "center",
                "center_left",
                "center_right",
                "split",
                "mixed",
                "unknown",
              ],
            },
            headlineDominance: {
              type: "string",
              enum: ["low", "medium", "high", "very_high", "unknown"],
            },
            layering: {
              type: "string",
              enum: [
                "flat",
                "stacked",
                "vertical_layers",
                "overlap",
                "layered_overlap",
                "mixed",
                "unknown",
              ],
            },
            negativeSpace: {
              type: "string",
              enum: ["low", "medium", "high", "unknown"],
            },
            imageRelationship: { type: "string", maxLength: 260 },
            supportingInfoPosition: { type: "string", maxLength: 180 },
          },
        },
        typography: {
          type: "object",
          additionalProperties: false,
          required: [
            "headlineToBodyContrast",
            "headlineWidth",
            "bodyDensity",
            "microTypography",
            "heroAlignment",
            "contentAlignment",
          ],
          properties: {
            headlineToBodyContrast: {
              type: "string",
              enum: ["low", "medium", "high", "extreme", "unknown"],
            },
            headlineWidth: {
              type: "string",
              enum: ["narrow", "medium", "wide", "unknown"],
            },
            bodyDensity: {
              type: "string",
              enum: ["low", "medium", "compact", "unknown"],
            },
            microTypography: {
              type: "string",
              enum: ["absent", "present", "unknown"],
            },
            heroAlignment: {
              type: "string",
              enum: ["left", "center", "right", "mixed", "unknown"],
            },
            contentAlignment: {
              type: "string",
              enum: ["left", "center", "right", "alternating", "mixed", "unknown"],
            },
          },
        },
        layout: {
          type: "object",
          additionalProperties: false,
          required: [
            "symmetry",
            "gridBehavior",
            "sectionAlignmentPattern",
            "contentWidthPattern",
            "overlaps",
            "elementsBreakingGrid",
          ],
          properties: {
            symmetry: {
              type: "string",
              enum: ["symmetric", "asymmetric", "mixed", "unknown"],
            },
            gridBehavior: {
              type: "string",
              enum: [
                "rigid",
                "fluid",
                "controlled_breaks",
                "overlapping",
                "mixed",
                "unknown",
              ],
            },
            sectionAlignmentPattern: { type: "string", maxLength: 220 },
            contentWidthPattern: { type: "string", maxLength: 220 },
            overlaps: { type: "string", maxLength: 220 },
            elementsBreakingGrid: { type: "string", maxLength: 220 },
          },
        },
        sectionFlow: {
          type: "object",
          additionalProperties: false,
          required: [
            "backgroundSequence",
            "transitionFrequency",
            "transitionTypes",
            "densityPattern",
          ],
          properties: {
            backgroundSequence: {
              type: "array",
              maxItems: 5,
              items: { type: "string", maxLength: 80 },
            },
            transitionFrequency: {
              type: "string",
              enum: ["none", "single", "few", "repeated", "unknown"],
            },
            transitionTypes: {
              type: "array",
              maxItems: 4,
              items: { type: "string", maxLength: 80 },
            },
            densityPattern: {
              type: "array",
              maxItems: 5,
              items: { type: "string", maxLength: 80 },
            },
          },
        },
        cta: {
          type: "object",
          additionalProperties: false,
          required: ["quantity", "hierarchy", "placement", "shape", "relativeScale"],
          properties: {
            quantity: {
              type: "string",
              enum: ["low", "medium", "high", "unknown"],
            },
            hierarchy: {
              type: "string",
              enum: [
                "single_dominant_action",
                "primary_secondary",
                "distributed",
                "unknown",
              ],
            },
            placement: { type: "string", maxLength: 180 },
            shape: { type: "string", maxLength: 120 },
            relativeScale: {
              type: "string",
              enum: ["small", "medium", "large", "unknown"],
            },
          },
        },
        decorativeSystem: {
          type: "object",
          additionalProperties: false,
          required: ["amount", "recurringMotifs", "texture"],
          properties: {
            amount: {
              type: "string",
              enum: [
                "none",
                "low",
                "low_to_medium",
                "medium",
                "high",
                "unknown",
              ],
            },
            recurringMotifs: {
              type: "array",
              maxItems: 5,
              items: { type: "string", maxLength: 80 },
            },
            texture: {
              type: "string",
              enum: ["none", "subtle", "pronounced", "mixed", "unknown"],
            },
          },
        },
        imagery: {
          type: "object",
          additionalProperties: false,
          required: [
            "role",
            "cropStrategy",
            "placementPattern",
            "textImageRelationship",
          ],
          properties: {
            role: {
              type: "string",
              enum: [
                "structural",
                "supporting",
                "decorative",
                "absent",
                "mixed",
                "unknown",
              ],
            },
            cropStrategy: { type: "string", maxLength: 180 },
            placementPattern: { type: "string", maxLength: 220 },
            textImageRelationship: { type: "string", maxLength: 220 },
          },
        },
      },
    },
    composition: {
      type: "object",
      additionalProperties: false,
      required: ["hero", "grid", "alignment", "density", "sectionRhythm"],
      properties: {
        hero: { type: "string" },
        grid: { type: "string" },
        alignment: { type: "string" },
        density: { type: "string" },
        sectionRhythm: { type: "string" },
      },
    },
    typography: {
      type: "object",
      additionalProperties: false,
      required: ["style", "hierarchy", "scale", "alignment"],
      properties: {
        style: { type: "string" },
        hierarchy: { type: "string" },
        scale: { type: "string" },
        alignment: { type: "string" },
      },
    },
    imagery: {
      type: "object",
      additionalProperties: false,
      required: ["usage", "crop", "placement"],
      properties: {
        usage: { type: "string" },
        crop: { type: "string" },
        placement: { type: "string" },
      },
    },
    interface: {
      type: "object",
      additionalProperties: false,
      required: ["buttons", "navigation", "borders", "cards"],
      properties: {
        buttons: { type: "string" },
        navigation: { type: "string" },
        borders: { type: "string" },
        cards: { type: "string" },
      },
    },
    commonPatterns: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
    meaningfulDifferences: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
    conflicts: {
      type: "array",
      maxItems: 6,
      items: { type: "string" },
    },
    visualMechanismsToReuse: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { type: "string" },
    },
    avoidCopying: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: { type: "string" },
    },
  },
};

const SYSTEM_PROMPT = `
Você é o analisador de referências visuais do JanuarioLeads.

OBJETIVO
Analise screenshots de sites como REFERÊNCIAS DE DESIGN. Extraia mecanismos visuais úteis e explique por que funcionam. A análise será usada por outro modelo para gerar uma direção ORIGINAL para uma empresa diferente.

NÃO COPIAR
Nunca recomende copiar nome, marca, logotipo, textos, slogans, imagens, ilustrações, produtos, preços, depoimentos, identidade comercial, código ou layout pixel a pixel. Não reproduza medidas exatas, proporções rígidas ou identidade proprietária.

ANÁLISE CONCRETA
Evite frases vazias como "design moderno", "visual clean", "boa hierarquia" ou "layout elegante".
Descreva mecanismos observáveis e seus efeitos. Exemplo: "A diferença extrema entre a escala da headline e do corpo cria hierarquia imediata e mantém a Hero legível mesmo com pouco conteúdo."

O QUE ANALISAR
- composição e assimetria;
- hierarquia e escala tipográfica;
- relação texto/imagem;
- grids e alinhamentos;
- ritmo, densidade e espaços negativos;
- tratamento e recorte de imagens;
- CTAs e navegação;
- bordas, cards e elementos decorativos;
- alternância entre seções;
- quando for full page, sequência e ritmo global.

STRUCTURAL VISUAL DNA
Além da descrição qualitativa, normalize a estrutura observável em structuralVisualDNA.
- Use categorias relativas; nunca invente pixels, porcentagens ou medidas exatas.
- Quando algo não puder ser inferido com segurança, use "unknown" ou array vazio.
- Priorize Hero, eixo dominante, posição do conteúdo, contraste de escala, alinhamento, grid, sobreposição, ritmo, transições, densidade, CTAs e relação texto/imagem.
- backgroundSequence deve descrever tipos de campo observáveis (por exemplo: photographic_context, warm_flat_field, light_utility_field), não inventar cores ausentes.
- sectionAlignmentPattern, contentWidthPattern, overlaps e elementos que rompem o grid devem ser frases curtas e estruturais, não adjetivos.
- O DNA deve representar padrões coerentes quando houver várias referências; diferenças e conflitos continuam nos campos próprios.
- A orientação explícita do usuário continua tendo prioridade. Se ele pedir somente a Hero, o DNA das demais áreas não deve dominar a recomendação.

MÚLTIPLAS REFERÊNCIAS
Não misture tudo indiscriminadamente. Identifique padrões em comum, diferenças, conflitos e quais mecanismos combinam de forma coerente.

ORIENTAÇÃO DO USUÁRIO
A orientação geral e as observações por imagem têm prioridade sobre inferências suas. Se o usuário disser para ignorar cores, ignore a paleta. Se disser "somente a Hero da referência 1", não transporte o resto daquela identidade.

SAÍDA
Retorne apenas a análise estruturada solicitada. Não revele chain-of-thought ou raciocínio interno. Seja específico, útil e conciso.
`;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return failure("INVALID_REQUEST", "Este serviço aceita somente POST.", 405);
  }

  const authorized = await requireAuthorizedUser(request);
  if (!authorized.ok) return authorized.response;

  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    return failure(
      "NOT_CONFIGURED",
      "O provedor de IA ainda não está configurado no backend.",
      503,
    );
  }

  let body: { setId?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return failure("INVALID_REQUEST", "A solicitação está em formato inválido.", 400);
  }

  if (
    typeof body.setId !== "string" ||
    !/^[0-9a-f-]{36}$/i.test(body.setId) ||
    (body.force !== undefined && typeof body.force !== "boolean")
  ) {
    return failure("INVALID_REQUEST", "O conjunto de referências é inválido.", 400);
  }

  const setParams = new URLSearchParams({
    select:
      "id,business_key,guidance,analysis,analysis_signature,analysis_model,analyzed_at",
    id: `eq.${body.setId}`,
    user_id: `eq.${authorized.userId}`,
    limit: "1",
  });

  const setResponse = await fetch(
    `${authorized.supabaseUrl}/rest/v1/prompt_visual_reference_sets?${setParams}`,
    { headers: authorized.headers },
  );
  if (!setResponse.ok) {
    return failure("REFERENCE_LOAD_FAILED", "Não foi possível carregar as referências.", 502);
  }

  const sets = (await setResponse.json()) as Array<{
    id: string;
    business_key: string;
    guidance: string;
    analysis: VisualAnalysis | null;
    analysis_signature: string | null;
    analysis_model: string | null;
    analyzed_at: string | null;
  }>;
  const set = sets[0];
  if (!set) {
    return failure("FORBIDDEN", "Este conjunto de referências não está disponível.", 403);
  }

  const refParams = new URLSearchParams({
    select:
      "id,reference_type,file_hash,storage_path,original_name,note,sort_order,byte_size,width,height,source_url,source_domain,capture_status,capture_hash,capture_final_url,capture_title,captured_at",
    set_id: `eq.${set.id}`,
    user_id: `eq.${authorized.userId}`,
    active: "eq.true",
    order: "sort_order.asc",
  });
  const refsResponse = await fetch(
    `${authorized.supabaseUrl}/rest/v1/prompt_visual_references?${refParams}`,
    { headers: authorized.headers },
  );
  if (!refsResponse.ok) {
    return failure("REFERENCE_LOAD_FAILED", "Não foi possível carregar as referências.", 502);
  }

  const references = (await refsResponse.json()) as Array<{
    id: string;
    reference_type: "image" | "url";
    file_hash: string | null;
    storage_path: string | null;
    original_name: string;
    note: string;
    sort_order: number;
    byte_size: number | null;
    width: number | null;
    height: number | null;
    source_url: string | null;
    source_domain: string | null;
    capture_status: "pending" | "ready" | "failed" | null;
    capture_hash: string | null;
    capture_final_url: string | null;
    capture_title: string | null;
    captured_at: string | null;
  }>;

  if (references.length < 1 || references.length > 5) {
    return failure(
      "NO_REFERENCES",
      "Adicione entre 1 e 5 referências antes de analisar.",
      400,
    );
  }


  const urlReferenceIds = references
    .filter((reference) => reference.reference_type === "url")
    .map((reference) => reference.id);

  const assetsByReference = new Map<
    string,
    Array<{
      id: string;
      reference_id: string;
      storage_path: string;
      file_hash: string;
      byte_size: number;
      width: number;
      height: number;
      segment_kind: "full" | "hero" | "middle" | "final";
      sort_order: number;
    }>
  >();

  if (urlReferenceIds.length > 0) {
    const assetParams = new URLSearchParams({
      select:
        "id,reference_id,storage_path,file_hash,byte_size,width,height,segment_kind,sort_order",
      reference_id: `in.(${urlReferenceIds.join(",")})`,
      order: "sort_order.asc",
    });

    const assetsResponse = await fetch(
      `${authorized.supabaseUrl}/rest/v1/prompt_visual_reference_assets?${assetParams}`,
      { headers: authorized.headers },
    );

    if (!assetsResponse.ok) {
      return failure(
        "REFERENCE_LOAD_FAILED",
        "Não foi possível carregar as capturas dos sites de referência.",
        502,
      );
    }

    const assets = (await assetsResponse.json()) as Array<{
      id: string;
      reference_id: string;
      storage_path: string;
      file_hash: string;
      byte_size: number;
      width: number;
      height: number;
      segment_kind: "full" | "hero" | "middle" | "final";
      sort_order: number;
    }>;

    for (const asset of assets) {
      assetsByReference.set(asset.reference_id, [
        ...(assetsByReference.get(asset.reference_id) ?? []),
        asset,
      ]);
    }
  }

  const unavailableUrl = references.find(
    (reference) =>
      reference.reference_type === "url" &&
      (
        reference.capture_status !== "ready" ||
        !reference.capture_hash ||
        (assetsByReference.get(reference.id)?.length ?? 0) === 0
      ),
  );

  if (unavailableUrl) {
    return failure(
      "REFERENCE_LOAD_FAILED",
      `A referência ${unavailableUrl.source_domain ?? unavailableUrl.original_name} ainda não possui uma captura visual válida. Analise o site novamente ou envie um screenshot.`,
      400,
    );
  }

  const signaturePayload = JSON.stringify({
    guidance: set.guidance.trim(),
    references: references.map((reference) => ({
      type: reference.reference_type,
      identity:
        reference.reference_type === "url"
          ? {
              url: reference.source_url,
              captureHash: reference.capture_hash,
            }
          : { hash: reference.file_hash },
      note: reference.note.trim(),
      order: reference.sort_order,
    })),
  });
  const signature = await sha256(signaturePayload);

  if (
    body.force !== true &&
    set.analysis &&
    set.analysis_signature === signature &&
    isValidAnalysis(set.analysis)
  ) {
    return json({
      ok: true,
      analysis: set.analysis,
      signature,
      model: set.analysis_model ?? MODEL,
      analyzedAt: set.analyzed_at ?? new Date().toISOString(),
      cached: true,
    });
  }

  const imageInputs: Array<{
    type: "input_image";
    image_url: string;
    detail: "high";
  }> = [];

  const visualParts: Array<{
    referenceIndex: number;
    sourceType: "image" | "url";
    sourceLabel: string;
    segment: string;
    dimensions: string;
    note: string | null;
  }> = [];

  for (let referenceIndex = 0; referenceIndex < references.length; referenceIndex += 1) {
    const reference = references[referenceIndex];

    const parts =
      reference.reference_type === "url"
        ? (assetsByReference.get(reference.id) ?? []).map((asset) => ({
            storagePath: asset.storage_path,
            dimensions: `${asset.width}x${asset.height}`,
            segment: asset.segment_kind,
          }))
        : reference.storage_path
          ? [{
              storagePath: reference.storage_path,
              dimensions: `${reference.width ?? 0}x${reference.height ?? 0}`,
              segment:
                (reference.height ?? 0) > (reference.width ?? 1) * 2.2
                  ? "full"
                  : "manual",
            }]
          : [];

    for (const part of parts) {
      const fileResponse = await fetch(
        `${authorized.supabaseUrl}/storage/v1/object/authenticated/${BUCKET}/${part.storagePath}`,
        { headers: authorized.headers },
      );

      if (!fileResponse.ok) {
        return failure(
          "REFERENCE_LOAD_FAILED",
          `Não foi possível carregar ${reference.original_name} para análise.`,
          502,
        );
      }

      const bytes = new Uint8Array(await fileResponse.arrayBuffer());
      imageInputs.push({
        type: "input_image",
        image_url: `data:image/webp;base64,${bytesToBase64(bytes)}`,
        detail: "high",
      });
      visualParts.push({
        referenceIndex: referenceIndex + 1,
        sourceType: reference.reference_type,
        sourceLabel:
          reference.reference_type === "url"
            ? reference.source_domain ?? reference.original_name
            : reference.original_name,
        segment: part.segment,
        dimensions: part.dimensions,
        note: reference.note.trim() || null,
      });
    }
  }

  const referenceNotes = references.map((reference, index) => ({
    reference: index + 1,
    sourceType: reference.reference_type,
    source:
      reference.reference_type === "url"
        ? reference.source_domain ?? reference.source_url
        : reference.original_name,
    captureTitle:
      reference.reference_type === "url" ? reference.capture_title : null,
    capturedAt:
      reference.reference_type === "url" ? reference.captured_at : null,
    parts:
      reference.reference_type === "url"
        ? (assetsByReference.get(reference.id) ?? []).map((asset) => ({
            segment: asset.segment_kind,
            dimensions: `${asset.width}x${asset.height}`,
          }))
        : [{
            segment:
              (reference.height ?? 0) > (reference.width ?? 1) * 2.2
                ? "full"
                : "manual",
            dimensions: `${reference.width ?? 0}x${reference.height ?? 0}`,
          }],
    note: reference.note.trim() || null,
  }));

  const userText = JSON.stringify({
    userGuidance: set.guidance.trim() || null,
    references: referenceNotes,
    visualParts,
    priorityRules: [
      "A orientação explícita do usuário tem prioridade sobre interpretações visuais.",
      "Extraia mecanismos e princípios, não conteúdo comercial.",
      "Não transforme uma proporção observada em medida obrigatória.",
      "Diferencie padrões compartilhados, diferenças e conflitos.",
      "Várias capturas internas da mesma URL pertencem à mesma referência lógica; use-as para entender o ritmo da página completa, não como referências independentes.",
      "A análise deve ajudar outra IA a criar algo original e específico.",
    ],
  });

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
        max_output_tokens: 3200,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: userText },
              ...imageInputs,
            ],
          },
        ],
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "januario_visual_reference_analysis",
            description:
              "Análise estruturada de mecanismos visuais extraídos de referências de design.",
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      }),
    });

    const providerPayload = (await providerResponse.json()) as OpenAIResponse;

    if (!providerResponse.ok) {
      if (providerResponse.status === 401 || providerResponse.status === 403) {
        return failure(
          "PROVIDER_AUTH",
          "A credencial do provedor de IA foi recusada.",
          502,
        );
      }
      if (providerResponse.status === 429) {
        return failure(
          "PROVIDER_QUOTA",
          "O limite do provedor de IA foi atingido. Tente novamente mais tarde.",
          429,
        );
      }
      return failure(
        "PROVIDER_FAILED",
        "Não foi possível analisar as referências visuais.",
        502,
      );
    }

    const outputText = extractOutputText(providerPayload);
    if (!outputText) {
      return failure(
        "INVALID_AI_RESPONSE",
        "A análise visual não retornou uma resposta utilizável.",
        502,
      );
    }

    let analysis: unknown;
    try {
      analysis = JSON.parse(outputText);
    } catch {
      return failure(
        "INVALID_AI_RESPONSE",
        "A análise visual não pôde ser validada.",
        502,
      );
    }

    if (!isValidAnalysis(analysis)) {
      return failure(
        "INVALID_AI_RESPONSE",
        "A análise visual não correspondeu ao formato esperado.",
        502,
      );
    }

    const analyzedAt = new Date().toISOString();
    const saveResponse = await fetch(
      `${authorized.supabaseUrl}/rest/v1/prompt_visual_reference_sets?id=eq.${encodeURIComponent(set.id)}&user_id=eq.${encodeURIComponent(authorized.userId)}`,
      {
        method: "PATCH",
        headers: {
          ...authorized.headers,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          analysis,
          analysis_signature: signature,
          analysis_model: MODEL,
          analyzed_at: analyzedAt,
          updated_at: analyzedAt,
        }),
      },
    );

    if (!saveResponse.ok) {
      return failure(
        "PROVIDER_FAILED",
        "A análise foi concluída, mas não pôde ser salva com segurança.",
        502,
      );
    }

    return json({
      ok: true,
      analysis,
      signature,
      model: MODEL,
      analyzedAt,
      cached: false,
    });
  } catch {
    return failure(
      "PROVIDER_FAILED",
      "Não foi possível analisar as referências visuais.",
      502,
    );
  }
});
