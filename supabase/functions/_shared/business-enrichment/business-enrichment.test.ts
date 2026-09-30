import {
  buildFingerprint,
  branchIdentityScoreFromText,
  identitySignature,
  safePublicUrl,
  withVerifiedIdentityUpdates,
} from "./security.ts";
import { buildContentAvailabilityMatrix } from "../niche-strategies.ts";
import {
  buildVerifiedSnapshot,
  finalizeCandidates,
} from "./consolidate.ts";
import {
  deterministicOfficialFacts,
  isCommercialPlatformUrl,
  selectInternalLinks,
  shouldUseBrowserless,
} from "./website.ts";
import { planWebResearchQueries } from "./research.ts";
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


Deno.test("verified enrichment feeds the existing Content Availability Matrix", async () => {
  const service = candidate("service", "corte masculino", "high", "example.com");
  const portfolio = candidate(
    "portfolio_image",
    "trabalho real",
    "high",
    "example.com",
    "official_image",
  );
  portfolio.value = { imageUrl: "https://example.com/trabalho.webp" };
  portfolio.normalizedValue = "https example com trabalho webp";

  const booking = candidate(
    "channel_booking",
    "agendamento",
    "high",
    "example.com",
    "official_link",
  );
  booking.value = { url: "https://example.com/agendar" };
  booking.normalizedValue = "https example com agendar";

  const facts = await finalizeCandidates(
    [service, portfolio, booking],
    new Set(),
  );
  const snapshot = buildVerifiedSnapshot(facts);
  const matrix = buildContentAvailabilityMatrix({
    company: "Barbearia Fixture",
    segment: "Barbearia",
    verifiedContent: snapshot.verifiedContent,
    verifiedImages: snapshot.verifiedImages,
    confirmedChannels: snapshot.confirmedChannels,
  });

  assert(matrix.services.status === "verified", "Verified services must reach the existing matrix.");
  assert(matrix.portfolio.status === "verified", "Verified portfolio must reach the existing matrix.");
  assert(matrix.booking.status === "verified", "Verified booking must reach the existing matrix.");
});

Deno.test("SSRF URL gate rejects local private and credentialed targets", () => {
  const rejected = [
    "http://localhost/admin",
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "ftp://example.com/file",
    "https://user:pass@example.com/private",
  ];
  assert(
    rejected.every((url) => safePublicUrl(url) === null),
    "Private, local, credentialed and non-http(s) URLs must be rejected.",
  );
  assert(
    safePublicUrl("https://example.com/servicos") !== null,
    "Normal public HTTP(S) URL should remain eligible before DNS validation.",
  );
});


function pageFixture(input: Partial<PageSnapshot> & { url: string }): PageSnapshot {
  return {
    url:input.url,
    finalUrl:input.finalUrl ?? input.url,
    domain:new URL(input.finalUrl ?? input.url).hostname.replace(/^www\./, ""),
    title:input.title ?? "Fixture",
    metaDescription:input.metaDescription ?? "",
    text:input.text ?? "",
    html:input.html ?? "<html><body></body></html>",
    jsonLd:input.jsonLd ?? [],
    embeddedJson:input.embeddedJson ?? [],
    links:input.links ?? [],
    images:input.images ?? [],
    method:input.method ?? "http",
    checkedAt:new Date().toISOString(),
    sourceUpdatedAt:null,
    sourceKind:input.sourceKind,
    linkedFrom:input.linkedFrom ?? null,
  };
}

Deno.test("static complete commerce page does not require Browserless", () => {
  const page = pageFixture({
    url:"https://example.com/cardapio",
    text:"Cardápio da Empresa. X Burger R$ 29,90. X Bacon R$ 35,00. Pedido e retirada disponíveis.",
    html:"<html><body><main><h1>Cardápio</h1><p>X Burger R$ 29,90</p><p>X Bacon R$ 35,00</p></main></body></html>",
  });
  const facts = [
    candidate("menu_item","x burger 29 90","high","example.com"),
    candidate("menu_item","x bacon 35 00","high","example.com"),
  ];
  const decision = shouldUseBrowserless(page,["cardápio","preços","pedido"],facts);
  assert(!decision.use,"Complete static commerce content should not render again.");
});

Deno.test("SPA shell with commercial route requires Browserless", () => {
  const page = pageFixture({
    url:"https://pedido.example.com/empresa",
    text:"Faça seu pedido online.",
    html:`<html><body><div id="root"></div><script src="/assets/app.js"></script><script>fetch("/public/menu")</script><script src="/assets/vendor.js"></script><script src="/assets/ui.js"></script></body></html>`,
  });
  const decision = shouldUseBrowserless(page,["cardápio","produtos","preços"],[]);
  assert(decision.use,"SPA shell on a commercial source must trigger rendering.");
  assert(
    decision.reason === "html_insufficient" ||
    decision.reason === "spa_shell" ||
    decision.reason === "commercial_content_missing",
    "Decision must explain why rendering is needed.",
  );
});

