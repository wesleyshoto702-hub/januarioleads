/// <reference lib="deno.ns" />
import { buildProspectingHierarchy } from "./prospecting-regions.ts";
import type { ExistingLeadIdentity } from "./identity.ts";

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
const leads: ExistingLeadIdentity[] = [
  {id:"a",company:"Barbearia 1",phone:"",segment:"Barbearia",state:"MG",city:"Lavras",
   neighborhood:"Centro",status:"waiting"},
  {id:"b",company:"Barbearia 2",phone:"",segment:"Barbearia",state:"MG",city:"Lavras",
   neighborhood:"Vila Rica",status:"accepted"},
  {id:"c",company:"Barbearia 3",phone:"",segment:"Barbearia",state:"MG",city:"Lavras",
   neighborhood:"Centro",status:"rejected"},
  {id:"d",company:"Barbearia 4",phone:"",segment:"Barbearia",state:"MG",city:"Varginha",
   neighborhood:"Centro",status:"send_message"},
  {id:"e",company:"Pizzaria",phone:"",segment:"Pizzaria",state:"SP",city:"São Paulo",
   neighborhood:"Jardins",status:"waiting"},
];
const touches = new Set(["a","b","c","e"]);

Deno.test("states are collapsed by UI and grouped with accurate per-user metrics", () => {
  const tree = buildProspectingHierarchy(leads,touches);
  assert(tree.metrics.total===5,"Total must be current CRM count");
  assert(tree.states.length===2,"Expected MG and SP only");
  const mg=tree.states.find(s=>s.key==="MG")!;
  assert(mg.metrics.total===4 && mg.metrics.touched===3,"MG must count three clicks among four");
  assert(mg.metrics.touchedPercent===75,"MG bar must be 75%");
  assert(mg.metrics.waiting===1 && mg.metrics.accepted===1 && mg.metrics.rejected===1,
    "MG status counts must be exact");
});

Deno.test("cities and neighborhoods are independent within the same state", () => {
  const mg=buildProspectingHierarchy(leads,touches,undefined,"neighborhood").states.find(s=>s.key==="MG")!;
  const lavras=mg.children.find(c=>c.name==="Lavras")!;
  assert(lavras.metrics.total===3 && lavras.metrics.touched===3,"Lavras rows");
  assert(lavras.children.length===2,"Neighborhood grouping");
  assert(lavras.children.find(n=>n.name==="Centro")?.metrics.total===2,
    "Centro contains two barbershops");
  assert(mg.children.find(c=>c.name==="Varginha")?.metrics.total===1,
    "Other city must be separate");
});

Deno.test("status change immediately updates waiting accepted rejected percentages", () => {
  const next=leads.map(x=>x.id==="a"?{...x,status:"accepted" as const}:x);
  const before=buildProspectingHierarchy(leads,touches).metrics;
  const after=buildProspectingHierarchy(next,touches).metrics;
  assert(before.waiting===2 && after.waiting===1,"Waiting must decrease");
  assert(before.accepted===1 && after.accepted===2,"Accepted must increase");
  assert(after.acceptedPercent===40 && after.waitingPercent===20,"Status percentages update");
});

Deno.test("adding a new untouched lead changes the denominator", () => {
  const more=[...leads,{...leads[0]!,id:"new",status:"send_message" as const}];
  const prior=buildProspectingHierarchy(leads,touches).metrics;
  const next=buildProspectingHierarchy(more,touches).metrics;
  assert(next.total===prior.total+1 && next.touched===prior.touched,"Added lead no click");
  assert(next.touchedPercent<prior.touchedPercent,"Rate falls when untouched lead is added");
});

Deno.test("deleting a contacted lead drops both lead and click from the aggregate", () => {
  const remaining=leads.filter(x=>x.id!=="a");
  const prior=buildProspectingHierarchy(leads,touches).metrics;
  const next=buildProspectingHierarchy(remaining,touches).metrics;
  assert(next.total===4 && next.touched===3,"Deleted contacted lead removed immediately");
  assert(next.touchedPercent<prior.touchedPercent,"Removing contacted lead lowers rate in this fixture");
});

Deno.test("deleting an untouched lead can legitimately raise the percentage", () => {
  const remaining=leads.filter(x=>x.id!=="d");
  const next=buildProspectingHierarchy(remaining,touches).metrics;
  assert(next.total===4 && next.touched===4 && next.touchedPercent===100,
    "Never force percentages down when denominator shrinks faster than numerator");
});

Deno.test("one lead is not double-counted when WhatsApp is clicked more than once", () => {
  const repeated=[...leads,{...leads[0]!}];
  const next=buildProspectingHierarchy(repeated,new Set(["a","a","e"])).metrics;
  assert(next.total===leads.length,"Repeat lead ID excluded");
  assert(next.touched===2,"Contact IDs de-duplicated");
});

