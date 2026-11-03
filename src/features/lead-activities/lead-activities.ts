import { getValidSession } from "../../lib/auth";
import type { CreateLeadActivityInput, LeadActivity, LeadActivityPage } from "./types";
import { LEAD_ACTIVITY_PAGE_SIZE } from "./types";

import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../lib/supabase-config";

type RemoteLeadActivity = {
  id: number;
  lead_id: string;
  user_id: string;
  type: LeadActivity["type"];
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

async function authedRequest(path: string, init: RequestInit = {}) {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");

  return {
    session,
    response: await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    }),
  };
}

function fromRemote(row: RemoteLeadActivity): LeadActivity {
  return {
    id: row.id,
    leadId: row.lead_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    description: row.description,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export async function fetchLeadActivities(
  leadId: string,
  offset = 0,
  limit = LEAD_ACTIVITY_PAGE_SIZE,
): Promise<LeadActivityPage> {
  const params = new URLSearchParams();
  params.set("select", "id,lead_id,user_id,type,title,description,metadata,created_at");
  params.set("lead_id", `eq.${leadId}`);
  params.set("order", "created_at.desc,id.desc");
  params.set("offset", String(offset));
  params.set("limit", String(limit + 1));

  const { response } = await authedRequest(`lead_activities?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`LEAD_ACTIVITIES_${response.status}`);
  }

  const rows = (await response.json()) as RemoteLeadActivity[];
  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit).map(fromRemote);

  return {
    items: visible,
    hasMore,
    nextOffset: offset + visible.length,
  };
}

export async function createLeadActivity(
  input: CreateLeadActivityInput,
): Promise<LeadActivity | null> {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");
  const { response } = await authedRequest("lead_activities", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      lead_id: input.leadId,
      user_id: session.user.id,
      type: input.type,
      title: input.title.trim().slice(0, 180),
      description: input.description?.trim() ? input.description.trim().slice(0, 1200) : null,
      metadata: input.metadata ?? {},
      ...(input.createdAt ? { created_at: input.createdAt } : {}),
    }),
  });

  if (!response.ok) {
    if (response.status === 409 && input.type === "lead_added") {
      return null;
    }
    throw new Error(`LEAD_ACTIVITY_CREATE_${response.status}`);
  }

  const rows = (await response.json()) as RemoteLeadActivity[];
  return rows[0] ? fromRemote(rows[0]) : null;
}

export async function updateManualNote(
  activityId: number,
  text: string,
): Promise<LeadActivity | null> {
  const { response } = await authedRequest(
    `lead_activities?id=eq.${encodeURIComponent(String(activityId))}&type=eq.manual_note`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        description: text.trim().slice(0, 1200),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`LEAD_ACTIVITY_UPDATE_${response.status}`);
  }

  const rows = (await response.json()) as RemoteLeadActivity[];
  return rows[0] ? fromRemote(rows[0]) : null;
}

export async function deleteManualNote(activityId: number) {
  const { response } = await authedRequest(
    `lead_activities?id=eq.${encodeURIComponent(String(activityId))}&type=eq.manual_note`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    },
  );

  return response.ok;
}
