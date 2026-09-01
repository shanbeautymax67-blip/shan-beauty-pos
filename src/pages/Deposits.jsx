import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { fetchAllRows } from "../lib/fetchAll";
import CollectDepositPaymentModal from "../components/CollectDepositPaymentModal";

const money = (n) => `KES ${Number(n).toFixed(2)}`;

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export default function Deposits() {
  const [deposits, setDeposits] = useState([]);
  const [items, setItems] = useState({}); // deposit_sale_id -> items[]
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [message, setMessage] = useState(null);
  const [collecting, setCollecting] = useState(null); // deposit sale being paid
  const [cancelling, setCancelling] = useState(null); // id currently being cancelled

  async function load() {
    setLoading(true);
    const { data, error } = await fetchAllRows("deposit_sales", {
      orderBy: "created_at",
      ascending: false,
    });
    if (!error) setDeposits(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const filtered = useMemo(() => deposits.filter((d) => d.status === tab), [deposits, tab]);

  const pendingCount = useMemo(() => deposits.filter((d) => d.status === "pending").length, [deposits]);

  async function toggleExpand(depositId) {
    if (expanded === depositId) {
      setExpanded(null);
      return;
    }
    setExpanded(depositId);
    if (!items[depositId]) {
      const { data } = await supabase
        .from("deposit_sale_items")
        .select("*")
        .eq("deposit_sale_id", depositId);
      setItems((prev) => ({ ...prev, [depositId]: data || [] }));
    }
  }

  async function handleCollectPayment({ cashAmount, mpesaAmount }) {
    if (!collecting) return { error: "Nothing selected." };
    const { error } = await supabase.rpc("collect_deposit_sale_payment", {
      p_deposit_sale_id: collecting.id,
      p_cash_amount: cashAmount,
      p_mpesa_amount: mpesaAmount,
    });
    if (error) return { error: error.message };

    setCollecting(null);
    setMessage({ type: "success", text: "Payment recorded." });
    load();
    return {};
  }

  async function handleCancel(depositSale) {
    const itemsList = items[depositSale.id];
    const itemsSummary = itemsList
      ? itemsList.map((i) => `${i.quantity} × ${i.product_name}`).join(", ")
      : "the reserved item(s)";
    const ok = confirm(
      `Cancel this deposit sale? ${itemsSummary} will be returned to stock, and ${money(
        depositSale.amount_paid
      )} will be marked as refunded to the customer. This can't be undone.`
    );
    if (!ok) return;

    setCancelling(depositSale.id);
    const { error } = await supabase.rpc("cancel_deposit_sale", {
      p_deposit_sale_id: depositSale.id,
    });
    setCancelling(null);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }
    setMessage({ type: "success", text: "Deposit sale cancelled — stock returned and refund recorded." });
    load();
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="font-display text-2xl text-heading">Deposits</h1>
      </div>
      <p className="text-sm text-ink/50 mb-6">
        Products reserved for a customer who paid part of the price now and will pay the
        rest later. Reserved item(s) are already out of stock — the sale only counts
        toward revenue and profit once the balance is paid off.
      </p>

      <div className="flex gap-1 mb-5 border-b border-plum/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id ? "border-berry text-plum" : "border-transparent text-ink/40 hover:text-ink/70"
            }`}
          >
            {t.label}
            {t.id === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-berry text-white text-[10px] font-mono align-middle">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {message && (
        <p
          className={`text-xs rounded-lg px-3 py-2 mb-4 ${
            message.type === "error" ? "bg-berry/10 text-berry-dark" : "bg-green-50 text-green-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-ink/50 text-sm">
          {tab === "pending"
            ? "No pending deposit sales. Take one from the Make Sale screen."
            : `No ${tab} deposit sales.`}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const balance = Math.max(0, Number(d.total) - Number(d.amount_paid));
            return (
              <div key={d.id} className="rounded-xl border border-plum/10 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(d.id)}
                  className="w-full text-left px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink text-sm">
                      {d.customer_name || "Walk-in customer"}
                    </p>
                    <p className="text-xs text-ink/50 mt-0.5">
                      {d.customer_phone || "No phone number"} ·{" "}
                      {new Date(d.created_at).toLocaleString("en-KE", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-semibold text-blue-700">{money(d.total)}</p>
                    {d.status === "pending" ? (
                      <p className="text-[11px] font-semibold text-red-600 mt-0.5">
                        {money(balance)} due
                      </p>
                    ) : d.status === "completed" ? (
                      <p className="text-[11px] font-medium text-green-700 mt-0.5">Paid in full</p>
                    ) : (
                      <p className="text-[11px] font-medium text-ink/40 mt-0.5">Cancelled</p>
                    )}
                  </div>
                </button>

                {expanded === d.id && (
                  <div className="border-t border-plum/10 px-5 py-4 bg-plum/5">
                    {!items[d.id] ? (
                      <p className="text-xs text-ink/40">Loading items…</p>
                    ) : (
                      <div className="space-y-1.5 mb-4">
                        {items[d.id].map((it) => (
                          <div key={it.id} className="flex justify-between text-sm">
                            <span className="text-ink/70">
                              {it.quantity} × {it.product_name}
                            </span>
                            <span className="font-mono text-blue-700">{money(it.line_total)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="space-y-1 text-sm font-mono mb-4">
                      <div className="flex justify-between text-ink/60">
                        <span>Paid so far</span>
                        <span className="text-green-700 font-semibold">{money(d.amount_paid)}</span>
                      </div>
                      {d.status === "pending" && (
                        <div className="flex justify-between text-ink font-semibold">
                          <span>Balance due</span>
                          <span className="text-red-600">{money(balance)}</span>
                        </div>
                      )}
                    </div>

                    {d.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCollecting(d)}
                          className="px-4 py-2 rounded-lg bg-berry hover:bg-berry-light text-white text-sm font-semibold"
                        >
                          Collect Payment
                        </button>
                        <button
                          onClick={() => handleCancel(d)}
                          disabled={cancelling === d.id}
                          className="px-4 py-2 rounded-lg border border-berry/30 text-berry-dark hover:bg-berry/5 text-sm font-medium disabled:opacity-50"
                        >
                          {cancelling === d.id ? "Cancelling…" : "Cancel & Refund"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {collecting && (
        <CollectDepositPaymentModal
          depositSale={collecting}
          onClose={() => setCollecting(null)}
          onConfirm={handleCollectPayment}
        />
      )}
    </div>
  );
}
