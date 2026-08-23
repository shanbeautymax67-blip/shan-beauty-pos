import { supabase } from "./supabaseClient";

const THEME_KEY = "app_theme";
const LOCAL_STORAGE_KEY = "shan_theme_v1";

// Each entry: token name -> default hex color.
export const DEFAULT_THEME = {
  plum: "#2B1024",
  "plum-light": "#3E1836",
  "plum-dark": "#1B0A17",
  berry: "#C6467A",
  "berry-light": "#E06B9C",
  "berry-dark": "#9E3661",
  ivory: "#FBF6F2",
  ink: "#241B22",
  gold: "#C9A15A",
  blush: "#F3D9E4",
};

// Human-friendly grouping/labels for the Settings UI.
export const THEME_FIELDS = [
  { key: "plum", label: "Primary (Sidebar / Headings)" },
  { key: "plum-light", label: "Primary — Light" },
  { key: "plum-dark", label: "Primary — Dark" },
  { key: "berry", label: "Accent (Buttons / Highlights)" },
  { key: "berry-light", label: "Accent — Light" },
  { key: "berry-dark", label: "Accent — Dark" },
  { key: "gold", label: "Gold Accent" },
  { key: "blush", label: "Blush Tint" },
  { key: "ivory", label: "Page Background" },
  { key: "ink", label: "Body Text" },
];

function hexToChannels(hex) {
  const h = (hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  Object.entries({ ...DEFAULT_THEME, ...theme }).forEach(([key, hex]) => {
    const channels = hexToChannels(hex);
    if (channels) root.style.setProperty(`--color-${key}`, channels);
  });
}

export function loadLocalTheme() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_THEME };
}

export function saveLocalTheme(theme) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // ignore (e.g. private browsing)
  }
}

// Apply whatever's cached locally immediately — call this as early as
// possible (before first paint) to avoid a flash of default colors.
export function applyLocalThemeSync() {
  applyTheme(loadLocalTheme());
}

export async function loadRemoteTheme() {
  try {
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", THEME_KEY)
      .maybeSingle();
    if (error || !data?.value) return null;
    const parsed = JSON.parse(data.value);
    return { ...DEFAULT_THEME, ...parsed };
  } catch {
    return null;
  }
}

export async function saveRemoteTheme(theme) {
  const { error } = await supabase.from("app_settings").upsert({
    key: THEME_KEY,
    value: JSON.stringify(theme),
    updated_at: new Date().toISOString(),
  });
  return { error };
}

// Reconciles local (instant) with remote (source of truth across devices).
// Call once after login/session is ready.
export async function syncThemeFromRemote() {
  const remote = await loadRemoteTheme();
  if (remote) {
    applyTheme(remote);
    saveLocalTheme(remote);
    return remote;
  }
  return loadLocalTheme();
}
