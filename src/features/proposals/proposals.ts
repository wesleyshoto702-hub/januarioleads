import { accountLocalStorage } from "../../lib/account-storage";
import type { PersistedLead } from "../leads/remote-leads";

export type ProposalStatus = "draft" | "sent" | "accepted" | "rejected";
export type ProposalLine = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
};
export type ProposalRecord = {
  id: string;
  leadId: string | null;
  clientName: string;
  clientEmail: string;
  title: string;
  sellerName: string;
  sellerContact: string;
  introduction: string;
  scope: string;
  deadline: string;
  paymentTerms: string;
  validUntil: string;
  notes: string;
  lines: ProposalLine[];
  status: ProposalStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "proposals:v1";
const MAX_PROPOSALS = 120;
const MAX_LINES = 30;
const PROPOSAL_STATUSES: ProposalStatus[] = ["draft", "sent", "accepted", "rejected"];

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  draft: "Rascunho", sent: "Enviada", accepted: "Aceita", rejected: "Recusada",
};
export const PROPOSAL_TEMPLATES = [
  {
    id: "site", label: "Site institucional",
    title: "Proposta de criação de site institucional",
    introduction: "Apresentamos uma proposta para desenvolver a presença digital da sua empresa.",
    scope: "Planejamento da estrutura, criação de páginas institucionais, versão responsiva e publicação após aprovação.",
    line: "Desenvolvimento de site institucional",
  },
  {
    id: "landing", label: "Landing page",
    title: "Proposta de desenvolvimento de landing page",
    introduction: "Esta proposta apresenta a criação de uma página orientada à comunicação de sua oferta.",
    scope: "Estrutura da página, apresentação dos benefícios, formulário ou botão de contato, adaptação para celular e publicação.",
    line: "Criação de landing page",
  },
  {
    id: "maintenance", label: "Manutenção de site",
    title: "Proposta de manutenção e melhorias de site",
    introduction: "Apresentamos um serviço de melhorias e manutenção para o site informado.",
    scope: "Revisão do site atual, correção dos itens acordados e testes das alterações entregues.",
    line: "Manutenção e melhorias de site",
  },
] as const;
export type ProposalTemplateId = typeof PROPOSAL_TEMPLATES[number]["id"];

