"use client";
import { useEffect, useMemo, useState } from "react";
import { addDays, fmtHM, hours, length, mondayOf, shift, todayISO, weekday } from "@/lib/time";
import { computeDay } from "@/lib/availability";
import { workBlocks } from "@/lib/work";
import { getUid, useInputs, useRows } from "@/lib/hooks";
import { check, toast } from "@/lib/toast";
import { DAYS, dLabel, hhmm } from "@/lib/fmt";
import { Badge, Btn, Card, Label, Loading, Modal, PageHead } from "@/components/ui";
import type { DayInputs, WorkException, WorkRule } from "@/lib/types";

const KINDS: Record<string, { label: string; kind: WorkException["kind"]; times: boolean }> = {
  overtime: { label: "Heures supplémentaires / prolongation de service", kind: "overtime", times: true },
  replace: { label: "Changement de dernière minute / remplacement / changement de poste", kind: "replace", times: true },
  late: { label: "Retard (nouvelle heure de début)", kind: "late", times: true },
  extra: { label: "Service supplémentaire", kind: "extra", times: true },
  off: { label: "Absence / jour de repos supplémentaire", kind: "off", times: false },
  cancel: { label: "Journée / service annulé", kind: "cancel", times: false },
};
const dur = (s: string, e: string) => hours(length(shift("2000-01-03", s, e)));
const strip = ({ id, created_at, ...r }: any) => r;

