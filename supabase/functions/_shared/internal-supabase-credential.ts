/** Select a server-side credential for Supabase internal REST requests.
 *
 * Prefer revocable modern sb_secret_ keys. Legacy service_role JWT is only a
 * transition fallback and must be deactivated after all consumers are migrated.
 * Never return or log these values from a public Edge Function response.
 */
export type InternalSupabaseCredential = {
  key: string;
  authorization: string | null;
  kind: "modern_secret" | "legacy_service_role";
};

export function selectInternalSupabaseCredential(
  rawNamedKeys: string | undefined,
  rawLegacyServiceRole: string | undefined,
): InternalSupabaseCredential | null {
  if (rawNamedKeys) {
    try {
      const keys: unknown = JSON.parse(rawNamedKeys);
      if (keys && typeof keys === "object" && !Array.isArray(keys)) {
        const dictionary = keys as Record<string, unknown>;
        const ordered = [dictionary["default"], ...Object.entries(dictionary)
          .filter(([name]) => name !== "default").map(([, key]) => key)];
        for (const raw of ordered) {
          if (typeof raw !== "string") continue;
          const key = raw.trim();
          if (key.startsWith("sb_secret_") && key.length > "sb_secret_".length) {
            return { key, authorization: null, kind: "modern_secret" };
          }
        }
      }
    } catch {
      // Malformed modern config: fall back only during a documented migration.
    }
  }

  const legacy = rawLegacyServiceRole?.trim();
  if (legacy && legacy.startsWith("eyJ") && legacy.length < 4096) {
    return {
      key: legacy,
      authorization: `Bearer ${legacy}`,
      kind: "legacy_service_role",
    };
  }
  return null;
}
