import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import PasswordInput from "../components/PasswordInput";

async function lookupEmailForUsername(rawUsername) {
  const { data, error } = await supabase
    .from("login_usernames")
    .select("user_email")
    .eq("username", rawUsername.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data.user_email;
}

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "forgot"

  // Sign-in state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Forgot-password state
  const [resetUsername, setResetUsername] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Usernames map to a real email behind the scenes (Supabase Auth
    // itself only understands email/phone), so look that up first.
    const email = await lookupEmailForUsername(username);
    if (!email) {
      setLoading(false);
      setError("Username or password is incorrect.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Username or password is incorrect.");
  }

  async function handleSendReset(e) {
    e.preventDefault();
    setResetMessage(null);
    setResetSending(true);

    const email = await lookupEmailForUsername(resetUsername);
    setResetSending(false);

    // Same message whether or not the username exists, so this can't be
    // used to check which usernames are registered.
    if (!email) {
      setResetMessage({
        type: "success",
        text: "If that username exists, a reset link has been sent to its email.",
      });
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    setResetMessage(
      error
        ? { type: "error", text: "Couldn't send the reset email. Try again shortly." }
        : {
            type: "success",
            text: "If that username exists, a reset link has been sent to its email.",
          }
    );
  }

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-plum px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="SHAN BEAUTY MAX" className="w-24 h-24 rounded-full mx-auto mb-4" />
          <p className="font-display text-3xl text-blush tracking-wide">SHAN BEAUTY MAX</p>
          <p className="font-mono text-xs text-berry-light mt-2 tracking-[0.2em] uppercase">
            Point of Sale
          </p>
        </div>

        {mode === "login" ? (
          <form
            onSubmit={handleSubmit}
            className="bg-plum-light border border-white/10 rounded-2xl p-6 space-y-4"
          >
            <div>
              <label className="block text-xs font-mono text-blush/70 mb-1 uppercase tracking-wide">
                Username
              </label>
              <input
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg bg-plum-dark border border-white/10 px-3 py-2 text-ivory focus:outline-none focus:ring-2 focus:ring-berry"
                placeholder="yourname"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-mono text-blush/70 uppercase tracking-wide">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError("");
                    setResetMessage(null);
                    setResetUsername(username);
                  }}
                  className="text-xs text-berry-light hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <PasswordInput
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-plum-dark border border-white/10 px-3 py-2 text-ivory focus:outline-none focus:ring-2 focus:ring-berry"
                placeholder="••••••••"
                iconClassName="text-blush/60"
              />
            </div>
            {error && (
              <p className="text-sm text-berry-light bg-berry/10 border border-berry/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-berry hover:bg-berry-light transition-colors text-white font-semibold py-2.5 disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={handleSendReset}
            className="bg-plum-light border border-white/10 rounded-2xl p-6 space-y-4"
          >
            <p className="text-sm text-blush/80">
              Enter your username and we'll email a password reset link to the address on your
              account.
            </p>
            <div>
              <label className="block text-xs font-mono text-blush/70 mb-1 uppercase tracking-wide">
                Username
              </label>
              <input
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                value={resetUsername}
                onChange={(e) => setResetUsername(e.target.value)}
                className="w-full rounded-lg bg-plum-dark border border-white/10 px-3 py-2 text-ivory focus:outline-none focus:ring-2 focus:ring-berry"
                placeholder="yourname"
              />
            </div>
            {resetMessage && (
              <p
                className={`text-sm rounded-lg px-3 py-2 border ${
                  resetMessage.type === "error"
                    ? "text-berry-light bg-berry/10 border-berry/30"
                    : "text-blush bg-white/5 border-white/10"
                }`}
              >
                {resetMessage.text}
              </p>
            )}
            <button
              type="submit"
              disabled={resetSending}
              className="w-full rounded-lg bg-berry hover:bg-berry-light transition-colors text-white font-semibold py-2.5 disabled:opacity-50"
            >
              {resetSending ? "Sending…" : "Send Reset Link"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setResetMessage(null);
              }}
              className="w-full text-center text-xs text-berry-light hover:underline"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
