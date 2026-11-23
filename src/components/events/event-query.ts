export type EventPeriod = "upcoming" | "past" | "all";
export interface EventQuery {
  q: string;
  city: string;
  type: string;
  status: string;
  period: EventPeriod;
  from: string;
  to: string;
  sort: "asc" | "desc";
  view: "list" | "calendar";
  month: string;
}
const eventTypes = ["Показ", "Кастинг", "Съёмка"];
const statuses = ["Открыт набор", "Закрыто", "Отменено", "Завершено"];

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function defaultEventQuery(today: string): EventQuery {
  return { q: "", city: "all", type: "all", status: "all", period: "upcoming", from: "", to: "", sort: "asc", view: "list", month: today.slice(0, 7) };
}
export function parseEventQuery(query: Pick<URLSearchParams, "get">, today: string, cities: readonly string[] = ["Алматы", "Астана"]): EventQuery {
  const result = defaultEventQuery(today);
  result.q = (query.get("q") || "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 120);
  const city = query.get("city") || "";
  if (cities.includes(city)) result.city = city;
  const type = query.get("type") || "";
  if (eventTypes.includes(type)) result.type = type;
  const status = query.get("status") || "";
  if (statuses.includes(status)) result.status = status;
  const period = query.get("period");
  if (period === "past" || period === "all") result.period = period;
  for (const name of ["from", "to"] as const) {
    const value = query.get(name) || "";
    if (validDate(value)) result[name] = value;
  }
  if (query.get("sort") === "desc") result.sort = "desc";
  if (query.get("view") === "calendar") result.view = "calendar";
  const month = query.get("month") || "";
  if (/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) result.month = month;
  return result;
}
export function eventQueryString(state: EventQuery, today: string) {
  const defaults = defaultEventQuery(today);
  const params = new URLSearchParams();
  for (const name of Object.keys(defaults) as (keyof EventQuery)[]) {
    if (state[name] !== defaults[name] || (name === "month" && state.view === "calendar")) params.set(name, state[name]);
  }
  return params.toString();
}
export function eventResultsHref(state: EventQuery, today: string) {
  const query = eventQueryString(state, today);
  return `/events/${query ? `?${query}` : ""}`;
}
/** Only the local event index may be used as a return destination. */
export function safeEventReturnTo(value: string | undefined, today: string) {
  if (!value || value.length > 2500 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/events/";
  try {
    const url = new URL(value, "https://runway.local");
    if (url.origin !== "https://runway.local" || url.pathname.replace(/\/$/, "") !== "/events") return "/events/";
    return eventResultsHref(parseEventQuery(url.searchParams, today), today);
  } catch { return "/events/"; }
}
export function eventDetailHref(id: string, returnTo?: string) {
  return `/events/${encodeURIComponent(id)}/${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""}`;
}
