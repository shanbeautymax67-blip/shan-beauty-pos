import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import AddStockModal from "../components/AddStockModal";
import { fetchAllRows } from "../lib/fetchAll";

const money = (n) => `KES ${Number(n).toFixed(2)}`;
const DEFAULT_REORDER_LEVEL = 5;
const emptyForm = {
  id: null,
  name: "",
  category: "",
  price: "",
  buying_price: "",
  stock: "",
  reorder_level: "",
};
const PAGE_SIZE = 100;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [stockTarget, setStockTarget] = useState(null); // product being restocked
  const [page, setPage] = useState(1);

  async function loadProducts() {
    setLoading(true);
    const { data, error } = await fetchAllRows("products", { orderBy: "name" });
    if (!error) setProducts(data);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || p.category === categoryFilter;
      const matchesLowStock =
        !lowStockOnly || Number(p.stock) <= Number(p.reorder_level ?? DEFAULT_REORDER_LEVEL);
      return matchesQuery && matchesCategory && matchesLowStock;
    });
  }, [products, query, categoryFilter, lowStockOnly]);

  useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, lowStockOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return Array.from(set).sort();
  }, [products]);

  function startEdit(p) {
    setForm({
      id: p.id,
      name: p.name,
      category: p.category || "",
      price: p.price,
      buying_price: p.buying_price || "",
      stock: p.stock,
      reorder_level: p.reorder_level ?? "",
    });
  }

  function resetForm() {
    setForm(emptyForm);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      price: Number(form.price) || 0,
      buying_price: Number(form.buying_price) || 0,
      stock: Number(form.stock) || 0,
      reorder_level:
        form.reorder_level === "" ? DEFAULT_REORDER_LEVEL : Number(form.reorder_level),
    };

    if (form.id) {
      await supabase.from("products").update(payload).eq("id", form.id);
    } else {
      await supabase.from("products").insert(payload);
    }

    resetForm();
    await loadProducts();
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this product? This cannot be undone.")) return;
    await supabase.from("products").delete().eq("id", id);
    loadProducts();
  }

  async function handleAddStock(quantity) {
    if (!stockTarget) return { error: "No product selected." };
    const newStock = Number(stockTarget.stock) + quantity;
    const { error } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", stockTarget.id);
    if (error) return { error: error.message };
    setStockTarget(null);
    await loadProducts();
    return {};
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="font-display text-2xl text-heading mb-6">Products</h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-plum/10 rounded-xl p-5 mb-6 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
      >
        <div className="sm:col-span-2">
          <label className="block text-xs font-mono text-ink mb-1 uppercase">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-plum/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
            placeholder="e.g. Matte Lipstick — Rose"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-ink mb-1 uppercase">Category</label>
          <input
            list="product-categories"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full rounded-lg border border-plum/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
            placeholder="e.g. Lip care"
          />
          <datalist id="product-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-xs font-mono text-ink mb-1 uppercase">Buying Price</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.buying_price}
            onChange={(e) => setForm({ ...form, buying_price: e.target.value })}
            className="w-full rounded-lg border border-plum/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
            placeholder="cost (KES)"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-ink mb-1 uppercase">Selling Price</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-full rounded-lg border border-plum/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-ink mb-1 uppercase">Stock</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: e.target.value })}
            className="w-full rounded-lg border border-plum/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-ink mb-1 uppercase">
            Reorder Level
          </label>
          <input
            type="number"
            step="1"
            min="0"
            value={form.reorder_level}
            onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
            className="w-full rounded-lg border border-plum/15 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-berry"
            placeholder={`default ${DEFAULT_REORDER_LEVEL}`}
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
            {form.id ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by product or category…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-plum/15 bg-white px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-berry"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-plum/15 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-berry sm:w-56"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 rounded-lg border border-plum/15 bg-white px-4 py-2.5 text-sm text-ink/70 cursor-pointer whitespace-nowrap select-none">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="accent-berry"
          />
          Low stock only
        </label>
      </div>

      {loading ? (
        <p className="text-ink/50 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-ink/50 text-sm">
          {products.length === 0 ? "No products yet. Add your first one above." : "No products match your search or filter."}
        </p>
      ) : (
        <div className="bg-white border border-plum/10 rounded-xl overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <table className="text-sm border-collapse">
              <thead>
                <tr className="bg-blush text-left text-ink font-mono text-xs uppercase">
                  <th className="px-4 py-3 sticky top-0 left-0 z-30 bg-blush border-r border-b border-plum/10 w-40">
                    Name
                  </th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-blush border-b border-plum/10 whitespace-nowrap">
                    Category
                  </th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-blush border-b border-plum/10 text-right whitespace-nowrap">
                    Buying Price
                  </th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-blush border-b border-plum/10 text-right whitespace-nowrap">
                    Selling Price
                  </th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-blush border-b border-plum/10 text-right whitespace-nowrap">
                    Margin
                  </th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-blush border-b border-plum/10 text-right whitespace-nowrap">
                    Stock
                  </th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-blush border-b border-plum/10 text-right whitespace-nowrap">
                    Reorder Level
                  </th>
                  <th className="px-4 py-3 sticky top-0 z-20 bg-blush border-b border-plum/10 whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((p) => {
                  const margin = Number(p.price) - Number(p.buying_price || 0);
                  const reorderLevel = p.reorder_level ?? DEFAULT_REORDER_LEVEL;
                  return (
                    <tr key={p.id} className="border-t border-plum/5">
                      <td className="px-4 py-3 font-medium text-ink sticky left-0 z-10 bg-white border-r border-plum/10 w-40 max-w-40 break-words">
                        {p.name}
                      </td>
                      <td className="px-4 py-3 text-ink text-xs whitespace-nowrap">
                        {p.category || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink whitespace-nowrap">
                        {money(p.buying_price || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                        {money(p.price)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                        <span className={margin < 0 ? "text-berry-dark" : "text-green-700"}>
                          {money(margin)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono whitespace-nowrap">
                        <span
                          className={
                            Number(p.stock) <= reorderLevel ? "text-berry-dark" : "text-green-700"
                          }
                        >
                          {p.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink whitespace-nowrap">
                        {reorderLevel}
                      </td>
                      <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                      <button
                        onClick={() => setStockTarget(p)}
                        className="text-berry-dark hover:text-berry text-xs font-medium"
                      >
                        + Stock
                      </button>
                      <button
                        onClick={() => startEdit(p)}
                        className="text-plum/70 hover:text-plum text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-berry-dark hover:text-berry text-xs font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-plum/10 text-xs">
            <p className="text-ink/50">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
              {filtered.length}
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

      {stockTarget && (
        <AddStockModal
          product={stockTarget}
          onClose={() => setStockTarget(null)}
          onConfirm={handleAddStock}
        />
      )}
    </div>
  );
}
