import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { todayStr, toLocalDateStr } from "../lib/dateUtils";
import { dailyExpensesForDate } from "../lib/expenseUtils";

const money = (n) => `KES ${Number(n).toFixed(2)}`;

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

export default function Financials() {
  const [date, setDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ revenue: 0, cogs: 0, cashTotal: 0, mpesaTotal: 0, saleCount: 0 });
  const [dailyExpenses, setDailyExpenses] = useState(0);
  const [cashLeftToday, setCashLeftToday] = useState(0);
  const [cashLeftYesterday, setCashLeftYesterday] = useState(0);
  const [cashLeftInput, setCashLeftInput] = useState("0");
  const [savingCashLeft, setSavingCashLeft] = useState(false);

  async function load() {
    setLoading(true);
    const start = new Date(date + "T00:00:00");
    const end = new Date(date + "T00:00:00");
    end.setDate(end.getDate() + 1);

    const { data: sales } = await supabase
      .from("sales")
      .select("*")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());

    let cogs = 0;
    if (sales && sales.length > 0) {
      const saleIds = sales.map((s) => s.id);
      const { data: items } = await supabase
        .from("sale_items")
        .select("quantity, unit_cost")
        .in("sale_id", saleIds);
      cogs = (items || []).reduce((sum, it) => sum + Number(it.quantity) * Number(it.unit_cost), 0);
    }

    const revenue = (sales || []).reduce((sum, s) => sum + Number(s.total), 0);
    const cashTotal = (sales || []).reduce((sum, s) => sum + Number(s.cash_amount || 0), 0);
    const mpesaTotal = (sales || []).reduce((sum, s) => sum + Number(s.mpesa_amount || 0), 0);

    setData({ revenue, cogs, cashTotal, mpesaTotal, saleCount: (sales || []).length });

    const dailyExp = await dailyExpensesForDate(date);
    setDailyExpenses(dailyExp);

    const { data: todayRow } = await supabase
      .from("daily_cash_left")
      .select("*")
      .eq("cash_date", date)
      .maybeSingle();
    setCashLeftToday(Number(todayRow?.cash_left || 0));
    setCashLeftInput(String(todayRow?.cash_left || 0));

    const { data: yestRow } = await supabase
      .from("daily_cash_left")
      .select("*")
      .eq("cash_date", shiftDate(date, -1))
      .maybeSingle();
    setCashLeftYesterday(Number(yestRow?.cash_left || 0));

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function saveCashLeft() {
    setSavingCashLeft(true);
    const value = Number(cashLeftInput) || 0;
    await supabase.from("daily_cash_left").upsert({
      cash_date: date,
      cash_left: value,
      updated_at: new Date().toISOString(),
    });
    setCashLeftToday(value);
    setSavingCashLeft(false);
  }

  const grossProfit = data.revenue - data.cogs;
  const netProfit = grossProfit - dailyExpenses;
  const cashForToday = data.cashTotal + cashLeftYesterday;
  const cashAfterCashLeft = cashForToday - cashLeftToday;
  const isToday = date === todayStr();

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h1 className="font-display text-2xl text-plum">Financials</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            className="w-8 h-8 rounded-lg border border-plum/15 text-ink/60 hover:bg-plum/5"
          >
            ‹
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-plum/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-berry"
          />
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            className="w-8 h-8 rounded-lg border border-plum/15 text-ink/60 hover:bg-plum/5"
          >
            ›
          </button>
        </div>
      </div>
      <p className="text-sm text-ink/50 mb-6">
        {new Date(date + "T00:00:00").toLocaleDateString("en-KE", { dateStyle: "long" })}
        {isToday && " · today"}
      </p>

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <StatCard label="Revenue" value={money(data.revenue)} />
            <StatCard label="Cost of Goods" value={money(data.cogs)} />
            <StatCard label="Gross Profit" value={money(grossProfit)} tone="green" />
            <StatCard label="Daily Expenses" value={money(dailyExpenses)} tone="berry" />
            <StatCard label="Net Profit" value={money(netProfit)} tone={netProfit >= 0 ? "green" : "berry"} accent />
            <StatCard label="Cash Total" value={money(data.cashTotal)} />
            <StatCard label="M-Pesa Total" value={money(data.mpesaTotal)} />
            <StatCard label="Sales Recorded" value={data.saleCount} />
          </div>

          <div className="bg-white border border-plum/10 rounded-xl p-5 mb-6">
            <h2 className="font-display text-lg text-plum mb-1">Cash Left (Change Float)</h2>
            <p className="text-xs text-ink/50 mb-4">
              Set aside cash from today's till to carry forward as tomorrow's change float.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg border border-plum/10 p-3">
                <p className="text-xs font-mono text-ink/40 uppercase mb-1">Cash Left — Yesterday</p>
                <p className="font-display text-lg text-ink">{money(cashLeftYesterday)}</p>
              </div>
              <div className="rounded-lg border border-plum/10 p-3">
                <p className="text-xs font-mono text-ink/40 uppercase mb-1">
                  Cash Left — {isToday ? "Today" : "This Day"}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashLeftInput}
                    onChange={(e) => setCashLeftInput(e.target.value)}
                    className="w-full rounded-lg border border-plum/15 px-2 py-1.5 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-berry"
                  />
                  <button
                    onClick={saveCashLeft}
                    disabled={savingCashLeft}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-berry hover:bg-berry-light text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {savingCashLeft ? "Saving…" : "Set"}
                  </button>
                </div>
                {cashLeftToday !== Number(cashLeftInput || 0) && (
                  <p className="text-[11px] text-ink/40 mt-1">Saved: {money(cashLeftToday)}</p>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-plum/10 pt-4">
              <div className="flex justify-between">
                <span className="text-ink/60">Cash Made Today</span>
                <span className="font-mono text-ink">{money(data.cashTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">+ Yesterday's Cash Left</span>
                <span className="font-mono text-ink">{money(cashLeftYesterday)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-plum/10">
                <span className="text-ink">Cash for Today + Yesterday's Cash Left</span>
                <span className="font-mono text-plum">{money(cashForToday)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink/60">− Today's Cash Left (set aside for tomorrow)</span>
                <span className="font-mono text-ink">{money(cashLeftToday)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-plum/10">
                <span className="text-ink">Cash After Today's Cash Left</span>
                <span className="font-mono text-green-700">{money(cashAfterCashLeft)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-ink/40">
            Net profit here only deducts <strong>daily</strong>-type expenses recorded on this
            exact date. Monthly-type expenses are deducted at the month level only — see Reports
            or the Dashboard for a month's totals.
          </p>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, tone, accent }) {
  const toneClass =
    tone === "green" ? "text-green-700" : tone === "berry" ? "text-berry-dark" : "text-ink";
  return (
    <div
      className={`rounded-xl p-4 border ${
        accent ? "bg-plum text-ivory border-plum" : "bg-white border-plum/10"
      }`}
    >
      <p
        className={`text-xs font-mono uppercase tracking-wide mb-1 ${
          accent ? "text-blush/70" : "text-ink/40"
        }`}
      >
        {label}
      </p>
      <p className={`font-display text-xl ${accent ? "text-ivory" : toneClass}`}>{value}</p>
    </div>
  );
}