function text(value: unknown, limit: number): string {
  return typeof value === "string" ? value.slice(0,limit) : "";
}
function validPrice(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 10_000_000 ? Math.round(n * 100) / 100 : 0;
}
function validQty(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(999,Math.max(1,Math.trunc(n))) : 1;
}
function isRecord(value: unknown): value is Record<string,unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function dateOnly(value: unknown): string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) ? value : "";
}
export function proposalToday(date=new Date()): string {
  return new Intl.DateTimeFormat("en-CA",{
    timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",
  }).format(date);
}
function uuid(): string { return crypto.randomUUID(); }
export function proposalCode(proposal: Pick<ProposalRecord,"id"|"createdAt">): string {
  return "PC-"+proposal.createdAt.slice(0,4)+"-"+proposal.id.replace(/-/g,"").slice(0,8).toUpperCase();
}
export function proposalTotal(lines: readonly ProposalLine[]): number {
  // Calculate each row in integer cents to avoid floating-point BRL drift.
  const cents = lines.reduce((acc,line) =>
    acc + Math.round(validPrice(line.unitPrice)*100)*validQty(line.quantity),0);
  return cents/100;
}
export function proposalLine(description=""): ProposalLine {
  return {id:uuid(),description,quantity:1,unitPrice:0};
}
export function makeProposal(lead?: Pick<PersistedLead,"id"|"company">|null, sellerName=""): ProposalRecord {
  const now=new Date().toISOString();
  return {
    id:uuid(), leadId:lead?.id??null, clientName:lead?.company??"",
    clientEmail:"",title:"Proposta comercial",sellerName,sellerContact:"",
    introduction:"",scope:"",deadline:"",paymentTerms:"",validUntil:"",
    notes:"",lines:[proposalLine()],status:"draft",revision:1,
    createdAt:now,updatedAt:now,
  };
}
export function applyProposalTemplate(proposal: ProposalRecord,id:ProposalTemplateId): ProposalRecord {
  const template=PROPOSAL_TEMPLATES.find(t=>t.id===id);
  if(!template)return proposal;
  return {
    ...proposal,title:template.title,introduction:template.introduction,scope:template.scope,
    lines:[proposalLine(template.line)],
  };
}
function parseProposal(value: unknown): ProposalRecord | null {
  if(!isRecord(value) || typeof value.id!=="string" ||
    !/^[0-9a-f-]{36}$/i.test(value.id) ||
    typeof value.createdAt!=="string" || !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.updatedAt!=="string" || !Number.isFinite(Date.parse(value.updatedAt)) ||
    !Array.isArray(value.lines))return null;
  const lines: ProposalLine[]=value.lines.slice(0,MAX_LINES).flatMap(x=>{
    if(!isRecord(x) || typeof x.id!=="string" || !/^[0-9a-f-]{36}$/i.test(x.id))return [];
    return [{id:x.id,description:text(x.description,300),quantity:validQty(x.quantity),
      unitPrice:validPrice(x.unitPrice)}];
  });
  const leadId=typeof value.leadId==="string" && /^[0-9a-f-]{36}$/i.test(value.leadId)
    ?value.leadId:null;
  return {
    id:value.id,leadId,clientName:text(value.clientName,160),
    clientEmail:text(value.clientEmail,180),title:text(value.title,160),
    sellerName:text(value.sellerName,160),sellerContact:text(value.sellerContact,180),
    introduction:text(value.introduction,2400),scope:text(value.scope,6000),
    deadline:text(value.deadline,300),paymentTerms:text(value.paymentTerms,1200),
    validUntil:dateOnly(value.validUntil),notes:text(value.notes,2500),
    lines,status:PROPOSAL_STATUSES.includes(value.status as ProposalStatus)
      ?value.status as ProposalStatus:"draft",
    revision:typeof value.revision==="number"&&Number.isInteger(value.revision)
      ?Math.min(9999,Math.max(1,value.revision)):1,
    createdAt:value.createdAt,updatedAt:value.updatedAt,
  };
}
export function loadProposals(): ProposalRecord[] {
  if(typeof window==="undefined")return [];
  try{
    const value:unknown=JSON.parse(accountLocalStorage.getItem(STORAGE_KEY)??"[]");
    return Array.isArray(value)?value.slice(0,MAX_PROPOSALS).flatMap(x=>{
      const parsed=parseProposal(x);return parsed?[parsed]:[];
    }):[];
  }catch{return [];}
}
export function saveProposals(proposals: ProposalRecord[]): void {
  if(typeof window==="undefined")throw new Error("Salvamento indisponível fora do navegador.");
  if(proposals.length>MAX_PROPOSALS)
    throw new Error("Limite de 120 propostas neste navegador. Exclua ou exporte propostas antigas.");
  const seen=new Set<string>();
  const cleaned:ProposalRecord[]=[];
  for(const proposal of proposals){
    const parsed=parseProposal(proposal);
    if(!parsed)throw new Error("Há uma proposta com dados inválidos.");
    if(parsed.lines.length>MAX_LINES)
      throw new Error("Uma proposta pode conter no máximo 30 serviços.");
    if(seen.has(parsed.id))throw new Error("Encontramos uma proposta duplicada.");
    seen.add(parsed.id);
    cleaned.push(parsed);
  }
  try {
    const serialized=JSON.stringify(cleaned);
    accountLocalStorage.setItem(STORAGE_KEY,serialized);
    if(accountLocalStorage.getItem(STORAGE_KEY)!==serialized)
      throw new Error("Não foi possível confirmar o salvamento.");
  }catch {
    throw new Error("Não foi possível salvar as propostas neste navegador. Verifique o espaço disponível e as permissões de armazenamento.");
  }
}
export function validateProposalForSending(proposal: ProposalRecord): string | null {
  if(!proposal.clientName.trim())return "Informe o nome do cliente.";
  if(!proposal.title.trim())return "Informe o título da proposta.";
  if(!proposal.sellerName.trim())return "Informe o responsável pela proposta.";
  if(!proposal.lines.some(line=>line.description.trim() && validPrice(line.unitPrice)>0))
    return "Inclua pelo menos um serviço com descrição e valor maior que zero.";
  if(proposal.lines.some(line=>!line.description.trim() || line.quantity<1 ||
    !Number.isFinite(line.unitPrice) || line.unitPrice<0))
    return "Preencha corretamente a descrição, quantidade e valor de cada serviço.";
  return null;
}
export function duplicateProposal(proposal: ProposalRecord): ProposalRecord {
  const now=new Date().toISOString();
  return {...proposal,id:uuid(),title:proposal.title+" (cópia)",status:"draft",revision:1,
    lines:proposal.lines.map(line=>({...line,id:uuid()})),createdAt:now,updatedAt:now};
}

/**
 * Portable, user-controlled local backup. This is not cloud sync.
 * Never send proposal content to the server or third parties.
 */
export function serializeProposalBackup(proposals: readonly ProposalRecord[]): string {
  return JSON.stringify({
    product: "JanuarioLeads", section: "proposals", version: 1,
    exportedAt: new Date().toISOString(), proposals,
  }, null, 2);
}
export function parseProposalBackup(serialized: string): ProposalRecord[] {
  if(serialized.length > 3_000_000)
    throw new Error("O backup é maior do que o limite permitido de 3 MB.");
  let parsed: unknown;
  try { parsed = JSON.parse(serialized); }
  catch { throw new Error("Arquivo JSON inválido."); }
  if(!isRecord(parsed) || parsed.product!=="JanuarioLeads" ||
    parsed.section!=="proposals" || parsed.version!==1 ||
    !Array.isArray(parsed.proposals) || parsed.proposals.length>MAX_PROPOSALS)
    throw new Error("Este arquivo não é um backup compatível de propostas do Januário Leads.");
  const result:ProposalRecord[]=[];
  const ids=new Set<string>();
  for(const raw of parsed.proposals) {
    const record=parseProposal(raw);
    if(!record || !isRecord(raw) || !Array.isArray(raw.lines) ||
      raw.lines.length>MAX_LINES || ids.has(record.id))
      throw new Error("O backup contém propostas inválidas ou duplicadas.");
    ids.add(record.id);
    result.push(record);
  }
  return result;
}
