/// <reference lib="deno.ns" />

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}
const read = (path: string) => Deno.readTextFileSync(new URL(path, import.meta.url));
const settings = read("../../features/settings/user-settings.ts");
const accentList = settings.match(/export const ACCENT_COLORS = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
const supportedAccents = [...accentList.matchAll(/"([a-z]+)"/g)].map(x => x[1]);
const component = read("./WorkspaceAmbientParticles.tsx");
const shell = read("./AppShell.tsx");
const appRoute = read("../../routes/app.tsx");
const styles = read("../../styles/workspace-ambient-particles.css");
const routes = read("../../lib/route-styles.ts");

Deno.test("background is mounted only in authenticated SaaS main, never in sidebar or homepage", () => {
  assert(shell.includes('<div className="saas-main">\n        <WorkspaceAmbientParticles'),
    "The effect must be inside the main area, not the Workspace sidebar");
  assert(shell.indexOf("<WorkspaceAmbientParticles") > shell.indexOf('<div className="saas-main">'),
    "Effect belongs to content column only");
  assert(routes.includes("stylesheet(workspaceAmbientCss)") &&
    !routes.slice(routes.indexOf("export const MARKETING_STYLES")).includes("workspaceAmbientCss"),
    "Only authenticated app styles may load the animation");
  assert(!component.includes("window.innerWidth") && !component.includes("fixed inset-0"),
    "Do not size the canvas to cover the whole website");
});

Deno.test("all fourteen user colors and motion preference flow through the authenticated shell", () => {
  assert(supportedAccents.length === 14, "All fourteen accents must remain supported");
  assert(appRoute.includes("accentColor={userSettings.accentColor}"),
    "Use the persisted accent color");
  assert(shell.includes("accentColor={accentColor} reduceMotion={reduceMotion}"),
    "Forward both controls");
  assert(component.includes('getPropertyValue("--primary")'),
    "Use the current CSS primary token, not a hard-coded color");
  assert(component.includes("prefers-reduced-motion") && component.includes("document.hidden"),
    "Respect both OS motion preferences and hidden-tab pause");
});

Deno.test("ambient particles cannot cover buttons or invade sidebar", () => {
  assert(styles.includes("pointer-events: none"), "No pointer interaction is allowed");
  assert(styles.includes("position: fixed") && styles.includes("left: var(--saas-sidebar-width)") &&
    styles.includes("width: calc(100vw - var(--saas-sidebar-width))"),
    "Keep the backdrop visible when scrolling and confined to the main column");
  assert(styles.includes("@media (max-width: 900px)") && styles.includes("left: 0"),
    "Adapt to collapsed sidebar without covering interactive navigation");
  assert(styles.includes(".saas-main > .saas-main-inner") &&
    styles.includes("z-index: 1"), "Workspace content must stack above the canvas");
  assert(styles.includes(".saas-main > .jl-topbar") &&
    styles.includes("z-index: 2"), "Controls must stack above the canvas");
  assert(component.includes("clearRect") && !component.includes("fillRect"),
    "Never paint opaque backgrounds over existing workspace visual elements");
});

Deno.test("particles remain noticeable without covering business cards or controls", () => {
  assert(styles.includes("opacity: .84"), "Ambient desktop background must not disappear in the dark theme");
  assert(component.includes("Math.min(width < 640 ? 22 : 54"), "Particle density must fill empty main-area gaps");
  assert(component.includes("pointer-events") === false || styles.includes("pointer-events: none"),
    "The canvas must never intercept interactions");
  assert(!component.includes("fillRect"), "Backdrop must stay transparent over workspace surfaces");
});
