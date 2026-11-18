import type { Interval } from "./time";

export type Category = "etudes" | "travail" | "trading" | "sport" | "anglais" | "revisions" | "repos" | "repas" | "trajet" | "sommeil" | "autre";
export const CATEGORY_COLORS: Record<Category, string> = {
  etudes: "#3b82f6", travail: "#8b5cf6", trading: "#f97316", sport: "#22c55e", anglais: "#14b8a6",
  revisions: "#6366f1", repos: "#9ca3af", repas: "#eab308", trajet: "#64748b", sommeil: "#475569", autre: "#ec4899",
};
export const CATEGORY_LABELS: Record<Category, string> = {
  etudes: "Études", travail: "Travail", trading: "Trading", sport: "Sport", anglais: "Anglais",
  revisions: "Révisions", repos: "Repos", repas: "Repas", trajet: "Déplacements", sommeil: "Sommeil", autre: "Autre",
};

export type Prefs = {
  tz: string; group_main: string; group_english: string; group_tec: string;
  sleep_start: string | null; sleep_end: string | null; commute_min: number;
  setup_done: boolean;
};
export type WorkTemplate = { id: string; name: string; kind: string; is_default: boolean; active_from: string | null; active_to: string | null; priority: number };
export type WorkRule = {
  id: string; template_id: string; weekday: number; enabled: boolean; start_time: string; end_time: string;
  fixed: boolean; mandatory: boolean; allow_parallel: boolean; note: string | null;
};
export type WorkException = {
  id: string; date: string; kind: "replace" | "off" | "extra" | "overtime" | "late" | "cancel";
  start_time: string | null; end_time: string | null; reason: string | null; mandatory: boolean; allow_parallel: boolean;
};
export type TimetableEvent = {
  id: string; import_id: string | null; date: string; start_time: string; end_time: string; title: string;
  group_label: string | null; status: "keep" | "ignore" | "ambiguous"; kind: "cours" | "evaluation" | "ferie" | "autre"; category: Category;
};
export type PlanningEvent = {
  id: string; date: string; start_time: string; end_time: string; title: string; category: Category;
  status: "planned" | "done" | "skipped"; locked: boolean; allow_parallel: boolean; task_id: string | null;
};
export type Block = Interval & {
  id: string; title: string; category: Category; source: "cours" | "travail" | "trading" | "planning" | "sommeil" | "repas" | "trajet";
  exclusive: boolean; mandatory: boolean; date: string;
};
export type DayInputs = {
  prefs: Prefs; templates: WorkTemplate[]; rules: WorkRule[]; exceptions: WorkException[];
  timetable: TimetableEvent[]; planning: PlanningEvent[];
  trading: { weekday: number; start_time: string; end_time: string; enabled: boolean }[];
  meals: { start_time: string; end_time: string; title: string }[];
};
