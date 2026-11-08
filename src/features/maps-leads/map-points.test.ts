/// <reference lib="deno.ns" />
import { buildMapPoints } from "./map-points.ts";
function check(value: unknown, message: string) {
  if (!value) throw new Error(message);
}
Deno.test("Google Places pins retain verified ID and actual coordinates", () => {
  const points = buildMapPoints("google", [
    { placeId: "ChIJ-live", name: "Barbearia real", latitude: -21.243, longitude: -44.994 },
  ], []);
  check(points.length === 1 && points[0]?.id === "ChIJ-live" &&
    points[0]?.lat === -21.243 && points[0]?.lng === -44.994, "Incorrect Google pin");
});
Deno.test("Geoapify pins retain original source ID and coordinates", () => {
  const points = buildMapPoints("geoapify", [], [
    { sourceId: "osm-node-42", name: "Academia", latitude: -21.25, longitude: -45.01 },
  ]);
  check(points.length === 1 && points[0]?.id === "osm-node-42" &&
    points[0]?.lat === -21.25, "Incorrect Geoapify pin");
});
Deno.test("No provider means no pins; provider results never silently mix", () => {
  const google = [{ placeId: "g", name: "G", latitude: -21, longitude: -44 }];
  const geo = [{ sourceId: "o", name: "O", latitude: -22, longitude: -45 }];
  check(buildMapPoints(null, google, geo).length === 0, "Unsearched map should remain empty");
  check(buildMapPoints("google", google, geo).every((p) => p.id === "g"), "Cross-provider bleed");
});
Deno.test("Invalid/missing/synthetic coordinates are never pinned", () => {
  const values = [
    { placeId: "a", name: "A", latitude: null, longitude: -44 },
    { placeId: "b", name: "B", latitude: 999, longitude: -44 },
    { placeId: "c", name: "C", latitude: NaN, longitude: -44 },
    { placeId: "d", name: "D", latitude: -21, longitude: Infinity },
    { placeId: "e", name: "", latitude: -21, longitude: -44 },
  ];
  check(buildMapPoints("google", values, []).length === 0, "Bad coordinates should be rejected");
});
Deno.test("Pins are deduplicated and capped to the actual 20-place search payload", () => {
  const values = Array.from({ length: 35 }, (_, i) => ({
    placeId: "p" + i, name: "Empresa " + i, latitude: -21 + i / 1000, longitude: -45,
  }));
  values.push({ ...values[0]! });
  const points = buildMapPoints("google", values, []);
  check(points.length === 20 && new Set(points.map((p) => p.id)).size === 20, "Invalid cap or duplicates");
});
