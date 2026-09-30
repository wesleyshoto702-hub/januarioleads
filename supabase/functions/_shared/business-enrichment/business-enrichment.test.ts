import {
  buildFingerprint,
  branchIdentityScoreFromText,
  identitySignature,
  withVerifiedIdentityUpdates,
} from "./security.ts";
import {
  buildVerifiedSnapshot,
  finalizeCandidates,
} from "./consolidate.ts";
import { selectInternalLinks } from "./website.ts";
import type {
  BusinessInput,
  FactCandidate,
  PageSnapshot,
} from "./types.ts";

function assert(value: unknown, message: string) {
  if (!value) throw new Error(message);
}

function candidate(
  type: string,
  normalizedValue: string,
  confidence: "high" | "medium" | "low",
  sourceDomain: string,
  sourceType: FactCandidate["sourceType"] = "official_text",
): FactCandidate {
  return {
    type,
    label: normalizedValue,
    value: { name: normalizedValue },
    normalizedValue,
    sourceUrl: `https://${sourceDomain}/source`,
    sourceDomain,
    sourceType,
    extractionMethod: "test",
    identityScore: confidence === "high" ? 90 : confidence === "medium" ? 60 : 20,
    confidence,
    evidenceSummary: normalizedValue,
  };
}

Deno.test("same name in different cities receives a different identity signature", async () => {
  const base: BusinessInput = {
    placeId: null,
    company: "Studio Bella",
    segment: "Salão de Beleza",
    phone: null,
    address: "Rua A, 10",
    city: "Lavras",
    state: "MG",
  };
  const lavras = buildFingerprint(base, "beauty_salon");
  const outra = buildFingerprint(
    { ...base, address: "Rua B, 20", city: "Varginha" },
    "beauty_salon",
  );
  assert(
    (await identitySignature(lavras)) !== (await identitySignature(outra)),
    "Homonymous businesses in different cities cannot share cache.",
  );
});

Deno.test("different branches with different place ids never share cache", async () => {
  const a = buildFingerprint(
    {
      placeId: "branch-a",
      company: "Rede Exemplo",
      segment: "Barbearia",
      city: "Lavras",
    },
    "barbershop",
  );
  const b = buildFingerprint(
    {
      placeId: "branch-b",
      company: "Rede Exemplo",
      segment: "Barbearia",
      city: "Lavras",
    },
    "barbershop",
  );
  assert(
    (await identitySignature(a)) !== (await identitySignature(b)),
    "Place ID must separate branches.",
  );
});

Deno.test("branch-sensitive evidence needs local signals", () => {
  const fingerprint = buildFingerprint(
    {
      company: "Rede Exemplo",
      segment: "Barbearia",
      phone: "(35) 99999-1111",
      address: "Rua A, 231",
      city: "Lavras",
    },
    "barbershop",
  );
  const corporate = branchIdentityScoreFromText(
    fingerprint,
    "Rede Exemplo — conheça nossa equipe nacional.",
  );
  const local = branchIdentityScoreFromText(
    fingerprint,
    "Rede Exemplo em Lavras, Rua A 231, telefone (35) 99999-1111.",
  );
  assert(corporate < 80, "Corporate-only page cannot auto-verify local team/channel.");
  assert(local >= 80, "Strong local signals should verify the branch.");
});

Deno.test("internal crawl stays same-origin, shallow and bounded", () => {
  const home: PageSnapshot = {
    url: "https://example.com/",
    finalUrl: "https://example.com/",
    domain: "example.com",
    title: "Empresa",
    metaDescription: "",
    text: "x".repeat(600),
    html: "",
    jsonLd: [],
    links: [
      { url: "https://example.com/servicos", text: "Serviços" },
      { url: "https://example.com/equipe", text: "Equipe" },
      { url: "https://example.com/precos", text: "Preços" },
      { url: "https://example.com/agendamento", text: "Agendamento" },
      { url: "https://example.com/blog", text: "Blog" },
      { url: "https://other.example/servicos", text: "Serviços externos" },
    ],
    images: [],
    method: "http",
    checkedAt: new Date().toISOString(),
    sourceUpdatedAt: null,
  };
  const selected = selectInternalLinks(home, ["serviços","profissionais","preços"], 4);
  assert(selected.length <= 4, "Internal page budget must be capped.");
  assert(selected.every((url) => new URL(url).origin === "https://example.com"), "Crawl cannot leave official origin.");
});

