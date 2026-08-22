import { useState } from "react";

export default function AddStockModal({ product, onClose, onConfirm }) {
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await onConfirm(qty);
    setSubmitting(false);
    if (result?.error) setError(result.error);
  }

  const newTotal = Number(product.stock) + (Number(quantity) || 0);

  return (
    <div className="fixed inset-0 bg-plum-dark/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <p className="font-mono text-[11px] text-ink/40 uppercase tracking-widest mb-1">
          Add Stock
        </p>
        <h2 className="font-display text-lg text-plum mb-1">{product.name}</h2>
        <p className="text-xs text-ink/50 mb-4">
          Currently {product.stock} in stock. Enter how many are being added.
        </p>

        <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">Quantity to add</label>
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, Number(q) - 1))}
            className="w-9 h-9 rounded-lg bg-plum/5 text-plum hover:bg-plum/10 font-semibold"
          >
            −
          </button>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="flex-1 text-center rounded-lg border border-plum/15 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => Number(q) + 1)}
            className="w-9 h-9 rounded-lg bg-plum/5 text-plum hover:bg-plum/10 font-semibold"
          >
            +
          </button>
        </div>
        <p className="text-xs text-ink/40 mb-3">New total: {newTotal}</p>

        {error && (
          <p className="text-xs text-berry-dark bg-berry/10 border border-berry/30 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm text-ink/60 hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-berry hover:bg-berry-light text-white text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? "Working…" : "Add Stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
