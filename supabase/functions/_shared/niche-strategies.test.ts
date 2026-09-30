import {
  buildContentAvailabilityMatrix,
  buildLandingPagePlan,
  buildNichePlanningContext,
  getNicheCoverageReport,
  resolveNicheStrategy,
  resolvePrimaryAction,
} from "./niche-strategies.ts";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("all current Search Leads niches are covered", () => {
  const report = getNicheCoverageReport();
  assert(report.total === 108, `Expected 108 niches, got ${report.total}`);
  assert(report.covered === 108, `Expected full coverage, got ${report.covered}`);
  assert(report.coveragePercent === 100, "Coverage must be 100%");
});

Deno.test("Beefs-like sparse hamburger stays ESSENTIAL and omits unsupported commerce", () => {
  const business = {
    company: "Beefs Burger",
    segment: "Hamburgueria",
    address: "Centro, Lavras - MG",
    phone: "(35) 4104-1009",
    rating: 4.4,
    reviewCount: 871,
    openingHours: ["Todos os dias · 18h30–0h"],
    googleMapsUrl: "https://maps.google.com/example",
  };
  const ctx = buildNichePlanningContext(
    business,
    "Levar pessoas ao estabelecimento",
  );
  assert(ctx.resolvedStrategy.nicheKey === "hamburger", "Must resolve hamburger");
  assert(ctx.pagePlan.depth === "ESSENTIAL", "Sparse hamburger must be ESSENTIAL");
  assert(ctx.primaryAction.kind === "maps", "Visit objective must prefer Maps");
  const included = new Set(ctx.pagePlan.sections.map((item) => item.type));
  assert(!included.has("menu"), "Menu cannot exist without menu evidence");
  assert(!included.has("products"), "Products cannot exist without product evidence");
  assert(!included.has("gallery"), "Gallery cannot exist without verified images");
  assert(!included.has("order"), "Order section cannot exist without confirmed order channel");
});

Deno.test("rich hamburger becomes deeper and commerce-oriented", () => {
  const business = {
    company: "Fixture Burger",
    segment: "Hamburgueria",
    address: "Rua de teste",
    phone: "(35) 99999-9999",
    rating: 4.8,
    reviewCount: 420,
    openingHours: ["18:00–23:30"],
    googleMapsUrl: "https://maps.google.com/example",
    instagram: "https://instagram.com/fixture",
    verifiedImages: [{ url: "https://example.com/burger.webp" }],
    confirmedChannels: {
      whatsappUrl: "https://wa.me/5535999999999",
      deliveryUrl: "https://example.com/pedir",
      menuUrl: "https://example.com/menu",
    },
    verifiedContent: {
      products: ["Burger A", "Burger B"],
      menuItems: ["Burger A", "Burger B"],
      prices: ["Burger A — R$ 30"],
    },
  };
  const ctx = buildNichePlanningContext(business, "Conseguir pedidos");
  assert(ctx.pagePlan.depth === "RICH", "Rich fixture must be RICH");
  assert(ctx.primaryAction.kind === "delivery", "Confirmed delivery must win for order goal");
  const included = new Set(ctx.pagePlan.sections.map((item) => item.type));
  assert(included.has("products"), "Products should enter");
  assert(included.has("menu"), "Menu should enter");
  assert(included.has("gallery"), "Gallery should enter with verified image");
  assert(included.has("order"), "Order should enter with delivery/WhatsApp");
});

Deno.test("different niches with similar data produce different plans", () => {
  const common = {
    company: "Fixture",
    address: "Rua A, 10",
    phone: "(35) 99999-9999",
    rating: 4.9,
    reviewCount: 100,
    openingHours: ["08:00–18:00"],
    verifiedImages: [{ url: "https://example.com/a.webp" }],
    verifiedContent: {
      services: ["Serviço confirmado"],
      professionals: ["Profissional confirmado"],
      portfolioImages: [{ url: "https://example.com/portfolio.webp" }],
      facilities: ["Estrutura confirmada"],
    },
  };
  const dentist = buildNichePlanningContext({ ...common, segment: "Dentista", verifiedContent: { ...common.verifiedContent, treatments: ["Tratamento confirmado"], credentials: ["Credencial confirmada"] } }, "IA decidir");
  const burger = buildNichePlanningContext({ ...common, segment: "Hamburgueria", verifiedContent: { ...common.verifiedContent, products: ["Produto confirmado"] } }, "IA decidir");
  const tattoo = buildNichePlanningContext({ ...common, segment: "Estúdio de Tatuagem", verifiedContent: { ...common.verifiedContent, specialties: ["Estilo confirmado"] } }, "IA decidir");
  const a = dentist.pagePlan.sections.map((item) => item.type).join("|");
  const b = burger.pagePlan.sections.map((item) => item.type).join("|");
  const c = tattoo.pagePlan.sections.map((item) => item.type).join("|");
  assert(a !== b && b !== c && a !== c, "Niche plans must differ structurally");
});

Deno.test("CTA resolver never invents WhatsApp", () => {
  const business = {
    company: "Clínica Teste",
    segment: "Dentista",
    phone: "(35) 3333-3333",
    googleMapsUrl: "https://maps.google.com/example",
  };
  const strategy = resolveNicheStrategy(business);
  const matrix = buildContentAvailabilityMatrix(business);
  assert(matrix.whatsapp.status === "unverified", "Phone alone cannot verify WhatsApp");
  const action = resolvePrimaryAction(business, strategy, "Conseguir agendamentos");
  assert(action.kind === "phone", "Phone must be the fallback when booking/WhatsApp are absent");
});

Deno.test("generic fallback never blocks unknown categories", () => {
  const ctx = buildNichePlanningContext(
    { company: "Empresa X", segment: "Categoria totalmente nova", phone: "(35) 3333-3333" },
    "IA decidir",
  );
  assert(ctx.resolvedStrategy.nicheKey === "generic_local_business", "Unknown niche must fallback");
  assert(ctx.resolvedStrategy.fallback === true, "Fallback must be registered");
});
