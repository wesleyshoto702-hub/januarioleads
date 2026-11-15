/// <reference lib="deno.ns" />
const read=(p:string)=>Deno.readTextFileSync(new URL(p,import.meta.url));
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(message);}
const types=read("./user-settings.ts");
const view=read("./SettingsView.tsx");
const css=read("../../styles.css");
const settingsCss=read("./settings.css");
const animation=read("../../components/app-shell/WorkspaceAmbientParticles.tsx");
const banner=read("../../components/app-shell/HeaderLightTrails.tsx");
const app=read("../../routes/app.tsx");
const newColors:Record<string,string>={
  turquoise:"#14b8a6",ruby:"#a83f65",bronze:"#b88a55"
};
Deno.test("the exact 14 color options are supported, displayed and persisted",()=>{
  const list=types.match(/export const ACCENT_COLORS = \[([\s\S]*?)\] as const;/)?.[1]??"";
  const accents=[...list.matchAll(/"([a-z]+)"/g)].map(m=>m[1]);
  assert(accents.length===14&&new Set(accents).size===14,
    "Expected exactly fourteen unique theme options");
  for(const [key,hex] of Object.entries(newColors)){
    assert(accents.includes(key),"Missing persisted color "+key);
    assert(css.includes(`data-jl-accent="${key}"`),"Missing CSS variables for "+key);
    assert(css.includes(`--primary:${hex}`),"Expected primary color "+hex);
    assert(settingsCss.includes(`.is-${key}{--swatch:${hex}}`),
      "Color picker swatch does not match the selected theme");
    assert(view.includes(`value:"${key}"`),"New color not visible in preferences");
  }
  assert(types.includes("isAccentColor(row.accent_color)")&&
    types.includes("accent_color: next.accentColor"),
    "Both load and save must preserve the selected color");
});
Deno.test("all background effects track the selected theme without separate palettes",()=>{
  assert(app.includes("setAttribute(\"data-jl-accent\",userSettings.accentColor)"),
    "Use saved theme as the one source of truth");
  assert(app.includes("accentColor={userSettings.accentColor}"),
    "Pass saved color to the ambient canvas");
  assert(animation.includes('getPropertyValue("--primary")'),
    "Canvas must redraw using the active CSS token");
  assert(animation.includes("}, [accentColor, reduceMotion]);"),
    "Changing accent must restart the canvas");
  assert(banner.includes('stopColor="var(--primary)"')&&
    banner.includes('stroke="var(--primary)"'),
    "Animated banner beams should inherit the selected color");
});
