export function normalizeLocationText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeStateCode(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

export function sameLocation(
  left: { city?: string | null; state?: string | null },
  right: { city?: string | null; state?: string | null },
) {
  return (
    normalizeLocationText(left.city) === normalizeLocationText(right.city) &&
    normalizeStateCode(left.state) === normalizeStateCode(right.state)
  );
}

export function makeLocationKey(city: string, state: string) {
  return `${normalizeLocationText(city)}|${normalizeStateCode(state)}`;
}
