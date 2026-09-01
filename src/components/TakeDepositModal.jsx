import { useState } from "react";

const money = (n) => `KES ${Number(n).toFixed(2)}`;

// Reused inside Make Sale: takes the current cart + total and lets the
// cashier record a deposit — optional customer name/phone, and how much
// is being paid now (cash / M-Pesa / split). The product(s) are reserved
// (deducted from stock) as soon as this is confirmed.
export default function TakeDepositModal({ total, onClose, onConfirm }) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [payment, setPayment] = useState("cash"); // cash | mpesa | split
  const [amount, setAmount] = useState("");
  const [splitCash, setSplitCash] = useState("");
  const [splitMpesa, setSplitMpesa] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const cashAmount = payment === "split" ? Number(splitCash || 0) : payment === "cash" ? Number(amount || 0) : 0;
  const mpesaAmount = payment === "split" ? Number(splitMpesa || 0) : payment === "mpesa" ? Number(amount || 0) : 0;
  const depositAmount = cashAmount + mpesaAmount;
  const balanceAfter = Math.max(0, total - depositAmount);

  async function handleConfirm() {
    setError("");
    if (depositAmount <= 0) {
      setError("Enter how much the customer is paying now.");
      return;
    }
    if (depositAmount > total) {
      setError(`Deposit can't be more than the total (${money(total)}).`);
      return;
    }
    setSubmitting(true);
    const result = await onConfirm({
      customerName,
      customerPhone,
      cashAmount,
      mpesaAmount,
    });
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 bg-plum-dark/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
        <p className="font-mono text-[11px] text-ink/40 uppercase tracking-widest mb-1">
          Take Deposit
        </p>
        <h2 className="font-display text-lg text-heading mb-1">Reserve for a customer</h2>
        <p className="text-xs text-ink/50 mb-4">
          The item(s) are removed from stock right away so they stay reserved. This
          won't count as a sale or profit until the balance is paid in full.
        </p>

        <div className="flex justify-between text-sm font-mono mb-4 bg-plum/5 rounded-lg px-3 py-2">
          <span className="text-ink/60">Total price</span>
          <span className="text-blue-700 font-semibold">{money(total)}</span>
        </div>

        <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">
          Customer name (optional)
        </label>
        <input
          type="text"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="e.g. Mary"
          className="w-full rounded-lg border border-plum/15 px-3 py-2 mb-3 text-sm focus:outline-none focus:ring-2 focus:ring-berry"
        />

        <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">
          Phone number (optional)
        </label>
        <input
          type="text"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          placeholder="e.g. 07xx xxx xxx"
          className="w-full rounded-lg border border-plum/15 px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-berry"
        />

        <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">
          Paying now via
        </label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { id: "cash", label: "Cash" },
            { id: "mpesa", label: "M-Pesa" },
            { id: "split", label: "Split" },
          ].map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => {
                setPayment(method.id);
                setAmount("");
                setSplitCash("");
                setSplitMpesa("");
              }}
              className={`rounded-lg py-2 text-xs font-mono uppercase tracking-wide border ${
                payment === method.id
                  ? "bg-plum text-ivory border-plum"
                  : "border-plum/15 text-ink hover:border-plum/30"
              }`}
            >
              {method.label}
            </button>
          ))}
        </div>

        {payment !== "split" ? (
          <div className="mb-3">
            <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">
              Amount paid now
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-plum/15 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-berry"
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">Cash</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={splitCash}
                onChange={(e) => setSplitCash(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-plum/15 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-berry"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">M-Pesa</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={splitMpesa}
                onChange={(e) => setSplitMpesa(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-lg border border-plum/15 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-berry"
              />
            </div>
          </div>
        )}

        {depositAmount > 0 && (
          <div className="flex justify-between text-sm font-mono mb-3">
            <span className="text-ink/50">Balance remaining</span>
            <span className={balanceAfter > 0 ? "text-red-600 font-semibold" : "text-green-700 font-semibold"}>
              {money(balanceAfter)}
            </span>
          </div>
        )}

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
            {submitting ? "Saving…" : "Confirm Deposit"}
          </button>
        </div>
      </div>
    </div>
  );
}
