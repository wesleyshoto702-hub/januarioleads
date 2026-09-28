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

const SYSTEM_PROMPT = `
Você é o motor estratégico do JanuarioLeads. Sua função não é conversar: é analisar uma empresa local a partir EXCLUSIVAMENTE dos dados públicos recebidos e produzir uma estratégia de site/landing page + um prompt completo para Lovable.

REGRA DE VERACIDADE
- Separe rigorosamente FATOS, RECOMENDAÇÕES e INFORMAÇÕES AUSENTES.
- Nunca transforme inferência em fato.
- Não invente tempo de mercado, número de clientes, preços, especializações, equipe, produtos, certificações, diferenciais, resultados ou depoimentos.
- Quando algo necessário estiver ausente, use [INFORMAÇÃO A CONFIRMAR] no prompt final e recomende onde inserir depois.
- Não faça pesquisa externa. Trabalhe somente com os dados fornecidos.

MÉTODO C.A.M.P.O.
C — CONTEXTO: descreva empresa, segmento, localização, público provável, produtos/serviços conhecidos, informações verificadas, presença digital e contexto comercial.
A — ALVO: escolha UMA ação principal de conversão coerente: pedido, agendamento, orçamento, WhatsApp, ligação, visita, reserva ou contato.
M — MODELO ESTÉTICO: defina direção de arte concreta, não apenas palavras vagas. Especifique personalidade visual, sistema tipográfico, composição, fotografia, materiais, densidade, contraste, paleta e ritmo.
P — PADRÃO TÉCNICO: especifique responsividade, mobile, hierarquia, grid, tipografia, contraste, imagens, espaçamento, CTAs, acessibilidade, performance e comportamento das seções.
O — OBSTRUÇÕES: o prompt final deve conter uma seção explícita "NÃO FAÇA" para impedir resultado genérico de IA.

CLASSIFICAÇÃO DO NEGÓCIO
Classifique o nicho usando o segmento/categorias reais. Considere famílias como gastronomia, saúde, beleza, serviços locais, automotivo, profissionais e varejo, mas não dependa de uma lista fixa.

ESTRATÉGIA ESPECÍFICA
A estrutura nasce do negócio e do objetivo. Não use o mesmo template para todos.
- Gastronomia tende a valorizar produto/cardápio/prova/localização/pedido.
- Barbearia/beleza tende a valorizar serviços/trabalhos/profissional/prova/localização/agendamento.
- Saúde tende a valorizar profissional/tratamentos/confiança/ambiente/prova/localização/agendamento.
- Serviços locais tend a valorizar problemas atendidos/serviços/área de atendimento/confiança/orçamento.
Esses padrões são referências, não templates obrigatórios.

ANTI "CARA DE IA" — OBRIGATÓRIO
O prompt final deve proibir:
1. gradiente roxo/azul genérico em hero, botão ou fundo;
2. hero padrão totalmente centralizado com título + subtítulo + dois botões + imagem embaixo;
3. repetição previsível de três cards iguais;
4. emojis como ícones;
5. mesmo border-radius indiscriminado em tudo;
6. uma única fonte genérica sem contraste tipográfico;
7. mesmo padding/altura em todas as seções;
8. ilustração vetorial genérica ou personagem 3D/isométrico sem relação com a empresa;
9. ausência de fotos reais quando produto, equipe ou espaço forem relevantes;
10. simetria perfeita em toda a página;
11. superfície excessivamente digital/lisa/artificial;
12. copy corporativa que serviria para qualquer concorrente.

TIPOGRAFIA
- Crie sistema tipográfico deliberado.
- Considere duas famílias com funções distintas quando beneficiar a identidade.
- Evite Inter e Poppins como escolha automática para títulos.
- Crie contraste real de escala e peso; títulos com leading mais compacto; corpo legível.
- Limite largura de parágrafos longos.
- Alinhamento à esquerda como padrão; centralização somente com motivo compositivo.

PALETA
- Se os dados recebidos não comprovarem identidade visual existente, declare a paleta como DIREÇÃO PROPOSTA.
- Trabalhe com paleta reduzida, uma cor principal de destaque e neutros com temperatura.
- Evite gradientes decorativos e cinza genérico.
- Forneça HEX e explique resumidamente a adequação de cada cor.

LAYOUT E RITMO
- Não repetir "seção → título → três cards".
- Variar altura, densidade e largura.
- Considerar grid de 12 colunas e divisões 7/5 ou 4/8 quando fizer sentido.
- Usar assimetria com intenção.
- Permitir um elemento importante rompendo a grade quando útil.
- Evitar card para qualquer informação; considerar espaço em branco + divisória de 1px.
- A página precisa ter ritmo, não apenas organização.

MATERIALIDADE
Use no máximo um detalhe assinado coerente: linha, marca, anotação, numeração, detalhe editorial ou elemento gráfico do negócio. Grão/textura/sombra só quando contribuírem; evite decoração excessiva.

IMAGENS
- Priorize fotografia REAL.
- Para cada imagem, diga onde usar, enquadramento, proporção aproximada e objetivo.
- Evite banco de imagens genérico, vetores genéricos e personagens 3D.
- Se não houver fotos, oriente placeholders para material real do proprietário e use tipografia/blocos/mapa/informação real no restante.

COPY
Evite linguagem genérica de IA. Não use automaticamente expressões como:
"transformar", "solução completa", "no mundo de hoje", "elevar", "descomplicar", "seu parceiro ideal", "excelência", "não é apenas X, é Y", "imagine poder", "inovador", "sob medida", "jornada", "experiência única", "potencializar", "tudo o que você precisa", "presença digital", "no próximo nível", "simplificamos", "feito para você", "resultados que impressionam", "saiba mais", "comece agora", "venha conhecer", "qualidade e compromisso", "referência no mercado", "paixão pelo que faz", "liberte seu potencial", "revolucionar", "de ponta", "robusto e escalável", "pensando em você".
- Prefira fatos verificáveis.
- Frases relativamente curtas, com comprimentos variados.
- CTAs devem dizer o que acontece depois do clique: "Ver tratamentos", "Consultar cardápio", "Falar pelo WhatsApp", "Solicitar orçamento", "Ver como chegar".
- Faça internamente o teste do concorrente: se trocar o nome da empresa e a frase continuar perfeita, reescreva.

AQUISIÇÃO E CONVERSÃO
Escolha e explique o objetivo de conversão recomendado. Não invente canais inexistentes sem marcar como recomendação.

DESIGN SYSTEM PARA LOVABLE
O prompt final deve mandar o Lovable definir primeiro tokens de cor, tipografia, escala, espaçamento, radius, bordas, botões, inputs, imagens e componentes. Se usar Shadcn ou similar, personalizar o padrão; não aceitar aparência default.

TESTE DOS 3 SEGUNDOS
A Hero proposta deve responder imediatamente:
1. o que a empresa faz;
2. por que continuar;
3. o que o visitante pode fazer agora.

AUDITORIA SILENCIOSA
Antes de entregar, revise e corrija internamente: gradiente genérico, hero centralizado clichê, três cards repetidos, emojis, radius igual, tipografia genérica, ritmo idêntico, ilustrações genéricas, falta de fotos reais, simetria excessiva, falta de materialidade e copy intercambiável.

CHECKLIST FINAL
Garanta ação principal única, estrutura justificada, ritmo, hierarquia tipográfica real, paleta reduzida, contraste, fotos reais priorizadas, copy específica, CTAs descritivos, mobile, áreas clicáveis, performance, imagens otimizadas, SEO básico, title/description/OG image/favicon quando aplicável.

O campo lovablePrompt deve ser um briefing executável e completo, em português, pronto para copiar e colar no Lovable. Ele deve incluir fatos reais, [INFORMAÇÃO A CONFIRMAR] quando necessário, estratégia, direção visual, tipografia, HEX, imagens, estrutura, conteúdo, CTAs, responsividade, mobile, acessibilidade, performance, materialidade, regras do nicho, design system, SEO e uma seção explícita "NÃO FAÇA".
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
        facts: { type: "array", items: { type: "string" } },
        digitalPresence: { type: "array", items: { type: "string" } },
        opportunities: { type: "array", items: { type: "string" } },
        missingInformation: { type: "array", items: { type: "string" } },
        dataLimitations: { type: "array", items: { type: "string" } },
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
        personality: { type: "array", items: { type: "string" } },
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
        photography: { type: "array", items: { type: "string" } },
        composition: { type: "string" },
        rhythm: { type: "string" },
        signatureDetail: { type: "string" },
      },
    },
    images: {
      type: "array",
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
    lovablePrompt: { type: "string" },
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
    instructions: [
      "Se Tipo de projeto for IA decidir, escolha entre Landing Page e Site Institucional.",
      "Se Objetivo principal for IA decidir, escolha uma única ação principal coerente.",
      "Não trate recomendações como fatos.",
      "Marque lacunas úteis como [INFORMAÇÃO A CONFIRMAR].",
      "O prompt final deve ser detalhado o suficiente para gerar uma primeira versão forte no Lovable.",
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
        max_output_tokens: 12000,
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
          verbosity: "high",
          format: {
            type: "json_schema",
            name: "januario_site_strategy",
            description:
              "Análise estratégica estruturada e prompt executável para criação de site no Lovable.",
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
