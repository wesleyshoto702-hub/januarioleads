/// <reference lib="deno.ns" />
import { searchOverture, isSameLocatedOvertureBusiness, categoriesForOverture,
  type OverturePlace } from "../supabase/functions/_shared/overture-search.ts";

function assert(condition:unknown,message:string):asserts condition {
  if(!condition)throw new Error(message);
}
function place(
  id:string,name:string,category:string,
  lat:number|null,lon:number|null,address:string|null=null
):OverturePlace{
  return {id,name,category,city:"Lavras",state:"MG",address,
    latitude:lat,longitude:lon,phone:"35988888888",email:null,
    website:null,instagram:null,confidence:0.75,operating_status:"operational"};
}
function fakeAdmin(
  rows:OverturePlace[], requests:string[],
  status=200
):(path:string,init?:RequestInit)=>Promise<Response|null>{
  return async path=>{
    requests.push(path);
    return new Response(JSON.stringify(rows),{
      status,headers:{"content-type":"application/json"},
    });
  };
}
Deno.test("same name without address is not evidence of the same establishment",async()=>{
  const calls:string[]=[];
  const near=place("a","Barbearia Central","barber",-21.244,-44.998);
  const far=place("b","Barbearia Central","barber",-21.256,-45.014);
  const alias=place("c","Barbearia Central","barber",-21.24403,-44.99803);
  const unrelated=place("d","Escola Central","school",-21.250,-44.999);
  const closed={...place("e","Barbearia Fechada","barber",-21.251,-45.001),
    operating_status:"permanently_closed"};
  assert(!isSameLocatedOvertureBusiness(near,far),"Distinct branches were merged");
  assert(isSameLocatedOvertureBusiness(near,alias),"Nearby aliases not detected");
  const out=await searchOverture(
    {segment:"Barbearia",city:"Lavras",state:"mg"},
    fakeAdmin([near,far,alias,unrelated,closed],calls)
  );
  assert(out.ok && out.results.length===2,"Only two open distinct barber shops should remain");
  assert(out.ok && out.results.every(r=>r.source==="overture"),"Source attribution lost");
  assert(out.ok && out.results.every(r=>r.website===null),"Unknown website must remain unknown");
  const params=new URLSearchParams(calls[0].split("?")[1]);
  assert(params.get("state")==="eq.MG","UF filter incorrect");
  assert(params.get("city_key")==="eq.lavras","City filter incorrect");
  assert(params.get("limit")==="250","Bounded candidate window missing");
  assert(params.get("order")==="id.asc","Deterministic query order missing");
  assert(params.get("category")?.includes("barber")===true,"Exact niche category missing");
});
Deno.test("address fallback only deduplicates identical known addresses",()=>{
  const same=place("a","Farmácia Popular","pharmacy",null,null,"Rua A, 25");
  const equivalent=place("b","Farmácia Popular","pharmacy",null,null,"Rua A 25");
  const other=place("c","Farmácia Popular","pharmacy",null,null,"Rua B 25");
  const noAddress=place("d","Farmácia Popular","pharmacy",null,null,null);
  assert(isSameLocatedOvertureBusiness(same,equivalent),"Known identical addresses not matched");
  assert(!isSameLocatedOvertureBusiness(same,other),"Different addresses merged");
  assert(!isSameLocatedOvertureBusiness(same,noAddress),"Missing address must not assert a match");
});
Deno.test("pagination preserves the 20-row page size and cap without paid requests",async()=>{
  const requests:string[]=[];
  const data=Array.from({length:43},(_,i)=>
    place(String(i).padStart(3,"0"),"Barbearia "+i,"barber",-21.24-i*0.002,-44.98));
  const mock=fakeAdmin(data,requests);
  const first=await searchOverture({segment:"Barbearia",city:"Lavras",state:"MG"},mock);
  const second=await searchOverture({segment:"Barbearia",city:"Lavras",state:"MG",offset:20},mock);
  assert(first.ok&&second.ok,"Search failed");
  assert(first.results.length===20&&second.results.length===20,"Page size changed");
  assert(first.nextPageToken==="overture:20"&&second.nextPageToken==="overture:40",
    "Pagination token incorrect");
  assert(first.results.every(a=>!second.results.some(b=>a.placeId===b.placeId)),
    "Same business returned on both pages");
  assert(requests.length===2&&requests.every(p=>p.startsWith("overture_places?")),
    "A non-Overture provider was contacted");
});
Deno.test("unmapped niches do not broaden categories or make database queries",async()=>{
  assert(categoriesForOverture("Açaiteria").length===0,"Niche changed, review the safe test");
  const calls:string[]=[];
  const result=await searchOverture({segment:"Açaiteria",city:"Lavras",state:"MG"},
    fakeAdmin([place("a","Barbearia","barber",-21.2,-45.1)],calls));
  assert(result.ok&&result.results.length===0&&calls.length===0,
    "Unmapped niches must not return unrelated businesses");
});
Deno.test("unavailable Overture remains an explicit safe failure",async()=>{
  const result=await searchOverture({segment:"Barbearia",city:"Lavras",state:"MG"},
    fakeAdmin([],[],503));
  assert(!result.ok&&result.reason==="UNAVAILABLE","Unavailable data must not look successful");
});
