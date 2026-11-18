// Moteur temporel : toutes les heures sont des "minutes murales" (UTC fictif) -> aucun souci de DST.
export type Interval = { start: number; end: number };

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
};
export const fmtHM = (min: number): string => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
export const dayStart = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 60000;
};
export const addDays = (iso: string, n: number): string => {
  const d = new Date(dayStart(iso) * 60000 + n * 86400000);
  return d.toISOString().slice(0, 10);
};
/** 0 = lundi ... 6 = dimanche */
export const weekday = (iso: string): number => (new Date(dayStart(iso) * 60000).getUTCDay() + 6) % 7;
export const mondayOf = (iso: string): string => addDays(iso, -weekday(iso));
export const todayISO = (tz = "Africa/Casablanca"): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
export const nowMin = (tz = "Africa/Casablanca"): number => {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  return toMin(p);
};

/** Une plage qui traverse minuit (18:00 -> 02:00) = UNE seule période de 8 h. */
export function shift(dateISO: string, start: string, end: string): Interval {
  const s = dayStart(dateISO) + toMin(start);
  let e = dayStart(dateISO) + toMin(end);
  if (e <= s) e += 1440;
  return { start: s, end: e };
}
export const length = (i: Interval) => Math.max(0, i.end - i.start);
export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;
export const clip = (i: Interval, w: Interval): Interval | null => {
  const s = Math.max(i.start, w.start), e = Math.min(i.end, w.end);
  return e > s ? { start: s, end: e } : null;
};
export function merge(list: Interval[]): Interval[] {
  const s = [...list].filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of s) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}
export function subtract(base: Interval[], cut: Interval[]): Interval[] {
  const c = merge(cut);
  const out: Interval[] = [];
  for (const b of merge(base)) {
    let cur = b.start;
    for (const x of c) {
      if (x.end <= cur || x.start >= b.end) continue;
      if (x.start > cur) out.push({ start: cur, end: x.start });
      cur = Math.max(cur, x.end);
    }
    if (cur < b.end) out.push({ start: cur, end: b.end });
  }
  return out;
}
export const total = (l: Interval[]) => merge(l).reduce((a, i) => a + length(i), 0);
export const hours = (min: number) => Math.round((min / 60) * 100) / 100;
export const dayWindow = (iso: string): Interval => ({ start: dayStart(iso), end: dayStart(iso) + 1440 });
