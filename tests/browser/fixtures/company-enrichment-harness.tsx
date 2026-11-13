import React from "react";
import { createRoot } from "react-dom/client";
import { LeadCompanyCheckSection } from "../../../src/features/lead-verification/LeadCompanyCheckSection";
import type { BusinessSearchResult } from "../../../src/features/search-leads/types";
import "../../../src/features/lead-verification/lead-company-check.css";

const leadId="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const business: BusinessSearchResult={
  placeId:"fixture-place",name:"Oficina Exemplo",primaryCategory:null,
  categories:[],description:null,address:null,neighborhood:null,
  city:"Lavras",state:"MG",phone:null,internationalPhone:null,
  rating:null,reviewCount:null,isOpenNow:null,openingHours:[],
  website:"https://empresa-exemplo.com.br",instagram:null,
  googleMapsUrl:null,businessStatus:null,latitude:null,longitude:null,
};
const root=document.getElementById("root");
if(root){
  createRoot(root).render(
    <main style={{maxWidth:850,margin:"20px auto",padding:12}}>
      <LeadCompanyCheckSection
        leadId={leadId} business={business}
        onApplyPhone={(phone)=>{document.body.dataset.appliedPhone=phone;}}
      />
    </main>,
  );
}
