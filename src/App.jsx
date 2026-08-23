import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Sidebar from "./components/Sidebar";
import MakeSale from "./pages/MakeSale";
import Products from "./pages/Products";
import SalesHistory from "./pages/SalesHistory";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Financials from "./pages/Financials";
import CrossShop from "./pages/CrossShop";
import Settings from "./pages/Settings";
import { syncThemeFromRemote } from "./lib/theme";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [tab, setTab] = useState("dashboard");
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      // Fired when the user lands here via a "reset password" email link.
      if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) syncThemeFromRemote();
  }, [session]);

  if (session === undefined) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-plum">
        <p className="text-blush font-display text-lg tracking-wide">Loading SHAN BEAUTY MAX…</p>
      </div>
    );
  }

  if (passwordRecovery) {
    return <ResetPassword onDone={() => setPasswordRecovery(false)} />;
  }

  if (!session) {
    return <Login />;
  }

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      <Sidebar tab={tab} setTab={setTab} />
      <main className="flex-1 overflow-y-auto bg-ivory">
        {tab === "dashboard" && <Dashboard setTab={setTab} />}
        {tab === "sale" && <MakeSale />}
        {tab === "products" && <Products />}
        {tab === "history" && <SalesHistory />}
        {tab === "expenses" && <Expenses />}
        {tab === "reports" && <Reports />}
        {tab === "financials" && <Financials />}
        {tab === "crossshop" && <CrossShop />}
        {tab === "settings" && <Settings />}
      </main>
    </div>
  );
}
