import { getValidSession } from "../../lib/auth";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "../../lib/supabase-config";

/** Each row is owned by auth.uid(); never store role/plan/privileged settings here. */
export type SettingsHomeView =
  | "dashboard" | "leads" | "search" | "prospecting"
  | "opportunities" | "messages" | "finance";
export type AccentColor = "green" | "yellow" | "blue" | "red" | "white";
export const ACCENT_COLORS: readonly AccentColor[] = ["green","yellow","blue","red","white"];
export function isAccentColor(value:unknown): value is AccentColor {
  return typeof value === "string" && ACCENT_COLORS.includes(value as AccentColor);
}
export type UserSettings = {
  accentColor: AccentColor;
  displayName: string;
  homeView: SettingsHomeView;
  compactMode: boolean;
  reduceMotion: boolean;
  notifyDueToday: boolean;
  notifyOverdue: boolean;
};
export const DEFAULT_USER_SETTINGS: Readonly<UserSettings> = Object.freeze({
  accentColor: "red",
  displayName: "",
  homeView: "dashboard",
  compactMode: false,
  reduceMotion: false,
  notifyDueToday: true,
  notifyOverdue: true,
});
const HOME_VIEWS: SettingsHomeView[] = [
  "dashboard","leads","search","prospecting","opportunities","messages","finance",
];
type SettingsRow = {
  user_id: string;
  display_name: string;
  home_view: string;
  accent_color: string;
  compact_mode: boolean;
  reduce_motion: boolean;
  notify_due_today: boolean;
  notify_overdue: boolean;
};

export function parseUserSettings(value: unknown): UserSettings {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return { ...DEFAULT_USER_SETTINGS };
  const row = value as Partial<SettingsRow>;
  return {
    accentColor: isAccentColor(row.accent_color) ? row.accent_color : "red",
    displayName: typeof row.display_name === "string" ? row.display_name.slice(0,80) : "",
    homeView: HOME_VIEWS.includes(row.home_view as SettingsHomeView)
      ? row.home_view as SettingsHomeView : "dashboard",
    compactMode: row.compact_mode === true,
    reduceMotion: row.reduce_motion === true,
    notifyDueToday: row.notify_due_today !== false,
    notifyOverdue: row.notify_overdue !== false,
  };
}
function validateSettings(value: UserSettings): UserSettings {
  const displayName = value.displayName.trim();
  if (displayName.length > 80)
    throw new Error("O nome de exibição deve ter até 80 caracteres.");
  if (!isAccentColor(value.accentColor))
    throw new Error("Selecione uma das cinco cores disponíveis.");
  if (!HOME_VIEWS.includes(value.homeView))
    throw new Error("A página inicial selecionada é inválida.");
  return { ...value, displayName };
}

export async function loadUserSettings(): Promise<UserSettings> {
  const session = await getValidSession();
  if (!session) throw new Error("Sua sessão expirou. Faça login novamente.");
  const response = await fetch(
    SUPABASE_URL + "/rest/v1/user_settings?select=*&user_id=eq." + encodeURIComponent(session.user.id) + "&limit=1",
    { cache: "no-store", headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: "Bearer " + session.accessToken,
    }},
  );
  if (!response.ok) throw new Error("Não foi possível carregar suas configurações. Tente novamente.");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Resposta inesperada ao carregar configurações.");
  return parseUserSettings(data[0]);
}

export async function saveUserSettings(value: UserSettings): Promise<UserSettings> {
  const next = validateSettings(value);
  const session = await getValidSession();
  if (!session) throw new Error("Sua sessão expirou. Faça login novamente.");
  const response = await fetch(SUPABASE_URL + "/rest/v1/user_settings?on_conflict=user_id", {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: "Bearer " + session.accessToken,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      user_id: session.user.id,
      display_name: next.displayName,
      accent_color: next.accentColor,
      home_view: next.homeView,
      compact_mode: next.compactMode,
      reduce_motion: next.reduceMotion,
      notify_due_today: next.notifyDueToday,
      notify_overdue: next.notifyOverdue,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error("Não foi possível salvar as alterações no Supabase.");
  const data: unknown = await response.json();
  if (!Array.isArray(data) || data.length !== 1 ||
      (data[0] as Partial<SettingsRow>)?.user_id !== session.user.id)
    throw new Error("O Supabase não confirmou o salvamento da sua conta.");
  return parseUserSettings(data[0]);
}
