import {
  categoriesForOverture, enoughRelevantResults, searchOverture, isRelevantOverture,
} from "./overture-search.ts";

function assert(value:unknown,message:string):asserts value{
  if(!value)throw Error(message);
}
const row=(id:string,category:string,phone:string|null=null)=>({
  id,name:"Barbearia "+id,category,city:"Lavras",state:"MG",city_key:"lavras",
  address:"Rua A, "+id,latitude:-21.24,longitude:-45.00,
  phone,email:null,website:null,instagram:null,confidence:0.8,operating_status:"open",
});
Deno.test("Overture categories strictly match the selected niche, not vague searches",()=>{
  assert(categoriesForOverture("Barbearia").includes("barber"),"Barbers category required");
  assert(categoriesForOverture("Academia").includes("gym"),"Gym category required");
  assert(categoriesForOverture("Consultoria de RH").length===0,"Unmapped niche must not guess a broad category");
  assert(!isRelevantOverture(row("X","restaurant"),"Barbearia"),"Restaurant is not a barber");
  assert(enoughRelevantResults(Array.from({length:8},(_,i)=>({name:"X",phone:i<5?"35999999999":null,internationalPhone:null}))),
    "8 results and 5 contacts should avoid paid API calls");
  assert(!enoughRelevantResults([{name:"X",phone:"35999999999",internationalPhone:null}]),
    "One contact needs fallback");
});
Deno.test("Overture filters city/UF/category server-side, sorts and paginates",async()=>{
  let path="";
  const admin=async(uri:string)=>{
    path=uri;
    return Response.json(Array.from({length:53},(_,i)=>row(String(i),"barber",
      i%2===0?"35999999999":null)));
  };
  const first=await searchOverture({segment:"Barbearia",city:"Lavras",state:"MG"},admin);
  assert(first.ok,"Expected Overture search response");
  if(!first.ok)return;
  assert(first.results.length===20&&first.nextPageToken==="overture:20","First page");
  assert(first.results.every(x=>x.source==="overture"&&x.placeId.startsWith("overture:")),
    "Every result must carry Overture provenance");
  assert(path.includes("city_key=eq.lavras")&&path.includes("state=eq.MG"),
    "City and UF must be constrained on the private query");
  assert(path.includes("category=in."),"Niche must be category constrained");
  const next=await searchOverture({segment:"Barbearia",city:"Lavras",state:"MG",offset:40},admin);
  assert(next.ok && next.results.length===13 && next.nextPageToken===null,"Last page");
});
Deno.test("Unavailable Overture database fails closed instead of silently spending external budget",async()=>{
  const fail=await searchOverture({segment:"Academia",city:"Lavras",state:"MG"},
    async()=>new Response(null,{status:503}));
  assert(!fail.ok,"No silent paid provider fallback when base is down");
});
