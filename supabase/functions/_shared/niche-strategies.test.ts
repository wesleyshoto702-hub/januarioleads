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


Deno.test("irrelevant structured fields do not inflate niche depth", () => {
  const hamburger = buildNichePlanningContext(
    {
      company: "Burger Minimal",
      segment: "Hamburgueria",
      address: "Rua A, 1",
      phone: "(35) 3333-3333",
      rating: 4.7,
      reviewCount: 30,
      openingHours: ["18:00–23:00"],
      googleMapsUrl: "https://maps.google.com/example",
      verifiedContent: {
        professionals: ["Campo irrelevante para a estratégia de hamburgueria"],
        credentials: ["Outro campo irrelevante"],
        courses: ["Campo de outra família"],
        eventTypes: ["Campo de outra família"],
      },
    },
    "IA decidir",
  );

  assert(
    hamburger.pagePlan.depth === "ESSENTIAL",
    "Irrelevant fields must not turn a sparse hamburger into STANDARD/RICH",
  );
});

Deno.test("real dentist snapshot uses health architecture without inventing treatments", () => {
  const ctx = buildNichePlanningContext(
    {
      company: "Odonto Excellence Lavras",
      segment: "Dentista",
      primaryCategory: "Dentista",
      categories: ["dentist", "health", "point_of_interest", "establishment"],
      description:
        "Estabelecimento em Lavras - Minas Gerais, classificado no Google como Dentista.",
      address: "R. Misseno de Pádua, 475 - Centro, Lavras - MG, 37200-142",
      city: "Lavras",
      state: "Minas Gerais",
      phone: "(35) 99907-7380",
      rating: 4.5,
      reviewCount: 18,
      openingHours: [
        "segunda-feira: 08:00–20:00",
        "terça-feira: 08:00–20:00",
        "quarta-feira: 08:00–20:00",
        "quinta-feira: 08:00–20:00",
        "sexta-feira: 08:00–20:00",
        "sábado: 08:00–12:00",
        "domingo: Fechado",
      ],
      googleMapsUrl: "https://maps.google.com/example",
    },
    "IA decidir",
  );

  assert(ctx.resolvedStrategy.nicheKey === "dentist", "Real dentist must resolve dentist");
  const included = new Set(ctx.pagePlan.sections.map((item) => item.type));
  assert(!included.has("treatments"), "No treatments without verified treatment data");
  assert(!included.has("credentials"), "No credentials without verified credential data");
  assert(!included.has("professional"), "No professional section without verified professional data");
  assert(included.has("reviews"), "Verified Google rating/review count should support reviews");
  assert(included.has("location_hours"), "Location/hours should be used when available");
});

Deno.test("real salon snapshot does not invent services or portfolio", () => {
  const ctx = buildNichePlanningContext(
    {
      company: "Mega Hair Lavras Aline Gisele Hair",
      segment: "Salão de Beleza",
      primaryCategory: "Salão de Beleza",
      categories: ["beauty_salon", "hair_salon", "hair_care", "service"],
      description:
        "Estabelecimento em Lavras - Minas Gerais, classificado no Google como Salão de Beleza.",
      address: "R. Chagas Dória, 208 - Centro, Lavras - MG, 37200-042",
      city: "Lavras",
      state: "Minas Gerais",
      phone: "(35) 98802-1053",
      rating: 5,
      reviewCount: 76,
      openingHours: ["terça-feira: 09:00–18:00", "sábado: 09:00–18:00"],
      website: "https://linklist.bio/AlineGiseleHair",
      instagram: "https://www.instagram.com/alinegiselehair/",
      googleMapsUrl: "https://maps.google.com/example",
    },
    "Conseguir agendamentos",
  );

  assert(ctx.resolvedStrategy.nicheKey === "beauty_salon", "Salon must resolve beauty_salon");
  const included = new Set(ctx.pagePlan.sections.map((item) => item.type));
  assert(!included.has("services"), "No service section without verified services");
  assert(!included.has("portfolio"), "No portfolio section without verified portfolio images");
  assert(
    ctx.primaryAction.kind === "phone",
    "Phone should beat Instagram for appointment objective when booking/WhatsApp are unconfirmed",
  );
});

