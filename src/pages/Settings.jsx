import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import SetPinModal from "../components/SetPinModal";
import VerifyPinModal from "../components/VerifyPinModal";
import { isPinSet } from "../lib/pinUtils";

export default function Settings() {
  const [pinIsSet, setPinIsSet] = useState(false);
  const [showSetPin, setShowSetPin] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'clearProducts' | 'clearAllData'
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);

  useEffect(() => {
    isPinSet().then(setPinIsSet);
  }, []);

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
