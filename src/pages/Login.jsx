import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
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
        <form
          onSubmit={handleSubmit}
          className="bg-plum-light border border-white/10 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-mono text-blush/70 mb-1 uppercase tracking-wide">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-plum-dark border border-white/10 px-3 py-2 text-ivory focus:outline-none focus:ring-2 focus:ring-berry"
              placeholder="you@shanbeautymax.co.ke"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-blush/70 mb-1 uppercase tracking-wide">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-plum-dark border border-white/10 px-3 py-2 text-ivory focus:outline-none focus:ring-2 focus:ring-berry"
              placeholder="••••••••"
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
      </div>
    </div>
  );
}
