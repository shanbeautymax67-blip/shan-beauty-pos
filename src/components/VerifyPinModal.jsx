import { useState } from "react";
import { verifyPin } from "../lib/pinUtils";

export default function VerifyPinModal({ title, description, confirmLabel, requireTyped, onClose, onConfirmed }) {
  const [pin, setPin] = useState("");
  const [typedConfirm, setTypedConfirm] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  async function handleConfirm() {
    if (requireTyped && typedConfirm.trim().toUpperCase() !== "DELETE") {
      setError('Type "DELETE" to confirm.');
      return;
    }
    setChecking(true);
    setError("");
    const ok = await verifyPin(pin);
    setChecking(false);
    if (!ok) {
      setError("Incorrect PIN.");
      return;
    }
    onConfirmed();
  }

  return (
    <div className="fixed inset-0 bg-plum-dark/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <p className="font-mono text-[11px] text-berry-dark uppercase tracking-widest mb-1">
          PIN required
        </p>
        <h2 className="font-display text-lg text-plum mb-1">{title}</h2>
        <p className="text-xs text-ink/50 mb-4">{description}</p>

        <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">Enter PIN</label>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full rounded-lg border border-plum/15 px-3 py-2 mb-3 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-berry"
          placeholder="••••"
        />

        {requireTyped && (
          <>
            <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">
              Type DELETE to confirm
            </label>
            <input
              type="text"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              className="w-full rounded-lg border border-plum/15 px-3 py-2 mb-3 font-mono focus:outline-none focus:ring-2 focus:ring-berry"
              placeholder="DELETE"
            />
          </>
        )}

        {error && (
          <p className="text-xs text-berry-dark bg-berry/10 border border-berry/30 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={checking}
            className="px-4 py-2 rounded-lg text-sm text-ink/60 hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={checking}
            className="px-5 py-2 rounded-lg bg-berry-dark hover:bg-berry text-white text-sm font-semibold disabled:opacity-50"
          >
            {checking ? "Checking…" : confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
