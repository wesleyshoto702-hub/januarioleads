/** A browser Origin is not authentication: accept only known frontend hosts.
 * Additional customer domains must be explicitly configured server-side.
 */
export function isAllowedBrowserOrigin(
  origin: string,
  additionalOrigins = "",
): boolean {
  try {
    const parsed = new URL(origin);
    if (
      parsed.origin !== origin ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) return false;

    const host = parsed.hostname.toLowerCase();
    const isLocal =
      parsed.protocol === "http:" &&
      (host === "localhost" || host === "127.0.0.1");
    const isLovable =
      parsed.protocol === "https:" &&
      (
        host === "lovable.app" ||
        host.endsWith(".lovable.app") ||
        host === "lovable.dev" ||
        host.endsWith(".lovable.dev")
      );
    const isPublishedApp =
      parsed.protocol === "https:" && host === "januleads.vercel.app";
    const isExplicitlyConfigured = additionalOrigins
      .split(",")
      .some((configured) => configured.trim() === origin);

    return isLocal || isLovable || isPublishedApp || isExplicitlyConfigured;
  } catch {
    return false;
  }
}
