/** Only absolute HTTP(S) links may be rendered from external business data. */
export function safeExternalHref(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;

  try {
    const url = new URL(trimmed);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      !url.hostname ||
      url.username ||
      url.password
    ) return null;
    return url.href;
  } catch {
    return null;
  }
}
