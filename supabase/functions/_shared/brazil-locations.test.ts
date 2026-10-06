import {
  BRAZIL_STATES as EDGE_STATES,
  findBrazilianState as findEdgeState,
  normalizeBrazilianStateCode as normalizeEdgeState,
} from "./brazil-locations.ts";
import {
  BRAZIL_STATES as FRONTEND_STATES,
  findBrazilianState as findFrontendState,
  normalizeBrazilianStateCode as normalizeFrontendState,
} from "../../../src/lib/brazil-locations.ts";
import { makeLocationKey } from "../../../src/lib/location.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("frontend and edge expose the same 27 Brazilian states", () => {
  assert(EDGE_STATES.length === 27, "Edge state catalog must contain 27 UFs.");
  assert(FRONTEND_STATES.length === 27, "Frontend state catalog must contain 27 UFs.");
  assert(
    JSON.stringify(EDGE_STATES) === JSON.stringify(FRONTEND_STATES),
    "Frontend and Edge state catalogs must stay identical.",
  );
});

Deno.test("state normalization accepts UF and full state names", () => {
  for (const normalize of [normalizeEdgeState, normalizeFrontendState]) {
    assert(normalize("SP") === "SP", "SP should remain SP.");
    assert(normalize("São Paulo") === "SP", "São Paulo should normalize to SP.");
    assert(normalize("sao paulo") === "SP", "sao paulo should normalize to SP.");
    assert(normalize("Minas Gerais") === "MG", "Minas Gerais should normalize to MG.");
    assert(normalize("Bahia") === "BA", "Bahia should normalize to BA.");
    assert(normalize("Distrito Federal") === "DF", "Distrito Federal should normalize to DF.");
    assert(normalize("XX") === "", "Unknown UF must be rejected.");
  }
});

Deno.test("IBGE codes used for municipality loading are correct", () => {
  assert(findFrontendState("SP")?.ibgeCode === "35", "SP must use IBGE 35.");
  assert(findFrontendState("MG")?.ibgeCode === "31", "MG must use IBGE 31.");
  assert(findFrontendState("BA")?.ibgeCode === "29", "BA must use IBGE 29.");
  assert(findFrontendState("DF")?.ibgeCode === "53", "DF must use IBGE 53.");
  assert(findEdgeState("PR")?.name === "Paraná", "PR full name must be Paraná.");
});

Deno.test("cache keys separate city, state and segment contexts", () => {
  const sp = `${makeLocationKey("Campinas", "SP")}|barbearia`;
  const mg = `${makeLocationKey("Campinas", "MG")}|barbearia`;
  const bh = `${makeLocationKey("Belo Horizonte", "MG")}|barbearia`;

  assert(sp === "campinas|SP|barbearia", "Campinas/SP key is incorrect.");
  assert(mg === "campinas|MG|barbearia", "Campinas/MG key is incorrect.");
  assert(
    new Set([sp, mg]).size === 2,
    "Same city name in different states must not collide.",
  );
  assert(
    new Set([bh, sp]).size === 2,
    "Different cities must not collide.",
  );
});

Deno.test("state names support the expected Google Places query shape", () => {
  const sp = findEdgeState("SP");
  const ba = findEdgeState("BA");
  const pr = findEdgeState("PR");

  assert(
    `Barbearia em Campinas, ${sp?.name}, Brasil` ===
      "Barbearia em Campinas, São Paulo, Brasil",
    "SP query shape is incorrect.",
  );
  assert(
    `Odontologia em Salvador, ${ba?.name}, Brasil` ===
      "Odontologia em Salvador, Bahia, Brasil",
    "BA query shape is incorrect.",
  );
  assert(
    `Clínica de estética em Curitiba, ${pr?.name}, Brasil` ===
      "Clínica de estética em Curitiba, Paraná, Brasil",
    "PR query shape is incorrect.",
  );

  const rj = findEdgeState("RJ");
  const mg = findEdgeState("MG");
  assert(
    `Odontologia em Niterói, ${rj?.name}, Brasil` ===
      "Odontologia em Niterói, Rio de Janeiro, Brasil",
    "RJ query shape is incorrect.",
  );
  assert(
    `Barbearia em Lavras, ${mg?.name}, Brasil` ===
      "Barbearia em Lavras, Minas Gerais, Brasil",
    "MG compatibility query shape is incorrect.",
  );
  assert(
    `Restaurante em Salvador, ${ba?.name}, Brasil` ===
      "Restaurante em Salvador, Bahia, Brasil",
    "BA restaurant query shape is incorrect.",
  );
});
