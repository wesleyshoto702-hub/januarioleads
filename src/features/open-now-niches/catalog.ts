import {
  CURRENT_NICHE_COVERAGE,
  type NicheFamily,
} from "../../../supabase/functions/_shared/niche-strategies.ts";
import { ALL_SEARCH_SEGMENTS } from "../search-leads/segments";

export const NICHE_FAMILY_LABELS: Record<NicheFamily,string> = {
  generic_local_business:"Outros",
  food:"Alimentação",
  beauty:"Beleza",
  health:"Saúde",
  home_services:"Serviços residenciais",
  automotive:"Automotivo",
  fitness:"Fitness",
  education:"Educação",
  events:"Eventos",
  professional_services:"Serviços profissionais",
  retail:"Varejo",
  pets:"Pets",
  logistics:"Logística",
  creative:"Criativo",
};

const coverageBySegment = new Map(
  CURRENT_NICHE_COVERAGE.map((item)=>[item.segment,item]),
);

export type OpenNowCatalogEntry = {
  segment: string;
  nicheKey: string;
  family: NicheFamily;
  familyLabel: string;
};

export const OPEN_NOW_CATALOG: OpenNowCatalogEntry[] =
  ALL_SEARCH_SEGMENTS.map((segment)=>{
    const coverage=coverageBySegment.get(segment);
    const family=(coverage?.family ?? "generic_local_business") as NicheFamily;
    return {
      segment,
      nicheKey:coverage?.nicheKey ?? "generic_local_business",
      family,
      familyLabel:NICHE_FAMILY_LABELS[family],
    };
  });

export const OPEN_NOW_FAMILIES = Array.from(
  new Set(OPEN_NOW_CATALOG.map((item)=>item.family)),
);
