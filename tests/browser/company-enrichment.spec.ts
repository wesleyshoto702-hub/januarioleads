import { test, expect, type Page } from "@playwright/test";

/** Every call is mocked. No real Brazilian company, credential, CRM or paid API is touched. */
const USER_ID="11111111-1111-1111-1111-111111111111";
const LEAD_ID="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const COMPANY={
  id:LEAD_ID,user_id:USER_ID,company:"Oficina Exemplo",segment:"Oficina",
  phone:"",status:"waiting",first_contact:"2026-11-01",created_at:"2026-11-01T12:00:00.000Z",
  city:"Lavras",state:"MG",notes:"",website:"https://empresa-exemplo.com.br",source:"manual",
};
const CNPJ="00000000000191";
const GOOD={
  cnpj:CNPJ,corporate_name:"OFICINA EXEMPLO LTDA",trade_name:"Oficina Exemplo",
  registration_status:"ATIVA",status_date:"2026-01-01",city:"Lavras",state:"MG",
  contact_phone:"35999888777",contact_phone_alt:null,contact_email:null,
  identity_review_required:false,source_url:"https://brasilapi.com.br/api/cnpj/v1/"+CNPJ,
  checked_at:"2026-11-13T12:00:00Z",whatsapp_status:"not_verified",
  whatsapp_provider:null,whatsapp_checked_at:null,
};

type Options={mismatch?:boolean;noContacts?:boolean};
async function mockedLogin(page:Page,options:Options={}){
  const calls:string[]=[];
  await page.route("**/*",route=>{
    const url=new URL(route.request().url());
    return url.hostname==="127.0.0.1"?route.continue():route.abort();
  });
  await page.route("**/*.supabase.co/**",async route=>{
    const url=new URL(route.request().url());
    let data:unknown=[];
    if(url.pathname==="/auth/v1/token"){
      data={access_token:"fixture-token",refresh_token:"fixture-refresh",expires_in:3600,
        user:{id:USER_ID,email:"fixture@example.invalid"}};
    }else if(url.pathname==="/auth/v1/user"){
      data={id:USER_ID,email:"fixture@example.invalid"};
    }else if(url.pathname==="/rest/v1/private_access"){
      data=[{user_id:USER_ID}];
    }else if(url.pathname==="/rest/v1/leads"){
      data=route.request().method()==="GET"?(url.searchParams.get("offset")==="0"?[COMPANY]:[]):[];
    }else if(url.pathname==="/functions/v1/verify-lead-company"){
      const body=route.request().postDataJSON() as {mode:string};
      calls.push(body.mode);
      const record={...GOOD,
        identity_review_required:options.mismatch??false,
        contact_phone:options.noContacts?null:GOOD.contact_phone};
      if(body.mode==="status")data={ok:true,record:null,siteRecord:null};
      if(body.mode==="name_search")data={ok:true,candidates:[{
        cnpj:CNPJ,corporate_name:record.corporate_name,trade_name:record.trade_name,
        city:"Lavras",state:"MG",registration_status:"ATIVA",confidence:"likely",score:100,
        source_url:"https://www.datastone.com.br/consulta/empresa/00000000000191-oficina",
      }],cached:false,source:"https://www.datastone.com.br/consulta"};
      if(body.mode==="lookup")data={ok:true,record,cached:false};
      if(body.mode==="site_contacts")data={ok:true,cached:false,siteRecord:{
        website_url:"https://empresa-exemplo.com.br",phone:null,
        email:"contato@empresa-exemplo.com.br",checked_at:"2026-11-13T12:00:00Z",
      }};
      if(body.mode==="whatsapp_status")data={ok:true,record,available:false,
        message:"WhatsApp não está configurado."};
    }
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(data)});
  });
  await page.goto("/login");
  await page.getByPlaceholder("seu@email.com").fill("fixture@example.invalid");
  await page.getByPlaceholder("Sua senha").fill("test-password");
  await page.getByRole("button",{name:"Entrar",exact:true}).click();
  await expect(page.locator(".saas-shell")).toBeVisible();
  return calls;
}
async function openLead(page:Page,mobile=false){
  if(mobile){
    await page.getByRole("button",{name:"Abrir menu"}).click();
    await page.getByRole("dialog",{name:"Menu principal"})
      .getByRole("button",{name:"Meus Leads",exact:true}).click();
    const row=page.locator(".mobile-list .lead-card").filter({hasText:"Oficina Exemplo"});
    await expect(row).toBeVisible();
    await row.getByRole("button",{name:/Ver empresa/}).click();
  }else{
    await page.locator(".saas-sidebar").getByRole("button",{name:"Meus Leads",exact:true}).click();
    const row=page.locator(".desktop-table .table-row").filter({hasText:"Oficina Exemplo"});
    await expect(row).toBeVisible();
    await row.getByRole("button",{name:/Ver empresa/}).click();
  }
  const card=page.locator(".lc-check");
  await expect(card).toBeVisible();
  return card;
}

