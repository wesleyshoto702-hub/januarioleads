import { fetchAllRows } from "../../lib/rest-pagination";
import { getValidSession } from "../../lib/auth";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../../lib/supabase-config";

type ConfirmationRow = { lead_id: string; metadata: { confirmation?: unknown } | null };

/**
 * Read-only, RLS-scoped. No Places requests, no SaaS credit spend.
 * "WhatsApp aberto" by itself is NOT a confirmed send.
 */
export async function fetchConfirmedProspectingIds(): Promise<Set<string>> {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");
  const base = "lead_activities?select=lead_id,metadata&type=eq.whatsapp_opened&order=id.asc";
  const rows = await fetchAllRows<ConfirmationRow>(
    (path) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.accessToken}`,
      },
      cache: "no-store",
    }),
    base,
  );
  return new Set(
    rows.filter((row) => row.metadata?.confirmation === "user" && typeof row.lead_id === "string")
      .map((row) => row.lead_id),
  );
}
