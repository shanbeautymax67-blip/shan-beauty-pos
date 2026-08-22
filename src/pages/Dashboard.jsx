import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { todayStr } from "../lib/dateUtils";
import { dailyExpensesForDate, totalExpensesForMonth } from "../lib/expenseUtils";
import { fetchAllRows } from "../lib/fetchAll";

const money = (n) => `KES ${Number(n).toFixed(2)}`;
const LOW_STOCK_VISIBLE = 8;

export default function Dashboard({ setTab }) {
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState({
    saleCount: 0,
    revenue: 0,
    profit: 0,
    cashTotal: 0,
    mpesaTotal: 0,
  });
  const [monthly, setMonthly] = useState({
    saleCount: 0,
    revenue: 0,
    grossProfit: 0,
    expensesTotal: 0,
    netProfit: 0,
  });
  const [topItems, setTopItems] = useState([]);
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const now = new Date();
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // ---- Today ----
      const { data: todaySales } = await supabase
        .from("sales")
        .select("*")
        .gte("created_at", dayStart.toISOString());

      let todayCogs = 0;
      let tally = {};
      if (todaySales && todaySales.length > 0) {
        const saleIds = todaySales.map((s) => s.id);
        const { data: items } = await supabase
          .from("sale_items")
          .select("*")
          .in("sale_id", saleIds);
        todayCogs = (items || []).reduce(
          (sum, it) => sum + Number(it.quantity) * Number(it.unit_cost),
          0
        );
        (items || []).forEach((it) => {
          if (!tally[it.product_name]) tally[it.product_name] = { qty: 0, revenue: 0 };
          tally[it.product_name].qty += Number(it.quantity);
          tally[it.product_name].revenue += Number(it.line_total);
        });
      }
      const todayRevenue = (todaySales || []).reduce((sum, s) => sum + Number(s.total), 0);
      const todayDailyExpenses = await dailyExpensesForDate(todayStr());
      setToday({
        saleCount: (todaySales || []).length,
        revenue: todayRevenue,
        profit: todayRevenue - todayCogs - todayDailyExpenses,
        cashTotal: (todaySales || []).reduce((sum, s) => sum + Number(s.cash_amount || 0), 0),
        mpesaTotal: (todaySales || []).reduce((sum, s) => sum + Number(s.mpesa_amount || 0), 0),
      });
      setTopItems(
        Object.entries(tally)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 5)
      );

      // ---- This month ----
      const { data: monthSales } = await supabase
        .from("sales")
        .select("*")
        .gte("created_at", monthStart.toISOString())
        .lt("created_at", monthEnd.toISOString());

      let monthCogs = 0;
      if (monthSales && monthSales.length > 0) {
        const saleIds = monthSales.map((s) => s.id);
        const { data: items } = await supabase
          .from("sale_items")
          .select("quantity, unit_cost")
          .in("sale_id", saleIds);
        monthCogs = (items || []).reduce(
          (sum, it) => sum + Number(it.quantity) * Number(it.unit_cost),
          0
        );
      }
      const monthRevenue = (monthSales || []).reduce((sum, s) => sum + Number(s.total), 0);
      const monthGrossProfit = monthRevenue - monthCogs;

      const expenseBreakdown = await totalExpensesForMonth(now.getFullYear(), now.getMonth());
      const expensesTotal = expenseBreakdown.total;

      setMonthly({
        saleCount: (monthSales || []).length,
        revenue: monthRevenue,
        grossProfit: monthGrossProfit,
        expensesTotal,
        netProfit: monthGrossProfit - expensesTotal,
      });

      // ---- Low stock ----
      // Supabase can't compare stock <= reorder_level via a simple filter
      // (both are columns), so pull products and compare client-side.
      const { data: allProducts } = await fetchAllRows("products");
      const lowStockProducts = (allProducts || [])
        .filter((p) => Number(p.stock) <= Number(p.reorder_level ?? 5))
        .sort((a, b) => Number(a.stock) - Number(b.stock));
      setLowStock(lowStockProducts);

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-6 text-ink/50 text-sm">Loading dashboard…</div>;
  }

  const now = new Date();
  const monthName = now.toLocaleDateString("en-KE", { month: "long", year: "numeric" });
  const weekday = now.toLocaleDateString("en-KE", { weekday: "long" });
  const day = now.getDate();
  const monthShort = now.toLocaleDateString("en-KE", { month: "short" });
  const year = now.getFullYear();
  const todayLabel = `${weekday} ${day} ${monthShort} ${year}`;

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="font-display text-2xl text-plum mb-6">Today {todayLabel}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Sales Today" value={today.saleCount} accent />
        <StatCard label="Revenue" value={money(today.revenue)} accent />
        <StatCard label="Net Profit" value={money(today.profit)} accent />
        <CashMpesaCard cash={today.cashTotal} mpesa={today.mpesaTotal} />
      </div>

      <h2 className="font-display text-xl text-plum mb-4">This Month — {monthName}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-10">
        <StatCard label="Sales" value={monthly.saleCount} />
        <StatCard label="Revenue" value={money(monthly.revenue)} />
        <StatCard label="Gross Profit" value={money(monthly.grossProfit)} tone="green" />
        <StatCard label="Expenses" value={money(monthly.expensesTotal)} tone="berry" />
        <StatCard
          label="Net Profit"
          value={money(monthly.netProfit)}
          tone={monthly.netProfit >= 0 ? "green" : "berry"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-plum/10 rounded-xl p-5">
          <h2 className="font-display text-lg text-plum mb-3">Top Sellers Today</h2>
          {topItems.length === 0 ? (
            <p className="text-sm text-ink/40">No sales yet today.</p>
          ) : (
            <div className="space-y-2">
              {topItems.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <span className="text-ink">
                    <span className="font-mono text-ink/30 mr-2">{idx + 1}.</span>
                    {item.name}
                  </span>
                  <span className="font-mono text-ink/60">
                    {item.qty} sold · {money(item.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-plum/10 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-lg text-plum">Low Stock</h2>
            {lowStock.length > 0 && (
              <span className="text-xs font-mono text-ink/40">{lowStock.length} item{lowStock.length !== 1 ? "s" : ""}</span>
            )}
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-ink/40">All products are well stocked.</p>
          ) : (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {lowStock.slice(0, LOW_STOCK_VISIBLE).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-ink">{p.name}</span>
                    <span
                      className={`font-mono ${
                        Number(p.stock) <= 0 ? "text-berry-dark font-semibold" : "text-gold"
                      }`}
                    >
                      {p.stock} left
                    </span>
                  </div>
                ))}
              </div>
              {lowStock.length > LOW_STOCK_VISIBLE && (
                <button
                  onClick={() => setTab && setTab("products")}
                  className="mt-3 text-xs font-mono text-berry-dark hover:text-berry"
                >
                  +{lowStock.length - LOW_STOCK_VISIBLE} more — view all in Products →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, tone }) {
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

function CashMpesaCard({ cash, mpesa }) {
  return (
    <div className="rounded-xl p-4 border bg-white border-plum/10">
      <p className="text-xs font-mono uppercase tracking-wide mb-1 text-ink/40">Cash / M-Pesa</p>
      <p className="font-display text-base text-ink leading-snug">Cash: {money(cash)}</p>
      <p className="font-display text-base text-ink leading-snug">M-Pesa: {money(mpesa)}</p>
    </div>
  );
}
