import { allowsMutatingRequest } from "./bff-session-cookie.server";

// Production only. Fixed upstream: never accept a host/path from the caller.
// The Edge Function still verifies the caller JWT, private_access and quotas.
const UPSTREAM = "https://czkazbianiflhldenhcj.supabase.co/functions/v1/search-places";
function fail(status: number, code: string, message: string) {
  return Response.json({ok:false,code,message},{status,headers:{"Cache-Control":"no-store"}});
}
export async function handleSearchProxy(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  if(request.method !== "POST") return fail(405,"INVALID_REQUEST","Método não permitido.");
  if(!allowsMutatingRequest(request)) return fail(403,"FORBIDDEN","Origem não autorizada.");
  const token = request.headers.get("authorization") ?? "";
  const key = request.headers.get("apikey") ?? "";
  if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length>16384)
    return fail(401,"AUTH_REQUIRED","Sua sessão expirou. Entre novamente.");
  if(!key || key.length>4096) return fail(400,"INVALID_REQUEST","Chave pública ausente.");
  try {
    const body=await request.text();
    if(new TextEncoder().encode(body).byteLength>65536)
      return fail(413,"INVALID_REQUEST","Solicitação muito grande.");
    const payload:unknown=JSON.parse(body);
    if(!payload || typeof payload!=="object" || Array.isArray(payload))
      return fail(400,"INVALID_REQUEST","Solicitação inválida.");
    const input=payload as Record<string,unknown>;
    if(typeof input.segment!=="string" || typeof input.city!=="string" || typeof input.state!=="string" ||
       (input.pageToken!==undefined && typeof input.pageToken!=="string"))
      return fail(400,"INVALID_REQUEST","Informe nicho, cidade e UF.");
    // Accept only segment-search fields, never other Edge Function modes.
    const upstream=await fetcher(UPSTREAM,{method:"POST",redirect:"error",
      headers:{apikey:key,Authorization:token,"Content-Type":"application/json"},
      body:JSON.stringify({segment:input.segment,city:input.city,state:input.state,
        ...(typeof input.pageToken==="string"?{pageToken:input.pageToken}:{})}),
      signal:AbortSignal.timeout(27000)});
    const data=await upstream.text();
    if(!upstream.headers.get("content-type")?.includes("application/json"))
      return fail(502,"REQUEST_FAILED","O serviço de busca retornou uma resposta inesperada.");
    return new Response(data,{status:upstream.status,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}});
  } catch {
    return fail(503,"REQUEST_FAILED","O backend de busca está temporariamente indisponível.");
  }
}
