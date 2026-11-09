import { sameVerifiedBusiness, uniqueVerifiedAliases, type VerifiedPlace } from "./cross-provider-identity.ts";
const osm:VerifiedPlace={id:"geoapify:osm1200",name:"Barbearia São José",address:"Rua das Flores, 22",city:"Lavras",state:"MG",latitude:-21.245500,longitude:-44.998200};
const google:VerifiedPlace={id:"ChIJgoogle-place-1200",name:"Barbearia Sao Jose",address:"Rua das Flores, 22, Lavras - MG",city:"Lavras",state:"MG",latitude:-21.245520,longitude:-44.998245};
Deno.test("Google after Geoapify: same business receives verified 0-credit alias",()=>{
  const aliases=uniqueVerifiedAliases([google],[osm]);
  if(aliases[google.id]!==osm.id)throw new Error("Google alias missing");
});
Deno.test("Geoapify after Google: reverse direction also matches",()=>{
  const aliases=uniqueVerifiedAliases([osm],[google]);
  if(aliases[osm.id]!==google.id)throw new Error("OSM alias missing");
});
Deno.test("Same name at a different address 1km away must be billed normally",()=>{
  const another={...google,latitude:-21.26,longitude:-45.01,address:"Rua Nova 1010"};
  if(sameVerifiedBusiness(another,osm))throw new Error("False branch match");
});
Deno.test("Different city or UF is never matched, even if phone/name match",()=>{
  if(sameVerifiedBusiness({...google,state:"SP"},osm))throw new Error("Wrong state");
  if(sameVerifiedBusiness({...google,city:"Varginha"},osm))throw new Error("Wrong city");
});
Deno.test("Different name at the same pin is not an identity match",()=>{
  if(sameVerifiedBusiness({...google,name:"Salão do Pedro"},osm))throw new Error("Name mismatch");
});
Deno.test("Name + identical address + same city/state can match without GPS",()=>{
  const a={...google,latitude:null,longitude:null,address:osm.address};
  if(!sameVerifiedBusiness(a,osm))throw new Error("Exact address was ignored");
});
Deno.test("Ambiguous businesses with same name and nearby coordinates are NOT aliased",()=>{
  const second={...osm,id:"geoapify:osm-other",latitude:-21.245510};
  if(Object.keys(uniqueVerifiedAliases([google],[osm,second])).length)
    throw new Error("Ambiguous OSM candidates caused incorrect zero debit");
});
Deno.test("Two current places cannot claim one previously credited place",()=>{
  const second={...google,id:"GoogleAlternateId"};
  if(Object.keys(uniqueVerifiedAliases([google,second],[osm])).length)
    throw new Error("Two Google matches claimed same OSM credit");
});
Deno.test("Coordinates alone or names alone are never sufficient",()=>{
  if(sameVerifiedBusiness({...google,name:"Barbearia Outro Nome"},osm))
    throw new Error("Coordinate-only");
  if(sameVerifiedBusiness({...google,latitude:null,longitude:null,address:"Rua Nova 101"},osm))
    throw new Error("Name-only");
});
