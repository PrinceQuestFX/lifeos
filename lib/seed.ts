import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORY_COLORS, CATEGORY_LABELS, type Category } from "./types";

/** Valeurs initiales demandées. Sommeil/réveil/déplacements restent VIDES : ils sont à configurer, jamais inventés. */
export async function seedDefaults(sb: SupabaseClient, uid: string) {
  await sb.from("profiles").upsert({ id: uid });
  await sb.from("user_preferences").upsert({ user_id: uid, group_main: "A", group_english: "1", group_tec: "1" });
  await sb.from("school_groups").upsert([
    { user_id: uid, subject_kind: "main", group_label: "A" },
    { user_id: uid, subject_kind: "english", group_label: "1" },
    { user_id: uid, subject_kind: "tec", group_label: "1" },
  ], { onConflict: "user_id,subject_kind" });
  await sb.from("activity_categories").upsert(
    (Object.keys(CATEGORY_COLORS) as Category[]).map((k) => ({ user_id: uid, key: k, label: CATEGORY_LABELS[k], color: CATEGORY_COLORS[k], allow_parallel: false })),
    { onConflict: "user_id,key" });
  const { data: t } = await sb.from("work_schedule_templates")
    .insert({ user_id: uid, name: "Planning habituel", kind: "habituel", is_default: true }).select().single();
  if (t) {
    const rules = [0, 1, 2, 3, 4].map((w) => ({ weekday: w, enabled: true, start_time: "18:00", end_time: "02:00" }))
      .concat([{ weekday: 5, enabled: true, start_time: "12:00", end_time: "19:00" }, { weekday: 6, enabled: false, start_time: "12:00", end_time: "19:00" }]);
    await sb.from("work_schedule_rules").insert(rules.map((r) => ({ ...r, user_id: uid, template_id: t.id, fixed: true, mandatory: true, allow_parallel: false })));
  }
  await sb.from("recurring_rules").insert([0, 1, 2, 3, 4].map((w) => ({ user_id: uid, kind: "trading", weekday: w, start_time: "10:00", end_time: "18:00", label: "Trading" })));
  await sb.from("activities").insert({ user_id: uid, title: "Anglais", category: "anglais", minutes_per_day: 60, min_block: 30, priority: 2 });
}
