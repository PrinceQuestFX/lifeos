import type { SupabaseClient } from "@supabase/supabase-js";
import type { DayInputs, Prefs } from "./types";

/** Charge tout ce qu'il faut pour calculer une plage de dates (+1 jour de marge de chaque côté pour les services de nuit). */
export async function loadInputs(sb: SupabaseClient, from: string, to: string): Promise<DayInputs> {
  const q = (t: string) => sb.from(t).select("*");
  const [p, tpl, rules, exc, tt, pl, rec] = await Promise.all([
    sb.from("user_preferences").select("*").maybeSingle(),
    q("work_schedule_templates"), q("work_schedule_rules"),
    q("work_schedule_exceptions").gte("date", from).lte("date", to),
    q("timetable_events").gte("date", from).lte("date", to),
    q("planning_events").gte("date", from).lte("date", to),
    q("recurring_rules").eq("enabled", true),
  ]);
  const prefs: Prefs = { tz: "Africa/Casablanca", group_main: "A", group_english: "1", group_tec: "1", sleep_start: null, sleep_end: null, commute_min: 0, setup_done: false, ...(p.data ?? {}) };
  const rr = (rec.data ?? []) as any[];
  return {
    prefs, templates: tpl.data ?? [], rules: rules.data ?? [], exceptions: exc.data ?? [],
    timetable: tt.data ?? [], planning: pl.data ?? [],
    trading: rr.filter((r) => r.kind === "trading").map((r) => ({ weekday: r.weekday, start_time: r.start_time, end_time: r.end_time, enabled: true })),
    meals: rr.filter((r) => r.kind === "repas").map((r) => ({ start_time: r.start_time, end_time: r.end_time, title: r.label ?? "Repas" })),
  } as DayInputs;
}
