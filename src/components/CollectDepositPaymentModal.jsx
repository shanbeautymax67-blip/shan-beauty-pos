import { useState } from "react";

const money = (n) => `KES ${Number(n).toFixed(2)}`;

// Used on the Deposits page to record either a further top-up or the final
// balance payment on a pending deposit sale. If the amount entered covers
// the remaining balance, the sale completes automatically on confirm.
export default function CollectDepositPaymentModal({ depositSale, onClose, onConfirm }) {
  const balance = Math.max(0, Number(depositSale.total) - Number(depositSale.amount_paid));
  const [payment, setPayment] = useState("cash"); // cash | mpesa | split
  const [amount, setAmount] = useState(balance > 0 ? String(balance) : "");
  const [splitCash, setSplitCash] = useState("");
  const [splitMpesa, setSplitMpesa] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const cashAmount = payment === "split" ? Number(splitCash || 0) : payment === "cash" ? Number(amount || 0) : 0;
  const mpesaAmount = payment === "split" ? Number(splitMpesa || 0) : payment === "mpesa" ? Number(amount || 0) : 0;
  const payingNow = cashAmount + mpesaAmount;
  const willComplete = payingNow >= balance;

  function switchPayment(method) {
    setPayment(method);
    setAmount(method !== "split" && balance > 0 ? String(balance) : "");
    setSplitCash("");
    setSplitMpesa("");
  }

  async function handleConfirm() {
    setError("");
    if (payingNow <= 0) {
      setError("Enter how much is being paid now.");
      return;
    }
    setSubmitting(true);
    const result = await onConfirm({ cashAmount, mpesaAmount });
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 bg-plum-dark/50 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 max-h-[90vh] overflow-y-auto">
        <p className="font-mono text-[11px] text-ink/40 uppercase tracking-widest mb-1">
          Collect Payment
        </p>
        <h2 className="font-display text-lg text-heading mb-1">
          {depositSale.customer_name || "Walk-in customer"}
        </h2>
        <p className="text-xs text-ink/50 mb-4">
          {depositSale.customer_phone || "No phone number on record"}
        </p>

        <div className="space-y-1 text-sm font-mono mb-4 bg-plum/5 rounded-lg px-3 py-2">
          <div className="flex justify-between text-ink/60">
            <span>Total price</span>
            <span className="text-blue-700 font-semibold">{money(depositSale.total)}</span>
          </div>
          <div className="flex justify-between text-ink/60">
            <span>Already paid</span>
            <span className="text-green-700 font-semibold">{money(depositSale.amount_paid)}</span>
          </div>
          <div className="flex justify-between text-ink font-semibold pt-1 border-t border-plum/10">
            <span>Balance due</span>
            <span className="text-red-600">{money(balance)}</span>
          </div>
        </div>

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
              onClick={() => switchPayment(method.id)}
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
              placeholder={money(balance)}
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

        {payingNow > 0 && (
          <p
            className={`text-xs rounded-lg px-3 py-2 mb-3 ${
              willComplete ? "bg-green-50 text-green-700" : "bg-plum/5 text-ink/60"
            }`}
          >
            {willComplete
              ? payingNow > balance
                ? `This completes the sale — change due: ${money(payingNow - balance)}.`
                : "This pays it off in full — the sale will be completed."
              : `Still ${money(balance - payingNow)} left after this payment.`}
          </p>
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
            {submitting ? "Saving…" : willComplete ? "Complete Sale" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
