/** Location markers from authenticated real-provider search responses. No synthetic points. */
export type RealMapPoint = { id: string; name: string; lat: number; lng: number; listIndex: number };
type GoogleCandidate = { placeId: string; name: string; latitude: number | null; longitude: number | null };
type GeoCandidate = { sourceId: string; name: string; latitude: number; longitude: number };

function validLocation(lat: number | null, lng: number | null): lat is number {
  return typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
    typeof lng === "number" && Number.isFinite(lng) && Math.abs(lng) <= 180;
}

export function buildMapPoints(
  provider: "google" | "geoapify" | null,
  googleResults: readonly GoogleCandidate[],
  geoResults: readonly GeoCandidate[],
): RealMapPoint[] {
  const candidates = provider === "google"
    ? googleResults.map((item) => ({ id: item.placeId, name: item.name, lat: item.latitude, lng: item.longitude }))
    : provider === "geoapify"
      ? geoResults.map((item) => ({ id: item.sourceId, name: item.name, lat: item.latitude, lng: item.longitude }))
      : [];
  const seen = new Set<string>();
  const points: RealMapPoint[] = [];
  for (const [index, item] of candidates.entries()) {
    if (!item.id || !item.name || seen.has(item.id) || !validLocation(item.lat, item.lng)) continue;
    seen.add(item.id);
    // Same numbering as the sidebar, even if prior places lack GPS.
    points.push({ id: item.id, name: item.name, lat: item.lat!, lng: item.lng!, listIndex: index + 1 });
    if (points.length >= 35) break;
  }
  return points;
}
