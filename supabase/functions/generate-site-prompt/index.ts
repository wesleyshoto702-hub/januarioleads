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
};

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

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
      // Use legacy anon key below when available.
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
      response: failure(
        "AUTH_REQUIRED",
        "A aplicação não conseguiu autenticar a chamada ao gerador.",
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
        "Sua sessão expirou. Entre novamente para gerar prompts.",
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
    apikey: request.headers.get("apikey") ?? "",
    Authorization: authorization,
  };

  try {
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
    if (!userResponse.ok) {
      return {
        ok: false as const,
        response: failure(
          "AUTH_REQUIRED",
          "Sua sessão expirou. Entre novamente para gerar prompts.",
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
          "Sua sessão não é válida para utilizar o gerador.",
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

    return { ok: true as const, userId: user.id };
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

const PROJECT_TYPES = new Set<PromptProjectType>([
  "Landing Page",
  "Site Institucional",
  "IA decidir",
]);

const OBJECTIVES = new Set<PromptObjective>([
  "Conseguir pedidos",
  "Conseguir agendamentos",
  "Receber contatos",
  "Solicitar orçamento",
  "Levar para o WhatsApp",
  "Apresentar serviços",
  "Levar pessoas ao estabelecimento",
  "IA decidir",
]);

function validateInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as {
    business?: unknown;
    projectType?: unknown;
    objective?: unknown;
  };

  if (!input.business || typeof input.business !== "object") return null;
  const business = input.business as BusinessContext;

  if (
    typeof business.company !== "string" ||
    business.company.trim().length < 2 ||
    business.company.length > 180 ||
    typeof business.segment !== "string" ||
    business.segment.trim().length < 2 ||
    business.segment.length > 160 ||
    typeof input.projectType !== "string" ||
    !PROJECT_TYPES.has(input.projectType as PromptProjectType) ||
    typeof input.objective !== "string" ||
    !OBJECTIVES.has(input.objective as PromptObjective)
  ) {
    return null;
  }

  return {
    business: sanitizeBusiness(business),
    projectType: input.projectType as PromptProjectType,
    objective: input.objective as PromptObjective,
  };
}

function textOrNull(value: unknown, max = 800) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function stringArray(value: unknown, maxItems = 20, maxLength = 300) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeBusiness(business: BusinessContext): BusinessContext {
  return {
    company: textOrNull(business.company, 180) ?? "",
    segment: textOrNull(business.segment, 160) ?? "",
    primaryCategory: textOrNull(business.primaryCategory, 160),
    categories: stringArray(business.categories, 20, 120),
    description: textOrNull(business.description, 900),
    address: textOrNull(business.address, 300),
    neighborhood: textOrNull(business.neighborhood, 160),
    city: textOrNull(business.city, 120),
    state: textOrNull(business.state, 120),
    phone: textOrNull(business.phone, 80),
    internationalPhone: textOrNull(business.internationalPhone, 80),
    rating: typeof business.rating === "number" ? business.rating : null,
    reviewCount: typeof business.reviewCount === "number" ? business.reviewCount : null,
    openingHours: stringArray(business.openingHours, 14, 180),
    businessStatus: textOrNull(business.businessStatus, 100),
    website: textOrNull(business.website, 500),
    instagram: textOrNull(business.instagram, 500),
    googleMapsUrl: textOrNull(business.googleMapsUrl, 800),
    latitude: typeof business.latitude === "number" ? business.latitude : null,
    longitude: typeof business.longitude === "number" ? business.longitude : null,
    notes: textOrNull(business.notes, 1400),
  };
}

function buildContentAvailability(business: BusinessContext) {
  return {
    hasDescription: Boolean(business.description),
    hasAddress: Boolean(business.address),
    hasNeighborhood: Boolean(business.neighborhood),
    hasCity: Boolean(business.city),
    hasPhone: Boolean(business.phone || business.internationalPhone),
    hasRating:
      typeof business.rating === "number" &&
      typeof business.reviewCount === "number" &&
      business.reviewCount > 0,
    hasOpeningHours: Boolean(business.openingHours?.length),
    hasWebsite: Boolean(business.website),
    hasInstagram: Boolean(business.instagram),
    hasGoogleMaps: Boolean(business.googleMapsUrl),
    hasVerifiedImages: false,
  };
}

const SYSTEM_PROMPT = `
Você é o motor estratégico do JanuarioLeads. Gere instruções para outro agente construir uma landing page/site de empresa local. Você atua como diretor criativo + estrategista + UX, NÃO como um template que decide cada pixel.

PRINCÍPIO CENTRAL
Entregue direção estratégica forte + restrições importantes + liberdade compositiva controlada.
Antes de decidir layout, leia os dados reais. A estrutura, imagens, tipografia, paleta e densidade devem depender do negócio e do conteúdo disponível.

VERACIDADE
- Use somente os dados recebidos. Não pesquise externamente.
- Separe fatos, recomendações e lacunas.
- Nunca invente preços, cardápio, produtos, serviços, equipe, tempo de mercado, números, prêmios, depoimentos, diferenciais ou canais.
- Copy pode derivar um fato sem exagerá-lo: "872 avaliações registradas no Google" é válido; "uma das mais queridas da cidade" não é.
- [INFORMAÇÃO A CONFIRMAR] pode existir no briefing interno, mas NÃO deve virar seção grande, card ou placeholder visível na página final.

C.A.M.P.O.
C — Contexto: negócio, localização, dados confirmados, presença digital e lacunas.
A — Alvo: escolha UMA ação principal de conversão.
M — Modelo estético: direção curta e específica, fundamentada nos dados.
P — Padrão técnico: responsividade, acessibilidade, performance e robustez do layout.
O — Obstruções: uma lista curta do que evitar para impedir aparência genérica de IA.

ANÁLISE DE CONTEÚDO — OBRIGATÓRIA ANTES DO DESIGN
Considere nome, segmento, localização, telefone, site, Instagram, nota, quantidade de avaliações, horários, categorias, descrição, Google Maps e informações faltantes.
"hasVerifiedImages" indica somente imagens fornecidas diretamente ao gerador. Site/Instagram não significam automaticamente que uma foto específica está confirmada.

ESTRUTURA ADAPTATIVA
- Crie somente seções sustentadas pelo conteúdo real e pela ação principal.
- Prefira poucas seções excelentes a muitas seções artificiais.
- Não force Cardápio, Serviços, Galeria, Sobre, Depoimentos ou qualquer outra seção por causa do segmento.
- Se produtos/serviços/cardápio não estiverem disponíveis, omita a seção, reduza para um bloco pequeno ou incorpore a informação em outra área.
- Nunca crie uma seção visual grande contendo apenas [INFORMAÇÃO A CONFIRMAR].
- Não use uma sequência padrão fixa entre empresas do mesmo nicho.
- As seções retornadas em "sections" devem corresponder ao que realmente deve ser renderizado.

HERO
- A Hero deve passar no teste dos 3 segundos: o que é a empresa, por que continuar e qual ação pode ser feita agora.
- Sem imagem real confirmada: prefira Hero deliberadamente text-driven usando nome, categoria, localização, horário, avaliação, CTA, espaço negativo, divisórias ou composição gráfica. Não reserve 30–50% da tela para foto futura.
- Com imagem real confirmada: escolha a composição conforme formato, resolução, conteúdo e negócio. Full bleed, lateral, parcial, editorial, inferior, vertical ou assimétrica são opções; nenhuma é padrão obrigatório.
- Não force texto à esquerda + imagem à direita nem proporções como 5/7, 7/5 ou 4/8.

IMAGENS
- Se existirem imagens reais confirmadas, priorize nesta ordem: fornecidas pela empresa; site oficial; Instagram oficial identificado; outras fontes oficialmente associadas.
- Não substitua empresa real por comida, fachada, equipe ou ambiente fictícios gerados por IA.
- Se não houver imagem real, a página deve parecer finalizada SEM imagem.
- "Foto real recomendada aqui" só pode aparecer como comentário/metadata/instrução discreta de edição, nunca como grande elemento visual.
- O array "images" pode ser vazio quando não houver uso seguro de imagem.

DIREÇÃO VISUAL
- Gere uma direção de arte curta e fundamentada em características concretas do negócio.
- Defina somente o necessário: fundo predominante, superfície secundária se útil, cor de destaque, perfil tipográfico, densidade, contraste e tratamento de fotografia.
- Se não houver identidade oficial comprovada, deixe claro que é DIREÇÃO VISUAL PROPOSTA, não identidade da empresa.
- Paleta: normalmente 3–4 cores bastam. Não gere 5–6 cores por hábito.
- Tipografia: prefira descrever PERFIL (ex.: display expressiva + grotesca neutra). Escolha famílias exatas somente quando houver motivo forte. Não escolha automaticamente Inter, Poppins, Barlow Condensed, DM Sans ou qualquer combinação recorrente.
- "signatureDetail" é opcional em espírito: retorne "Nenhum detalhe assinado obrigatório" quando não houver motivo real. Nunca force 01/02/03, linhas decorativas ou numeração.
- Evite prescrever grid, frações, alturas e posicionamentos específicos sem necessidade.

ANTI-IA / TESTE DO CONCORRENTE
- Faça internamente o teste do concorrente: se trocar o nome por outra empresa do mesmo segmento e o conceito continuar perfeito, refine usando dados específicos como bairro, cidade, horário, volume de avaliações, categoria, contato, localização, presença digital e descrição.
- Não resolva genericidade adicionando decoração aleatória.
- Evite hero clichê centralizada, três cards iguais, gradiente roxo/azul genérico, emojis como ícones, radius idêntico em tudo, simetria excessiva, copy corporativa intercambiável, ilustração 3D/vetor genérico e aparência Shadcn/default.

COPY
- Use a descrição factual disponível para orientar headline, subheadline e organização.
- Não despeje categorias cruas do Google na interface.
- CTA deve dizer o que acontece depois: Falar pelo WhatsApp, Ver como chegar, Ligar agora, Solicitar orçamento etc.
- Não repita proibições ou explicações em várias partes do prompt.

REGRAS TÉCNICAS OBRIGATÓRIAS
- box-sizing: border-box global.
- nenhum elemento pode ultrapassar o viewport ou o container.
- max-width: 100% para imagens, mídia, embeds e mapas.
- min-width: 0 em filhos de flex/grid quando necessário.
- iframe/mapa responsivo e contido no grid.
- nenhuma largura fixa maior que o container.
- grids devem colapsar corretamente.
- evitar posicionamento absoluto para estrutura principal.
- não usar transformações que empurrem conteúdo para fora.
- verificar overflow-x.
- testar 320px, 375px, 768px, 1024px e desktop.
- preservar acessibilidade, foco visível, contraste, semântica, performance, imagens otimizadas e SEO básico.

VALIDAÇÃO VISUAL
Antes de considerar a implementação concluída, o agente que construir a página deve revisar e corrigir: Hero, largura, overflow, alinhamentos, espaços vazios, comportamento das imagens, tamanho das fontes, mobile, desktop e conteúdo ausente.
A página final não pode parecer wireframe. Nada de [FOTO], [IMAGEM], [FOTO REAL A INSERIR] ou [INFORMAÇÃO A CONFIRMAR] dominando a interface.

FORMATO DO LOVABLE PROMPT
O campo "lovablePrompt" deve ser aproximadamente 40–60% menor que o padrão antigo, sem repetição, preferencialmente entre 900 e 1.600 palavras.
Use exatamente esta organização, condensando itens quando possível:

## Contexto real
Dados confirmados relevantes.

## Objetivo
Uma ação principal.

## Estratégia
Como a página converte com o conteúdo disponível.

## Direção visual
Curta, específica e adaptativa. Informe se é proposta, não identidade oficial.

## Conteúdo disponível
O que pode ser usado com segurança.

## Conteúdo ausente
O que não pode ser inventado e como adaptar a composição sem criar vazios.

## Estrutura sugerida
Somente seções necessárias; explique brevemente o papel de cada uma. Não prescreva pixels.

## Imagens
Prioridade de fontes reais. Se não houver imagens confirmadas, diga explicitamente que a página deve funcionar sem imagem e sem placeholder grande.

## Regras de copy
Fatos, derivação factual e CTA.

## Regras técnicas
Resumo das regras obrigatórias de responsividade, acessibilidade, SEO e performance, incluindo prevenção de overflow.

## Evitar
Lista curta dos padrões anti-IA mais relevantes para este caso.

## Validação final
Teste dos 3 segundos + concorrente + inspeção mobile/desktop/overflow/conteúdo ausente.

SAÍDA ESTRUTURADA
- "analysis": concisa. Máximo prático de 5–7 fatos e lacunas relevantes.
- "strategy": uma recomendação e justificativa curta.
- "visualDirection": direção, não mockup fechado.
- "palette": 3–4 cores na maioria dos casos.
- "images": zero ou poucos usos realmente sustentados.
- "sections": somente as seções que devem existir.
- "lovablePrompt": briefing executável, enxuto e adaptativo.
`;

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["analysis", "strategy", "visualDirection", "images", "sections", "lovablePrompt"],
  properties: {
    analysis: {
      type: "object",
      additionalProperties: false,
      required: [
        "company",
        "segment",
        "nicheClassification",
        "facts",
        "digitalPresence",
        "opportunities",
        "missingInformation",
        "dataLimitations",
      ],
      properties: {
        company: { type: "string" },
        segment: { type: "string" },
        nicheClassification: { type: "string" },
        facts: { type: "array", maxItems: 7, items: { type: "string" } },
        digitalPresence: { type: "array", maxItems: 5, items: { type: "string" } },
        opportunities: { type: "array", maxItems: 5, items: { type: "string" } },
        missingInformation: { type: "array", maxItems: 7, items: { type: "string" } },
        dataLimitations: { type: "array", maxItems: 5, items: { type: "string" } },
      },
    },
    strategy: {
      type: "object",
      additionalProperties: false,
      required: [
        "projectType",
        "mainObjective",
        "primaryCta",
        "conversionStrategy",
        "rationale",
      ],
      properties: {
        projectType: {
          type: "string",
          enum: ["Landing Page", "Site Institucional"],
        },
        mainObjective: { type: "string" },
        primaryCta: { type: "string" },
        conversionStrategy: { type: "string" },
        rationale: { type: "string" },
      },
    },
    visualDirection: {
      type: "object",
      additionalProperties: false,
      required: [
        "style",
        "personality",
        "typography",
        "palette",
        "photography",
        "composition",
        "rhythm",
        "signatureDetail",
      ],
      properties: {
        style: { type: "string" },
        personality: { type: "array", maxItems: 4, items: { type: "string" } },
        typography: {
          type: "object",
          additionalProperties: false,
          required: ["headings", "body", "rationale"],
          properties: {
            headings: { type: "string" },
            body: { type: "string" },
            rationale: { type: "string" },
          },
        },
        palette: {
          type: "array",
          minItems: 3,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "hex", "role", "reason"],
            properties: {
              name: { type: "string" },
              hex: { type: "string" },
              role: { type: "string" },
              reason: { type: "string" },
            },
          },
        },
        photography: { type: "array", maxItems: 4, items: { type: "string" } },
        composition: { type: "string" },
        rhythm: { type: "string" },
        signatureDetail: { type: "string" },
      },
    },
    images: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["use", "image", "framing", "ratio", "purpose", "sourceGuidance"],
        properties: {
          use: { type: "string" },
          image: { type: "string" },
          framing: { type: "string" },
          ratio: { type: "string" },
          purpose: { type: "string" },
          sourceGuidance: { type: "string" },
        },
      },
    },
    sections: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "purpose", "content", "cta"],
        properties: {
          name: { type: "string" },
          purpose: { type: "string" },
          content: { type: "string" },
          cta: { type: "string" },
        },
      },
    },
    lovablePrompt: { type: "string", minLength: 3500, maxLength: 10500 },
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

