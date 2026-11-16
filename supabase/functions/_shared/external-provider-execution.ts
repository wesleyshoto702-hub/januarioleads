/** Fase 2.6a — enforce a separate reservation BEFORE every paid request.
 * This helper intentionally contains no network, secrets, persistence, fetch,
 * environment access or provider URLs. Reserve MUST be a server-side,
 * atomic budget claim. A failed/throwing reservation is DENY.
 */
export async function runReservedExternalCall<T>(
  reserve: () => Promise<boolean>,
  request: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; reason: "BUDGET_DENIED" }> {
  let approved = false;
  try {
    approved = (await reserve()) === true;
  } catch {
    // Unknown budget, timeout, missing RPC or permissions: do not call provider.
  }
  if (!approved) return { ok: false, reason: "BUDGET_DENIED" };
  return { ok: true, value: await request() };
}
