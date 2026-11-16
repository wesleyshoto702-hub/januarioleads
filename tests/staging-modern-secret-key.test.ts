import {selectInternalSupabaseCredential} from "../supabase/functions/_shared/internal-supabase-credential.ts";
function assert(v:unknown,msg:string):asserts v{if(!v)throw new Error(msg);}
Deno.test("prefer modern secret even if legacy service_role is still present",()=>{
 const modern="sb_secret_TEST_MODERN";
 const legacy="eyJTEST_LEGACY";
 const c=selectInternalSupabaseCredential(JSON.stringify({default:modern}),legacy);
 assert(c?.key===modern,"Modern key did not win");
 assert(c.authorization===null,"Modern key must not be sent as a Bearer JWT");
 assert(c.kind==="modern_secret","Credential type incorrect");
});
Deno.test("modern named key picks default, never publishable key",()=>{
 const modern="sb_secret_DEFAULT_TEST";
 const c=selectInternalSupabaseCredential(JSON.stringify({fallback:"sb_secret_OTHER_TEST",default:modern}),"eyJTEST_LEGACY");
 assert(c?.key===modern,"Did not choose named default");
 const missing=selectInternalSupabaseCredential(JSON.stringify({default:"sb_publishable_PUBLIC"}),undefined);
 assert(missing===null,"Public key must not be accepted as admin credential");
});
Deno.test("legacy fallback available only during migration",()=>{
 const legacy="eyJTEST_LEGACY";
 const c=selectInternalSupabaseCredential("broken-json",legacy);
 assert(c?.key===legacy && c.authorization==="Bearer "+legacy,"Legacy fallback broken");
 assert(c.kind==="legacy_service_role","Wrong fallback type");
});
Deno.test("no key fails closed",()=>{
 assert(selectInternalSupabaseCredential(undefined,undefined)===null,"Missing credentials must fail closed");
 assert(selectInternalSupabaseCredential("{}", "not-a-jwt")===null,"Malformed key accepted");
});

Deno.test("staging search-places excludes legacy service_role from its selector",async()=>{
 const source=await Deno.readTextFile(new URL("../supabase/functions/search-places/index.ts",import.meta.url));
 assert(source.includes('const isJanuarioStaging = url === "https://prlrxjothrslhswpkoza.supabase.co"'),
   "Staging must be identified by exact project URL");
 assert(source.includes('isJanuarioStaging ? undefined : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")'),
   "Legacy key must not be passed to selector on staging");
 assert(selectInternalSupabaseCredential('{"default":"sb_publishable_TEST"}',undefined)===null,
   "A publishable key must not become a privileged staging credential");
 assert(selectInternalSupabaseCredential("broken-json",undefined)===null,
   "Missing/malformed modern keys must not allow access in staging");
});