function isValidGeneratedResult(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;

  return (
    typeof result.analysis === "object" &&
    result.analysis !== null &&
    typeof result.strategy === "object" &&
    result.strategy !== null &&
    typeof result.visualDirection === "object" &&
    result.visualDirection !== null &&
    Array.isArray(result.images) &&
    Array.isArray(result.sections) &&
    typeof result.lovablePrompt === "string" &&
    result.lovablePrompt.trim().length > 500
  );
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
    return failure(
      "NOT_CONFIGURED",
      "O provedor de IA ainda não está configurado no backend.",
      503,
    );
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
      "Os dados da empresa ou as opções de geração são inválidos.",
      400,
    );
  }

  const userPayload = {
    requestedProjectType: input.projectType,
    requestedObjective: input.objective,
    verifiedBusinessData: input.business,
    contentAvailability: buildContentAvailability(input.business),
    instructions: [
      "Se Tipo de projeto for IA decidir, escolha entre Landing Page e Site Institucional.",
      "Se Objetivo principal for IA decidir, escolha uma única ação principal coerente.",
      "Não trate recomendações como fatos.",
      "Use [INFORMAÇÃO A CONFIRMAR] apenas no briefing interno e nunca como grande bloco visível.",
      "Escolha somente as seções sustentadas pelos dados reais.",
      "Se não houver imagem real confirmada, faça a composição funcionar sem imagem e sem placeholder grande.",
      "Mantenha direção forte sem prescrever pixels, frações de grid, fontes exatas ou numeração sem necessidade.",
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
        model: "gpt-5.6-terra",
        reasoning: { effort: "medium" },
        max_output_tokens: 7000,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: SYSTEM_PROMPT }],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: JSON.stringify(userPayload),
              },
            ],
          },
        ],
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "januario_site_strategy",
            description:
              "Análise estratégica adaptativa e briefing enxuto para criação de site no Lovable.",
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
        "O provedor de IA não conseguiu concluir a geração agora.",
        502,
      );
    }

    const outputText = extractOutputText(providerPayload);
    if (!outputText) {
      return failure(
        "INVALID_AI_RESPONSE",
        "A IA não retornou uma resposta utilizável.",
        502,
      );
    }

    let result: unknown;
    try {
      result = JSON.parse(outputText);
    } catch {
      return failure(
        "INVALID_AI_RESPONSE",
        "A IA retornou uma resposta que não pôde ser validada.",
        502,
      );
    }

    if (!isValidGeneratedResult(result)) {
      return failure(
        "INVALID_AI_RESPONSE",
        "A resposta da IA não correspondeu ao formato esperado.",
        502,
      );
    }

    return json({ ok: true, result });
  } catch {
    return failure(
      "PROVIDER_FAILED",
      "Não foi possível comunicar com o provedor de IA agora.",
      502,
    );
  }
});
