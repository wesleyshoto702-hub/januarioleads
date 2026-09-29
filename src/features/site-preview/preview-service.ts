import { getValidSession } from "../../lib/auth";
import type {
  GeneratePreviewInput,
  GeneratePreviewResponse,
  SavedPreviewRecord,
} from "./types";

const SUPABASE_URL = "https://czkazbianiflhldenhcj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";

async function authedHeaders() {
  const session = await getValidSession();
  if (!session) return null;

  return {
    session,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
    },
  };
}

export async function getSavedPreview(
  businessKey: string,
): Promise<SavedPreviewRecord | null> {
  const auth = await authedHeaders();
  if (!auth) return null;

  const params = new URLSearchParams();
  params.set(
    "select",
    "business_key,company,prompt_version,preview_version,preview_spec,generated_at",
  );
  params.set("business_key", `eq.${businessKey}`);
  params.set("limit", "1");

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/site_previews?${params.toString()}`,
    { headers: auth.headers },
  );

  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{
    business_key: string;
    company: string;
    prompt_version: string;
    preview_version: string;
    preview_spec: SavedPreviewRecord["spec"];
    generated_at: string;
  }>;

  const row = rows[0];
  if (!row) return null;

  return {
    businessKey: row.business_key,
    company: row.company,
    promptVersion: row.prompt_version,
    previewVersion: row.preview_version,
    generatedAt: row.generated_at,
    spec: row.preview_spec,
  };
}

export async function savePreview(preview: SavedPreviewRecord) {
  const auth = await authedHeaders();
  if (!auth) return false;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/site_previews?on_conflict=user_id,business_key`,
    {
      method: "POST",
      headers: {
        ...auth.headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: auth.session.user.id,
        business_key: preview.businessKey,
        company: preview.company,
        prompt_version: preview.promptVersion,
        preview_version: preview.previewVersion,
        preview_spec: preview.spec,
        generated_at: preview.generatedAt,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  return response.ok;
}

export async function generatePreview(
  input: GeneratePreviewInput,
): Promise<GeneratePreviewResponse> {
  const auth = await authedHeaders();
  if (!auth) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: "Sua sessão expirou. Entre novamente para gerar a prévia.",
    };
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-preview`,
      {
        method: "POST",
        headers: auth.headers,
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
        message: "A geração da prévia respondeu de forma inesperada.",
      };
    }

    if (
      payload &&
      typeof payload === "object" &&
      "ok" in payload &&
      typeof (payload as { ok?: unknown }).ok === "boolean"
    ) {
      return payload as GeneratePreviewResponse;
    }

    return {
      ok: false,
      code: response.status === 401 ? "AUTH_REQUIRED" : "PROVIDER_FAILED",
      message:
        response.status === 401
          ? "Sua sessão não é válida para gerar a prévia."
          : "Não foi possível gerar a prévia agora.",
    };
  } catch {
    return {
      ok: false,
      code: "PROVIDER_FAILED",
      message: "Não foi possível conectar ao gerador de prévia agora.",
    };
  }
}
