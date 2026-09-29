import { getValidSession } from "../../lib/auth";
import type {
  AnalyzeVisualReferencesResponse,
  VisualReferenceItem,
  VisualReferenceSet,
} from "./visual-reference-types";

const SUPABASE_URL = "https://czkazbianiflhldenhcj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_rDtFwPmhh93xceOpvf9hUg_PSlvpB8p";
const BUCKET = "prompt-visual-references";

type RemoteSet = {
  id: string;
  business_key: string;
  guidance: string;
  analysis: VisualReferenceSet["analysis"];
  analysis_signature: string | null;
  analysis_model: string | null;
  analyzed_at: string | null;
};

type RemoteReference = {
  id: string;
  set_id: string;
  file_hash: string;
  storage_path: string;
  original_name: string;
  mime_type: "image/webp";
  byte_size: number;
  width: number;
  height: number;
  note: string;
  sort_order: number;
  created_at: string;
};

async function auth() {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");
  return {
    session,
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${session.accessToken}`,
    },
  };
}

function mapReference(row: RemoteReference): VisualReferenceItem {
  return {
    id: row.id,
    setId: row.set_id,
    fileHash: row.file_hash,
    storagePath: row.storage_path,
    originalName: row.original_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    note: row.note,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function getVisualReferenceSet(
  businessKey: string,
): Promise<VisualReferenceSet | null> {
  const { headers } = await auth();
  const params = new URLSearchParams({
    select:
      "id,business_key,guidance,analysis,analysis_signature,analysis_model,analyzed_at",
    business_key: `eq.${businessKey}`,
    limit: "1",
  });

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_reference_sets?${params}`,
    { headers },
  );
  if (!response.ok) throw new Error("REFERENCE_SET_LOAD_FAILED");

  const rows = (await response.json()) as RemoteSet[];
  const set = rows[0];
  if (!set) return null;

  const refParams = new URLSearchParams({
    select:
      "id,set_id,file_hash,storage_path,original_name,mime_type,byte_size,width,height,note,sort_order,created_at",
    set_id: `eq.${set.id}`,
    order: "sort_order.asc",
  });

  const refsResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_references?${refParams}`,
    { headers },
  );
  if (!refsResponse.ok) throw new Error("REFERENCE_ITEMS_LOAD_FAILED");

  const references = ((await refsResponse.json()) as RemoteReference[]).map(
    mapReference,
  );

  return {
    id: set.id,
    businessKey: set.business_key,
    guidance: set.guidance,
    analysis: set.analysis,
    analysisSignature: set.analysis_signature,
    analysisModel: set.analysis_model,
    analyzedAt: set.analyzed_at,
    references,
  };
}

export async function ensureVisualReferenceSet(businessKey: string) {
  const current = await getVisualReferenceSet(businessKey);
  if (current) return current;

  const { session, headers } = await auth();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_reference_sets`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        user_id: session.user.id,
        business_key: businessKey,
      }),
    },
  );

  if (!response.ok) throw new Error("REFERENCE_SET_CREATE_FAILED");
  const rows = (await response.json()) as RemoteSet[];
  const row = rows[0];
  if (!row) throw new Error("REFERENCE_SET_CREATE_FAILED");

  return {
    id: row.id,
    businessKey: row.business_key,
    guidance: row.guidance,
    analysis: row.analysis,
    analysisSignature: row.analysis_signature,
    analysisModel: row.analysis_model,
    analyzedAt: row.analyzed_at,
    references: [],
  } satisfies VisualReferenceSet;
}

export async function updateVisualGuidance(setId: string, guidance: string) {
  const { headers } = await auth();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_reference_sets?id=eq.${encodeURIComponent(setId)}`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        guidance: guidance.slice(0, 1200),
        analysis: null,
        analysis_signature: null,
        analysis_model: null,
        analyzed_at: null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  return response.ok;
}

export async function updateReferenceNote(referenceId: string, note: string) {
  const { headers } = await auth();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_references?id=eq.${encodeURIComponent(referenceId)}`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ note: note.slice(0, 500) }),
    },
  );
  return response.ok;
}

