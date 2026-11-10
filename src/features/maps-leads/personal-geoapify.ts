import { getAccessToken } from "../../lib/auth";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "../../lib/supabase-config";

export type PersonalGeoapifyPlace = {
  source: "geoapify";
  sourceId: string;
  name: string;
  category: string | null;
  address: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
};
export type PersonalGeoapifyResponse =
  | {ok:true;provider:"geoapify";places:PersonalGeoapifyPlace[];limit:25;source:string}
  | {ok:false;code:string;message:string};

export async function searchPersonalGeoapify(input:{
  city:string;state:string;segment:string;neighborhood:string;
}):Promise<PersonalGeoapifyResponse>{
  const token=await getAccessToken();
  if(!token)return {ok:false,code:"AUTH_REQUIRED",message:"Sua sessão expirou."};
  try{
    const response=await fetch(SUPABASE_URL+"/functions/v1/geoapify-personal",{
      method:"POST",cache:"no-store",
      headers:{
        authorization:"Bearer "+token,
        apikey:SUPABASE_PUBLISHABLE_KEY,
        "content-type":"application/json",
      },
      body:JSON.stringify(input),
    });
    const raw:unknown=await response.json();
    if(!raw||typeof raw!=="object"||!("ok" in raw))throw Error("INVALID_DATA");
    const data=raw as Record<string,unknown>;
    if(data["ok"]!==true){
      return {
        ok:false,
        code:typeof data["code"]==="string"?data["code"]:"REQUEST_FAILED",
        message:typeof data["message"]==="string"?data["message"]:"Fonte Geoapify indisponível.",
      };
    }
    if(!Array.isArray(data["places"]))throw Error("INVALID_PLACES");
    return {
      ok:true,provider:"geoapify",limit:25,
      source:"Geoapify / © OpenStreetMap contributors",
      places:data["places"] as PersonalGeoapifyPlace[],
    };
  }catch{
    return {ok:false,code:"REQUEST_FAILED",
      message:"Não foi possível consultar o Geoapify agora."};
  }
}

/**
 * Checks only the existence of the server-side Geoapify secret.
 * Requires the original owner session; never spends search quota or provider credits.
 */
export type PersonalGeoapifyConfigStatus =
  | { ok: true; configured: boolean; provider: "geoapify"; dailyLimit: number }
  | { ok: false; code: string; message: string };

export async function checkPersonalGeoapifyConfig(): Promise<PersonalGeoapifyConfigStatus> {
  const token = await getAccessToken();
  if (!token) return { ok: false, code: "AUTH_REQUIRED", message: "Entre novamente na sua conta para verificar a configuração." };
  try {
    const response = await fetch(SUPABASE_URL + "/functions/v1/geoapify-personal", {
      method: "POST", cache: "no-store",
      headers: {
        authorization: "Bearer " + token,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "status" }),
    });
    const data: unknown = await response.json();
    if (data && typeof data === "object") {
      const payload = data as Record<string, unknown>;
      if (response.ok && payload["ok"] === true && typeof payload["configured"] === "boolean")
        return { ok: true, configured: payload["configured"], provider: "geoapify", dailyLimit: 10 };
      if (payload["ok"] === false)
        return {
          ok: false,
          code: typeof payload["code"] === "string" ? payload["code"] : "REQUEST_FAILED",
          message: typeof payload["message"] === "string" ? payload["message"] : "Não foi possível verificar a chave Geoapify.",
        };
    }
    return { ok: false, code: "REQUEST_FAILED", message: "A função não respondeu ao diagnóstico. Verifique a publicação no Supabase." };
  } catch {
    return { ok: false, code: "REQUEST_FAILED", message: "Não foi possível conectar ao diagnóstico Geoapify." };
  }
}
