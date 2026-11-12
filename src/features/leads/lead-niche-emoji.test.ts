import { ALL_SEARCH_SEGMENTS, SEARCH_SEGMENT_ALIASES } from "../search-leads/segments";
import { LEAD_NICHE_EMOJI, leadNicheEmoji } from "./lead-niche-emoji";

Deno.test("all 196 canonical niches have a nonempty category emoji",()=>{
  if(ALL_SEARCH_SEGMENTS.length!==196)throw Error("Review emoji mapping when canonical catalog grows or changes");
  const keys=Object.keys(LEAD_NICHE_EMOJI);
  if(keys.length!==ALL_SEARCH_SEGMENTS.length)throw Error("Emoji mapping contains missing or obsolete categories");
  for(const segment of ALL_SEARCH_SEGMENTS){
    const icon=LEAD_NICHE_EMOJI[segment];
    if(!icon || icon==="🏢")throw Error("Missing curated emoji for "+segment);
    if(leadNicheEmoji(segment)!==icon)throw Error("Mismatch in normalized lookup for "+segment);
  }
});

Deno.test("legacy niche names resolve to their canonical emojis",()=>{
  for(const [canonical,aliases] of Object.entries(SEARCH_SEGMENT_ALIASES)){
    for(const alias of aliases){
      if(leadNicheEmoji(alias)!==leadNicheEmoji(canonical))
        throw Error("Alias lookup mismatch "+alias);
    }
  }
  const cases:[string,string][]=[
    ["Academia","🏋️"],["Chaveiro","🔑"],["Barbearia","🧔"],
    ["Design de Sobrancelhas","👁️"],["Odontologia","🦷"],
    ["academia","🏋️"],["clínica odontológica","🦷"],
    ["Barbeiro especializado","🧔"],["Treinamento funcional","🏋️"],
    ["", "🏢"],["Nicho personalizado sem categoria","🏢"],
  ];
  for(const [segment,icon] of cases){
    if(leadNicheEmoji(segment)!==icon)
      throw Error("Expected "+icon+" for "+segment+", received "+leadNicheEmoji(segment));
  }
});
