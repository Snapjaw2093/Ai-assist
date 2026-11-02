// Timezone math without a library: the offset of `tz` from UTC at a given instant.
function offsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** "2026-11-03" + "09:30" in `tz` -> a real Date. */
export function zonedToDate(day: string, hhmm: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  let ms = guess - offsetMs(guess, tz);
  ms = guess - offsetMs(ms, tz); // second pass handles daylight-saving edges
  return new Date(ms);
}

/** Weekday (0=Sun) of a "YYYY-MM-DD" calendar date. */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function todayIn(tz: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now); // YYYY-MM-DD
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function spoken(date: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const isRealDate = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
};
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Turns what a caller actually says ("tuesday the 5th", "tomorrow", "11/26", "november 12") into YYYY-MM-DD.
 * `mismatch` is set when the weekday and the day-of-month disagree, so the agent can double-check with the caller.
 */
export function parseSpokenDate(input: string, today: string): { date: string; mismatch?: { saidWeekday: number; actualWeekday: number } } | null {
  let s = input.trim().toLowerCase().replace(/,/g, " ").replace(/(\d)(st|nd|rd|th)\b/g, "$1");
  const [ty, tm] = today.split("-").map(Number);

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return isRealDate(+iso[1], +iso[2], +iso[3]) ? { date: s } : null;

  s = s.replace(/\bat\b.*$/, "").trim(); // drop the time part: "tuesday at 3"
  if (/\btoday\b/.test(s)) return { date: today };
  if (/\btomorrow\b/.test(s)) return { date: addDays(today, 1) };

  const slash = s.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const m = +slash[1], d = +slash[2];
    let y = slash[3] ? (slash[3].length === 2 ? 2000 + +slash[3] : +slash[3]) : ty;
    if (!slash[3] && ymd(y, m, d) < today) y++;
    return isRealDate(y, m, d) ? { date: ymd(y, m, d) } : null;
  }

  const month = MONTHS.findIndex((x) => new RegExp(`\\b${x}[a-z]*\\b`).test(s));
  const dow = DAYS.findIndex((x) => new RegExp(`\\b${x}[a-z]*\\b`).test(s));
  const dayNum = s.match(/\b\d{1,2}\b/);
  const dom = dayNum ? Number(dayNum[0]) : null;
  if (dom !== null && (dom < 1 || dom > 31)) return null;

  if (month >= 0 && dom !== null) {
    let y = ty;
    if (ymd(y, month + 1, dom) < today) y++;
    if (!isRealDate(y, month + 1, dom)) return null;
    const date = ymd(y, month + 1, dom);
    return dow >= 0 && weekdayOf(date) !== dow ? { date, mismatch: { saidWeekday: dow, actualWeekday: weekdayOf(date) } } : { date };
  }
  if (dom !== null) {
    for (let i = 0; i < 62; i++) {
      const d = addDays(today, i);
      if (Number(d.slice(8)) === dom) {
        return dow >= 0 && weekdayOf(d) !== dow ? { date: d, mismatch: { saidWeekday: dow, actualWeekday: weekdayOf(d) } } : { date: d };
      }
    }
    return null;
  }
  if (dow >= 0) {
    for (let i = 0; i < 7; i++) if (weekdayOf(addDays(today, i)) === dow) return { date: addDays(today, i) };
  }
  void tm;
  return null;
}

/** "1030", "10:30", "10:30 am", "1pm", "noon" -> minutes after midnight. A bare 1-7 is read as afternoon (shop hours). */
export function parseTimeOfDay(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (/noon/.test(s)) return 720;
  const m = s.match(/^(\d{1,4})(?::(\d{2}))?\s*([ap])?\.?m?\.?$/);
  if (!m) return null;
  let h: number, min: number;
  if (m[2]) { h = +m[1]; min = +m[2]; }
  else if (m[1].length >= 3) { min = +m[1].slice(-2); h = +m[1].slice(0, -2); }
  else { h = +m[1]; min = 0; }
  if (m[3] === "p" && h < 12) h += 12;
  else if (m[3] === "a" && h === 12) h = 0;
  else if (!m[3] && h >= 1 && h <= 7) h += 12;
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function localMinutes(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return g("hour") * 60 + g("minute");
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
