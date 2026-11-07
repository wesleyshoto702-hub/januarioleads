import { prepareGoogleOAuth, requestPublicSignup } from "./public-registration.ts";

const requestEmail = "teste@example.invalid";
const strongPass = "SenhaMuitoForte123!";
const origin = "http://127.0.0.1:5173";

Deno.test("cadastro cria apenas a identidade Auth e nunca importa tokens para o CRM", async () => {
  let requests = 0;
  const fake = (async (request: string | URL | Request, init?: RequestInit) => {
    requests++;
    const url = new URL(String(request));
    if (url.pathname !== "/auth/v1/signup" || url.searchParams.get("redirect_to") !== origin + "/login") {
      throw new Error("Wrong endpoint");
    }
    if (init?.method !== "POST" || init.credentials !== "omit") {
      throw new Error("Must be a client sign-up without cookies");
    }
    const body = JSON.parse(String(init.body)) as { email:string;password:string;data:{full_name:string} };
    if (body.email !== requestEmail || body.password !== strongPass ||
        body.data.full_name !== "Teste Pessoa") {
      throw new Error("Unexpected sign-up request");
    }
    return Response.json({ access_token: "DO_NOT_STORE", refresh_token:"DO_NOT_STORE" });
  }) as typeof fetch;
  const result=await requestPublicSignup("  Teste   Pessoa ", " TESTE@EXAMPLE.INVALID ", strongPass, origin, fake);
  if (!result.ok || requests !== 1 || Object.keys(result).length !== 1) throw new Error("Invalid signup behavior");
});

Deno.test("cadastro não envia credenciais fracas, formulário ou origem invalidos", async () => {
  let requests=0;
  const fake=(async () => { requests++; throw new Error("Never send"); }) as typeof fetch;
  const cases=[
    ["",requestEmail,strongPass,origin],
    ["Teste Pessoa","invalid",strongPass,origin],
    ["Teste Pessoa",requestEmail,"short",origin],
    ["Teste Pessoa",requestEmail,strongPass,"https://evil.test/steal"],
    ["Teste Pessoa",requestEmail,strongPass,"http://evil.test"],
  ];
  for(const [name,email,password,redirect] of cases) {
    const r=await requestPublicSignup(name!,email!,password!,redirect!,fake);
    if(r.ok) throw new Error("Bad signup accepted");
  }
  if(requests!==0)throw new Error("Unsafe signup attempted HTTP");
});

Deno.test("falhas do Auth não vazam se o endereço já existe", async () => {
  const response=await requestPublicSignup("Teste Pessoa",requestEmail,strongPass,origin,
    (async()=>Response.json({msg:"User already registered"}, {status:400})) as typeof fetch);
  if(response.ok || response.message.includes("already registered")) throw new Error("Exposed account enumeration");
  const throttle=await requestPublicSignup("Teste Pessoa",requestEmail,strongPass,origin,
    (async()=>new Response("",{status:429})) as typeof fetch);
  if(throttle.ok || !throttle.message.includes("Aguarde"))throw new Error("Rate limit not handled");
});

Deno.test("Google usa PKCE S256, estado aleatório e callback local confiável", async () => {
  let stored:Record<string,string>={};
  const storage={setItem:(key:string,value:string)=>{stored[key]=value}};
  const r=await prepareGoogleOAuth(origin,storage);
  if(!r.ok || !r.url)throw new Error("Google redirect not generated");
  const url=new URL(r.url);
  if(url.pathname!=="/auth/v1/authorize" || url.searchParams.get("provider")!=="google" ||
     url.searchParams.get("flow_type")!=="pkce" ||
     url.searchParams.get("code_challenge_method")!=="s256" ||
     !url.searchParams.get("code_challenge"))throw new Error("PKCE parameters missing");
  const redirect=new URL(url.searchParams.get("redirect_to")!);
  const pending=JSON.parse(Object.values(stored)[0]!) as {state:string;verifier:string};
  if(redirect.origin!==origin || redirect.pathname!=="/auth/retorno" ||
     redirect.searchParams.get("state")!==pending.state || pending.verifier.length<43) {
    throw new Error("Callback verification incomplete");
  }
});
