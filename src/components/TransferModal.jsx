import { useState } from "react";

export default function TransferModal({ product, direction, onClose, onConfirm }) {
  const isToShopA = direction === "to_shop_a";
  // Sending to Shop A can't exceed what's physically here. Bringing in from
  // Shop A isn't capped — Royal Lady Cosmetics has its own stock beyond
  // whatever was previously sent, so any quantity can be brought in.
  const max = isToShopA ? Number(product.stock) : null;
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }
    if (max !== null && qty > max) {
      setError(`Only ${max} available to send.`);
      return;
    }
    setSubmitting(true);
    setError("");
    const result = await onConfirm(qty);
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 bg-plum-dark/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <p className="font-mono text-[11px] text-ink/40 uppercase tracking-widest mb-1">
          {isToShopA ? "Send to Shop A" : "Bring from Shop A"}
        </p>
        <h2 className="font-display text-lg text-heading mb-1">{product.name}</h2>
        <p className="text-xs text-ink/50 mb-4">
          {isToShopA
            ? "Royal Lady Cosmetics — this leaves this shop's stock and won't count as a sale here."
            : "Royal Lady Cosmetics — enter any quantity to restock here. It'll count in this shop's sales once sold."}
        </p>

        <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">
          Quantity{max !== null ? ` (max ${max})` : ""}
        </label>
        <div className="flex items-center gap-2 mb-3">
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
            max={max ?? undefined}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="flex-1 text-center rounded-lg border border-plum/15 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => (max !== null ? Math.min(max, Number(q) + 1) : Number(q) + 1))}
            className="w-9 h-9 rounded-lg bg-plum/5 text-plum hover:bg-plum/10 font-semibold"
          >
            +
          </button>
        </div>

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
            disabled={submitting || (max !== null && max <= 0)}
            className="px-5 py-2 rounded-lg bg-berry hover:bg-berry-light text-white text-sm font-semibold disabled:opacity-50"
          >
            {submitting ? "Working…" : isToShopA ? "Send" : "Bring in"}
          </button>
        </div>
      </div>
    </div>
  );
}
