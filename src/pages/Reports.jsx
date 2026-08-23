import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { todayStr } from "../lib/dateUtils";
import { dailyExpensesForDate, dailyExpensesInRange, totalExpensesForMonth } from "../lib/expenseUtils";

const money = (n) => `KES ${Number(n).toFixed(2)}`;

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}

export default function Reports() {
  const now = new Date();
  const [mode, setMode] = useState("day"); // day | range | month
  const [day, setDay] = useState(todayStr());
  const [rangeStart, setRangeStart] = useState(todayStr());
  const [rangeEnd, setRangeEnd] = useState(todayStr());
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);

  const { start, end, label } = useMemo(() => {
    if (mode === "day") {
      const s = new Date(day + "T00:00:00");
      const e = new Date(day + "T00:00:00");
      e.setDate(e.getDate() + 1);
      return {
        start: s,
        end: e,
        label: s.toLocaleDateString("en-KE", { dateStyle: "long" }),
      };
    }
    if (mode === "range") {
      const s = new Date(rangeStart + "T00:00:00");
      const e = new Date(rangeEnd + "T00:00:00");
      e.setDate(e.getDate() + 1);
      return {
        start: s,
        end: e,
        label: `${s.toLocaleDateString("en-KE", { dateStyle: "medium" })} – ${new Date(
          rangeEnd + "T00:00:00"
        ).toLocaleDateString("en-KE", { dateStyle: "medium" })}`,
      };
    }
    const s = new Date(year, month, 1);
    const e = new Date(year, month + 1, 1);
    return { start: s, end: e, label: monthLabel(year, month) };
  }, [mode, day, rangeStart, rangeEnd, year, month]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: sales } = await supabase
        .from("sales")
        .select("*")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString());

      let cogs = 0;
      let topItems = [];
      if (sales && sales.length > 0) {
        const saleIds = sales.map((s) => s.id);
        const { data: items } = await supabase
          .from("sale_items")
          .select("*")
          .in("sale_id", saleIds);

        cogs = (items || []).reduce(
          (sum, it) => sum + Number(it.quantity) * Number(it.unit_cost),
          0
        );

        const tally = {};
        (items || []).forEach((it) => {
          if (!tally[it.product_name]) tally[it.product_name] = { qty: 0, revenue: 0 };
          tally[it.product_name].qty += Number(it.quantity);
          tally[it.product_name].revenue += Number(it.line_total);
        });
        topItems = Object.entries(tally)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 8);
      }

      let expensesTotal = 0;
      let expenseNote = "";
      if (mode === "day") {
        expensesTotal = await dailyExpensesForDate(day);
        expenseNote = "daily expenses recorded on this day";
      } else if (mode === "range") {
        expensesTotal = await dailyExpensesInRange(rangeStart, rangeEnd);
        expenseNote = "daily expenses recorded within this range";
      } else {
        const breakdown = await totalExpensesForMonth(year, month);
        expensesTotal = breakdown.total;
        expenseNote = "daily + monthly expenses for this month";
      }

      const revenue = (sales || []).reduce((sum, s) => sum + Number(s.total), 0);
      const cashTotal = (sales || []).reduce((sum, s) => sum + Number(s.cash_amount || 0), 0);
      const mpesaTotal = (sales || []).reduce((sum, s) => sum + Number(s.mpesa_amount || 0), 0);

      setResult({
        saleCount: (sales || []).length,
        revenue,
        cogs,
        cashTotal,
        mpesaTotal,
        expensesTotal,
        expenseNote,
        topItems,
      });
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, mode]);

  const grossProfit = result ? result.revenue - result.cogs : 0;
  const netProfit = grossProfit - (result?.expensesTotal || 0);

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="font-display text-2xl text-heading mb-5">Reports</h1>

      <div className="flex items-center gap-2 mb-5">
        {[
          { id: "day", label: "Day" },
          { id: "range", label: "Range" },
          { id: "month", label: "Month" },
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wide border ${
              mode === m.id
                ? "bg-plum text-ivory border-plum"
                : "border-plum/15 text-ink hover:border-plum/30"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mb-6">
        {mode === "day" && (
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="rounded-lg border border-plum/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-berry"
          />
        )}
        {mode === "range" && (
          <div className="flex items-center gap-3">
            <input
              type="date"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              className="rounded-lg border border-plum/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-berry"
            />
            <span className="text-ink/40 text-sm">to</span>
            <input
              type="date"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="rounded-lg border border-plum/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-berry"
            />
          </div>
        )}
        {mode === "month" && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                let m = month - 1,
                  y = year;
                if (m < 0) {
                  m = 11;
                  y -= 1;
                }
                setMonth(m);
                setYear(y);
              }}
              className="w-8 h-8 rounded-lg border border-plum/15 text-ink/60 hover:bg-plum/5"
            >
              ‹
            </button>
            <p className="font-mono text-sm text-ink w-40 text-center">{monthLabel(year, month)}</p>
            <button
              onClick={() => {
                let m = month + 1,
                  y = year;
                if (m > 11) {
                  m = 0;
                  y += 1;
                }
                setMonth(m);
                setYear(y);
              }}
              className="w-8 h-8 rounded-lg border border-plum/15 text-ink/60 hover:bg-plum/5"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {loading || !result ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : (
        <>
          <p className="font-mono text-xs text-ink uppercase tracking-widest mb-3">{label}</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-2">
            <StatCard label="Sales" value={result.saleCount} />
            <StatCard label="Total Sales" value={money(result.revenue)} />
            <StatCard label="Gross Profit" value={money(grossProfit)} tone="green" />
            <StatCard label="Expenses" value={money(result.expensesTotal)} tone="berry" />
            <StatCard label="Net Profit" value={money(netProfit)} tone={netProfit >= 0 ? "green" : "berry"} />
          </div>
          <p className="text-xs text-ink/40 mb-6">
            Net profit deducts {result.expenseNote}.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white border border-plum/10 rounded-xl p-5">
              <h2 className="font-display text-lg text-heading mb-3">Payment Split</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink">Cash</span>
                  <span className="font-mono text-green-700">{money(result.cashTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink">M-Pesa</span>
                  <span className="font-mono text-green-700">{money(result.mpesaTotal)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-plum/10 rounded-xl p-5">
              <h2 className="font-display text-lg text-heading mb-3">Top Sellers</h2>
              {result.topItems.length === 0 ? (
                <p className="text-sm text-ink/40">No sales in this period.</p>
              ) : (
                <div className="space-y-2">
                  {result.topItems.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="text-ink truncate">
                        <span className="font-mono text-ink/30 mr-2">{idx + 1}.</span>
                        {item.name}
                      </span>
                      <span className="font-mono whitespace-nowrap ml-2">
                        <span className="text-ink">{item.qty}</span>{" "}
                        <span className="text-ink">·</span>{" "}
                        <span className="text-green-700">{money(item.revenue)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const toneClass =
    tone === "green" ? "text-green-700" : tone === "berry" ? "text-berry-dark" : "text-ink";
  return (
    <div className="rounded-xl p-4 border bg-white border-plum/10">
      <p className="text-xs font-mono uppercase tracking-wide mb-1 text-ink">{label}</p>
      <p className={`font-display text-xl ${toneClass}`}>{value}</p>
    </div>
  );
}
