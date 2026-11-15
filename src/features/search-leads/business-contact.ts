/**
 * A directory-provided email is a contact candidate, not proof that the
 * address belongs to the business. Never mark it as verified automatically.
 * This helper is intentionally pure: searching/filtering doesn't call APIs.
 */
export function hasUsableBusinessEmail(raw: string | null | undefined): boolean {
  if (typeof raw !== "string") return false;
  const value = raw.trim();
  return value.length > 0 && value.length <= 254 &&
    /^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
}
