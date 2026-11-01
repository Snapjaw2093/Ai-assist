import { BUSINESS } from "@/config/receptionist";

const tz = BUSINESS.timezone;
export const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
export const dayKey = (d: Date | number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
export const dateTime = (d: Date | number | string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(d));
export const timeOnly = (d: Date | number | string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(d));
export const duration = (s?: number) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
export const phone = (p?: string) => {
  const m = p?.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : (p ?? "Unknown");
};
export const statusLabel = (s: string) => ({ scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled", no_show: "No-show" })[s] ?? s;
