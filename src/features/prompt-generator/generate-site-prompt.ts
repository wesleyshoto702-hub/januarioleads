import { getAccessToken } from "../../lib/auth";
import type {
  GeneratePromptResponse,
  PromptBusinessContext,
  PromptObjective,
  PromptProjectType,
} from "./types";

const SUPABASE_URL = "https://czkazbianiflhldenhcj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";

export async function generateSitePrompt(input: {
  business: PromptBusinessContext;
  projectType: PromptProjectType;
  objective: PromptObjective;
}): Promise<GeneratePromptResponse> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: "Sua sessão expirou. Entre novamente para gerar o prompt.",
    };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-site-prompt`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(input),
      },
    );

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        code: "PROVIDER_FAILED",
        message: "A geração respondeu de forma inesperada. Tente novamente.",
      };
    }

    if (
      payload &&
      typeof payload === "object" &&
      "ok" in payload &&
      typeof (payload as { ok?: unknown }).ok === "boolean"
    ) {
      return payload as GeneratePromptResponse;
    }

    return {
      ok: false,
      code: response.status === 401 ? "AUTH_REQUIRED" : "PROVIDER_FAILED",
      message:
        response.status === 401
          ? "Sua sessão não é válida para utilizar o gerador."
          : "Não foi possível gerar o prompt agora. Tente novamente.",
    };
  } catch {
    return {
      ok: false,
      code: "PROVIDER_FAILED",
      message: "Não foi possível conectar ao gerador agora. Tente novamente.",
    };
  }
}
