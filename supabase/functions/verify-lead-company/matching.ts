/** Pure helpers used by the manual company verifier and its tests.
 * Company lookup suggestions must never be auto-confirmed by a similarity score.
 */
export const CNPJ_PATTERN=/^[A-Z0-9]{12}[0-9]{2}$/;
export const UUID_PATTERN=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export function cleanText(input:unknown,max=180):string|null{
  return typeof input==="string"&&input.trim()?input.trim().slice(0,max):null;
}
export function normalize(input:unknown):string{
  return String(input??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/gi," ").trim().replace(/\s+/g," ").toUpperCase();
}
const IGNORE=new Set(["LTDA","ME","EPP","EIRELI","SA","S","A","DO","DA","DE","DOS","DAS","COMERCIO","SERVICOS"]);
function meaningfulTokens(input:unknown){
  return normalize(input).split(" ").filter(x=>x.length>=3&&!IGNORE.has(x));
}
export function sameBusinessName(lead:unknown,corporate:unknown,trade:unknown):boolean{
  const query=normalize(lead), names=[normalize(corporate),normalize(trade)].filter(Boolean);
  if(!query) return false;
  if(names.some(x=>x===query))return true;
  const a=meaningfulTokens(query);
  return a.length>=2&&names.some(x=>{
    const b=new Set(meaningfulTokens(x));
    return a.filter(t=>b.has(t)).length/a.length>=0.8;
  });
}
export type CompanyCandidate={
  cnpj:string;
  corporate_name:string;
  trade_name:string|null;
  city:string;
  state:string;
  registration_status:string|null;
  source_url:string;
  confidence:"likely"|"review";
  score:number;
};
export function companyCandidates(
  input:unknown,name:string,city:string,state:string,
  sourceBase="https://www.datastone.com.br/consulta",
):CompanyCandidate[]{
  const raw=input&&typeof input==="object"&&!Array.isArray(input)?input as Record<string,unknown>:{};
  const rows=Array.isArray(raw.resultados)?raw.resultados:[];
  const uf=normalize(state), municipality=normalize(city), searchTokens=meaningfulTokens(name);
  const results:CompanyCandidate[]=[];
  const used=new Set<string>();
  for(const item of rows.slice(0,10)){
    if(!item||typeof item!=="object"||Array.isArray(item))continue;
    const row=item as Record<string,unknown>;
    const cnpj=String(row.cnpj??"").toUpperCase().replace(/[^0-9A-Z]/g,"");
    if(!CNPJ_PATTERN.test(cnpj)||used.has(cnpj))continue;
    const rowState=cleanText(row.uf,2);
    const rowCity=cleanText(row.cidade,100);
    const corporate=cleanText(row.razao_social,180);
    const trade=cleanText(row.nome_fantasia,180);
    if(!rowState||!rowCity||!corporate)continue;
    // Strict location match: never suggest wrong-state or wrong-city CNPJs.
    if(normalize(rowState)!==uf||normalize(rowCity)!==municipality)continue;
    const exact=[corporate,trade].some(x=>normalize(x)===normalize(name));
    const contained=[corporate,trade].some(x=>Boolean(x)&&normalize(x).includes(normalize(name))&&name.length>=6);
    const overlap=Math.max(...[corporate,trade].map(x=>{
      const tokens=new Set(meaningfulTokens(x));
      return searchTokens.length?searchTokens.filter(t=>tokens.has(t)).length/searchTokens.length:0;
    }));
    const score=exact?100:contained?88:Math.round(overlap*82);
    // Never show weak coincidences from broad searches as genuine matches.
    if(score<35)continue;
    let source=sourceBase;
    const links=row._links&&typeof row._links==="object"?row._links as Record<string,unknown>:{};
    if(typeof links.pagina==="string"){
      try{const u=new URL(links.pagina);if(u.protocol==="https:"&&u.hostname==="www.datastone.com.br"&&u.pathname.startsWith("/consulta/empresa/"))source=u.href}
      catch{/* fallback */}
    }
    used.add(cnpj);
    results.push({cnpj,corporate_name:corporate,trade_name:trade,city:rowCity,state:rowState,
      registration_status:cleanText(row.situacao,50),source_url:source,
      confidence:score>=88?"likely":"review",score});
  }
  return results.sort((a,b)=>b.score-a.score).slice(0,5);
}
export function publicWebsiteUrl(input:unknown):URL|null{
  if(typeof input!=="string"||input.length>500)return null;
  try{
    const url=new URL(input);
    const h=url.hostname.toLowerCase();
    if(url.protocol!=="https:"||url.username||url.password||url.port||
      !h.includes(".")||h.length>240||h.includes(":")||/^\d+\.\d+\.\d+\.\d+$/.test(h)||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example|home|lan|onion)$/.test(h))return null;
    if(url.pathname.length>200||url.search.length>80)return null;
    url.hash="";return url;
  }catch{return null}
}
export function publicIPv4(ip:string):boolean{
  const s=ip.split(".");
  if(s.length!==4||s.some(x=>!/^\d{1,3}$/.test(x)||Number(x)>255))return false;
  const [a,b]=s.map(Number);
  if(a===0||a===10||a===127||a>=224||
    (a===100&&b>=64&&b<=127)||(a===169&&b===254)||
    (a===172&&b>=16&&b<=31)||(a===192&&[0,168].includes(b))||
    (a===198&&(b===18||b===19))||(a===198&&b===51)||
    (a===203&&b===0))return false;
  return true;
}
export function publicIPv6(ip:string):boolean{
  const h=ip.toLowerCase();
  if(!h.includes(":"))return false;
  return !(/^(::|::1$|::ffff:|fe[89ab]|f[cd]|2001:db8|2001:0db8)/.test(h));
}
export function listedWebsiteContacts(html:string):{email:string|null;phone:string|null}{
  // Use explicit mailto/tel links, not arbitrary address-like text or personal
  // profile content. Treat every suggestion as unverified.
  const emails:Array<string>=[], phones:Array<string>=[];
  for(const match of html.matchAll(/href\s*=\s*["']\s*(mailto:|tel:)([^"'<>\s]{2,180})["']/gi)){
    const type=match[1]?.toLowerCase(), raw=match[2]??"";
    if(type==="mailto:"){
      const value=decodeURIComponent(raw.split("?")[0]??"").trim().toLowerCase();
      if(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(value)&&!value.endsWith("@example.com"))emails.push(value.slice(0,180));
    }
    if(type==="tel:"){
      const d=raw.replace(/\D/g,"");
      const digits=d.startsWith("55")&&d.length>=12?d.slice(2):d;
      if(/^\d{10,11}$/.test(digits))phones.push(digits);
    }
  }
  return {email:emails[0]??null,phone:phones[0]??null};
}