Deno.test("React or Next marker alone does not force Browserless", () => {
  const page = pageFixture({
    url:"https://example.com/menu",
    text:"Cardápio completo X Burger R$ 29,90 X Bacon R$ 35,00 Bebidas R$ 8,00 retirada delivery pedido.",
    html:`<html><body><div id="__next"><h1>Cardápio completo</h1><article>X Burger R$ 29,90</article><article>X Bacon R$ 35,00</article></div><script id="__NEXT_DATA__" type="application/json">{"page":"menu"}</script></body></html>`,
    embeddedJson:[{page:"menu"}],
  });
  const facts = [
    candidate("menu_item","x burger 29 90","high","example.com"),
    candidate("menu_item","x bacon 35 00","high","example.com"),
  ];
  const decision = shouldUseBrowserless(page,["cardápio","preços"],facts);
  assert(!decision.use,"Framework marker with usable rendered HTML should not force Browserless.");
});

Deno.test("commercial platform URLs stay distinct from official website concept", () => {
  assert(
    isCommercialPlatformUrl("https://pedido.brendi.com.br/cassio-sandubas-esplanada"),
    "Shared ordering platform must be recognized as commercial platform.",
  );
  assert(
    !isCommercialPlatformUrl("https://empresaexemplo.com.br/sobre"),
    "Normal institutional page must not be classified as ordering platform.",
  );
});

Deno.test("linked platform facts require branch identity rather than shared domain alone", () => {
  const fingerprint = buildFingerprint(
    {
      company:"Empresa A",
      segment:"Hamburgueria",
      phone:"(35) 99999-1111",
      address:"Rua A, 10",
      city:"Lavras",
      website:"https://pedido.plataforma.example/empresa-a",
    },
    "hamburger",
  );
  const correct = pageFixture({
    url:"https://pedido.plataforma.example/empresa-a",
    sourceKind:"official_linked_platform",
    text:"Empresa A Lavras Rua A 10 telefone (35) 99999-1111",
    jsonLd:[{"@type":"Product",name:"X A"}],
  });
  const wrong = pageFixture({
    url:"https://pedido.plataforma.example/empresa-b",
    sourceKind:"official_linked_platform",
    text:"Empresa B Varginha telefone (35) 98888-2222",
    jsonLd:[{"@type":"Product",name:"X B"}],
  });
  const correctFacts = deterministicOfficialFacts([correct],fingerprint);
  const wrongFacts = deterministicOfficialFacts([wrong],fingerprint);
  assert(
    correctFacts.some((fact)=>fact.confidence==="high"),
    "Matching branch signals should allow strong platform evidence.",
  );
  assert(
    wrongFacts.every((fact)=>fact.confidence!=="high"),
    "Shared platform domain alone cannot make the wrong branch HIGH.",
  );
});

Deno.test("public embedded menu JSON can produce deterministic menu items", () => {
  const fingerprint = buildFingerprint(
    {
      company:"Empresa Menu",
      segment:"Hamburgueria",
      city:"Lavras",
      website:"https://empresa.example/menu",
    },
    "hamburger",
  );
  const page = pageFixture({
    url:"https://empresa.example/menu",
    text:"Empresa Menu Lavras Cardápio",
    sourceKind:"official_website",
    embeddedJson:[
      { products:[
        { name:"X Tudo", price:"29,90", description:"Pão, carne e queijo" },
        { name:"X Bacon", price:"34,00", description:"Pão, carne e bacon" },
      ] },
    ],
  });
  const facts = deterministicOfficialFacts([page],fingerprint);
  assert(
    facts.filter((fact)=>fact.type==="menu_item").length >= 2,
    "Public hydration JSON should feed the same deterministic fact pipeline.",
  );
});

Deno.test("query planner uses 0 1 2 or 3 bounded searches by distinct gaps", () => {
  const fingerprint = buildFingerprint(
    {
      company:"Cassio Sandubas",
      segment:"Hamburgueria",
      city:"Lavras",
    },
    "hamburger",
  );
  assert(planWebResearchQueries(fingerprint,[]).length === 0,"No gaps means zero searches.");
  assert(
    planWebResearchQueries(fingerprint,["Instagram oficial"]).length === 1,
    "One distinct social gap should need one query.",
  );
  assert(
    planWebResearchQueries(fingerprint,["cardápio","delivery pedido"]).length === 2,
    "Menu and order gaps should produce two non-redundant queries.",
  );
  assert(
    planWebResearchQueries(
      fingerprint,
      ["cardápio","delivery pedido","Instagram oficial","profissionais equipe"],
    ).length === 3,
    "Planner must cap distinct useful queries at three.",
  );
});

Deno.test("commercial source with dynamic signals and no facts is inconclusive before render", () => {
  const page = pageFixture({
    url:"https://pedido.example.com/empresa",
    text:"Pedido online carregando...",
    html:`<html><body><div id="app"><div class="skeleton">Carregando</div></div><script src="/bundle.js"></script><script>fetch("/menu")</script><script src="/vendor.js"></script><script src="/runtime.js"></script></body></html>`,
  });
  const decision = shouldUseBrowserless(
    page,
    ["produtos","cardápio","preços","delivery"],
    [],
  );
  assert(decision.use,"Inconclusive commercial extraction must request the bounded renderer fallback.");
});
