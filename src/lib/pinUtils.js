import { supabase } from "./supabaseClient";

const SETTINGS_KEY = "destructive_pin_hash";

async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getPinHash() {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  return data?.value || null;
}

export async function isPinSet() {
  const hash = await getPinHash();
  return !!hash;
}

export async function setPin(pin) {
  const hash = await sha256(pin);
  await supabase.from("app_settings").upsert({
    key: SETTINGS_KEY,
    value: hash,
    updated_at: new Date().toISOString(),
  });
}

export async function verifyPin(pin) {
  const hash = await getPinHash();
  if (!hash) return false;
  const candidate = await sha256(pin);
  return candidate === hash;
}