test("assisted discovery requires candidate selection, and only verified identity offers phone fill",async({page})=>{
  const calls=await mockedLogin(page);
  const card=await openLead(page);
  await expect(card.getByText("Enriquecer empresa")).toBeVisible();
  await expect(card.getByText(/Lavras \/ MG/)).toBeVisible();
  await card.getByRole("button",{name:"Encontrar CNPJ"}).click();
  await expect(card.locator(".lc-candidate")).toHaveCount(1);
  expect(calls).toContain("name_search");
  await expect(card.locator('input[name="cnpj"]')).toHaveValue("");
  await card.getByRole("button",{name:"Selecionar CNPJ"}).click();
  await expect(card.locator('input[name="cnpj"]')).toHaveValue("00.000.000/0001-91");
  await card.getByRole("button",{name:"Consultar cadastro"}).click();
  await expect(card.getByText("OFICINA EXEMPLO LTDA")).toBeVisible();
  await expect(card.getByRole("button",{name:"Preencher telefone vazio no CRM"})).toBeVisible();
  expect(calls).toContain("lookup");
  expect(calls).not.toContain("site_contacts");
  await card.getByRole("button",{name:"Preencher telefone vazio no CRM"}).click();
  await expect(card.getByText(/Telefone incluído no campo vazio do lead/)).toBeVisible();
});

test("identity mismatch hides contacts; an absent CNPJ contact can be sourced from the known site",async({page})=>{
  const calls=await mockedLogin(page,{mismatch:true,noContacts:true});
  const card=await openLead(page);
  await card.locator('input[name="cnpj"]').fill("00.000.000/0001-91");
  await card.getByRole("button",{name:"Consultar cadastro"}).click();
  await expect(card.getByText(/não corresponderam claramente/)).toBeVisible();
  await expect(card.getByRole("button",{name:"Preencher telefone vazio no CRM"})).toHaveCount(0);
  await card.getByRole("button",{name:"Procurar contatos ausentes"}).click();
  await expect(card.getByText("contato@empresa-exemplo.com.br")).toBeVisible();
  await expect(card.getByText(/E-mail encontrado em link do site/)).toBeVisible();
  expect(calls).toContain("site_contacts");
  await card.getByRole("button",{name:"Consultar estado da integração"}).click();
  await expect(card.getByText(/WhatsApp não está configurado/)).toBeVisible();
});

test("mobile display provides manual CNPJ, source and WhatsApp status without overflow",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockedLogin(page);
  const card=await openLead(page,true);
  await expect(card.getByRole("button",{name:"Encontrar CNPJ"})).toBeVisible();
  await expect(card.getByRole("button",{name:"Consultar cadastro"})).toBeVisible();
  await expect(card.getByText(/Conta WhatsApp: Não verificado/)).toBeVisible();
  await expect(card.getByText(/nenhuma.*automático|fontes identificadas/i)).toHaveCount(0);
  const horizontalOverflow=await page.evaluate(()=>
    document.documentElement.scrollWidth>document.documentElement.clientWidth+2);
  expect(horizontalOverflow).toBe(false);
});
