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
  assert(categoriesForOverture("Mercado / Supermercado").includes("grocery_store"), "Overture mapping missing: Mercado / Supermercado");
  assert(categoriesForOverture("Bar / Pub").includes("bar"), "Overture mapping missing: Bar / Pub");
  assert(categoriesForOverture("Posto de Combustível").includes("gas_station"), "Overture mapping missing: Posto de Combustível");
  assert(categoriesForOverture("Autopeças").includes("auto_parts_store"), "Overture mapping missing: Autopeças");
  assert(categoriesForOverture("Loja de Cosméticos").includes("beauty_supply_store"), "Overture mapping missing: Loja de Cosméticos");
  assert(categoriesForOverture("Provedor de Internet").includes("internet_service_provider"), "Overture mapping missing: Provedor de Internet");
  assert(categoriesForOverture("Loja de Celulares").includes("mobile_phone_store"), "Overture mapping missing: Loja de Celulares");
  assert(categoriesForOverture("Loja de Eletrônicos").includes("electronics_store"), "Overture mapping missing: Loja de Eletrônicos");
  assert(categoriesForOverture("Loja de Departamentos").includes("department_store"), "Overture mapping missing: Loja de Departamentos");
  assert(categoriesForOverture("Loja de Conveniência").includes("convenience_store"), "Overture mapping missing: Loja de Conveniência");
  assert(categoriesForOverture("Revenda de Motos").includes("motorcycle_dealer"), "Overture mapping missing: Revenda de Motos");
  assert(categoriesForOverture("Loja de Lingerie").includes("lingerie_store"), "Overture mapping missing: Loja de Lingerie");
  assert(categoriesForOverture("Loja de Utilidades Domésticas").includes("home_goods_store"), "Overture mapping missing: Loja de Utilidades Domésticas");
  assert(categoriesForOverture("Funerária").includes("funeral_service"), "Overture mapping missing: Funerária");
  assert(categoriesForOverture("Livraria").includes("bookstore"), "Overture mapping missing: Livraria");
  assert(categoriesForOverture("Loja de Artigos para Festas").includes("party_supply_store"), "Overture mapping missing: Loja de Artigos para Festas");
  assert(categoriesForOverture("Loja de Artigos Esportivos").includes("sporting_goods_store"), "Overture mapping missing: Loja de Artigos Esportivos");
  assert(categoriesForOverture("Restaurante Japonês").includes("sushi_restaurant"), "Overture mapping missing: Restaurante Japonês");
  assert(categoriesForOverture("Loja de Brinquedos").includes("toy_store"), "Overture mapping missing: Loja de Brinquedos");
  assert(categoriesForOverture("Loja de Eletrodomésticos").includes("appliance_store"), "Overture mapping missing: Loja de Eletrodomésticos");
  assert(categoriesForOverture("Academia").includes("gym"),"Gym category required");
  assert(categoriesForOverture("Loja de Materiais de Construção").includes("building_supply_store"),
    "Material shops must use observed Overture taxonomy");
  assert(categoriesForOverture("Clínica Veterinária").includes("veterinarian"),
    "Veterinarian category observed in staging must map correctly");
  assert(categoriesForOverture("Clínica Odontológica").includes("general_dentistry"),
    "Dental clinic subtype must be searchable before provider fallback");
  assert(categoriesForOverture("Mecânica Automotiva").includes("automotive_repair"),
    "Mechanic category must have an exact Overture match");
  assert(categoriesForOverture("Hortifruti").includes("produce_store"),
    "Produce shops must map to the grounded taxonomy");
  assert(!categoriesForOverture("Academia").includes("sport_or_fitness_facility"),
    "Broad sports venues could be irrelevant to gyms");
  assert(!categoriesForOverture("Hamburgueria").includes("fast_food_restaurant"),
    "Broad fast food causes false positive burgers");

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
