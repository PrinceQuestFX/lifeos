import { addDays, fmtHM, type Interval, length, subtract } from "./time";
import type { DayAvailability } from "./availability";
import type { Category, PlanningEvent } from "./types";

export type Need = {
  title: string; category: Category; minutesPerDay: number; minBlock: number; priority: number; // 1 = plus important
  days?: number[];                      // jours (0=lundi) ; défaut = tous
  preferred?: { from: string; to: string }; // fenêtre souhaitée HH:MM
  allowParallel?: boolean;              // peut utiliser le temps de travail compatible
};
export type Proposal = Omit<PlanningEvent, "id" | "task_id" | "locked" | "status"> & { reason: string };
export type PlanResult = { proposals: Proposal[]; unplaced: { date: string; title: string; missingMin: number }[] };

const BUFFER = 15; // repos minimal laissé de chaque côté d'un créneau

const toIv = (date: string, from: string, to: string, base: number): Interval => {
  const [fh, fm] = from.split(":").map(Number), [th, tm] = to.split(":").map(Number);
  return { start: base + fh * 60 + fm, end: base + th * 60 + tm };
};

/** Génère des PROPOSITIONS. Rien n'est écrit en base sans confirmation de l'utilisateur. */
export function generatePlan(days: DayAvailability[], needs: Need[], weekdayOf: (d: string) => number): PlanResult {
  const proposals: Proposal[] = []; const unplaced: PlanResult["unplaced"] = [];
  const sorted = [...needs].sort((a, b) => a.priority - b.priority);
  for (const day of days) {
    // créneaux libres moins un tampon de repos, mutables au fil des placements
    let free: Interval[] = day.usable.map((i) => ({ start: i.start + BUFFER, end: i.end - BUFFER })).filter((i) => length(i) > 0);
    let par: Interval[] = [...day.parallelSlots];
    const dayStartMin = Math.floor((day.free[0]?.start ?? day.parallelSlots[0]?.start ?? 0) / 1440) * 1440;
    for (const n of sorted) {
      if (n.days && !n.days.includes(weekdayOf(day.date))) continue;
      let left = n.minutesPerDay;
      const pools = n.allowParallel ? [par, free] : [free];
      for (let p = 0; p < pools.length && left >= n.minBlock; p++) {
        let pool = pools[p];
        for (const slot of [...pool].sort((a, b) => a.start - b.start)) {
          if (left < n.minBlock) break;
          let s = slot.start, e = slot.end;
          if (n.preferred) {
            const w = toIv(day.date, n.preferred.from, n.preferred.to, dayStartMin);
            s = Math.max(s, w.start); e = Math.min(e, w.end);
          }
          if (e - s < n.minBlock) continue;
          const dur = Math.min(left, e - s);
          proposals.push({
            date: day.date, start_time: fmtHM(s), end_time: fmtHM(s + dur), title: n.title, category: n.category,
            allow_parallel: p === 0 && !!n.allowParallel, reason: p === 0 && n.allowParallel ? "Pendant un service compatible" : "Créneau réellement libre",
          });
          pool = subtract(pool, [{ start: s - BUFFER, end: s + dur + BUFFER }]);
          if (p === 0 && n.allowParallel) par = pool; else free = subtract(free, [{ start: s - BUFFER, end: s + dur + BUFFER }]);
          left -= dur;
        }
      }
      if (left > 0) unplaced.push({ date: day.date, title: n.title, missingMin: left });
    }
  }
  return { proposals, unplaced };
}

/** Propose de nouveaux créneaux pour des activités non réalisées ou en conflit (jamais pour les événements verrouillés). */
export function proposeMoves(events: PlanningEvent[], days: DayAvailability[], weekdayOf: (d: string) => number) {
  const needs = events.filter((e) => !e.locked).map((e, i): Need & { id: string } => {
    const [sh, sm] = e.start_time.split(":").map(Number), [eh, em] = e.end_time.split(":").map(Number);
    let dur = eh * 60 + em - (sh * 60 + sm); if (dur <= 0) dur += 1440;
    return { id: e.id, title: e.title, category: e.category, minutesPerDay: dur, minBlock: Math.min(dur, 30), priority: i + 1, allowParallel: e.allow_parallel };
  });
  const moves: { eventId: string; proposal: Proposal | null }[] = [];
  const remaining = new Set(needs.map((n) => n.id));
  for (const day of days) {
    for (const n of needs) {
      if (!remaining.has(n.id)) continue;
      const r = generatePlan([day], [n], weekdayOf);
      if (r.proposals.length && !r.unplaced.length) { moves.push({ eventId: n.id, proposal: r.proposals[0] }); remaining.delete(n.id); }
    }
  }
  for (const id of remaining) moves.push({ eventId: id, proposal: null });
  return moves;
}
export { addDays };
