import { addDays, shift, weekday, type Interval } from "./time";
import type { Block, DayInputs, WorkTemplate } from "./types";

/** Modèle actif pour une date : période + priorité la plus haute, sinon le modèle par défaut. */
export function activeTemplate(date: string, templates: WorkTemplate[]): WorkTemplate | undefined {
  const inPeriod = templates
    .filter((t) => !t.is_default && t.active_from && t.active_to && t.active_from <= date && date <= t.active_to)
    .sort((a, b) => b.priority - a.priority);
  return inPeriod[0] ?? templates.find((t) => t.is_default);
}

/**
 * Plages de travail QUI COMMENCENT à `date`.
 * Exceptions : off/cancel = supprime ; replace/late = remplace ; extra/overtime = ajoute.
 * Le modèle habituel n'est jamais modifié par une exception.
 */
export function workBlocks(date: string, d: DayInputs): Block[] {
  const t = activeTemplate(date, d.templates);
  const exc = d.exceptions.filter((e) => e.date === date);
  const removed = exc.some((e) => e.kind === "off" || e.kind === "cancel" || e.kind === "replace" || e.kind === "late");
  const out: Block[] = [];
  const mk = (id: string, iv: Interval, mandatory: boolean, parallel: boolean, title: string): Block => ({
    ...iv, id, title, category: "travail", source: "travail", exclusive: !parallel, mandatory, date,
  });
  if (t && !removed) {
    for (const r of d.rules.filter((r) => r.template_id === t.id && r.enabled && r.weekday === weekday(date)))
      out.push(mk(r.id, shift(date, r.start_time, r.end_time), r.mandatory, r.allow_parallel, "Chatting"));
  }
  for (const e of exc) {
    if (["replace", "late", "extra", "overtime"].includes(e.kind) && e.start_time && e.end_time)
      out.push(mk(e.id, shift(date, e.start_time, e.end_time), e.mandatory, e.allow_parallel, `Chatting (${e.kind})`));
  }
  return out;
}

export const tradingBlocks = (date: string, d: DayInputs): Block[] =>
  d.trading.filter((r) => r.enabled && r.weekday === weekday(date)).map((r, i) => ({
    ...shift(date, r.start_time, r.end_time), id: `trading-${date}-${i}`, title: "Trading", category: "trading" as const,
    source: "trading" as const, exclusive: true, mandatory: false, date,
  }));

export const prevDay = (date: string) => addDays(date, -1);