Deno.test("rich tattoo prioritizes portfolio and quote flow", () => {
  const ctx = buildNichePlanningContext(
    {
      company: "Tattoo Fixture",
      segment: "Estúdio de Tatuagem",
      phone: "(35) 99999-0000",
      instagram: "https://instagram.com/tattoo-fixture",
      confirmedChannels: {
        whatsappUrl: "https://wa.me/5535999990000",
      },
      verifiedImages: [
        { url: "https://example.com/tattoo-general.webp" },
      ],
      verifiedContent: {
        professionals: ["Artista confirmado"],
        specialties: ["Fine line"],
        portfolioImages: [
          { url: "https://example.com/tattoo-1.webp" },
          { url: "https://example.com/tattoo-2.webp" },
        ],
        process: ["Briefing", "Orçamento"],
      },
    },
    "Solicitar orçamento",
  );

  assert(ctx.resolvedStrategy.nicheKey === "tattoo", "Tattoo fixture must resolve tattoo");
  const sections = ctx.pagePlan.sections.map((item) => item.type);
  assert(sections.includes("portfolio"), "Tattoo portfolio must enter when verified");
  assert(sections.includes("specialties"), "Verified tattoo specialties should enter");
  assert(sections.includes("quote"), "Quote section should enter with confirmed WhatsApp");
  assert(ctx.primaryAction.kind === "whatsapp", "Quote should use confirmed WhatsApp");
});

Deno.test("mechanic fixture prioritizes services vehicles structure and quote", () => {
  const ctx = buildNichePlanningContext(
    {
      company: "Oficina Fixture",
      segment: "Mecânica Automotiva",
      address: "Rua Oficina, 10",
      phone: "(35) 99999-1111",
      rating: 4.8,
      reviewCount: 84,
      openingHours: ["segunda a sexta: 08:00–18:00"],
      googleMapsUrl: "https://maps.google.com/example",
      confirmedChannels: {
        whatsappUrl: "https://wa.me/5535999991111",
      },
      verifiedImages: [{ url: "https://example.com/oficina.webp" }],
      verifiedContent: {
        services: ["Troca de óleo", "Alinhamento"],
        vehicleTypes: ["Carros de passeio"],
        facilities: ["Oficina equipada"],
      },
    },
    "Solicitar orçamento",
  );

  assert(ctx.resolvedStrategy.nicheKey === "mechanic", "Mechanic fixture must resolve mechanic");
  const sections = new Set(ctx.pagePlan.sections.map((item) => item.type));
  assert(sections.has("services"), "Mechanic services must enter");
  assert(sections.has("vehicles"), "Verified vehicle types must enter");
  assert(sections.has("facilities"), "Verified workshop structure must enter");
  assert(sections.has("quote"), "Quote section must enter");
  assert(ctx.primaryAction.kind === "whatsapp", "Confirmed WhatsApp should serve quote goal");
});

Deno.test("rich salon produces service portfolio professional and appointment plan", () => {
  const ctx = buildNichePlanningContext(
    {
      company: "Salon Fixture",
      segment: "Salão de Beleza",
      address: "Rua Beleza, 10",
      phone: "(35) 99999-2222",
      rating: 4.9,
      reviewCount: 120,
      openingHours: ["terça a sábado: 09:00–18:00"],
      instagram: "https://instagram.com/salon-fixture",
      confirmedChannels: {
        whatsappUrl: "https://wa.me/5535999992222",
      },
      verifiedImages: [{ url: "https://example.com/salon.webp" }],
      verifiedContent: {
        services: ["Corte", "Escova"],
        professionals: ["Profissional confirmado"],
        portfolioImages: [
          { url: "https://example.com/hair-1.webp" },
          { url: "https://example.com/hair-2.webp" },
        ],
      },
    },
    "Conseguir agendamentos",
  );

  const sections = new Set(ctx.pagePlan.sections.map((item) => item.type));
  assert(sections.has("services"), "Salon services should enter");
  assert(sections.has("portfolio"), "Salon portfolio should enter");
  assert(sections.has("professional"), "Salon professional should enter");
  assert(sections.has("appointment"), "Salon appointment section should enter with WhatsApp");
  assert(ctx.primaryAction.kind === "whatsapp", "Salon should use confirmed WhatsApp");
});

