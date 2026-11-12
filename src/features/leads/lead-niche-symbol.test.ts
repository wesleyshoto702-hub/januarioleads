import { ALL_SEARCH_SEGMENTS, SEARCH_SEGMENT_ALIASES } from "../search-leads/segments";
import { LEAD_NICHE_SYMBOLS, leadNicheSymbol } from "./lead-niche-symbol";

Deno.test("every one of 196 canonical niches has a Lucide symbol",()=>{
  if(ALL_SEARCH_SEGMENTS.length!==196)throw Error("Canonical niche catalog changed; review symbols");
  const keys=Object.keys(LEAD_NICHE_SYMBOLS);
  if(keys.length!==ALL_SEARCH_SEGMENTS.length)
    throw Error("Niche symbols mapping is missing or has obsolete entries");
  for(const segment of ALL_SEARCH_SEGMENTS){
    const symbol=LEAD_NICHE_SYMBOLS[segment as keyof typeof LEAD_NICHE_SYMBOLS];
    if(!symbol || symbol==="Building2")throw Error("Missing curated line icon for "+segment);
    if(leadNicheSymbol(segment)!==symbol)
      throw Error("Mismatch for "+segment);
  }
});

Deno.test("aliases, common old CRM names and unknown labels",()=>{
  for(const [canonical,aliases] of Object.entries(SEARCH_SEGMENT_ALIASES)){
    for(const alias of aliases){
      if(leadNicheSymbol(alias)!==leadNicheSymbol(canonical))
        throw Error("Alias mismatch for "+alias);
    }
  }
  const examples:[string,string][]=[
    ["Academia","Dumbbell"],
    ["Chaveiro","KeyRound"],
    ["Barbearia","Scissors"],
    ["Design de Sobrancelhas","Flower2"],
    ["Odontologia","Smile"],
    ["clínica odontológica","Smile"],
    ["Barbeiro especializado","Scissors"],
    ["Treinamento funcional","Dumbbell"],
    ["", "Building2"],
    ["Nicho personalizado sem categoria","Building2"],
  ];
  for(const [segment,symbol] of examples){
    if(leadNicheSymbol(segment)!==symbol)
      throw Error("Expected "+symbol+" for "+segment+", got "+leadNicheSymbol(segment));
  }
});
