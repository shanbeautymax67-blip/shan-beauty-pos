import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { todayStr } from "../lib/dateUtils";

export default function CrossShop() {
  const [date, setDate] = useState(todayStr());
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const start = new Date(date + "T00:00:00").toISOString();
      const end = new Date(date + "T00:00:00");
      end.setDate(end.getDate() + 1);
      const { data, error } = await supabase
        .from("stock_transfers")
        .select("*")
        .gte("created_at", start)
        .lt("created_at", end.toISOString())
        .order("created_at", { ascending: false });
      if (!error) setTransfers(data);
      setLoading(false);
    }
    load();
  }, [date]);

  const sentOut = transfers.filter((t) => t.direction === "to_shop_a");
  const broughtIn = transfers.filter((t) => t.direction === "from_shop_a");

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="font-display text-2xl text-heading">Cross-Shop — Royal Lady Cosmetics</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-plum/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-berry"
        />
      </div>
      <p className="text-sm text-ink mb-6">
        {new Date(date + "T00:00:00").toLocaleDateString("en-KE", { dateStyle: "long" })}
      </p>

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : transfers.length === 0 ? (
        <p className="text-ink/50 text-sm">No stock was sent or brought in on this day.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="bg-white border border-plum/10 rounded-xl overflow-hidden">
            <div className="bg-red-50 px-4 py-3">
              <h2 className="font-display text-base text-ink">Sent to Shop A</h2>
              <p className="text-xs text-ink font-mono">{sentOut.length} transfer{sentOut.length !== 1 ? "s" : ""}</p>
            </div>
            {sentOut.length === 0 ? (
              <p className="text-sm text-ink/40 px-4 py-4">Nothing sent out on this day.</p>
            ) : (
              <div className="divide-y divide-plum/5">
                {sentOut.map((t) => (
                  <div key={t.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-ink font-medium">{t.product_name}</p>
                      <p className="text-xs text-ink font-mono">
                        {new Date(t.created_at).toLocaleTimeString("en-KE", { timeStyle: "short" })}
                      </p>
                    </div>
                    <span className="font-mono text-red-600">−{t.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-plum/10 rounded-xl overflow-hidden">
            <div className="bg-green-50 px-4 py-3">
              <h2 className="font-display text-base text-ink">Brought from Shop A</h2>
              <p className="text-xs text-ink font-mono">{broughtIn.length} transfer{broughtIn.length !== 1 ? "s" : ""}</p>
            </div>
            {broughtIn.length === 0 ? (
              <p className="text-sm text-ink/40 px-4 py-4">Nothing brought in on this day.</p>
            ) : (
              <div className="divide-y divide-plum/5">
                {broughtIn.map((t) => (
                  <div key={t.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div>
                      <p className="text-ink font-medium">{t.product_name}</p>
                      <p className="text-xs text-ink font-mono">
                        {new Date(t.created_at).toLocaleTimeString("en-KE", { timeStyle: "short" })}
                      </p>
                    </div>
                    <span className="font-mono text-green-700">+{t.quantity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
