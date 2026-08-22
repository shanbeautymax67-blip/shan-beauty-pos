import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import TransferModal from "../components/TransferModal";
import { fetchAllRows } from "../lib/fetchAll";

const money = (n) => `KES ${Number(n).toFixed(2)}`;
const PAGE_SIZE = 100;

export default function MakeSale() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState([]); // { product_id, name, price, cost, quantity }
  const [payment, setPayment] = useState("cash"); // cash | mpesa | split
  const [discount, setDiscount] = useState("");
  const [amountPaid, setAmountPaid] = useState(""); // used for cash & mpesa
  const [splitCash, setSplitCash] = useState("");
  const [splitMpesa, setSplitMpesa] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [transfer, setTransfer] = useState(null); // { product, direction }

  async function loadProducts() {
    setLoading(true);
    const { data, error } = await fetchAllRows("products", { orderBy: "name" });
    if (!error) setProducts(data);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, query]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          price: Number(product.price),
          cost: Number(product.buying_price || 0),
          quantity: 1,
        },
      ];
    });
  }

  function updateQty(product_id, quantity) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.product_id !== product_id));
      return;
    }
    setCart((prev) => prev.map((i) => (i.product_id === product_id ? { ...i, quantity } : i)));
  }

  function removeItem(product_id) {
    setCart((prev) => prev.filter((i) => i.product_id !== product_id));
  }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const discountAmount = Math.min(Number(discount || 0), subtotal);
  const total = subtotal - discountAmount;

  useEffect(() => {
    if (payment === "mpesa") {
      setAmountPaid(total > 0 ? String(total) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  // Unified tender calculation — works the same whether it's plain cash,
  // plain M-Pesa, or a split of the two. Change is drawn from cash first.
  const cashTendered = payment === "split" ? Number(splitCash || 0) : payment === "cash" ? Number(amountPaid || 0) : 0;
  const mpesaTendered = payment === "split" ? Number(splitMpesa || 0) : payment === "mpesa" ? Number(amountPaid || 0) : 0;
  const tendered = cashTendered + mpesaTendered;
  const changeDue = Math.max(0, tendered - total);
  const shortfall = Math.max(0, total - tendered);

  function switchPayment(method) {
    setPayment(method);
    if (method === "mpesa") {
      setAmountPaid(total > 0 ? String(total) : "");
    } else {
      setAmountPaid("");
    }
    setSplitCash("");
    setSplitMpesa("");
  }

  async function handleTransferConfirm(quantity) {
    if (!transfer) return { error: "No transfer in progress." };
    const fn = transfer.direction === "to_shop_a" ? "send_stock_to_shop_a" : "bring_stock_from_shop_a";
    const { error } = await supabase.rpc(fn, {
      p_product_id: transfer.product.id,
      p_quantity: quantity,
    });
    if (error) return { error: error.message };

    setTransfer(null);
    setMessage({
      type: "success",
      text:
        transfer.direction === "to_shop_a"
          ? `Sent ${quantity} × ${transfer.product.name} to Shop A.`
          : `Brought in ${quantity} × ${transfer.product.name} from Shop A.`,
    });
    loadProducts();
    return {};
  }

  async function completeSale() {
    if (cart.length === 0) return;
    setMessage(null);

    if (shortfall > 0) {
      setMessage({ type: "error", text: `Amount paid is short by ${money(shortfall)}.` });
      return;
    }

    setSaving(true);

    for (const item of cart) {
      const product = products.find((p) => p.id === item.product_id);
      if (product && item.quantity > Number(product.stock)) {
        setMessage({ type: "error", text: `Not enough stock for "${item.name}".` });
        setSaving(false);
        return;
      }
    }

    // Allocate change out of cash first, spilling to mpesa only if needed.
    const changeFromCash = Math.min(changeDue, cashTendered);
    const changeFromMpesa = changeDue - changeFromCash;
    const cashRevenue = cashTendered - changeFromCash;
    const mpesaRevenue = mpesaTendered - changeFromMpesa;

    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        total,
        discount: discountAmount,
        payment_method: payment,
        cash_amount: cashRevenue,
        mpesa_amount: mpesaRevenue,
        amount_paid: tendered,
        change_given: changeDue,
      })
      .select()
      .single();

    if (saleError) {
      setMessage({ type: "error", text: saleError.message });
      setSaving(false);
      return;
    }

    const items = cart.map((i) => ({
      sale_id: sale.id,
      product_id: i.product_id,
      product_name: i.name,
      quantity: i.quantity,
      unit_price: i.price,
      unit_cost: i.cost,
      line_total: i.price * i.quantity,
    }));

    const { error: itemsError } = await supabase.from("sale_items").insert(items);
    if (itemsError) {
      setMessage({ type: "error", text: itemsError.message });
      setSaving(false);
      return;
    }

    for (const item of cart) {
      const product = products.find((p) => p.id === item.product_id);
      if (product) {
        await supabase
          .from("products")
          .update({ stock: Number(product.stock) - item.quantity })
          .eq("id", product.id);
      }
    }

    setMessage({
      type: "success",
      text:
        changeDue > 0
          ? `Sale complete — ${money(total)} received. Change due: ${money(changeDue)}.`
          : `Sale complete — ${money(total)} received.`,
    });
    setCart([]);
    setDiscount("");
    switchPayment("cash");
    loadProducts();
    setSaving(false);
  }

  return (
    <div className="h-full flex">
      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-2xl text-plum">Make a Sale</h1>
        </div>
        <input
          type="text"
          placeholder="Search products…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-plum/15 bg-white px-4 py-2.5 mb-5 focus:outline-none focus:ring-2 focus:ring-berry"
        />
        {loading ? (
          <p className="text-ink/50 text-sm">Loading products…</p>
        ) : filtered.length === 0 ? (
          <p className="text-ink/50 text-sm">
            No products found. Add some from the Products tab.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {paginated.map((p) => {
              const outOfStock = Number(p.stock) <= 0;
              const shopAStock = Number(p.shop_a_stock || 0);
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border transition-all overflow-hidden ${
                    outOfStock ? "border-plum/10 bg-plum/5" : "border-plum/10 bg-white hover:border-berry hover:shadow-md"
                  }`}
                >
                  <button
                    type="button"
                    disabled={outOfStock}
                    onClick={() => addToCart(p)}
                    className={`w-full text-left p-4 ${outOfStock ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <p className="font-medium text-ink text-sm leading-snug mb-1">{p.name}</p>
                    <p className="font-mono text-berry-dark text-sm">{money(p.price)}</p>
                    <p className="text-[11px] text-ink/40 mt-1">
                      {outOfStock ? "Out of stock" : `${p.stock} in stock`}
                      {shopAStock > 0 && ` · ${shopAStock} at Shop A`}
                    </p>
                  </button>
                  <div className="border-t border-plum/10 px-2 py-1.5 flex gap-1">
                    {!outOfStock && (
                      <button
                        type="button"
                        onClick={() => setTransfer({ product: p, direction: "to_shop_a" })}
                        className="flex-1 text-[10px] font-mono uppercase tracking-wide text-plum/60 hover:text-plum py-1 rounded hover:bg-plum/5"
                      >
                        Send to Shop A
                      </button>
                    )}
                    {outOfStock && (
                      <button
                        type="button"
                        onClick={() => setTransfer({ product: p, direction: "from_shop_a" })}
                        className="flex-1 text-[10px] font-mono uppercase tracking-wide text-berry-dark hover:text-berry py-1 rounded hover:bg-berry/5"
                      >
                        Bring from Shop A
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between mt-5 text-xs">
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
        )}
      </div>

      {/* Cart panel */}
      <div className="w-[32rem] shrink-0 bg-white border-l border-plum/10 flex flex-col">
        <div className="px-6 py-5 border-b border-plum/10">
          <p className="font-display text-lg text-plum">Current Sale</p>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.length === 0 ? (
            <p className="text-sm text-ink/40 py-8 text-center">Tap a product to add it here.</p>
          ) : (
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => updateQty(item.product_id, item.quantity - 1)}
                        className="w-6 h-6 rounded-md bg-plum/5 text-ink hover:bg-plum/10 text-sm"
                      >
                        −
                      </button>
                      <span className="text-sm text-ink/70 w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.product_id, item.quantity + 1)}
                        className="w-6 h-6 rounded-md bg-plum/5 text-ink hover:bg-plum/10 text-sm"
                      >
                        +
                      </button>
                      <span className="text-xs text-ink/40 ml-1">@ {money(item.price)}</span>
                      <button
                        onClick={() => removeItem(item.product_id)}
                        className="ml-auto text-xs text-berry-dark hover:text-berry"
                      >
                        remove
                      </button>
                    </div>
                  </div>
                  <p className="font-mono text-sm text-ink whitespace-nowrap pt-0.5">
                    {money(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-plum/10 px-6 py-5 space-y-4">
          {discountAmount > 0 && (
            <div className="space-y-1 text-sm font-mono">
              <div className="flex justify-between text-ink/50">
                <span>Subtotal</span>
                <span>{money(subtotal)}</span>
              </div>
              <div className="flex justify-between text-berry-dark">
                <span>Discount</span>
                <span>−{money(discountAmount)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between font-display text-2xl text-plum">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>

          <div>
            <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">
              Discount (KES)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              max={subtotal}
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-full rounded-lg border border-plum/15 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-berry"
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "cash", label: "Cash" },
              { id: "mpesa", label: "M-Pesa" },
              { id: "split", label: "Split" },
            ].map((method) => (
              <button
                key={method.id}
                onClick={() => switchPayment(method.id)}
                className={`rounded-lg py-2 text-xs font-mono uppercase tracking-wide border ${
                  payment === method.id
                    ? "bg-plum text-ivory border-plum"
                    : "border-plum/15 text-ink/60 hover:border-plum/30"
                }`}
              >
                {method.label}
              </button>
            ))}
          </div>

          {payment !== "split" ? (
            <div>
              <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">
                Amount Paid
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="w-full rounded-lg border border-plum/15 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-berry"
                placeholder={money(total)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-mono text-ink/50 mb-1 uppercase">Cash</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={splitCash}
                  onChange={(e) => setSplitCash(e.target.value)}
                  className="w-full rounded-lg border border-plum/15 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-berry"
                  placeholder="0.00"
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
                  className="w-full rounded-lg border border-plum/15 px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-berry"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {tendered > 0 && (
            <div className="flex justify-between text-sm font-mono">
              <span className="text-ink/50">{changeDue > 0 ? "Change due" : "Balance"}</span>
              <span className={changeDue > 0 ? "text-green-700 font-semibold" : shortfall > 0 ? "text-berry-dark" : "text-ink/40"}>
                {changeDue > 0 ? money(changeDue) : shortfall > 0 ? `short ${money(shortfall)}` : money(0)}
              </span>
            </div>
          )}

          {message && (
            <p
              className={`text-xs rounded-lg px-3 py-2 ${
                message.type === "error"
                  ? "bg-berry/10 text-berry-dark"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            onClick={completeSale}
            disabled={cart.length === 0 || saving}
            className="w-full rounded-lg bg-berry hover:bg-berry-light disabled:opacity-40 text-white font-semibold py-3 transition-colors"
          >
            {saving ? "Processing…" : "Complete Sale"}
          </button>
        </div>
      </div>

      {transfer && (
        <TransferModal
          product={transfer.product}
          direction={transfer.direction}
          onClose={() => setTransfer(null)}
          onConfirm={handleTransferConfirm}
        />
      )}
    </div>
  );
}
