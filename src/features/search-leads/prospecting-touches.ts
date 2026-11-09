import { fetchAllRows } from "../../lib/rest-pagination";
import { getValidSession } from "../../lib/auth";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../../lib/supabase-config";

type TouchRow = { lead_id: string };
type PastWhatsAppRow = { lead_id: string };

/** Per-user, RLS-scoped CRM read. No Google/Geoapify requests or credits. */
export async function fetchProspectingTouchedIds(): Promise<Set<string>> {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");

  function request(path: string) {
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session!.accessToken}`,
      },
      cache: "no-store",
    });
  }

  const [touches, oldEvents] = await Promise.all([
    fetchAllRows<TouchRow>(
      request,
      "lead_prospecting_touches?select=lead_id&order=lead_id.asc",
    ),
    // Old WhatsApp-opened events show that a contact action was previously
    // initiated. They are NOT evidence the message was sent.
    fetchAllRows<PastWhatsAppRow>(
      request,
      "lead_activities?select=lead_id&type=eq.whatsapp_opened&order=id.asc",
    ),
  ]);
  return new Set(
    [...touches, ...oldEvents]
      .map((row) => row.lead_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );
}

/**
 * Record only the first click on the existing "Mandar mensagem" action.
 * PK(user_id, lead_id) keeps repeat clicks and follow-ups from inflating
 * counts. FK ON DELETE CASCADE forgets the click when its lead is deleted.
 */
export async function recordProspectingTouch(leadId: string): Promise<void> {
  const session = await getValidSession();
  if (!session) throw new Error("AUTH_REQUIRED");
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/lead_prospecting_touches?on_conflict=user_id,lead_id`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({ user_id: session.user.id, lead_id: leadId }),
    },
  );
  if (!response.ok) throw new Error(`PROSPECTING_TOUCH_${response.status}`);
}