export async function invalidateVisualAnalysis(setId: string) {
  const { headers } = await auth();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_reference_sets?id=eq.${encodeURIComponent(setId)}`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        analysis: null,
        analysis_signature: null,
        analysis_model: null,
        analyzed_at: null,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  return response.ok;
}

export async function uploadVisualReference(input: {
  set: VisualReferenceSet;
  blob: Blob;
  hash: string;
  originalName: string;
  width: number;
  height: number;
  sortOrder: number;
}) {
  const { session, headers } = await auth();
  const storagePath = `${session.user.id}/${input.set.id}/${input.hash}.webp`;

  const uploadResponse = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "image/webp",
        "x-upsert": "false",
      },
      body: input.blob,
    },
  );

  if (!uploadResponse.ok) {
    const uploadError = await uploadResponse.text();
    const duplicateObject =
      uploadResponse.status === 400 &&
      /duplicate|already exists/i.test(uploadError);
    if (!duplicateObject) {
      throw new Error("REFERENCE_UPLOAD_FAILED");
    }
  }

  const insertResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_references`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        set_id: input.set.id,
        user_id: session.user.id,
        file_hash: input.hash,
        storage_path: storagePath,
        original_name: input.originalName.slice(0, 240),
        mime_type: "image/webp",
        byte_size: input.blob.size,
        width: input.width,
        height: input.height,
        note: "",
        sort_order: input.sortOrder,
      }),
    },
  );

  if (!insertResponse.ok) {
    if (insertResponse.status !== 409) {
      await fetch(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`,
        { method: "DELETE", headers },
      );
    }
    if (insertResponse.status === 409) {
      throw new Error("REFERENCE_DUPLICATE");
    }
    throw new Error("REFERENCE_METADATA_FAILED");
  }

  await invalidateVisualAnalysis(input.set.id);
  const rows = (await insertResponse.json()) as RemoteReference[];
  return rows[0] ? mapReference(rows[0]) : null;
}

export async function deleteVisualReference(reference: VisualReferenceItem) {
  const { headers } = await auth();

  const metadataResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_references?id=eq.${encodeURIComponent(reference.id)}`,
    {
      method: "DELETE",
      headers: {
        ...headers,
        Prefer: "return=minimal",
      },
    },
  );
  if (!metadataResponse.ok) return false;

  await fetch(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${reference.storagePath}`,
    { method: "DELETE", headers },
  );

  await invalidateVisualAnalysis(reference.setId);
  return true;
}

export async function fetchReferencePreview(reference: VisualReferenceItem) {
  const { headers } = await auth();
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${reference.storagePath}`,
    { headers },
  );
  if (!response.ok) return null;
  return URL.createObjectURL(await response.blob());
}

export async function analyzeVisualReferences(
  setId: string,
  force = false,
): Promise<AnalyzeVisualReferencesResponse> {
  const { headers } = await auth();
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/analyze-visual-references`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ setId, force }),
    },
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      code: "PROVIDER_FAILED",
      message: "A análise visual respondeu de forma inesperada.",
    };
  }

  return payload as AnalyzeVisualReferencesResponse;
}


export async function persistVisualReferenceDraft(set: VisualReferenceSet) {
  const { headers } = await auth();

  const setResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_reference_sets?id=eq.${encodeURIComponent(set.id)}`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        guidance: set.guidance.slice(0, 1200),
        updated_at: new Date().toISOString(),
        ...(set.analysis === null && set.analysisSignature === null
          ? {
              analysis: null,
              analysis_signature: null,
              analysis_model: null,
              analyzed_at: null,
            }
          : {}),
      }),
    },
  );

  if (!setResponse.ok) return false;

  const results = await Promise.all(
    set.references.map((reference) =>
      fetch(
        `${SUPABASE_URL}/rest/v1/prompt_visual_references?id=eq.${encodeURIComponent(reference.id)}`,
        {
          method: "PATCH",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ note: reference.note.slice(0, 500) }),
        },
      ),
    ),
  );

  return results.every((response) => response.ok);
}