Deno.test("HIGH enters verified snapshot, MEDIUM and LOW do not", async () => {
  const high = candidate("service","corte masculino","high","example.com");
  const medium = candidate("professional","joao","medium","directory.example");
  const low = candidate("price","40","low","unknown.example");
  const facts = await finalizeCandidates([high,medium,low],new Set());
  const snapshot = buildVerifiedSnapshot(facts);
  assert(snapshot.verifiedContent.services?.includes("corte masculino"), "HIGH service must enter verifiedContent.");
  assert(!(snapshot.verifiedContent.professionals?.length), "MEDIUM professional must wait for review.");
  assert(!(snapshot.verifiedContent.prices?.length), "LOW price cannot become fact.");
});

Deno.test("two independent MEDIUM sources can promote the same fact", async () => {
  const a = candidate("service","corte masculino","medium","directory-a.example","web_search");
  const b = candidate("service","corte masculino","medium","directory-b.example","web_search");
  a.identityScore = 70;
  b.identityScore = 75;
  const facts = await finalizeCandidates([a,b],new Set());
  assert(facts.every((fact) => fact.resolution === "auto_verified"), "Corroborated medium fact should be promoted.");
});

Deno.test("rejected signature stays rejected on future consolidation", async () => {
  const value = candidate("service","servico errado","high","example.com");
  const initial = await finalizeCandidates([value],new Set());
  const signature = initial[0].factSignature;
  const next = await finalizeCandidates([value],new Set([signature]));
  assert(next[0].resolution === "rejected", "Rejected fact must not reappear automatically.");
});

Deno.test("conflicting prices from equally strong sources require review", async () => {
  const a = candidate("price","corte 40","high","example.com","official_text");
  a.value = { name: "Corte", price: "40", currency: "BRL" };
  a.normalizedValue = "corte 40";
  const b = candidate("price","corte 50","high","example.com","official_text");
  b.value = { name: "Corte", price: "50", currency: "BRL" };
  b.normalizedValue = "corte 50";
  const facts = await finalizeCandidates([a,b],new Set());
  assert(
    facts.every((fact) => fact.resolution === "needs_review"),
    "Same-strength conflicting prices must not silently feed verifiedContent.",
  );
});

Deno.test("explicit before-after is required to populate beforeAfterImages", async () => {
  const normal = candidate("portfolio_image","resultado","high","example.com","official_image");
  normal.value = { imageUrl: "https://example.com/result.webp" };
  normal.normalizedValue = "https example com result webp";
  const facts = await finalizeCandidates([normal],new Set());
  const snapshot = buildVerifiedSnapshot(facts);
  assert(!(snapshot.verifiedContent.beforeAfterImages?.length), "Generic portfolio image cannot become before/after.");
});


Deno.test("verified website and Instagram update the cached identity signature", async () => {
  const initial = buildFingerprint(
    {
      placeId: "place-123",
      company: "Empresa Exemplo",
      segment: "Barbearia",
      phone: "(35) 99999-1111",
      address: "Rua A, 10",
      city: "Lavras",
    },
    "barbershop",
  );

  const finalIdentity = withVerifiedIdentityUpdates(initial, {
    website: "https://empresaexemplo.com.br/",
    instagram: "https://www.instagram.com/empresaexemplo/",
  });

  assert(
    finalIdentity.officialDomain === "empresaexemplo.com.br",
    "Verified website must become part of the final fingerprint.",
  );
  assert(
    finalIdentity.confirmedInstagram ===
      "https://www.instagram.com/empresaexemplo/",
    "Verified Instagram must become part of the final fingerprint.",
  );
  assert(
    (await identitySignature(initial)) !==
      (await identitySignature(finalIdentity)),
    "The run must persist the final signature after identity enrichment.",
  );
});
