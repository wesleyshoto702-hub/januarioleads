/// <reference lib="deno.ns" />
import { summarizeSavedProspecting, summarizeLoadedProspecting } from "./prospecting-progress.ts";
import type { ExistingLeadIdentity } from "./identity.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const saved: ExistingLeadIdentity[] = [
  { id: "l1", company: "Barbearia Um", segment: "Barbearia", city: "São Luís", state: "MA",
    phone: "98999999999", status: "waiting" },
  { id: "l2", company: "Barbearia Dois", segment: "barbearia", city: "Sao Luis", state: "MA",
    phone: "", status: "waiting" },
  { id: "l3", company: "Barbearia Três", segment: "Barbearia", city: "São Luís", state: "MA",
    phone: "", status: "send_message" },
  { id: "l4", company: "Outro estado", segment: "Barbearia", city: "São Luís", state: "PI",
    phone: "", status: "waiting" },
  { id: "l5", company: "Outro nicho", segment: "Pizzaria", city: "São Luís", state: "MA",
    phone: "", status: "waiting" },
];
const confirmed = new Set(["l1", "l4"]);

Deno.test("historical progress matches city, UF and niche with accent normalization", () => {
  const result = summarizeSavedProspecting(saved, {
    city: "Sao Luis", state: "ma", segment: "Barbearia",
  }, confirmed);
  assert(result.total === 3 && result.saved === 3, "Only same city, UF and niche");
  assert(result.confirmed === 1, "Only explicit confirmations count");
  assert(result.legacy === 1, "Waiting without confirmation stays separate");
  assert(result.confirmedPercent === 33.3, "Confirmed percentage has one decimal");
});

Deno.test("another city and UF never share CRM progress", () => {
  const result = summarizeSavedProspecting(saved, {
    city: "São Luís", state: "PI", segment: "Barbearia",
  }, confirmed);
  assert(result.saved === 1 && result.confirmed === 1, "Other state must be independent");
  const other = summarizeSavedProspecting(saved, {
    city: "Lavras", state: "MG", segment: "Barbearia",
  }, confirmed);
  assert(other.saved === 0 && other.confirmedPercent === 0, "Empty match should have zero, not NaN");
});

Deno.test("loaded results use only actual results as percentage denominator", () => {
  const a = saved[0]!;
  const b = saved[1]!;
  const result = summarizeLoadedProspecting([
    { business: {placeId:"place1",name:"A",address:"Rua 1"},existingLead:a },
    { business: {placeId:"place2",name:"B",address:"Rua 2"},existingLead:b },
    { business: {placeId:"place3",name:"C",address:"Rua 3"},existingLead:null },
    { business: {placeId:"place4",name:"D",address:"Rua 4"},existingLead:null },
  ], confirmed);
  assert(result.total === 4 && result.saved === 2, "Only loaded businesses count");
  assert(result.confirmed === 1 && result.confirmedPercent === 25, "One of four confirmed");
  assert(result.savedPercent === 50, "Two of four saved");
  assert(result.legacy === 1, "Other waiting lead is only a legacy signal");
});

Deno.test("pagination or duplicate listings never double-count a company", () => {
  const result = summarizeLoadedProspecting([
    { business: {placeId:"same",name:"A",address:"Rua 1"},existingLead:saved[0]! },
    { business: {placeId:"same",name:"A",address:"Rua 1"},existingLead:saved[0]! },
  ], confirmed);
  assert(result.total === 1 && result.confirmed === 1 && result.confirmedPercent === 100,
    "Repeat listing must not inflate metrics");
});

Deno.test("same lead with multiple WhatsApp confirmations counts only once", () => {
  const confirmedTwice = new Set(["l1", "l1"]);
  const result = summarizeSavedProspecting(saved, {
    city:"São Luís",state:"MA",segment:"Barbearia",
  }, confirmedTwice);
  assert(result.confirmed === 1, "Set of lead IDs prevents follow-up double-counting");
  assert(result.legacy === 1, "Past contact is not mislabelled as confirmed");
});

Deno.test("nothing is written into saved leads by progress computation", () => {
  const snapshot = JSON.stringify(saved);
  summarizeSavedProspecting(saved, {
    city:"São Luís",state:"MA",segment:"Barbearia",
  }, confirmed);
  summarizeLoadedProspecting([], confirmed);
  assert(JSON.stringify(saved) === snapshot, "Progress must remain read-only");
});
