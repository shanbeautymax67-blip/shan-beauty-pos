import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { fetchAllRows } from "../lib/fetchAll";

const money = (n) => `KES ${Number(n).toFixed(2)}`;
const PAGE_SIZE = 50;

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [items, setItems] = useState({}); // sale_id -> items[]
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);

  async function loadSales() {
    setLoading(true);
    const filters = {};
    if (dateFilter) {
      const start = new Date(dateFilter + "T00:00:00").toISOString();
      const end = new Date(dateFilter + "T23:59:59").toISOString();
      filters.gte = ["created_at", start];
      filters.lte = ["created_at", end];
    }
    const { data, error } = await fetchAllRows("sales", {
      orderBy: "created_at",
      ascending: false,
      filters,
    });
    if (!error) setSales(data);
    setLoading(false);
  }

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  useEffect(() => {
    setPage(1);
  }, [dateFilter]);

  const totalPages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sales.slice(start, start + PAGE_SIZE);
  }, [sales, page]);

  async function toggleExpand(saleId) {
    if (expanded === saleId) {
      setExpanded(null);
      return;
    }
    setExpanded(saleId);
    if (!items[saleId]) {
      const { data } = await supabase.from("sale_items").select("*").eq("sale_id", saleId);
      setItems((prev) => ({ ...prev, [saleId]: data || [] }));
    }
  }

  const dayTotal = sales.reduce((sum, s) => sum + Number(s.total), 0);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-display text-2xl text-plum">Sales History</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-plum/15 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-berry"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="text-xs text-ink/50 hover:text-ink"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {!loading && sales.length > 0 && (
        <p className="font-mono text-sm text-ink mb-4">
          {sales.length} sale{sales.length !== 1 ? "s" : ""} · total{" "}
          <span className="text-green-700">{money(dayTotal)}</span>
        </p>
      )}

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : sales.length === 0 ? (
        <p className="text-ink/50 text-sm">No sales recorded for this period.</p>
      ) : (
        <div className="space-y-2">
          {paginated.map((s) => (
            <div key={s.id} className="bg-white border border-plum/10 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleExpand(s.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-plum/5"
              >
                <div className="text-left">
                  <p className="text-sm font-medium text-ink">
                    {new Date(s.created_at).toLocaleString("en-KE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="text-xs text-ink font-mono uppercase">{s.payment_method}</p>
                </div>
                <p className="font-mono text-green-700 font-semibold">{money(s.total)}</p>
              </button>
              {expanded === s.id && (
                <div className="border-t border-dashed border-plum/20 px-4 py-3 bg-ivory/60">
                  {items[s.id] === undefined ? (
                    <p className="text-xs text-ink/40">Loading items…</p>
                  ) : (
                    <div className="space-y-1.5">
                      {items[s.id].map((it) => (
                        <div
                          key={it.id}
                          className="flex justify-between text-xs font-mono text-ink"
                        >
                          <span>
                            {it.quantity} × {it.product_name}
                          </span>
                          <span className="text-green-700">{money(it.line_total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && sales.length > 0 && (
        <div className="flex items-center justify-between mt-5 text-xs">
          <p className="text-ink/50">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sales.length)} of{" "}
            {sales.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-plum/15 text-ink/70 hover:bg-plum/5 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono text-ink/50">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-plum/15 text-ink/70 hover:bg-plum/5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
