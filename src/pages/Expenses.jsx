import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { todayStr, toLocalDateStr } from "../lib/dateUtils";

const money = (n) => `KES ${Number(n).toFixed(2)}`;
const PAGE_SIZE = 50;
const emptyForm = { id: null, description: "", amount: "", expense_date: todayStr(), expense_type: "daily" };

function monthLabel(year, month) {
  return new Date(year, month, 1).toLocaleDateString("en-KE", { month: "long", year: "numeric" });
}

export default function Expenses() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  async function loadExpenses() {
    setLoading(true);
    const start = toLocalDateStr(new Date(year, month, 1));
    const end = toLocalDateStr(new Date(year, month + 1, 0));
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", start)
      .lte("expense_date", end)
      .order("expense_date", { ascending: false });
    if (!error) setExpenses(data);
    setLoading(false);
  }

  useEffect(() => {
    loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => {
    setPage(1);
  }, [year, month]);

  const totalPages = Math.max(1, Math.ceil(expenses.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return expenses.slice(start, start + PAGE_SIZE);
  }, [expenses, page]);

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  function startEdit(exp) {
    setForm({
      id: exp.id,
      description: exp.description,
      amount: exp.amount,
      expense_date: exp.expense_date,
      expense_type: exp.expense_type || "daily",
    });
  }

  function resetForm() {
    setForm({ ...emptyForm, expense_date: todayStr() });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      description: form.description.trim(),
      amount: Number(form.amount) || 0,
      expense_date: form.expense_date,
      expense_type: form.expense_type,
    };

    if (form.id) {
      await supabase.from("expenses").update(payload).eq("id", form.id);
    } else {
      await supabase.from("expenses").insert(payload);
    }

    resetForm();
    await loadExpenses();
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    await supabase.from("expenses").delete().eq("id", id);
    loadExpenses();
  }

  const monthTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const dailyTotal = expenses
    .filter((e) => e.expense_type === "daily")
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const monthlyTypeTotal = expenses
    .filter((e) => e.expense_type === "monthly")
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-display text-2xl text-plum">Expenses</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => shiftMonth(-1)}
            className="w-8 h-8 rounded-lg border border-plum/15 text-ink/60 hover:bg-plum/5"
          >
            ‹
          </button>
          <p className="font-mono text-sm text-ink w-40 text-center">{monthLabel(year, month)}</p>
          <button
            onClick={() => shiftMonth(1)}
            className="w-8 h-8 rounded-lg border border-plum/15 text-ink/60 hover:bg-plum/5"
          >
            ›
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-plum/10 rounded-xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
      >
        <div className="sm:col-span-2">
          <label className="block text-xs font-mono text-ink mb-1 uppercase">Description</label>
          <input
            required
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full rounded-lg border border-plum/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
            placeholder="e.g. Rent, restock transport, packaging"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-ink mb-1 uppercase">Type</label>
          <select
            value={form.expense_type}
            onChange={(e) => setForm({ ...form, expense_type: e.target.value })}
            className="w-full rounded-lg border border-plum/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
          >
            <option value="daily">Daily — deducted from that day</option>
            <option value="monthly">Monthly — deducted from the month</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-mono text-ink mb-1 uppercase">Amount (KES)</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full rounded-lg border border-plum/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-ink mb-1 uppercase">
            Date {form.expense_type === "monthly" && <span className="normal-case text-ink/30">(month used)</span>}
          </label>
          <input
            required
            type="date"
            value={form.expense_date}
            onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
            className="w-full rounded-lg border border-plum/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
          />
        </div>
        <div className="sm:col-span-5 flex gap-2 justify-end">
          {form.id && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-lg text-sm text-ink/60 hover:text-ink"
            >
              Cancel edit
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-berry hover:bg-berry-light text-white text-sm font-semibold disabled:opacity-50"
          >
            {form.id ? "Save changes" : "Add expense"}
          </button>
        </div>
      </form>

      {!loading && (
        <p className="font-mono text-sm text-ink mb-4">
          {expenses.length} expense{expenses.length !== 1 ? "s" : ""} this month · daily{" "}
          <span className="text-red-600 font-semibold">{money(dailyTotal)}</span> · monthly{" "}
          <span className="text-red-600 font-semibold">{money(monthlyTypeTotal)}</span> · total{" "}
          <span className="text-red-600 font-semibold">{money(monthTotal)}</span>
        </p>
      )}

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : expenses.length === 0 ? (
        <p className="text-ink/50 text-sm">No expenses recorded for {monthLabel(year, month)}.</p>
      ) : (
        <div className="bg-white border border-plum/10 rounded-xl overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <table className="text-sm border-collapse">
              <thead>
                <tr className="bg-blush text-left text-ink font-mono text-xs uppercase">
                  <th className="px-4 py-3 sticky top-0 left-0 z-30 bg-blush whitespace-nowrap border-r border-b border-plum/10">
                    Date
                  </th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-blush border-b border-plum/10 whitespace-nowrap">
                    Type
                  </th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-blush border-b border-plum/10 whitespace-nowrap">
                    Description
                  </th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-blush border-b border-plum/10 text-right whitespace-nowrap">
                    Amount
                  </th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-blush border-b border-plum/10 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((exp) => (
                  <tr key={exp.id} className="border-t border-plum/5">
                    <td className="px-4 py-3 font-mono text-xs text-ink sticky left-0 z-10 bg-white whitespace-nowrap border-r border-plum/10">
                      {new Date(exp.expense_date + "T00:00:00").toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                          exp.expense_type === "monthly"
                            ? "bg-plum/10 text-plum"
                            : "bg-berry/10 text-berry-dark"
                        }`}
                      >
                        {exp.expense_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink whitespace-nowrap">{exp.description}</td>
                    <td className="px-4 py-3 text-right font-mono text-red-600 whitespace-nowrap">
                      {money(exp.amount)}
                    </td>
                    <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                      <button
                        onClick={() => startEdit(exp)}
                        className="text-plum/70 hover:text-plum text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="text-berry-dark hover:text-berry text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-plum/10 text-xs">
            <p className="text-ink/50">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, expenses.length)} of{" "}
              {expenses.length}
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
        </div>
      )}
    </div>
  );
}