export default function Travail() {
  const today = todayISO(), from = addDays(today, -7), to = addDays(today, 120);
  const { sb, inputs, reload } = useInputs(from, to);
  const { rows: history, reload: reloadH } = useRows<any>("work_schedule_history", (q) => q.order("created_at", { ascending: false }).limit(40));
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<(Partial<WorkRule> & { k: string })[]>([]);
  const [modal, setModal] = useState<"quick" | "tpl" | null>(null);

  const sel = inputs?.templates.find((t) => t.id === selId) ?? inputs?.templates.find((t) => t.is_default);
  useEffect(() => { if (sel && !selId) setSelId(sel.id); }, [sel, selId]);
  useEffect(() => { if (inputs && sel) setDraft(inputs.rules.filter((r) => r.template_id === sel.id).sort((a, b) => a.weekday - b.weekday).map((r) => ({ ...r, k: r.id }))); }, [inputs, sel?.id]); // eslint-disable-line

  const log = async (change_type: string, scope: string, pf: string | null, pt: string | null, reason: string | null, before: any, after: any) =>
    sb.from("work_schedule_history").insert({ user_id: await getUid(sb), change_type, scope, period_from: pf, period_to: pt, reason, before, after });

  if (!inputs || !sel) return <Loading />;
  const patch = (k: string, p: Partial<WorkRule>) => setDraft((d) => d.map((r) => (r.k === k ? { ...r, ...p } : r)));

  const saveRules = async () => {
    const before = inputs.rules.filter((r) => r.template_id === sel.id);
    const uid = await getUid(sb);
    if (!check(await sb.from("work_schedule_rules").delete().eq("template_id", sel.id))) return;
    const rows = draft.map(({ k, id, ...r }) => ({ ...r, user_id: uid, template_id: sel.id }));
    if (rows.length && !check(await sb.from("work_schedule_rules").insert(rows))) return;
    await log("modele", sel.is_default ? "permanent" : "modele", sel.active_from, sel.active_to, `Modèle « ${sel.name} » enregistré`, { template_id: sel.id, rules: before.map(strip) }, { rules: rows.length });
    toast("Horaires enregistrés"); reload(); reloadH();
  };
  const delTemplate = async () => {
    if (sel.is_default || !confirm(`Supprimer le modèle « ${sel.name} » ?`)) return;
    if (check(await sb.from("work_schedule_templates").delete().eq("id", sel.id), "Modèle supprimé")) { setSelId(null); reload(); }
  };
  const restore = async (h: any) => {
    if (!confirm("Restaurer cette configuration ? L'état actuel sera lui-même conservé dans l'historique.")) return;
    const uid = await getUid(sb);
    if (h.before?.rules && h.before.template_id) {
      const cur = inputs.rules.filter((r) => r.template_id === h.before.template_id).map(strip);
      await sb.from("work_schedule_rules").delete().eq("template_id", h.before.template_id);
      if (h.before.rules.length) await sb.from("work_schedule_rules").insert(h.before.rules.map((r: any) => ({ ...r, user_id: uid, template_id: h.before.template_id })));
      await log("restauration", "modele", null, null, `Restauration du ${new Date(h.created_at).toLocaleString("fr-FR")}`, { template_id: h.before.template_id, rules: cur }, { restored: h.id });
    } else {
      if (h.after?.added_ids?.length) await sb.from("work_schedule_exceptions").delete().in("id", h.after.added_ids);
      if (h.before?.removed?.length) await sb.from("work_schedule_exceptions").insert(h.before.removed.map((r: any) => ({ ...r, user_id: uid })));
      await log("restauration", "exceptions", h.period_from, h.period_to, `Restauration du ${new Date(h.created_at).toLocaleString("fr-FR")}`, { added: h.after?.added_ids }, { restored: h.id });
    }
    toast("Configuration restaurée"); reload(); reloadH();
  };

  return <>
    <PageHead title="Mes horaires de travail" sub="Horaires habituels + exceptions par date. Une modification n'écrase jamais l'habituel (sauf modification permanente, historisée)."
      actions={<><Btn onClick={() => setModal("quick")}>Modifier mes horaires</Btn><Btn variant="ghost" onClick={() => setModal("tpl")}>Nouveau modèle</Btn></>} />

    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {inputs.templates.map((t) => <button key={t.id} onClick={() => setSelId(t.id)} className={`rounded-full border px-3 py-1 text-sm ${sel.id === t.id ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950" : "dark:border-slate-700"}`}>
          {t.name}{t.is_default && " ★"}{t.active_from && <span className="ml-1 text-xs text-slate-500">{t.active_from.slice(5)} → {t.active_to?.slice(5)}</span>}</button>)}
        <span className="text-xs text-slate-500">Type : {sel.kind}</span>{!sel.is_default && <Btn variant="danger" onClick={delTemplate}>Supprimer ce modèle</Btn>}
      </div>
      <div className="space-y-3">
        {DAYS.map((name, wd) => { const rs = draft.filter((r) => r.weekday === wd); return (
          <div key={wd} className="rounded-xl border p-3 dark:border-slate-800">
            <div className="mb-2 flex items-center justify-between"><b className="text-sm">{name}</b>
              <Btn variant="ghost" onClick={() => setDraft((d) => [...d, { k: crypto.randomUUID(), weekday: wd, enabled: true, start_time: "18:00", end_time: "02:00", fixed: true, mandatory: true, allow_parallel: false, note: null }])}>+ plage</Btn></div>
            {rs.length === 0 && <p className="text-sm text-slate-500">Repos (aucune plage).</p>}
            {rs.map((r) => <div key={r.k} className="mb-2 flex flex-wrap items-end gap-2 text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" checked={!!r.enabled} onChange={(e) => patch(r.k, { enabled: e.target.checked })} />Actif</label>
              <Label t="Début"><input type="time" value={hhmm(r.start_time!)} onChange={(e) => patch(r.k, { start_time: e.target.value })} /></Label>
              <Label t="Fin"><input type="time" value={hhmm(r.end_time!)} onChange={(e) => patch(r.k, { end_time: e.target.value })} /></Label>
              <Badge color="#8b5cf6">{dur(r.start_time!, r.end_time!)} h{r.end_time! <= r.start_time! ? " (traverse minuit)" : ""}</Badge>
              <select value={r.fixed ? "fixe" : "flex"} onChange={(e) => patch(r.k, { fixed: e.target.value === "fixe" })}><option value="fixe">Fixe</option><option value="flex">Flexible</option></select>
              <label className="flex items-center gap-1"><input type="checkbox" checked={!!r.mandatory} onChange={(e) => patch(r.k, { mandatory: e.target.checked })} />Obligatoire</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={!!r.allow_parallel} onChange={(e) => patch(r.k, { allow_parallel: e.target.checked })} />Activités simultanées</label>
              <input placeholder="Pause / note" value={r.note ?? ""} onChange={(e) => patch(r.k, { note: e.target.value })} className="w-40" />
              <button className="text-red-600" onClick={() => setDraft((d) => d.filter((x) => x.k !== r.k))}>Supprimer</button></div>)}
          </div>); })}
      </div>
      <div className="mt-3 flex justify-end"><Btn onClick={saveRules}>Enregistrer ce modèle</Btn></div>
    </Card>

    <ExceptionForm sb={sb} inputs={inputs} onDone={() => { reload(); reloadH(); }} log={log} />
    <ExceptionList sb={sb} inputs={inputs} today={today} onDone={() => { reload(); reloadH(); }} />

    <Card className="mt-4"><h2 className="mb-2 font-medium">Historique des modifications</h2>
      {!history?.length ? <p className="text-sm text-slate-500">Aucune modification.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th>Date</th><th>Type</th><th>Période</th><th>Motif</th><th /></tr></thead><tbody>
        {history.map((h) => <tr key={h.id} className="border-t dark:border-slate-800"><td className="py-1">{new Date(h.created_at).toLocaleString("fr-FR")}</td><td>{h.change_type}{h.scope ? ` · ${h.scope}` : ""}</td><td>{h.period_from ? `${h.period_from} → ${h.period_to ?? ""}` : "—"}</td><td>{h.reason}</td>
          <td>{h.change_type !== "restauration" && (h.before?.rules || h.after?.added_ids || h.before?.removed) && <button className="text-indigo-600" onClick={() => restore(h)}>Restaurer</button>}</td></tr>)}</tbody></table></div>}
    </Card>

    <Modal open={modal === "quick"} onClose={() => setModal(null)} title="Modifier mes horaires"><QuickModify sb={sb} inputs={inputs} log={log} onDone={() => { setModal(null); reload(); reloadH(); }} /></Modal>
    <Modal open={modal === "tpl"} onClose={() => setModal(null)} title="Nouveau modèle d'horaires"><NewTemplate sb={sb} inputs={inputs} onDone={(id) => { setModal(null); setSelId(id); reload(); }} /></Modal>
  </>;
}

