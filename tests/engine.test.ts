import { describe, it, expect } from "vitest";
import { classify } from "../lib/groups";
import { shift, length, hours, merge, subtract } from "../lib/time";
import { computeDay } from "../lib/availability";
import { activeTemplate, workBlocks } from "../lib/work";
import { generatePlan } from "../lib/planner";
import type { DayInputs } from "../lib/types";

const G = { main: "A", english: "1", tec: "1" };
const base = (): DayInputs => ({
  prefs: { tz: "Africa/Casablanca", group_main: "A", group_english: "1", group_tec: "1", sleep_start: null, sleep_end: null, commute_min: 0, setup_done: true },
  templates: [{ id: "t0", name: "Habituel", kind: "habituel", is_default: true, active_from: null, active_to: null, priority: 0 }],
  rules: [0, 1, 2, 3, 4].map((w) => ({ id: `r${w}`, template_id: "t0", weekday: w, enabled: true, start_time: "18:00", end_time: "02:00", fixed: true, mandatory: true, allow_parallel: false, note: null })),
  exceptions: [], timetable: [], planning: [], trading: [], meals: [],
});
// 2026-11-16 = lundi ; 2026-11-17 = mardi

describe("filtrage groupes", () => {
  it("garde A et 1, ignore B et 2", () => {
    expect(classify("TP Conception mécanique Groupe A", G).status).toBe("keep");
    expect(classify("TP Conception mécanique Groupe B", G).status).toBe("ignore");
    expect(classify("Python Groupe A", G).status).toBe("keep");
    expect(classify("Python Groupe B", G).status).toBe("ignore");
    expect(classify("Business English Groupe 1", G).status).toBe("keep");
    expect(classify("Business English Groupe 2", G).status).toBe("ignore");
    expect(classify("TEC Groupe 1", G).status).toBe("keep");
    expect(classify("TEC Groupe 2", G).status).toBe("ignore");
  });
  it("cours commun gardé, confusion A/1 signalée", () => {
    expect(classify("Mécanique des fluides", G).status).toBe("keep");
    expect(classify("Business English Groupe A", G).status).toBe("ambiguous");
  });
});
describe("horaires de nuit", () => {
  it("18h-02h = une seule période de 8h", () => { expect(hours(length(shift("2026-11-16", "18:00", "02:00")))).toBe(8); });
  it("le service de la veille déborde sur le lendemain mais n'est pas compté deux fois", () => {
    const a = computeDay("2026-11-17", base());
    expect(a.minutes.travail).toBe(120 + 360); // 00-02 (veille) + 18-24 (jour)
  });
});
describe("exceptions de travail", () => {
  it("modifie uniquement le mardi", () => {
    const d = base(); d.exceptions.push({ id: "e1", date: "2026-11-17", kind: "replace", start_time: "14:00", end_time: "22:00", reason: null, mandatory: true, allow_parallel: false });
    expect(workBlocks("2026-11-17", d)[0].start % 1440).toBe(840);
    expect(workBlocks("2026-11-18", d)[0].start % 1440).toBe(1080);
  });
  it("une semaine entière via un modèle temporaire", () => {
    const d = base(); d.templates.push({ id: "t1", name: "Semaine", kind: "temporaire", is_default: false, active_from: "2026-11-16", active_to: "2026-11-22", priority: 5 });
    d.rules.push({ id: "x", template_id: "t1", weekday: 0, enabled: true, start_time: "15:00", end_time: "23:00", fixed: true, mandatory: true, allow_parallel: false, note: null });
    expect(activeTemplate("2026-11-16", d.templates)?.id).toBe("t1");
    expect(activeTemplate("2026-11-23", d.templates)?.id).toBe("t0");
  });
  it("jour off et heures supplémentaires", () => {
    const d = base(); d.exceptions.push({ id: "o", date: "2026-11-16", kind: "off", start_time: null, end_time: null, reason: null, mandatory: true, allow_parallel: false });
    expect(workBlocks("2026-11-16", d)).toHaveLength(0);
    d.exceptions.push({ id: "s", date: "2026-11-16", kind: "overtime", start_time: "02:00", end_time: "04:00", reason: null, mandatory: true, allow_parallel: false });
    expect(workBlocks("2026-11-16", d)).toHaveLength(1);
  });
});
describe("conflits, parallèle, heures libres", () => {
  it("détecte cours vs travail", () => {
    const d = base(); d.timetable.push({ id: "c", import_id: null, date: "2026-11-16", start_time: "17:00", end_time: "19:00", title: "Python", group_label: "A", status: "keep", kind: "cours", category: "etudes" });
    expect(computeDay("2026-11-16", d).conflicts).toHaveLength(1);
  });
  it("travail parallèle : pas de conflit, pas de double comptage", () => {
    const d = base(); d.rules.forEach((r) => (r.allow_parallel = true)); d.rules.forEach((r) => (r.mandatory = false));
    d.planning.push({ id: "p", date: "2026-11-16", start_time: "20:00", end_time: "21:00", title: "Anglais", category: "anglais", status: "planned", locked: false, allow_parallel: true, task_id: null });
    const a = computeDay("2026-11-16", d);
    expect(a.conflicts).toHaveLength(0);
    expect(a.minutes.travail + a.minutes.anglais).toBe(360); // 18-24 une seule fois
    expect(a.parallelMin).toBeGreaterThan(0);
  });
  it("heures libres : 24h - travail (hors sommeil)", () => {
    const a = computeDay("2026-11-16", base());
    expect(a.freeMin).toBe(1440 - 360 - 120 * 0); // lundi : veille dimanche repos, 18-24 occupé
  });
  it("intervalles", () => {
    expect(merge([{ start: 0, end: 10 }, { start: 5, end: 20 }])).toEqual([{ start: 0, end: 20 }]);
    expect(subtract([{ start: 0, end: 100 }], [{ start: 10, end: 20 }])).toHaveLength(2);
  });
});
describe("planner", () => {
  it("place dans les créneaux libres, jamais sur un service", () => {
    const d = base(); const a = computeDay("2026-11-17", d);
    const r = generatePlan([a], [{ title: "Anglais", category: "anglais", minutesPerDay: 60, minBlock: 30, priority: 1 }], () => 1);
    expect(r.proposals.length).toBeGreaterThan(0);
    const p = r.proposals[0]; const [h] = p.start_time.split(":").map(Number);
    expect(h >= 2 && h < 17).toBe(true);
  });
});
