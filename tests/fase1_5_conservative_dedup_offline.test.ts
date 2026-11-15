/// <reference lib="deno.ns" />
import {
  isSameLocatedOvertureBusiness,
  searchOverture,
  type OverturePlace,
} from "../supabase/functions/_shared/overture-search.ts";
import { canonicalPublicInstagram, providerInstagramCandidate } from
  "../supabase/functions/_shared/public-instagram-candidate.ts";

function assert(value: unknown, message: string): asserts value {
  if(!value)throw new Error(message);
}
function makePlace(id:string, overrides:Partial<OverturePlace>={}):OverturePlace {
  return {
    id, name:"Barbearia Central",category:"barber",city:"Lavras",state:"MG",
    address:"Rua das Flores, 25",latitude:-21.245,longitude:-44.997,
    phone:"(35) 98888-8888",email:"contact@example.test",
    website:null,instagram:null,confidence:0.8,operating_status:null,
    ...overrides,
  };
}
Deno.test("same source ID is not shown twice, regardless of metadata order",()=>{
  const p=makePlace("same");
  assert(isSameLocatedOvertureBusiness(p,{...p,address:"Rua Outro Número, 200"}),
    "Same Overture ID must be recognized");
});
Deno.test("separate businesses within fifteen meters must survive explicit conflicts",()=>{
  const p=makePlace("base");
  const close={latitude:-21.24501,longitude:-44.99701};
  assert(isSameLocatedOvertureBusiness(p,makePlace("alias",close)),
    "Close compatible same-name location should collapse");
  assert(!isSameLocatedOvertureBusiness(p,makePlace("suite",{
    ...close,address:"Rua das Flores, 27"
  })),"Nearby different-number locations should not merge");
  assert(!isSameLocatedOvertureBusiness(p,makePlace("category",{
    ...close,category:"hair_salon"
  })),"Different explicit category must not be silently discarded");
  assert(!isSameLocatedOvertureBusiness(p,makePlace("contact",{
    ...close,phone:"(35) 97777-7777"
  })),"Nearby phone conflict must remain distinct");
});
Deno.test("geographic distance and missing data are handled conservatively",()=>{
  const p=makePlace("a");
  assert(!isSameLocatedOvertureBusiness(p,makePlace("far",{
    latitude:-21.249,longitude:-45.002
  })),"Different branch in the same municipality cannot merge");
  assert(!isSameLocatedOvertureBusiness(p,makePlace("name",{
    name:"Barbearia da Praça"
  })),"Different names are distinct");
  assert(isSameLocatedOvertureBusiness(p,makePlace("same-address",{
    latitude:null,longitude:null
  })),"Identical known address is valid fallback when coordinates are absent");
  assert(!isSameLocatedOvertureBusiness(p,makePlace("no-address",{
    latitude:null,longitude:null,address:null
  })),"Missing address cannot prove shared location");
  assert(!isSameLocatedOvertureBusiness(p,makePlace("broken-coords",{
    latitude:NaN,longitude:null,address:null
  })),"Invalid coordinates and unknown address must not dedup");
});
Deno.test("normalization does not treat harmless phone/address punctuation as conflicts",()=>{
  const a=makePlace("a",{address:"Rua das Flores, 25",phone:"(35) 98888-8888"});
  const b=makePlace("b",{
    address:"RUA DAS FLORES 25",phone:"35 98888 8888",
    latitude:-21.24502,longitude:-44.99701
  });
  assert(isSameLocatedOvertureBusiness(a,b),"Equivalent formatted contact/location should merge");
});
Deno.test("searchOverture retains distinct nearby shops and collapses only a compatible alias",async()=>{
  const p=makePlace("01");
  const alias=makePlace("02",{latitude:-21.24501,longitude:-44.99701});
  const diffAddress=makePlace("03",{
    latitude:-21.24502,longitude:-44.99702,address:"Rua das Flores, 27"
  });
  const diffPhone=makePlace("04",{
    latitude:-21.24503,longitude:-44.99702,phone:"(35) 97777-7777"
  });
  const far=makePlace("05",{latitude:-21.265,longitude:-45.010});
  const closed=makePlace("06",{
    name:"Barbearia Encerrada",operating_status:"permanently_closed"
  });
  const calls:string[]=[];
  const mock=async(path:string):Promise<Response>=>{
    calls.push(path);
    return new Response(JSON.stringify([p,alias,diffAddress,diffPhone,far,closed]),{
      status:200,headers:{"content-type":"application/json"}
    });
  };
  const result=await searchOverture({
    city:"Lavras",state:"MG",segment:"Barbearia"
  },mock);
  assert(result.ok,"Mock search should succeed");
  assert(result.allCount===4, "Four distinct open businesses must remain");
  assert(result.results.length===4,"Search result count lost after dedup");
  assert(result.results.every(x=>x.source==="overture"),
    "No fallback providers should be called");
  assert(calls.length===1 && calls[0].startsWith("overture_places?"),
    "Only a bounded database read is expected");
  assert(result.results.every(x=>x.businessStatus!=="permanently_closed"),
    "Closed business unexpectedly included");
});
Deno.test("Instagram data is only a candidate profile, never an official verification",()=>{
  assert(canonicalPublicInstagram("https://instagram.com/exemplo_loja/")===
    "https://www.instagram.com/exemplo_loja/","Valid direct profile should normalize");
  const invalid=[
    "https://instagram.com/p/examplepost/",
    "https://instagram.com/explore/",
    "https://instagram.com/stories/exemplo",
    "https://instagram.com/",
    "https://instagram.com.evil.example/exemplo",
    "https://instagram.com/reel/abc"
  ];
  for(const value of invalid){
    assert(canonicalPublicInstagram(value)===null,
      "Non-profile Instagram URL must be rejected: "+value);
  }
  const candidate=providerInstagramCandidate(
    "https://instagram.com/exemplo_loja/","Overture"
  );
  assert(candidate?.confidence==="medium",
    "Public directory link must never be marked verified");
  assert(candidate?.evidenceUrls.length===0,
    "Provider profile link is not independent proof of ownership");
});
