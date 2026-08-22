import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import SetPinModal from "../components/SetPinModal";
import VerifyPinModal from "../components/VerifyPinModal";
import { isPinSet } from "../lib/pinUtils";
import { exportProductsToExcel, parseProductsExcelFile } from "../lib/productsIO";
import { fetchAllRows } from "../lib/fetchAll";

export default function Settings() {
  const [pinIsSet, setPinIsSet] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'clearProducts' | 'clearAllData'
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    isPinSet().then(setPinIsSet);
  }, []);

  async function handleExport() {
    setExporting(true);
    const { data } = await fetchAllRows("products", { orderBy: "name" });
    await exportProductsToExcel(data || []);
    setExporting(false);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportSummary(null);
    try {
      const { rows, errors } = await parseProductsExcelFile(file);
      let inserted = 0;
      if (rows.length > 0) {
        // Insert in chunks so large imports don't hit a single request's
        // payload/timeout limits.
        const CHUNK_SIZE = 500;
        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
          const chunk = rows.slice(i, i + CHUNK_SIZE);
          const { error } = await supabase.from("products").insert(chunk);
          if (error) {
            setImportSummary({
              type: "error",
              text:
                inserted > 0
                  ? `Imported ${inserted} product${inserted !== 1 ? "s" : ""} before an error: ${error.message}`
                  : error.message,
            });
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
          }
          inserted += chunk.length;
        }
      }
      setImportSummary({
        type: inserted > 0 ? "success" : "error",
        text:
          inserted > 0
            ? `Imported ${inserted} product${inserted !== 1 ? "s" : ""}.${
                errors.length > 0 ? ` ${errors.length} row(s) skipped.` : ""
              }`
            : "No valid rows found in the file.",
        details: errors,
      });
    } catch (err) {
      setImportSummary({ type: "error", text: `Could not read file: ${err.message}` });
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function runClearProducts() {
    setResetting(true);
    await supabase.from("products").delete().not("id", "is", null);
    setResetting(false);
    setResetMessage({ type: "success", text: "Product list cleared." });
    setPendingAction(null);
  }

  async function runClearAllData() {
    setResetting(true);
    // Sales cascade-delete their sale_items automatically.
    await supabase.from("sales").delete().not("id", "is", null);
    await supabase.from("stock_transfers").delete().not("id", "is", null);
    await supabase.from("expenses").delete().not("id", "is", null);
    await supabase.from("daily_cash_left").delete().not("cash_date", "is", null);
    await supabase.from("products").delete().not("id", "is", null);
    setResetting(false);
    setResetMessage({ type: "success", text: "All test data cleared. Ready for real sales." });
    setPendingAction(null);
  }

  return (
    <div className="p-6 max-w-5xl">
      <h1 className="font-display text-2xl text-plum mb-6">Settings</h1>

      <div className="border border-plum/10 rounded-xl p-5 bg-white mb-6">
        <h2 className="font-display text-lg text-plum mb-1">Product Data</h2>
        <p className="text-xs text-ink/50 mb-4">
          Export your product list to an Excel file, or bulk-import products from one.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 rounded-lg border border-plum/15 text-sm text-ink/70 hover:bg-plum/5 disabled:opacity-40"
          >
            {exporting ? "Exporting…" : "Export to Excel"}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 rounded-lg border border-plum/15 text-sm text-ink/70 hover:bg-plum/5 disabled:opacity-40"
          >
            {importing ? "Importing…" : "Import from Excel"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        {importSummary && (
          <div
            className={`text-xs rounded-lg px-3 py-2 mt-4 ${
              importSummary.type === "error"
                ? "bg-berry/10 text-berry-dark"
                : "bg-green-50 text-green-700"
            }`}
          >
            <p>{importSummary.text}</p>
            {importSummary.details && importSummary.details.length > 0 && (
              <ul className="mt-1 list-disc list-inside space-y-0.5">
                {importSummary.details.slice(0, 5).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
                {importSummary.details.length > 5 && (
                  <li>…and {importSummary.details.length - 5} more.</li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="border border-berry/20 rounded-xl p-5 bg-berry/5">
        <h2 className="font-display text-lg text-berry-dark mb-1">Security</h2>
        <p className="text-xs text-ink/50 mb-4">
          These actions are protected by a PIN. Use them once you're done testing and ready to
          start real sales.
        </p>

        <div className="flex items-center justify-between flex-wrap gap-2 mb-4 pb-4 border-b border-berry/10">
          <div>
            <p className="text-sm text-ink font-medium">PIN Protection</p>
            <p className="text-xs text-ink/50">
              {pinIsSet ? "A PIN is set." : "No PIN set yet — set one before you can clear data."}
            </p>
          </div>
          <button
            onClick={() => setShowSetPin(true)}
            className="px-4 py-1.5 rounded-lg border border-plum/15 text-sm text-ink/70 hover:bg-white"
          >
            {pinIsSet ? "Change PIN" : "Set PIN"}
          </button>
        </div>

        {resetMessage && (
          <p
            className={`text-xs rounded-lg px-3 py-2 mb-4 ${
              resetMessage.type === "error"
                ? "bg-berry/10 text-berry-dark"
                : "bg-green-50 text-green-700"
            }`}
          >
            {resetMessage.text}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setPendingAction("clearProducts")}
            disabled={!pinIsSet || resetting}
            className="px-4 py-2 rounded-lg bg-white border border-berry-dark/30 text-berry-dark text-sm font-medium hover:bg-berry/10 disabled:opacity-40"
          >
            Clear Product List
          </button>
          <button
            onClick={() => setPendingAction("clearAllData")}
            disabled={!pinIsSet || resetting}
            className="px-4 py-2 rounded-lg bg-berry-dark text-white text-sm font-medium hover:bg-berry disabled:opacity-40"
          >
            Clear All Test Data
          </button>
        </div>
      </div>

      {showSetPin && (
        <SetPinModal
          hasExistingPin={pinIsSet}
          onClose={() => setShowSetPin(false)}
          onDone={() => {
            setShowSetPin(false);
            setPinIsSet(true);
          }}
        />
      )}

      {pendingAction === "clearProducts" && (
        <VerifyPinModal
          title="Clear Product List"
          description="This deletes every product currently in your list. Sales history and expenses are not affected."
          confirmLabel="Clear Products"
          onClose={() => setPendingAction(null)}
          onConfirmed={runClearProducts}
        />
      )}

      {pendingAction === "clearAllData" && (
        <VerifyPinModal
          title="Clear All Test Data"
          description="This permanently deletes ALL sales, expenses, stock transfers, cash-left records, and products. This cannot be undone."
          confirmLabel="Clear Everything"
          requireTyped
          onClose={() => setPendingAction(null)}
          onConfirmed={runClearAllData}
        />
      )}
    </div>
  );
}
