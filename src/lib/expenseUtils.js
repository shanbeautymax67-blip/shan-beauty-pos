import { supabase } from "./supabaseClient";
import { toLocalDateStr } from "./dateUtils";

// Sum of 'daily'-type expenses recorded on exactly this date. These are the
// only expenses that ever reduce a single day's profit.
export async function dailyExpensesForDate(dateStr) {
  const { data } = await supabase
    .from("expenses")
    .select("amount")
    .eq("expense_type", "daily")
    .eq("expense_date", dateStr);
  return (data || []).reduce((sum, e) => sum + Number(e.amount), 0);
}

// Sum of 'daily'-type expenses within an inclusive date range.
export async function dailyExpensesInRange(startDateStr, endDateStr) {
  const { data } = await supabase
    .from("expenses")
    .select("amount")
    .eq("expense_type", "daily")
    .gte("expense_date", startDateStr)
    .lte("expense_date", endDateStr);
  return (data || []).reduce((sum, e) => sum + Number(e.amount), 0);
}

// Sum of 'monthly'-type expenses attributed to the given month (matched by
// month/year of expense_date — the day of month is irrelevant for these).
export async function monthlyExpensesForMonth(year, month) {
  const start = toLocalDateStr(new Date(year, month, 1));
  const end = toLocalDateStr(new Date(year, month + 1, 0));
  const { data } = await supabase
    .from("expenses")
    .select("amount")
    .eq("expense_type", "monthly")
    .gte("expense_date", start)
    .lte("expense_date", end);
  return (data || []).reduce((sum, e) => sum + Number(e.amount), 0);
}

// Everything that should be deducted from a whole month's profit: every
// 'daily' expense that fell within the month, plus every 'monthly' expense
// attributed to that month.
export async function totalExpensesForMonth(year, month) {
  const start = toLocalDateStr(new Date(year, month, 1));
  const end = toLocalDateStr(new Date(year, month + 1, 0));
  const [daily, monthly] = await Promise.all([
    dailyExpensesInRange(start, end),
    monthlyExpensesForMonth(year, month),
  ]);
  return { daily, monthly, total: daily + monthly };
}
