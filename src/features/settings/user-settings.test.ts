/// <reference lib="deno.ns" />
import { DEFAULT_USER_SETTINGS, isAccentColor, parseUserSettings } from "./user-settings.ts";

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
    accent_color:"blue",
    compact_mode:true,
    reduce_motion:true,
    notify_due_today:false,
    notify_overdue:false,
    admin:true,
    role:"owner",
  });
  assert(value.displayName==="Contato"&&value.homeView==="leads", "Profile/home settings");
  assert(value.accentColor==="blue", "Chosen accent should survive parsing");
  assert(value.compactMode&&value.reduceMotion, "Appearance flags");
  assert(!value.notifyDueToday&&!value.notifyOverdue, "Notification flags");
  assert(!("admin" in value)&&!("role" in value), "No privilege claims in settings");
});
Deno.test("Workspace settings reject unknown start pages and corrupt field types",()=>{
  const value=parseUserSettings({
    home_view:"maps",
    accent_color:"magenta",
    display_name:42,
    compact_mode:"true",
    reduce_motion:1,
    notify_due_today:"false",
    notify_overdue:null,
  });
  assert(value.homeView==="dashboard"&&value.displayName==="", "Unknown home page/identity");
  assert(value.accentColor==="red", "Unknown accent must fall back to default");
  assert(!value.compactMode&&!value.reduceMotion, "Only booleans enable appearance");
  assert(value.notifyDueToday&&value.notifyOverdue, "Invalid notifications fall back safely");
});

Deno.test("All eleven approved workspace accent colors are accepted and persist safely",()=>{
  const supported = [
    "green","yellow","blue","red","white","black",
    "purple","cyan","orange","pink","indigo",
  ];
  assert(supported.length===11, "Expected eleven available accent choices");
  for(const color of supported){
    assert(isAccentColor(color), "Valid accent missing: "+color);
    assert(parseUserSettings({accent_color:color}).accentColor===color,
      "Valid accent lost during parsing: "+color);
  }
  for(const value of ["ultraviolet","magenta","light",null,4,{},[]]){
    assert(!isAccentColor(value), "Unapproved accent accepted");
  }
});
