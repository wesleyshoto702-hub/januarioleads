/// <reference lib="deno.ns" />
const read=(p:string)=>Deno.readTextFileSync(new URL(p,import.meta.url));
function assert(condition:unknown,why:string):asserts condition{if(!condition)throw new Error(why);}
const view=read("../../features/settings/SettingsView.tsx");
const settings=read("../../features/settings/user-settings.ts");
const shell=read("./AppShell.tsx");
const particles=read("./WorkspaceAmbientParticles.tsx");
const beams=read("../../styles/workspace-header-light-trails.css");
const settingsCss=read("../../features/settings/settings.css");
const numbers=read("./AnimatedNumber.tsx");
const guide=read("./WorkspaceGuide.tsx");
Deno.test("user-facing control removes animations and uses the existing saved preference",()=>{
  assert(view.includes('title="Remover animações"'),"Missing new setting title");
  assert(view.includes('label="Remover animações"'),"Missing accessible toggle label");
  assert(!view.includes("Reduzir animações"),"Old setting still visible");
  assert(view.includes("change({reduceMotion:v})"),"Saving must keep the existing setting field");
  assert(settings.includes("reduce_motion: next.reduceMotion"),"Preference must remain persisted per user");
  assert(settings.includes("reduceMotion: row.reduce_motion === true"),"Saved choice must restore on login");
});
Deno.test("toggle eliminates CSS motion and particles without affecting navigation",()=>{
  assert(shell.includes("js-settings-remove-animations"),"Shell should expose disabled-motion state");
  assert(settingsCss.includes("animation: none !important") &&
    settingsCss.includes("transition: none !important") &&
    settingsCss.includes("scroll-behavior: auto !important"),"All CSS animations and transitions should stop");
  assert(particles.includes("return reduceMotion ? null : <canvas"),"Particle canvas must disappear entirely");
  assert(shell.includes("WorkspaceMotionContext.Provider value={reduceMotion}"),
    "Nested components should respond immediately");
});
Deno.test("animated header strokes stop and counters show final values",()=>{
  assert(beams.includes(".saas-shell.js-settings-remove-animations .jl-header-beams .jl-header-beam-pulse"),
    "No moving light on banners");
  assert(beams.includes("display: none !important"),"Hide animated strokes entirely");
  assert(numbers.includes("useContext(WorkspaceMotionContext)") &&
    numbers.includes("removeAnimations ? finalValue : displayValue"),
    "Do not run animated counters when animations are removed");
  assert(numbers.includes("format, removeAnimations"),"Counter effects must react to preference changes");
  assert(guide.includes("if (reduced) setPlaying(false)"),"Guide autoplay must stop with preference");
});
