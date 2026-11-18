import { addDays, clip, dayStart, dayWindow, type Interval, length, merge, overlaps, shift, subtract, toMin, total } from "./time";
import { tradingBlocks, workBlocks } from "./work";
import type { Block, Category, DayInputs } from "./types";

export const MIN_USABLE = 30; // un créneau libre < 30 min n'est pas exploitable
const ORDER: Category[] = ["sommeil", "etudes", "travail", "trading", "trajet", "repas", "sport", "anglais", "revisions", "repos", "autre"];

export type Conflict = { a: Block; b: Block; hard: boolean };
export type DayAvailability = {
  date: string; blocks: Block[]; conflicts: Conflict[];
  minutes: Record<string, number>;         // minutes par catégorie, sans double comptage
  free: Interval[]; freeMin: number;       // libre théorique
  usable: Interval[]; usableMin: number;   // libre réellement exploitable (>= MIN_USABLE)
  parallelSlots: Interval[]; parallelMin: number; // temps de travail compatible avec activités secondaires
};

/** Blocs de la journée `date` (y compris ce qui déborde de la veille, ex. 18h–02h). */
export function blocksForWindow(date: string, d: DayInputs): Block[] {
  const win = dayWindow(date);
  const raw: Block[] = [];
  for (const day of [addDays(date, -1), date]) {
    raw.push(...workBlocks(day, d), ...tradingBlocks(day, d));
    if (d.prefs.sleep_start && d.prefs.sleep_end)
      raw.push({ ...shift(day, d.prefs.sleep_start, d.prefs.sleep_end), id: `sleep-${day}`, title: "Sommeil", category: "sommeil", source: "sommeil", exclusive: true, mandatory: true, date: day });
    d.meals.forEach((m, i) => raw.push({ ...shift(day, m.start_time, m.end_time), id: `meal-${day}-${i}`, title: m.title, category: "repas", source: "repas", exclusive: false, mandatory: false, date: day }));
    for (const e of d.timetable.filter((e) => e.date === day && e.status === "keep"))
      raw.push({ ...shift(day, e.start_time, e.end_time), id: e.id, title: e.title, category: e.category === "etudes" ? "etudes" : e.category, source: "cours", exclusive: true, mandatory: true, date: day });
    for (const e of d.planning.filter((e) => e.date === day && e.status !== "skipped"))
      raw.push({ ...shift(day, e.start_time, e.end_time), id: e.id, title: e.title, category: e.category, source: "planning", exclusive: !e.allow_parallel, mandatory: e.locked, date: day });
  }
  // trajets autour des cours (uniquement si configurés : jamais inventés)
  if (d.prefs.commute_min > 0) {
    const courses = raw.filter((b) => b.source === "cours" && b.date === date).sort((a, b) => a.start - b.start);
    if (courses.length) {
      const f = courses[0], l = courses[courses.length - 1];
      raw.push({ ...f, id: `commute-in-${date}`, title: "Trajet", category: "trajet", source: "trajet", start: f.start - d.prefs.commute_min, end: f.start, exclusive: true, mandatory: true });
      raw.push({ ...l, id: `commute-out-${date}`, title: "Trajet", category: "trajet", source: "trajet", start: l.end, end: l.end + d.prefs.commute_min, exclusive: true, mandatory: true });
    }
  }
  return raw.map((b) => { const c = clip(b, win); return c ? { ...b, ...c } : null; }).filter(Boolean) as Block[];
}

export function detectConflicts(blocks: Block[]): Conflict[] {
  const out: Conflict[] = [];
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i], b = blocks[j];
      if (a.exclusive && b.exclusive && overlaps(a, b)) out.push({ a, b, hard: a.mandatory && b.mandatory });
    }
  return out;
}

export function computeDay(date: string, d: DayInputs): DayAvailability {
  const win = dayWindow(date);
  const blocks = blocksForWindow(date, d);
  const minutes: Record<string, number> = {};
  let claimed: Interval[] = [];
  for (const cat of ORDER) {
    const iv = merge(blocks.filter((b) => b.category === cat));
    minutes[cat] = total(subtract(iv, claimed)); // jamais deux fois la même minute
    claimed = merge([...claimed, ...iv]);
  }
  // les blocs non exclusifs (repas, travail parallèle) ne bloquent pas le "libre"
  const blocking = merge(blocks.filter((b) => b.exclusive));
  const free = subtract([win], blocking);
  const usable = free.filter((i) => length(i) >= MIN_USABLE);
  const higher = merge(blocks.filter((b) => b.exclusive && b.category !== "travail"));
  const parallelSlots = subtract(merge(blocks.filter((b) => b.source === "travail" && !b.exclusive)), higher).filter((i) => length(i) >= MIN_USABLE);
  return {
    date, blocks, conflicts: detectConflicts(blocks), minutes,
    free, freeMin: total(free), usable, usableMin: total(usable), parallelSlots, parallelMin: total(parallelSlots),
  };
}

export const computeRange = (dates: string[], d: DayInputs) => dates.map((x) => computeDay(x, d));
export const dateRange = (from: string, to: string): string[] => {
  const out: string[] = []; for (let n = 0; dayStart(from) + n * 1440 <= dayStart(to); n++) out.push(addDays(from, n)); return out;
};
export { toMin };