function NewTemplate({ sb, inputs, onDone }: { sb: any; inputs: DayInputs; onDone: (id: string) => void }) {
  const [f, setF] = useState({ name: "", kind: "temporaire", from: "", to: "", priority: 5, copy: true });
  const go = async () => {
    if (!f.name) return toast("Donnez un nom au modèle", "err");
    if (f.kind !== "personnalise" && (!f.from || !f.to)) return toast("Indiquez la période d'activation", "err");
    const uid = await getUid(sb);
    const { data, error } = await sb.from("work_schedule_templates").insert({ user_id: uid, name: f.name, kind: f.kind, active_from: f.from || null, active_to: f.to || null, priority: f.priority }).select().single();
    if (error) return toast(error.message, "err");
    const def = inputs.templates.find((t) => t.is_default);
    if (f.copy && def) { const rules = inputs.rules.filter((r) => r.template_id === def.id).map((r) => ({ ...strip(r), user_id: uid, template_id: data.id })); if (rules.length) await sb.from("work_schedule_rules").insert(rules); }
    toast("Modèle créé"); onDone(data.id);
  };
  return <div className="grid gap-3 md:grid-cols-2">
    <Label t="Nom"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Label>
    <Label t="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{["temporaire", "exceptionnel", "vacances", "personnalise"].map((k) => <option key={k}>{k}</option>)}</select></Label>
    <Label t="Actif du"><input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Label>
    <Label t="Actif au"><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Label>
    <Label t="Priorité (le plus haut gagne)"><input type="number" value={f.priority} onChange={(e) => setF({ ...f, priority: +e.target.value })} /></Label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.copy} onChange={(e) => setF({ ...f, copy: e.target.checked })} />Copier les horaires habituels</label>
    <div className="md:col-span-2 flex justify-end"><Btn onClick={go}>Créer</Btn></div></div>;
}

