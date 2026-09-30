import { getValidSession } from "../../lib/auth";
import type {
  AnalyzeVisualReferencesResponse,
  CaptureUrlReferenceResponse,
  VisualReferenceAsset,
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
  reference_type: "image" | "url";
  file_hash: string | null;
  storage_path: string | null;
  original_name: string;
  mime_type: "image/webp" | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  note: string;
  sort_order: number | null;
  created_at: string;
  source_url: string | null;
  source_domain: string | null;
  capture_status: "pending" | "ready" | "failed" | null;
  capture_error: string | null;
  capture_hash: string | null;
  capture_final_url: string | null;
  capture_title: string | null;
  captured_at: string | null;
};

type RemoteAsset = {
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

async function sha256Text(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function currentReferenceSignature(
  guidance: string,
  references: VisualReferenceItem[],
) {
  return sha256Text(
    JSON.stringify({
      guidance: guidance.trim(),
      references: references.map((reference) => ({
        type: reference.referenceType,
        identity:
          reference.referenceType === "url"
            ? {
                url: reference.sourceUrl,
                captureHash: reference.captureHash,
              }
            : { hash: reference.fileHash },
        note: reference.note.trim(),
        order: reference.sortOrder,
      })),
    }),
  );
}

function mapAsset(row: RemoteAsset): VisualReferenceAsset {
  return {
    id: row.id,
    referenceId: row.reference_id,
    storagePath: row.storage_path,
    fileHash: row.file_hash,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    segmentKind: row.segment_kind,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
  };
}

function mapReference(
  row: RemoteReference,
  assets: VisualReferenceAsset[] = [],
): VisualReferenceItem {
  return {
    id: row.id,
    setId: row.set_id,
    referenceType: row.reference_type,
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
    sourceUrl: row.source_url,
    sourceDomain: row.source_domain,
    captureStatus: row.capture_status,
    captureError: row.capture_error,
    captureHash: row.capture_hash,
    captureFinalUrl: row.capture_final_url,
    captureTitle: row.capture_title,
    capturedAt: row.captured_at,
    assets,
  };
}

export function normalizeVisualReferenceUrl(value: string) {
  const raw = value.trim();
  if (!raw) throw new Error("REFERENCE_URL_INVALID");

  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("REFERENCE_URL_INVALID");
  }
  if (url.username || url.password) throw new Error("REFERENCE_URL_INVALID");

  url.hash = "";
  if (url.protocol === "http:" && url.port === "80") url.port = "";
  if (url.protocol === "https:" && url.port === "443") url.port = "";

  return {
    url: url.toString(),
    domain: url.hostname.toLowerCase(),
  };
}

async function loadAssets(
  headers: Record<string, string>,
  referenceIds: string[],
) {
  if (referenceIds.length === 0) return new Map<string, VisualReferenceAsset[]>();

  const params = new URLSearchParams({
    select:
      "id,reference_id,storage_path,file_hash,mime_type,byte_size,width,height,segment_kind,sort_order,created_at",
    reference_id: `in.(${referenceIds.join(",")})`,
    order: "sort_order.asc",
  });

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_reference_assets?${params}`,
    { headers },
  );
  if (!response.ok) throw new Error("REFERENCE_ASSETS_LOAD_FAILED");

  const rows = (await response.json()) as RemoteAsset[];
  const grouped = new Map<string, VisualReferenceAsset[]>();
  for (const row of rows) {
    const asset = mapAsset(row);
    grouped.set(row.reference_id, [
      ...(grouped.get(row.reference_id) ?? []),
      asset,
    ]);
  }
  return grouped;
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
      "id,set_id,reference_type,file_hash,storage_path,original_name,mime_type,byte_size,width,height,note,sort_order,created_at,source_url,source_domain,capture_status,capture_error,capture_hash,capture_final_url,capture_title,captured_at",
    set_id: `eq.${set.id}`,
    active: "eq.true",
    order: "sort_order.asc",
  });

  const refsResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_references?${refParams}`,
    { headers },
  );
  if (!refsResponse.ok) throw new Error("REFERENCE_ITEMS_LOAD_FAILED");

  const refRows = (await refsResponse.json()) as RemoteReference[];
  const assets = await loadAssets(
    headers,
    refRows.filter((row) => row.reference_type === "url").map((row) => row.id),
  );
  const references = refRows.map((row) =>
    mapReference(row, assets.get(row.id) ?? []),
  );

  const currentSignature = await currentReferenceSignature(
    set.guidance,
    references,
  );
  const analysisIsCurrent =
    Boolean(set.analysis) &&
    Boolean(set.analysis_signature) &&
    set.analysis_signature === currentSignature;

  return {
    id: set.id,
    businessKey: set.business_key,
    guidance: set.guidance,
    analysis: analysisIsCurrent ? set.analysis : null,
    analysisSignature: analysisIsCurrent ? set.analysis_signature : null,
    analysisModel: analysisIsCurrent ? set.analysis_model : null,
    analyzedAt: analysisIsCurrent ? set.analyzed_at : null,
    references,
  };
}