Deno.test("selected niche filters nationally; all niches restores all states", () => {
  const niche=buildProspectingHierarchy(leads,touches,"Barbearia");
  const all=buildProspectingHierarchy(leads,touches);
  assert(niche.metrics.total===4 && niche.states.length===1 && niche.states[0]?.key==="MG",
    "Barbearia should not include SP pizzaria");
  assert(all.states.length===2,"All niches should include both states");
});

Deno.test("empty lead data is valid and safe for missing localization", () => {
  const empty=buildProspectingHierarchy([],new Set());
  assert(empty.metrics.total===0 && empty.metrics.touchedPercent===0 && empty.states.length===0,
    "Empty CRM shouldn't produce NaN or fake data");
  const unknown=buildProspectingHierarchy([
    {id:"x",company:"Sem endereço",phone:"",segment:"Barbearia",
    city:"",state:"",neighborhood:"",status:"send_message"}
  ],new Set());
  assert(unknown.states[0]?.name==="UF não informada", "Do not lose missing-location leads");
});


Deno.test("Nichos is the default third level in every city", () => {
  const mg=buildProspectingHierarchy(leads,touches).states.find(s=>s.key==="MG")!;
  const lavras=mg.children.find(c=>c.name==="Lavras")!;
  assert(lavras.children.length===1, "Lavras contains one niche across different neighborhoods");
  const barbearia=lavras.children[0]!;
  assert(barbearia.name==="Barbearia", "Default label should be the segment name");
  assert(barbearia.metrics.total===3 && barbearia.metrics.touched===3,
    "Niche summary counts all matching saved leads and distinct contact actions");
  assert(barbearia.metrics.touchedPercent===100, "All three barbershops were approached");
  assert(mg.children.find(c=>c.name==="Varginha")?.children[0]?.name==="Barbearia",
    "Same niche in another city must remain independent");
});

Deno.test("Bairros option preserves original neighborhood view without changing city totals", () => {
  const niches=buildProspectingHierarchy(leads,touches,undefined,"segment");
  const neighborhoods=buildProspectingHierarchy(leads,touches,undefined,"neighborhood");
  assert(JSON.stringify(niches.metrics)===JSON.stringify(neighborhoods.metrics),
    "Changing detail mode cannot change global CRM metrics");
  const cityNiches=niches.states.find(s=>s.key==="MG")!.children.find(c=>c.name==="Lavras")!;
  const cityBairros=neighborhoods.states.find(s=>s.key==="MG")!.children.find(c=>c.name==="Lavras")!;
  assert(JSON.stringify(cityNiches.metrics)===JSON.stringify(cityBairros.metrics),
    "Changing detail mode cannot change Lavras metrics");
  assert(cityNiches.children[0]?.name==="Barbearia", "Segment mode must show niche");
  assert(cityBairros.children.some(child=>child.name==="Centro"), "Bairro mode must show Centro");
  assert(cityBairros.children.some(child=>child.name==="Vila Rica"), "Bairro mode must show Vila Rica");
});

Deno.test("Filtering a niche still works in both detail modes", () => {
  const nichos=buildProspectingHierarchy(leads,touches,"Barbearia","segment");
  const bairros=buildProspectingHierarchy(leads,touches,"Barbearia","neighborhood");
  assert(nichos.metrics.total===4 && bairros.metrics.total===4,"Both views filter by niche");
  assert(nichos.states.length===1 && bairros.states.length===1,"Only MG has matching niche");
  assert(nichos.states[0]?.children.length===2 && bairros.states[0]?.children.length===2,
    "Cities stay visible in both modes");
});

Deno.test("Changing status, deleting a lead or clicking Mandar mensagem updates both views", () => {
  const changed=leads.filter(lead=>lead.id!=="a").map(lead=>
    lead.id==="b"?{...lead,status:"rejected" as const}:lead
  );
  const moreTouches=new Set([...touches,"d"]);
  const before=buildProspectingHierarchy(leads,touches,"Barbearia","segment");
  const after=buildProspectingHierarchy(changed,moreTouches,"Barbearia","segment");
  const afterBairros=buildProspectingHierarchy(changed,moreTouches,"Barbearia","neighborhood");
  assert(after.metrics.total===before.metrics.total-1,"Deleted lead leaves denominator");
  assert(after.metrics.touched===3,"Remaining contacted leads count once");
  assert(after.metrics.rejected===2 && after.metrics.accepted===0,
    "Live status updates current outcome rates");
  assert(JSON.stringify(after.metrics)===JSON.stringify(afterBairros.metrics),
    "Views must remain exactly consistent after edits");
});