function QuickModify({ sb, inputs, log, onDone }: { sb: any; inputs: DayInputs; log: Function; onDone: () => void }) {
  const today = todayISO();
  const [f, setF] = useState({ scope: "day", date: today, to: today, weeks: 2, mode: "replace", start: "14:00", end: "22:00", mandatory: true, reason: "", wd: [0, 1, 2, 3, 4, 5, 6] });
  const [step, setStep] = useState<"form" | "preview">("form");

  const plan = useMemo(() => {
    const dates: string[] = [];
    const m = mondayOf(f.date);
    if (f.scope === "day") dates.push(f.date);
    else if (f.scope === "week") for (let i = 0; i < 7; i++) dates.push(addDays(m, i));
    else if (f.scope === "weeks") for (let i = 0; i < 7 * f.weeks; i++) dates.push(addDays(m, i));
    else if (f.scope === "period") for (let d = f.date; d <= f.to; d = addDays(d, 1)) dates.push(d);
    const sel = f.scope === "permanent" ? [] : dates.filter((d) => f.scope === "day" || f.wd.includes(weekday(d)));
    const rows = sel.map((d) => ({ date: d, old: workBlocks(d, inputs).map((b) => `${fmtHM(b.start)}–${fmtHM(b.end)}`) }))
      .filter((r) => f.scope === "day" || r.old.length > 0); // multi-jours : seulement les jours réellement travaillés
    const removed = inputs.exceptions.filter((e) => rows.some((r) => r.date === e.date) && ["replace", "off", "cancel", "late"].includes(e.kind));
    const added = rows.map((r) => ({ date: r.date, kind: f.mode === "off" ? "off" : "replace", start_time: f.mode === "off" ? null : f.start, end_time: f.mode === "off" ? null : f.end, reason: f.reason || null, mandatory: f.mandatory, allow_parallel: false }));
    const hyp: DayInputs = { ...inputs, exceptions: [...inputs.exceptions.filter((e) => !removed.includes(e)), ...added.map((a, i) => ({ ...a, id: `h${i}` } as any))] };
    const impacted = new Set<string>(), hard: string[] = [];
    rows.forEach((r) => [r.date, addDays(r.date, 1)].forEach((d) => { const a = computeDay(d, hyp);
      a.conflicts.forEach((c) => { if (c.a.source === "travail" || c.b.source === "travail") { const o = c.a.source === "travail" ? c.b : c.a; if (o.source === "planning") impacted.add(`${d} ${o.title}`); else if (o.source === "cours") hard.push(`${d} ${o.title}`); } }); }));
    return { rows, removed, added, impacted: [...impacted], hard: [...new Set(hard)] };
  }, [f, inputs]);

  const apply = async () => {
    const uid = await getUid(sb);
    if (f.scope === "permanent") {
      const def = inputs.templates.find((t) => t.is_default)!;
      const before = inputs.rules.filter((r) => r.template_id === def.id);
      await sb.from("work_schedule_rules").delete().eq("template_id", def.id).in("weekday", f.wd);
      const rows = f.wd.map((w) => ({ user_id: uid, template_id: def.id, weekday: w, enabled: f.mode !== "off", start_time: f.start, end_time: f.end, fixed: true, mandatory: f.mandatory, allow_parallel: false }));
      if (!check(await sb.from("work_schedule_rules").insert(rows), "Horaires habituels modifiés")) return;
      await log("permanent", "permanent", null, null, f.reason || null, { template_id: def.id, rules: before.map(strip) }, { weekdays: f.wd, mode: f.mode, start: f.start, end: f.end });
    } else {
      if (plan.removed.length) await sb.from("work_schedule_exceptions").delete().in("id", plan.removed.map((e) => e.id));
      const { data, error } = await sb.from("work_schedule_exceptions").insert(plan.added.map((a) => ({ ...a, user_id: uid }))).select("id");
      if (error) return toast(error.message, "err");
      const ds = plan.rows.map((r) => r.date).sort();
      await log("exception", f.scope, ds[0] ?? null, ds[ds.length - 1] ?? null, f.reason || null, { removed: plan.removed.map(strip) }, { added_ids: data.map((x: any) => x.id) });
      toast(`${data.length} jour(s) modifié(s) — horaires habituels conservés`);
    }
    onDone();
  };
  const perm = f.scope === "permanent";
  return step === "form" ? <div className="grid gap-3 md:grid-cols-2">
    <Label t="Portée"><select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}>
      <option value="day">Une seule journée</option><option value="week">Toute une semaine</option><option value="weeks">Plusieurs semaines</option><option value="period">Période personnalisée</option><option value="permanent">Horaires habituels (définitif)</option></select></Label>
    {!perm && <Label t={f.scope === "period" ? "Du" : f.scope === "day" ? "Date" : "Semaine contenant le"}><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Label>}
    {f.scope === "period" && <Label t="Au"><input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></Label>}
    {f.scope === "weeks" && <Label t="Nombre de semaines"><input type="number" min={2} max={26} value={f.weeks} onChange={(e) => setF({ ...f, weeks: +e.target.value })} /></Label>}
    <Label t="Nouveau régime"><select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="replace">Nouveaux horaires</option><option value="off">Repos / pas de travail</option></select></Label>
    {f.mode === "replace" && <><Label t="Début"><input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Label><Label t="Fin"><input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Label></>}
    {f.scope !== "day" && <div className="md:col-span-2 flex flex-wrap gap-3 text-sm">{DAYS.map((d, i) => <label key={d} className="flex items-center gap-1"><input type="checkbox" checked={f.wd.includes(i)} onChange={(e) => setF({ ...f, wd: e.target.checked ? [...f.wd, i] : f.wd.filter((x) => x !== i) })} />{d.slice(0, 3)}</label>)}</div>}
    <Label t="Motif (facultatif)"><input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Label>
    <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={f.mandatory} onChange={(e) => setF({ ...f, mandatory: e.target.checked })} />Obligatoire</label>
    <div className="md:col-span-2 flex justify-end"><Btn onClick={() => (perm || plan.rows.length ? setStep("preview") : toast("Aucun jour concerné par cette modification", "err"))}>Voir les changements</Btn></div>
  </div> : <div className="space-y-3 text-sm">
    {perm ? <p>Les horaires <b>habituels</b> des jours cochés seront remplacés ({f.mode === "off" ? "repos" : `${f.start}–${f.end}`}). L'ancienne configuration sera conservée dans l'historique et restaurable.</p> :
      <table className="w-full"><thead className="text-left text-xs text-slate-500"><tr><th>Date</th><th>Avant</th><th>Après</th></tr></thead><tbody>{plan.rows.map((r) => <tr key={r.date} className="border-t dark:border-slate-800"><td className="py-1">{dLabel(r.date)}</td><td>{r.old.join(", ") || "repos"}</td><td className="font-medium">{f.mode === "off" ? "repos" : `${f.start}–${f.end}`}</td></tr>)}</tbody></table>}
    {plan.hard.length > 0 && <p className="rounded-lg bg-red-50 p-2 text-red-700 dark:bg-red-950">⚠ Conflit avec des cours : {plan.hard.join(" · ")}</p>}
    {plan.impacted.length > 0 && <p className="rounded-lg bg-amber-50 p-2 text-amber-800 dark:bg-amber-950">Activités planifiées à déplacer (rien n'est supprimé) : {plan.impacted.join(" · ")} → régénérez-les depuis « Mon planning intelligent ».</p>}
    <div className="flex justify-between"><Btn variant="ghost" onClick={() => setStep("form")}>Retour</Btn><Btn onClick={apply}>Confirmer et appliquer</Btn></div>
  </div>;
}

function ExceptionForm({ sb, inputs, onDone, log }: { sb: any; inputs: DayInputs; onDone: () => void; log: Function }) {
  const [f, setF] = useState({ type: "overtime", date: todayISO(), start: "02:00", end: "04:00", reason: "", mandatory: true, parallel: false });
  const k = KINDS[f.type];
  const go = async () => {
    if (k.times && (!f.start || !f.end)) return toast("Indiquez début et fin", "err");
    const uid = await getUid(sb);
    const row = { user_id: uid, date: f.date, kind: k.kind, start_time: k.times ? f.start : null, end_time: k.times ? f.end : null, reason: f.reason || null, mandatory: f.mandatory, allow_parallel: f.parallel };
    const removed = ["replace", "off", "cancel", "late"].includes(k.kind) ? inputs.exceptions.filter((e) => e.date === f.date && ["replace", "off", "cancel", "late"].includes(e.kind)) : [];
    if (removed.length) await sb.from("work_schedule_exceptions").delete().in("id", removed.map((e) => e.id));
    const { data, error } = await sb.from("work_schedule_exceptions").insert(row).select("id").single();
    if (error) return toast(error.message, "err");
    await log("exception", k.kind, f.date, f.date, f.reason || null, { removed: removed.map(strip) }, { added_ids: [data.id] });
    toast("Événement enregistré"); onDone();
  };
  return <Card className="mt-4"><h2 className="mb-2 font-medium">Événement professionnel exceptionnel</h2>
    <div className="grid gap-3 md:grid-cols-4">
      <Label t="Type"><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{Object.entries(KINDS).map(([key, v]) => <option key={key} value={key}>{v.label}</option>)}</select></Label>
      <Label t="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Label>
      {k.times && <><Label t="Début"><input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Label><Label t="Fin"><input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Label></>}
      <Label t="Motif / note"><input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Label>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.mandatory} onChange={(e) => setF({ ...f, mandatory: e.target.checked })} />Obligatoire</label>
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.parallel} onChange={(e) => setF({ ...f, parallel: e.target.checked })} />Activités simultanées</label>
      <div className="flex items-end justify-end"><Btn onClick={go}>Ajouter</Btn></div></div></Card>;
}

function ExceptionList({ sb, inputs, today, onDone }: { sb: any; inputs: DayInputs; today: string; onDone: () => void }) {
  const list = inputs.exceptions.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return <Card className="mt-4"><h2 className="mb-2 font-medium">Exceptions à venir</h2>{list.length === 0 ? <p className="text-sm text-slate-500">Aucune exception : horaires habituels partout.</p> :
    <ul className="divide-y text-sm dark:divide-slate-800">{list.map((e) => <li key={e.id} className="flex items-center justify-between py-1.5"><span>{dLabel(e.date)} — <b>{e.kind}</b> {e.start_time ? `${hhmm(e.start_time)}–${hhmm(e.end_time!)}` : ""} {e.reason && <i className="text-slate-500">({e.reason})</i>}</span>
      <button className="text-red-600" onClick={async () => { if (check(await sb.from("work_schedule_exceptions").delete().eq("id", e.id), "Exception supprimée")) onDone(); }}>Retirer</button></li>)}</ul>}</Card>;
}
