type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

type VisualAnalysis = {
  overallDirection: string;
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
      stringArray(analysis.avoidCopying),
  );
}

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "overallDirection",
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
      "id,file_hash,storage_path,original_name,note,sort_order,byte_size,width,height",
    set_id: `eq.${set.id}`,
    user_id: `eq.${authorized.userId}`,
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
    file_hash: string;
    storage_path: string;
    original_name: string;
    note: string;
    sort_order: number;
    byte_size: number;
    width: number;
    height: number;
  }>;

  if (references.length < 1 || references.length > 5) {
    return failure(
      "NO_REFERENCES",
      "Adicione entre 1 e 5 referências antes de analisar.",
      400,
    );
  }

  const signaturePayload = JSON.stringify({
    guidance: set.guidance.trim(),
    references: references.map((reference) => ({
      hash: reference.file_hash,
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

  for (const reference of references) {
    const fileResponse = await fetch(
      `${authorized.supabaseUrl}/storage/v1/object/authenticated/${BUCKET}/${reference.storage_path}`,
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
  }

  const referenceNotes = references.map((reference, index) => ({
    reference: index + 1,
    originalName: reference.original_name,
    dimensions: `${reference.width}x${reference.height}`,
    likelyScope:
      reference.height > reference.width * 2.2
        ? "provável screenshot de página longa/full page"
        : reference.height > reference.width * 1.15
          ? "provável seção/viewport vertical"
          : "provável Hero/seção/viewport horizontal",
    note: reference.note.trim() || null,
  }));

  const userText = JSON.stringify({
    userGuidance: set.guidance.trim() || null,
    references: referenceNotes,
    priorityRules: [
      "A orientação explícita do usuário tem prioridade sobre interpretações visuais.",
      "Extraia mecanismos e princípios, não conteúdo comercial.",
      "Não transforme uma proporção observada em medida obrigatória.",
      "Diferencie padrões compartilhados, diferenças e conflitos.",
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
