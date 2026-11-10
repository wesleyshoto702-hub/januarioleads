/// <reference lib="deno.ns" />
import {
  applyProposalTemplate, duplicateProposal, makeProposal,
  proposalCode, proposalTotal, validateProposalForSending,
  type ProposalLine,
} from "./proposals.ts";

function check(condition:unknown,message:string) {
  if(!condition) throw new Error(message);
}
Deno.test("Proposal totals are calculated in integer BRL cents",()=>{
  const lines:ProposalLine[]=[
    {id:"a",description:"Hospedagem",quantity:3,unitPrice:.1},
    {id:"b",description:"Dominio",quantity:1,unitPrice:.2},
  ];
  check(proposalTotal(lines)===.5,"Floating-point total should be R$ 0,50");
});
Deno.test("Proposal creates a draft linked to existing CRM lead without modifying it",()=>{
  const lead={id:crypto.randomUUID(),company:"Barbearia Exemplo"};
  const source={...lead};
  const proposal=makeProposal(lead,"Prestador");
  check(proposal.leadId===lead.id && proposal.clientName===lead.company,"Lead must be linked");
  check(proposal.sellerName==="Prestador" && proposal.status==="draft","Draft metadata incorrect");
  check(JSON.stringify(lead)===JSON.stringify(source),"The lead must not be changed");
  check(proposalCode(proposal).startsWith("PC-"),"Stable proposal code expected");
});
Deno.test("Templates provide scoped content but never invent prices",()=>{
  for(const id of ["site","landing","maintenance"] as const){
    const original=makeProposal(null);
    const filled=applyProposalTemplate(original,id);
    check(filled.lines.length===1 && filled.lines[0]?.unitPrice===0,"Templates must never invent pricing");
    check(filled.title!==original.title&&Boolean(filled.scope),"Template fields missing");
  }
});
Deno.test("Sending requires a client, seller, and a priced service",()=>{
  const proposal=makeProposal(null);
  check(Boolean(validateProposalForSending(proposal)),"Blank proposal must not be markable as sent");
  proposal.clientName="Empresa";
  proposal.sellerName="Prestador";
  proposal.lines[0]!.description="Site institucional";
  proposal.lines[0]!.unitPrice=1500;
  check(validateProposalForSending(proposal)===null,"Complete proposal should pass");
  proposal.lines.push({id:crypto.randomUUID(),description:"",quantity:1,unitPrice:100});
  check(Boolean(validateProposalForSending(proposal)),"All service descriptions must be filled");
});
Deno.test("Duplicating creates separate identity, line IDs and a draft version",()=>{
  const initial=makeProposal({id:crypto.randomUUID(),company:"Cliente"},"Vendedor");
  const sent={...initial,status:"sent" as const,revision:5};
  const copied=duplicateProposal(sent);
  check(copied.id!==initial.id && copied.status==="draft" && copied.revision===1,
    "Duplicate should reset status and identity");
  check(copied.lines[0]?.id!==initial.lines[0]?.id,"Duplicated lines need unique IDs");
  check(copied.leadId===initial.leadId,"CRM lead link should be preserved");
});
