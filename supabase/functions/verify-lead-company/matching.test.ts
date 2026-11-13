import {
  CNPJ_PATTERN, normalize, sameBusinessName, companyCandidates,
  publicWebsiteUrl, publicIPv4, publicIPv6, listedWebsiteContacts,
} from "./matching.ts";

const expect = (test:boolean,reason:string) => {if(!test)throw Error(reason)};

Deno.test("CNPJ accepts present numeric and future alphanumeric format only",()=>{
  expect(CNPJ_PATTERN.test("00000000000191"),"numeric");
  expect(CNPJ_PATTERN.test("A1000000000191"),"alphanumeric");
  expect(!CNPJ_PATTERN.test("123456"),"too short");
  expect(!CNPJ_PATTERN.test("0000000000000!"),"bad char");
});
Deno.test("normalization handles names and accents without treating generic words as proof",()=>{
  expect(normalize("São José Comércio") === "SAO JOSE COMERCIO","accents");
  expect(sameBusinessName("Barbearia do Carlos","BARBEARIA DO CARLOS LTDA",null),"valid match");
  expect(!sameBusinessName("Barbearia do Carlos","MERCADO JOSE LTDA",null),"false match");
  expect(!sameBusinessName("Açai","ACAI LTDA",null),"generic short must not silently match");
});
const rows={
  resultados:[
    {cnpj:"00000000000191",razao_social:"BARBEARIA DO CARLOS LTDA",
      nome_fantasia:"Barbearia do Carlos",cidade:"Lavras",uf:"MG",situacao:"Ativa",
      _links:{pagina:"https://www.datastone.com.br/consulta/empresa/00000000000191-barbearia"}},
    {cnpj:"11222333000181",razao_social:"BARBEARIA DO CARLOS LTDA",
      nome_fantasia:"Barbearia do Carlos",cidade:"Varginha",uf:"MG",situacao:"Ativa"},
    {cnpj:"22333444000155",razao_social:"BARBEARIA DO CARLOS LTDA",
      nome_fantasia:"Barbearia do Carlos",cidade:"Lavras",uf:"SP",situacao:"Ativa"},
    {cnpj:"33444555000107",razao_social:"PADARIA SANTA MARIA LTDA",
      nome_fantasia:"Padaria Santa Maria",cidade:"Lavras",uf:"MG",situacao:"Ativa"},
  ],
};
Deno.test("assisted search returns only same-city/state plausible matches",()=>{
  const found=companyCandidates(rows,"Barbearia do Carlos","Lavras","MG");
  expect(found.length===1,"only one matches");
  expect(found[0]?.cnpj==="00000000000191","correct city and state");
  expect(found[0]?.confidence==="likely","confidence displayed but requires confirmation");
});
Deno.test("empty, unrelated or ambiguous matches never become verified",()=>{
  const missing=companyCandidates({resultados:[]},"Barbearia do Carlos","Lavras","MG");
  expect(missing.length===0,"no contacts");
  const wrong=companyCandidates(rows,"ACADEMIA FIT CLUB","Lavras","MG");
  expect(wrong.length===0,"false candidate suppressed");
});
Deno.test("only allow plausible public HTTPS business website URLs",()=>{
  expect(publicWebsiteUrl("https://empresa.com.br/")!==null,"public website");
  for(const u of ["http://empresa.com.br","https://127.0.0.1/",
    "https://localhost/","https://intranet.local/","https://[::1]/","file:///etc/passwd",
    "https://user:pass@empresa.com.br","https://empresa.com.br:8443/"]){
    expect(publicWebsiteUrl(u)===null,"forbidden URL "+u);
  }
  expect(!publicIPv4("127.0.0.1")&&!publicIPv4("10.1.2.3"),"private v4");
  expect(!publicIPv4("169.254.169.254")&&!publicIPv4("192.168.1.8"),"link-local v4");
  expect(publicIPv4("8.8.8.8"),"public v4");
  expect(!publicIPv6("::1")&&!publicIPv6("fc00::2"),"private v6");
  expect(publicIPv6("2606:4700:4700::1111"),"public v6");
});
Deno.test("website contacts use only explicit mailto/tel and show no placeholders",()=>{
  const result=listedWebsiteContacts('<a href="mailto:contato@empresa.com.br">Email</a><a href="tel:+5535998877665">Fone</a>');
  expect(result.email==="contato@empresa.com.br","email");
  expect(result.phone==="35998877665","phone");
  const missing=listedWebsiteContacts("<p>Sem contato nesta página</p>");
  expect(missing.email===null&&missing.phone===null,"missing contacts");
  const noInference=listedWebsiteContacts("<p>email: qualquer@empresa.com.br</p>");
  expect(noInference.email===null,"no arbitrary text guess");
});
