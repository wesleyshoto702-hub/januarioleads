/// <reference lib="deno.ns" />
import { DEFAULT_USER_SETTINGS, parseUserSettings } from "./user-settings.ts";

function assert(value:unknown,message:string){
  if(!value)throw new Error(message);
}
Deno.test("Workspace settings use safe defaults for an empty account",()=>{
  const actual=parseUserSettings(undefined);
  assert(JSON.stringify(actual)===JSON.stringify(DEFAULT_USER_SETTINGS),
    "New accounts should have safe defaults and dashboard homepage");
});
Deno.test("Workspace settings parse only supported public preference fields",()=>{
  const value=parseUserSettings({
    display_name:"Contato",
    home_view:"leads",
    compact_mode:true,
    reduce_motion:true,
    notify_due_today:false,
    notify_overdue:false,
    admin:true,
    role:"owner",
  });
  assert(value.displayName==="Contato"&&value.homeView==="leads", "Profile/home settings");
  assert(value.compactMode&&value.reduceMotion, "Appearance flags");
  assert(!value.notifyDueToday&&!value.notifyOverdue, "Notification flags");
  assert(!("admin" in value)&&!("role" in value), "No privilege claims in settings");
});
Deno.test("Workspace settings reject unknown start pages and corrupt field types",()=>{
  const value=parseUserSettings({
    home_view:"maps",
    display_name:42,
    compact_mode:"true",
    reduce_motion:1,
    notify_due_today:"false",
    notify_overdue:null,
  });
  assert(value.homeView==="dashboard"&&value.displayName==="", "Unknown home page/identity");
  assert(!value.compactMode&&!value.reduceMotion, "Only booleans enable appearance");
  assert(value.notifyDueToday&&value.notifyOverdue, "Invalid notifications fall back safely");
});
