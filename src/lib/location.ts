import { normalizeBrazilianStateCode } from "./brazil-locations";

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
  return normalizeBrazilianStateCode(value) || (value ?? "").trim().toUpperCase();
}

export function sameLocation(
  left: { city?: string | null | undefined; state?: string | null | undefined },
  right: { city?: string | null | undefined; state?: string | null | undefined },
) {
  return (
    normalizeLocationText(left.city) === normalizeLocationText(right.city) &&
    normalizeStateCode(left.state) === normalizeStateCode(right.state)
  );
}

export function makeLocationKey(city: string, state: string) {
  return `${normalizeLocationText(city)}|${normalizeStateCode(state)}`;
}
