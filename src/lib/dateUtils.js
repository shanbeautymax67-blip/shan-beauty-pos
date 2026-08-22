// Returns YYYY-MM-DD based on the browser's LOCAL calendar date, not UTC.
// Using date.toISOString().slice(0, 10) is a common bug: it converts to UTC
// first, which silently shifts the date back by one during the early hours
// of the day for any timezone ahead of UTC (e.g. Nairobi, UTC+3, between
// 00:00 and 02:59 local time). All "today"/date-bucket logic in this app
// should go through this helper instead.
export function toLocalDateStr(date) {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayStr() {
  return toLocalDateStr(new Date());
}
