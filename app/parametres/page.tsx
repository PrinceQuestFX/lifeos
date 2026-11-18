"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getUid, useRows, useSB } from "@/lib/hooks";
import { check, toast } from "@/lib/toast";
import { CATEGORY_LABELS, type Category } from "@/lib/types";
import { DAYS, hhmm } from "@/lib/fmt";
import { Btn, Card, Label, Loading, PageHead } from "@/components/ui";

export default function Page() { return <Suspense fallback={<Loading />}><Params /></Suspense>; }

function Params() {
  const sb = useSB(), router = useRouter(), setup = useSearchParams().get("setup") === "1";
  const [p, setP] = useState<any>(null);
  const { rows: rec, reload: rr } = useRows<any>("recurring_rules", (q) => q.order("weekday"));
  const { rows: acts, reload: ra } = useRows<any>("activities", (q) => q.order("priority"));
  const { rows: cats, reload: rc } = useRows<any>("activity_categories");
  const [meal, setMeal] = useState({ label: "Déjeuner", s: "13:00", e: "13:45" });
  const [act, setAct] = useState({ title: "", category: "sport", mpd: 45, block: 30, prio: 3, wd: [0, 2, 4], parallel: false });
  useEffect(() => { sb.from("user_preferences").select("*").maybeSingle().then((r) => setP(r.data)); }, [sb]);
  if (!p || !rec || !acts || !cats) return <Loading />;

  const save = async (finish = false) => {
    const { error } = await sb.from("user_preferences").update({ group_main: p.group_main, group_english: p.group_english, group_tec: p.group_tec, sleep_start: p.sleep_start || null, sleep_end: p.sleep_end || null, commute_min: +p.commute_min || 0, setup_done: finish || p.setup_done, updated_at: new Date().toISOString() }).eq("user_id", await getUid(sb));
    if (!check({ error }, "Paramètres enregistrés")) return;
    await sb.from("school_groups").upsert([{ subject_kind: "main", group_label: p.group_main }, { subject_kind: "english", group_label: p.group_english }, { subject_kind: "tec", group_label: p.group_tec }].map((g) => ({ ...g, user_id: p.user_id })), { onConflict: "user_id,subject_kind" });
    if (finish) router.replace("/");
  };
  const trading = DAYS.map((_, w) => rec.find((r) => r.kind === "trading" && r.weekday === w));
  const setTrading = async (w: number, patch: any) => {
    const cur = trading[w]; const uid = await getUid(sb);
    if (cur) await sb.from("recurring_rules").update(patch).eq("id", cur.id); else await sb.from("recurring_rules").insert({ user_id: uid, kind: "trading", weekday: w, start_time: "10:00", end_time: "18:00", label: "Trading", ...patch });
    rr();
  };
  const addAct = async () => { if (!act.title) return toast("Titre requis", "err");
    if (check(await sb.from("activities").insert({ user_id: await getUid(sb), title: act.title, category: act.category, minutes_per_day: act.mpd, min_block: act.block, priority: act.prio, weekdays: act.wd, allow_parallel: act.parallel }), "Activité ajoutée")) { setAct({ ...act, title: "" }); ra(); } };

  return <>
    <PageHead title="Paramètres" sub={setup ? "Configuration initiale — complétez ce qui vous concerne, rien n'est inventé." : "Groupes, horaires habituels, préférences"} actions={<Btn onClick={() => save(setup)}>{setup ? "Terminer la configuration" : "Enregistrer"}</Btn>} />
    {setup && <Card className="mb-4 border-indigo-300 bg-indigo-50 text-sm dark:bg-indigo-950/40">Valeurs préremplies : groupe A, anglais 1, TEC 1, chatting lun–ven 18h–02h / sam 12h–19h, trading lun–ven 10h–18h, anglais 1 h/jour. À vous de définir : coucher, réveil, déplacements, programme de sport, repas et priorités ci-dessous.</Card>}
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="mb-2 font-medium">Groupes scolaires (filtrage automatique)</h2><div className="grid grid-cols-3 gap-3">
        <Label t="Matières A/B"><input value={p.group_main} onChange={(e) => setP({ ...p, group_main: e.target.value.toUpperCase() })} /></Label>
        <Label t="Business English"><input value={p.group_english} onChange={(e) => setP({ ...p, group_english: e.target.value })} /></Label>
        <Label t="TEC / Communication"><input value={p.group_tec} onChange={(e) => setP({ ...p, group_tec: e.target.value })} /></Label></div></Card>
      <Card><h2 className="mb-2 font-medium">Rythme de vie</h2><div className="grid grid-cols-3 gap-3">
        <Label t="Coucher"><input type="time" value={p.sleep_start ? hhmm(p.sleep_start) : ""} onChange={(e) => setP({ ...p, sleep_start: e.target.value })} /></Label>
        <Label t="Réveil"><input type="time" value={p.sleep_end ? hhmm(p.sleep_end) : ""} onChange={(e) => setP({ ...p, sleep_end: e.target.value })} /></Label>
        <Label t="Trajet (min, aller)"><input type="number" value={p.commute_min} onChange={(e) => setP({ ...p, commute_min: e.target.value })} /></Label></div>
        <p className="mt-2 text-xs text-slate-500">Laissés vides, le sommeil et les trajets ne sont pas comptés. Fuseau : {p.tz}.</p></Card>
      <Card><h2 className="mb-2 font-medium">Horaires de trading</h2><div className="space-y-1.5 text-sm">{DAYS.map((d, w) => { const t = trading[w]; return <div key={w} className="flex items-center gap-2"><label className="flex w-28 items-center gap-1"><input type="checkbox" checked={!!t?.enabled} onChange={(e) => setTrading(w, { enabled: e.target.checked })} />{d}</label>
        <input type="time" disabled={!t?.enabled} value={t ? hhmm(t.start_time) : "10:00"} onChange={(e) => setTrading(w, { start_time: e.target.value })} /><input type="time" disabled={!t?.enabled} value={t ? hhmm(t.end_time) : "18:00"} onChange={(e) => setTrading(w, { end_time: e.target.value })} /></div>; })}</div></Card>
      <Card><h2 className="mb-2 font-medium">Repas</h2><ul className="mb-2 text-sm">{rec.filter((r) => r.kind === "repas").map((r) => <li key={r.id} className="flex justify-between py-0.5">{r.label} {hhmm(r.start_time)}–{hhmm(r.end_time)}<button className="text-red-600" onClick={async () => { await sb.from("recurring_rules").delete().eq("id", r.id); rr(); }}>✕</button></li>)}</ul>
        <div className="flex flex-wrap items-end gap-2"><Label t="Repas"><input value={meal.label} onChange={(e) => setMeal({ ...meal, label: e.target.value })} /></Label><input type="time" value={meal.s} onChange={(e) => setMeal({ ...meal, s: e.target.value })} /><input type="time" value={meal.e} onChange={(e) => setMeal({ ...meal, e: e.target.value })} />
          <Btn onClick={async () => { const uid = await getUid(sb); for (let w = 0; w < 7; w++) await sb.from("recurring_rules").insert({ user_id: uid, kind: "repas", weekday: w, start_time: meal.s, end_time: meal.e, label: meal.label }); rr(); }}>Ajouter (tous les jours)</Btn></div></Card>
    </div>
    <Card className="mt-4"><h2 className="mb-2 font-medium">Activités à planifier (anglais, sport, révisions…)</h2>
      <table className="mb-3 w-full text-sm"><tbody>{acts.map((a) => <tr key={a.id} className="border-t dark:border-slate-800"><td className="py-1">{a.title}</td><td>{CATEGORY_LABELS[a.category as Category]}</td><td>{a.minutes_per_day} min/j</td><td>bloc ≥ {a.min_block} min</td><td>P{a.priority}</td><td>{(a.weekdays ?? [0, 1, 2, 3, 4, 5, 6]).map((d: number) => DAYS[d][0]).join("")}</td><td>{a.allow_parallel ? "simultané OK" : "exclusive"}</td>
        <td><button className="text-red-600" onClick={async () => { await sb.from("activities").delete().eq("id", a.id); ra(); }}>✕</button></td></tr>)}</tbody></table>
      <div className="flex flex-wrap items-end gap-2 text-sm"><Label t="Titre"><input value={act.title} onChange={(e) => setAct({ ...act, title: e.target.value })} /></Label>
        <Label t="Catégorie"><select value={act.category} onChange={(e) => setAct({ ...act, category: e.target.value })}>{Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Label>
        <Label t="Min / jour"><input type="number" className="w-20" value={act.mpd} onChange={(e) => setAct({ ...act, mpd: +e.target.value })} /></Label><Label t="Bloc min"><input type="number" className="w-20" value={act.block} onChange={(e) => setAct({ ...act, block: +e.target.value })} /></Label>
        <Label t="Priorité"><select value={act.prio} onChange={(e) => setAct({ ...act, prio: +e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></Label>
        <div className="flex gap-1">{DAYS.map((d, i) => <label key={d}><input type="checkbox" checked={act.wd.includes(i)} onChange={(e) => setAct({ ...act, wd: e.target.checked ? [...act.wd, i] : act.wd.filter((x) => x !== i) })} />{d[0]}</label>)}</div>
        <label className="flex items-center gap-1"><input type="checkbox" checked={act.parallel} onChange={(e) => setAct({ ...act, parallel: e.target.checked })} />Simultanée avec le travail</label><Btn onClick={addAct}>Ajouter</Btn></div>
      <p className="mt-2 text-xs text-slate-500">Programme sportif : ajoutez ici vos séances (jours, durée, bloc minimal) quand il sera défini.</p></Card>
    <Card className="mt-4"><h2 className="mb-2 font-medium">Catégories : activités simultanées autorisées par défaut</h2><div className="flex flex-wrap gap-4 text-sm">{cats.map((c) => <label key={c.id} className="flex items-center gap-1"><input type="checkbox" checked={c.allow_parallel} onChange={async (e) => { await sb.from("activity_categories").update({ allow_parallel: e.target.checked }).eq("id", c.id); rc(); }} />{c.label}</label>)}</div></Card>
  </>;
}
