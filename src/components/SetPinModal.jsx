import { useState } from "react";
import { setPin } from "../lib/pinUtils";

export default function SetPinModal({ hasExistingPin, onClose, onDone }) {
  const [pin, setPinValue] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs don't match.");
      return;
    }
    setSaving(true);
    setError("");
    await setPin(pin);
    setSaving(false);
    onDone();
  }

  return (
    <div className="fixed inset-0 bg-plum-dark/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <p className="font-mono text-[11px] text-ink/40 uppercase tracking-widest mb-1">
          {hasExistingPin ? "Change PIN" : "Set a PIN"}
        </p>
        <h2 className="font-display text-lg text-plum mb-1">Protect destructive actions</h2>
        <p className="text-xs text-ink/50 mb-4">
          This PIN will be required before clearing products or resetting test data.
        </p>

        <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">New PIN</label>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPinValue(e.target.value)}
          className="w-full rounded-lg border border-plum/15 px-3 py-2 mb-3 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-berry"
          placeholder="••••"
        />
        <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">Confirm PIN</label>
        <input
          type="password"
          inputMode="numeric"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          className="w-full rounded-lg border border-plum/15 px-3 py-2 mb-3 font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-berry"
          placeholder="••••"
        />

        {error && (
          <p className="text-xs text-berry-dark bg-berry/10 border border-berry/30 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm text-ink/60 hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-berry hover:bg-berry-light text-white text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save PIN"}
          </button>
        </div>
      </div>
    </div>
  );
}