Deno.test("missing-content safety holds across every strategy family", () => {
  const representatives = [
    ["Hamburgueria", "food"],
    ["Salão de Beleza", "beauty"],
    ["Dentista", "health"],
    ["Eletricista", "home_services"],
    ["Mecânica Automotiva", "automotive"],
    ["Academia", "fitness"],
    ["Escola de Idiomas", "education"],
    ["Casa de Festas", "events"],
    ["Contabilidade", "professional_services"],
    ["Loja de Roupas", "retail"],
    ["Pet Shop", "pets"],
    ["Transportadora", "logistics"],
    ["Estúdio de Tatuagem", "creative"],
  ] as const;

  for (const [segment, expectedFamily] of representatives) {
    const ctx = buildNichePlanningContext(
      {
        company: "Empresa mínima",
        segment,
        phone: "(35) 3333-3333",
      },
      "IA decidir",
    );

    assert(ctx.resolvedStrategy.family === expectedFamily, `${segment} family mismatch`);
    assert(ctx.pagePlan.depth === "ESSENTIAL", `${segment} minimal data must be ESSENTIAL`);
    assert(
      ctx.pagePlan.sections.every((section) =>
        section.evidence.every((key) =>
          ["identity", "phone"].includes(key),
        ),
      ),
      `${segment} must not fabricate evidence when commercial content is missing`,
    );
  }
});

Deno.test("CTA matrix follows niche goal plus confirmed channel", () => {
  const hamburger = buildNichePlanningContext(
    {
      company: "Burger",
      segment: "Hamburgueria",
      confirmedChannels: { deliveryUrl: "https://example.com/order" },
    },
    "Conseguir pedidos",
  );
  assert(hamburger.primaryAction.kind === "delivery", "Hamburger order must use confirmed delivery");

  const dentist = buildNichePlanningContext(
    {
      company: "Dentista",
      segment: "Dentista",
      confirmedChannels: { bookingUrl: "https://example.com/book" },
    },
    "Conseguir agendamentos",
  );
  assert(dentist.primaryAction.kind === "booking", "Dentist appointment must use confirmed booking");

  const mechanic = buildNichePlanningContext(
    {
      company: "Oficina",
      segment: "Mecânica Automotiva",
      phone: "(35) 99999-3333",
      confirmedChannels: { whatsappUrl: "https://wa.me/5535999993333" },
    },
    "Solicitar orçamento",
  );
  assert(mechanic.primaryAction.kind === "whatsapp", "Mechanic quote must prefer confirmed WhatsApp");

  const visit = buildNichePlanningContext(
    {
      company: "Loja",
      segment: "Loja de Roupas",
      phone: "(35) 99999-4444",
      googleMapsUrl: "https://maps.google.com/example",
    },
    "Levar pessoas ao estabelecimento",
  );
  assert(visit.primaryAction.kind === "maps", "Visit objective must prefer confirmed Maps");

  const phoneOnly = buildNichePlanningContext(
    {
      company: "Profissional",
      segment: "Contabilidade",
      phone: "(35) 3333-3333",
    },
    "Receber contatos",
  );
  assert(phoneOnly.primaryAction.kind === "phone", "Phone-only business must use phone");
});
