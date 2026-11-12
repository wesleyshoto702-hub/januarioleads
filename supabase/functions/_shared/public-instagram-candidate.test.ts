import {
  canonicalPublicInstagram,
  firstProviderInstagram,
  providerInstagramCandidate,
} from "./public-instagram-candidate.ts";

function equal(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(label + ": expected " + String(expected) +
      ", got " + String(actual));
  }
}

Deno.test("canonicalizes public profile URLs and handles", () => {
  equal(canonicalPublicInstagram("@hotel_lavras"), "https://www.instagram.com/hotel_lavras/", "@handle");
  equal(canonicalPublicInstagram("https://m.instagram.com/lavras.hotel/?utm_source=maps"),
    "https://www.instagram.com/lavras.hotel/", "mobile profile");
  equal(canonicalPublicInstagram("instagram.com/barbearia_lavras"),
    "https://www.instagram.com/barbearia_lavras/", "bare host");
});

Deno.test("never turns reels, post links or spoofed URLs into company profiles", () => {
  for (const value of [
    "https://www.instagram.com/p/ABCxyz",
    "https://instagram.com/reel/ABC",
    "https://instagram.com/stories/empresa/123",
    "https://instagram.com.evil.example/barbearia",
    "https://evil.test/instagram.com/empresa",
    "javascript:alert(1)",
    "http://user:secret@instagram.com/empresa",
    "@",
  ]) equal(canonicalPublicInstagram(value), null, value);
});

Deno.test("source links are only medium-confidence review candidates", () => {
  for (const source of ["Overture", "Geoapify", "Google Places"] as const) {
    const candidate = providerInstagramCandidate(
      "https://instagram.com/empresa_lavras", source
    );
    equal(candidate?.confidence, "medium", source);
    equal(candidate?.username, "empresa_lavras", source);
    equal(candidate?.evidenceUrls.length, 0, "no invented verification evidence");
    if (!candidate?.signals[0].includes(source)) throw new Error("provenance missing");
  }
});

Deno.test("picks the first valid profile from nested public provider records", () => {
  const found = firstProviderInstagram(
    ["https://instagram.com/p/test", "invalid"],
    ["https://instagram.com/empresa_a/", "https://instagram.com/empresa_b/"],
  );
  equal(found, "https://www.instagram.com/empresa_a/", "first verified syntax");
});
