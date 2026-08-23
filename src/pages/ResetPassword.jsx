import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import PasswordInput from "../components/PasswordInput";

export default function ResetPassword({ onDone }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);
    if (error) {
      setError("Couldn't update the password. Try requesting a new reset link.");
    } else {
      onDone();
    }
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-plum px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="SHAN BEAUTY MAX" className="w-24 h-24 rounded-full mx-auto mb-4" />
          <p className="font-display text-3xl text-blush tracking-wide">SHAN BEAUTY MAX</p>
          <p className="font-mono text-xs text-berry-light mt-2 tracking-[0.2em] uppercase">
            Set A New Password
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-plum-light border border-white/10 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-mono text-blush/70 mb-1 uppercase tracking-wide">
              New Password
            </label>
            <PasswordInput
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg bg-plum-dark border border-white/10 px-3 py-2 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-berry"
              placeholder="••••••••"
              iconClassName="text-black/50"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-blush/70 mb-1 uppercase tracking-wide">
              Confirm New Password
            </label>
            <PasswordInput
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg bg-plum-dark border border-white/10 px-3 py-2 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-berry"
              placeholder="••••••••"
              iconClassName="text-black/50"
            />
          </div>
          {error && (
            <p className="text-sm text-red-200 bg-red-950/40 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-berry hover:bg-berry-light transition-colors text-white font-semibold py-2.5 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save New Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
