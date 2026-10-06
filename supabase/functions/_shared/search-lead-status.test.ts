import { STATUS_LABEL } from "../../../src/features/leads/lead-status.ts";
import {
  findBusinessDuplicate,
  type ExistingLeadIdentity,
} from "../../../src/features/search-leads/identity.ts";
import type { BusinessSearchResult } from "../../../src/features/search-leads/types.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function business(patch: Partial<BusinessSearchResult> = {}): BusinessSearchResult {
  return {
    placeId: "place-1",
    name: "Psicóloga Paula Barbosa Pereira",
    primaryCategory: null,
    categories: [],
    description: null,
    address: "Rua A, 10, Lavras - MG",
    neighborhood: null,
    city: "Lavras",
    state: "MG",
    phone: "(35) 99999-9999",
    internationalPhone: null,
    rating: 4.8,
    reviewCount: 42,
    isOpenNow: null,
    openingHours: [],
    website: null,
    instagram: null,
    googleMapsUrl: null,
    businessStatus: "OPERATIONAL",
    latitude: null,
    longitude: null,
    ...patch,
  };
}

function lead(
  status: ExistingLeadIdentity["status"],
  patch: Partial<ExistingLeadIdentity> = {},
): ExistingLeadIdentity {
  return {
    id: "lead-1",
    company: "Psicóloga Paula Barbosa Pereira",
    phone: "5535999999999",
    placeId: "place-1",
    address: "Rua A, 10, Lavras - MG",
    status,
    ...patch,
  };
}

Deno.test("search duplicate keeps the current commercial status from existing leads", () => {
  const existing = lead("waiting");
  const duplicate = findBusinessDuplicate(business(), [existing]);

  assert(duplicate?.id === existing.id, "Expected the existing lead to be matched.");
  assert(duplicate?.status === "waiting", "Expected the live waiting status.");
  assert(STATUS_LABEL[duplicate.status] === "Aguardando", "Expected Aguardando label.");
});

Deno.test("placeId match wins even when the business appears in another related search", () => {
  const existing = lead("accepted", {
    company: "Paula Psicologia",
    phone: "5535888888888",
    address: "Outro endereço",
  });
  const duplicate = findBusinessDuplicate(business(), [existing]);

  assert(duplicate?.status === "accepted", "Expected accepted status from the same placeId.");
});

Deno.test("normalized phone can identify the existing lead and expose rejected status", () => {
  const existing = lead("rejected", {
    placeId: undefined,
    phone: "35 99999-9999",
  });
  const duplicate = findBusinessDuplicate(
    business({ placeId: "different-place" }),
    [existing],
  );

  assert(duplicate?.status === "rejected", "Expected phone match to keep rejected status.");
});

Deno.test("business without a matching lead remains new", () => {
  const duplicate = findBusinessDuplicate(
    business({
      placeId: "brand-new",
      name: "Clínica Nova",
      phone: "5535777777777",
      address: "Avenida B, 200, Lavras - MG",
    }),
    [lead("send_message")],
  );

  assert(duplicate === null, "Expected unmatched business to remain new.");
});

Deno.test("shared lead labels cover the four existing CRM statuses", () => {
  assert(STATUS_LABEL.send_message === "Enviar mensagem", "Missing send_message label.");
  assert(STATUS_LABEL.waiting === "Aguardando", "Missing waiting label.");
  assert(STATUS_LABEL.accepted === "Aceito", "Missing accepted label.");
  assert(STATUS_LABEL.rejected === "Recusado", "Missing rejected label.");
});
