import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "📊" },
  { id: "products", label: "Products", icon: "🏷" },
  { id: "sale", label: "Make Sale", icon: "🛍" },
  { id: "history", label: "Sales History", icon: "🧾" },
  { id: "crossshop", label: "Cross-Shop", icon: "🔄" },
  { id: "expenses", label: "Expenses", icon: "💸" },
  { id: "reports", label: "Reports", icon: "📈" },
  { id: "financials", label: "Financials", icon: "💰" },
  { id: "settings", label: "Settings", icon: "⚙️" },
];

const COLLAPSE_KEY = "sidebar_collapsed";

export default function Sidebar({ tab, setTab }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore storage errors (e.g. private browsing)
    }
  }, [collapsed]);

  return (
    <aside
      className={`shrink-0 bg-plum flex flex-col transition-all duration-200 ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div
        className={`border-b border-white/10 flex items-center ${
          collapsed ? "flex-col gap-3 py-4 px-2" : "gap-3 px-5 py-6"
        }`}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`shrink-0 flex items-center justify-center rounded-lg text-sidebar-text/70 hover:text-sidebar-text hover:bg-white/10 transition-colors ${
            collapsed ? "w-9 h-9 order-first" : "w-8 h-8"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 5.5H17M3 10H17M3 14.5H17"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {!collapsed && (
          <>
            <img
              src="/logo.png"
              alt="SHAN BEAUTY MAX"
              className="w-11 h-11 rounded-full shrink-0"
            />
            <div className="min-w-0">
              <p className="font-display text-sm text-sidebar-text leading-tight break-words">
                SHAN BEAUTY MAX
              </p>
              <p className="font-mono text-[10px] text-sidebar-text/70 tracking-[0.2em] uppercase mt-1">
                Point of Sale
              </p>
            </div>
          </>
        )}
      </div>
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center text-sm font-medium transition-colors border-l-2 ${
              collapsed ? "justify-center px-0 py-3" : "gap-3 px-5 py-3"
            } ${
              tab === item.id
                ? "bg-white/5 border-berry text-sidebar-text"
                : "border-transparent text-sidebar-text/60 hover:text-sidebar-text hover:bg-white/5"
            }`}
          >
            <span className="text-base shrink-0">{item.icon}</span>
            {!collapsed && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </nav>
      <div className={`border-t border-white/10 ${collapsed ? "p-2" : "p-4"}`}>
        <button
          onClick={() => supabase.auth.signOut()}
          title={collapsed ? "Sign out" : undefined}
          className={`w-full text-xs font-mono text-sidebar-text/50 hover:text-sidebar-text transition-colors uppercase tracking-wide py-2 ${
            collapsed ? "text-center" : ""
          }`}
        >
          {collapsed ? "⏻" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