export async function ensureVisualReferenceSet(businessKey: string) {
  const current = await getVisualReferenceSet(businessKey);
  if (current) return current;

  const { session, headers } = await auth();
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_reference_sets?on_conflict=user_id,business_key`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
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

  const cachedParams = new URLSearchParams({
    select:
      "id,set_id,reference_type,file_hash,storage_path,original_name,mime_type,byte_size,width,height,note,sort_order,created_at,source_url,source_domain,capture_status,capture_error,capture_hash,capture_final_url,capture_title,captured_at",
    set_id: `eq.${input.set.id}`,
    user_id: `eq.${session.user.id}`,
    reference_type: "eq.image",
    file_hash: `eq.${input.hash}`,
    active: "eq.false",
    limit: "1",
  });
  const cachedResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_references?${cachedParams}`,
    { headers },
  );

  if (cachedResponse.ok) {
    const cachedRows = (await cachedResponse.json()) as RemoteReference[];
    const cached = cachedRows[0];
    if (cached) {
      const reactivateResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/prompt_visual_references?id=eq.${encodeURIComponent(cached.id)}`,
        {
          method: "PATCH",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            active: true,
            removed_at: null,
            sort_order: input.sortOrder,
          }),
        },
      );
      if (!reactivateResponse.ok) {
        throw new Error("REFERENCE_METADATA_FAILED");
      }

      const rows = (await reactivateResponse.json()) as RemoteReference[];
      return rows[0] ? mapReference(rows[0]) : null;
    }
  }

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
    if (!duplicateObject) throw new Error("REFERENCE_UPLOAD_FAILED");
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
        reference_type: "image",
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
    if (insertResponse.status === 409) throw new Error("REFERENCE_DUPLICATE");
    throw new Error("REFERENCE_METADATA_FAILED");
  }

  await invalidateVisualAnalysis(input.set.id);
  const rows = (await insertResponse.json()) as RemoteReference[];
  return rows[0] ? mapReference(rows[0]) : null;
}

export async function createUrlVisualReference(input: {
  set: VisualReferenceSet;
  url: string;
  sortOrder: number;
}) {
  const normalized = normalizeVisualReferenceUrl(input.url);
  const { session, headers } = await auth();

  const cachedParams = new URLSearchParams({
    select:
      "id,set_id,reference_type,file_hash,storage_path,original_name,mime_type,byte_size,width,height,note,sort_order,created_at,source_url,source_domain,capture_status,capture_error,capture_hash,capture_final_url,capture_title,captured_at",
    set_id: `eq.${input.set.id}`,
    user_id: `eq.${session.user.id}`,
    reference_type: "eq.url",
    source_url: `eq.${normalized.url}`,
    active: "eq.false",
    limit: "1",
  });
  const cachedResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_references?${cachedParams}`,
    { headers },
  );

  if (cachedResponse.ok) {
    const cachedRows = (await cachedResponse.json()) as RemoteReference[];
    const cached = cachedRows[0];
    if (cached) {
      const reactivateResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/prompt_visual_references?id=eq.${encodeURIComponent(cached.id)}`,
        {
          method: "PATCH",
          headers: {
            ...headers,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            active: true,
            removed_at: null,
            sort_order: input.sortOrder,
          }),
        },
      );
      if (!reactivateResponse.ok) {
        throw new Error("REFERENCE_URL_CREATE_FAILED");
      }

      const rows = (await reactivateResponse.json()) as RemoteReference[];
      return rows[0] ? mapReference(rows[0]) : null;
    }
  }

  const response = await fetch(
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
        reference_type: "url",
        original_name: normalized.domain.slice(0, 240),
        note: "",
        sort_order: input.sortOrder,
        source_url: normalized.url,
        source_domain: normalized.domain,
        capture_status: "pending",
      }),
    },
  );

  if (!response.ok) {
    if (response.status === 409) throw new Error("REFERENCE_URL_DUPLICATE");
    throw new Error("REFERENCE_URL_CREATE_FAILED");
  }

  await invalidateVisualAnalysis(input.set.id);
  const rows = (await response.json()) as RemoteReference[];
  return rows[0] ? mapReference(rows[0]) : null;
}

export async function captureUrlVisualReference(
  referenceId: string,
  force = false,
): Promise<CaptureUrlReferenceResponse> {
  const { headers } = await auth();
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/capture-visual-reference`,
    {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ referenceId, force }),
    },
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      code: "CAPTURE_FAILED",
      message: "Não foi possível analisar automaticamente este site.",
      fallbackToScreenshot: true,
    };
  }

  return payload as CaptureUrlReferenceResponse;
}

export async function removeVisualReference(reference: VisualReferenceItem) {
  const { headers } = await auth();
  const removedAt = new Date().toISOString();

  const metadataResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/prompt_visual_references?id=eq.${encodeURIComponent(reference.id)}`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        active: false,
        removed_at: removedAt,
        sort_order: null,
      }),
    },
  );
  if (!metadataResponse.ok) return false;

  // Keep the previous aggregate analysis as cache. Its signature no longer
  // matches the active reference set, so loaders/analyzers will ignore it
  // until the exact composition becomes active again.
  return true;
}

async function fetchStorageObject(
  headers: Record<string, string>,
  storagePath: string,
) {
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${storagePath}`,
    { headers },
  );
  if (!response.ok) return null;
  return URL.createObjectURL(await response.blob());
}

export async function fetchReferencePreview(reference: VisualReferenceItem) {
  const { headers } = await auth();
  const storagePath =
    reference.referenceType === "url"
      ? reference.assets[0]?.storagePath
      : reference.storagePath;

  if (!storagePath) return null;
  return fetchStorageObject(headers, storagePath);
}

export async function fetchReferencePreviewAssets(
  reference: VisualReferenceItem,
) {
  const { headers } = await auth();
  const paths =
    reference.referenceType === "url"
      ? reference.assets.map((asset) => ({
          path: asset.storagePath,
          label: asset.segmentKind,
        }))
      : reference.storagePath
        ? [{ path: reference.storagePath, label: "full" as const }]
        : [];

  const results = await Promise.all(
    paths.map(async (item) => ({
      label: item.label,
      url: await fetchStorageObject(headers, item.path),
    })),
  );

  return results.filter(
    (item): item is { label: typeof item.label; url: string } =>
      Boolean(item.url),
  );
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
