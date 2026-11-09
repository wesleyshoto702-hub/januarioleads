import { findSavedBusinessMatch, findBusinessDuplicate, type ExistingLeadIdentity } from "./identity.ts";
import type { BusinessSearchResult } from "./types.ts";

const lead: ExistingLeadIdentity = {
  id:"crm-lead-1", company:"Barbearia São José", phone:"",
  placeId:"google-main-456", address:"Rua das Flores, 22",
  city:"Lavras", state:"MG", latitude:-21.245500, longitude:-44.998200,
};

const osm = {
  placeId:"geoapify:osm123", name:"Barbearia Sao Jose",
  phone:null, address:"R. Flores, nº 22",
  city:"Lavras", state:"MG",latitude:-21.245520,longitude:-44.998245,
};

Deno.test("Google lead added via Buscar Leads is recognized via Maps by Place ID", () => {
  const match=findSavedBusinessMatch({ ...osm,placeId:"google-main-456" },[lead]);
  if(match?.id!==lead.id) throw new Error("Same Google place ID not found");
});

Deno.test("Google CRM lead appears as saved in Geoapify despite different provider IDs", () => {
  const match=findSavedBusinessMatch(osm,[lead]);
  if(match?.id!==lead.id) throw new Error("Same business by name and nearby coordinates not recognized");
});

Deno.test("Lead saved in Maps is recognized from traditional Buscar Leads", () => {
  const mapLead={...lead,placeId:"geoapify:osm123"};
  const standard={...osm,placeId:"google-main-456",name:"Barbearia São José"};
  if(findSavedBusinessMatch(standard,[mapLead])?.id!==lead.id)
    throw new Error("Inverse Maps -> standard recognition failed");
});

Deno.test("Same chain name at distant branches is not mistaken for an added lead", () => {
  const other={...osm,address:"Rua da Matriz 310",latitude:-21.251,longitude:-44.984};
  if(findSavedBusinessMatch(other,[lead]))
    throw new Error("Unrelated branch was incorrectly classified as saved");
});

Deno.test("Never match different company names using coordinates alone", () => {
  if(findSavedBusinessMatch({...osm,name:"Barbearia do Pedro"},[lead]))
    throw new Error("Proximity alone is not identity");
});

Deno.test("Same phone cannot conflate companies in different towns or states", () => {
  const saved={...lead,phone:"(35) 98888-1111"};
  const candidate={...osm,phone:"(35) 98888-1111",city:"Varginha"};
  if(findSavedBusinessMatch(candidate,[saved]))
    throw new Error("Shared phone across towns was incorrectly matched");
  if(findSavedBusinessMatch({...candidate,city:"Lavras",state:"SP"},[saved]))
    throw new Error("Shared phone across states was incorrectly matched");
});

Deno.test("Name alone is not enough to declare a duplicate", () => {
  if(findSavedBusinessMatch({name:"Barbearia Sao Jose",placeId:"geoapify:different"},[lead]))
    throw new Error("Name-only match may hide a legitimate business");
});

Deno.test("Identical name + normalized address works even when coordinates are missing", () => {
  if(findSavedBusinessMatch({
    name:"Barbearia Sao Jose",address:"Rua das Flores, 22",city:"Lavras",state:"MG",
  },[{...lead,latitude:undefined,longitude:undefined}])?.id!==lead.id)
    throw new Error("Name/address cross-source match failed");
});

Deno.test("Traditional card uses the same match logic after saving from Maps", () => {
  const business={
    ...osm,placeId:"google-main-456",primaryCategory:null,categories:[],
    description:null,neighborhood:null,internationalPhone:null,
    rating:null,reviewCount:null,isOpenNow:null,openingHours:[],
    website:null,instagram:null,googleMapsUrl:null,businessStatus:null,
  } as BusinessSearchResult;
  if(findBusinessDuplicate(business,[{...lead,placeId:"geoapify:osm123"}])?.id!==lead.id)
    throw new Error("Traditional result did not reuse cross-provider matching");
});

Deno.test("Mesmo telefone de central não deve juntar duas empresas diferentes", () => {
  const original={...lead,phone:"(35) 98888-1111"};
  const another={...osm,phone:"(35) 98888-1111",
    name:"Barbearia do Pedro",address:"Rua da Matriz 100"};
  if(findSavedBusinessMatch(another,[original]))
    throw new Error("Telefone compartilhado gerou uma duplicata falsa");
});

Deno.test("Different stores sharing a phone and one building must not be merged", () => {
  const saved={...lead,phone:"(35) 98888-1111"};
  const neighbor={...osm,name:"Salão da Maria",phone:"(35) 98888-1111",
    address:saved.address,latitude:-21.245500,longitude:-44.998200};
  if(findSavedBusinessMatch(neighbor,[saved]))
    throw new Error("Shared reception and address caused a false duplicate");
});

Deno.test("Same chain name and central phone at a distant branch is not a duplicate", () => {
  const saved={...lead,phone:"(35) 98888-1111"};
  const other={...osm,phone:"(35) 98888-1111",
    address:"Rua da Matriz, 300",latitude:-21.253,longitude:-44.985};
  if(findSavedBusinessMatch(other,[saved]))
    throw new Error("Distant chain branch matched just by name/phone");
});

Deno.test("Far apart valid coordinates take precedence over identical address text", () => {
  const other={...osm,address:lead.address,latitude:-21.260,longitude:-44.985};
  if(findSavedBusinessMatch(other,[lead]))
    throw new Error("Generic building address hid contradictory coordinates");
});

Deno.test("Ambiguous same-name neighbors are not silently matched to the first CRM lead", () => {
  const second={...lead,id:"crm-lead-2",placeId:"geoapify:other-02",
    latitude:-21.245515,longitude:-44.998215};
  if(findSavedBusinessMatch(osm,[lead,second]))
    throw new Error("Ambiguous fuzzy identity selected the wrong lead");
});

Deno.test("Verified provider alias recognizes a Google lead with user-entered CRM name", () => {
  const manuallyNamed={...lead,company:"Minha conta preferida",
    address:undefined,city:undefined,state:undefined,
    latitude:undefined,longitude:undefined};
  const geo={...osm,equivalentPlaceId:"google-main-456"};
  if(findSavedBusinessMatch(geo,[manuallyNamed])?.id!==lead.id)
    throw new Error("Server-verified provider alias was ignored");
});

Deno.test("Phone and business name without physical evidence are not sufficient", () => {
  const saved={...lead,phone:"(35) 98888-1111",placeId:"google-other",
    address:undefined,latitude:undefined,longitude:undefined};
  const candidate={...osm,phone:"(35) 98888-1111",address:null,
    latitude:null,longitude:null};
  if(findSavedBusinessMatch(candidate,[saved]))
    throw new Error("No geographic evidence: potential chain branch was conflated");
});
