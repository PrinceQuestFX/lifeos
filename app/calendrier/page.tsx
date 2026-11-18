"use client";
import { useMemo, useState } from "react";
import { addDays, dayStart, fmtHM, mondayOf, todayISO, toMin } from "@/lib/time";
import { computeRange, dateRange } from "@/lib/availability";
import { getUid, useInputs } from "@/lib/hooks";
import { check, toast } from "@/lib/toast";
import { CATEGORY_COLORS, CATEGORY_LABELS, type Block, type Category } from "@/lib/types";
import { dLabel, fh } from "@/lib/fmt";
import { Btn, Card, Label, Loading, Modal, PageHead } from "@/components/ui";

type View = "jour" | "semaine" | "mois" | "chrono";
const PX = 44; // px / heure

export default function Calendrier() {
  const [view, setView] = useState<View>("semaine"), [anchor, setAnchor] = useState(todayISO()), [sel, setSel] = useState<Block | null>(null), [add, setAdd] = useState(false);
  const mon = mondayOf(anchor), monthStart = anchor.slice(0, 8) + "01";
  const from = view === "jour" || view === "chrono" ? anchor : view === "semaine" ? mon : addDays(monthStart, -weekdayN(monthStart));
  const to = view === "jour" || view === "chrono" ? anchor : view === "semaine" ? addDays(mon, 6) : addDays(from, 41);
  const { sb, inputs, reload } = useInputs(from, to);
  const days = useMemo(() => (inputs ? computeRange(dateRange(from, to), inputs) : []), [inputs, from, to]);
  if (!inputs) return <Loading />;
  const step = view === "mois" ? 30 : view === "semaine" ? 7 : 1;
  const conflictIds = new Set(days.flatMap((d) => d.conflicts.flatMap((c) => [c.a.id, c.b.id])));
  const planning = (id: string) => inputs.planning.find((p) => p.id === id);

  const drop = async (e: React.DragEvent, date: string) => {
    const id = e.dataTransfer.getData("id"), p = planning(id); if (!p) return;
    if (p.locked && !confirm("Cet événement est verrouillé. Le déplacer quand même ?")) return;
    const y = e.clientY - (e.currentTarget as HTMLElement).getBoundingClientRect().top;
    const start = Math.round(((y / PX) * 60) / 15) * 15, d = ((toMin(p.end_time) - toMin(p.start_time)) + 1440) % 1440 || 60;
    if (check(await sb.from("planning_events").update({ date, start_time: fmtHM(start), end_time: fmtHM(start + d) }).eq("id", id), "Événement déplacé")) reload();
  };
  const setStatus = async (id: string, status: string) => { if (check(await sb.from("planning_events").update({ status }).eq("id", id))) { setSel(null); reload(); } };
  const del = async (id: string) => { if (confirm("Supprimer cet événement ?") && check(await sb.from("planning_events").delete().eq("id", id), "Supprimé")) { setSel(null); reload(); } };

  return <>
    <PageHead title="Mon calendrier" sub={`${dLabel(from)} → ${dLabel(to)}`} actions={<>
      {(["jour", "semaine", "mois", "chrono"] as View[]).map((v) => <Btn key={v} variant={view === v ? "primary" : "ghost"} onClick={() => setView(v)}>{v === "chrono" ? "Chronologie" : v[0].toUpperCase() + v.slice(1)}</Btn>)}
      <Btn variant="ghost" onClick={() => setAnchor(addDays(anchor, -step))}>←</Btn><Btn variant="ghost" onClick={() => setAnchor(todayISO())}>Aujourd'hui</Btn><Btn variant="ghost" onClick={() => setAnchor(addDays(anchor, step))}>→</Btn><Btn onClick={() => setAdd(true)}>+ Événement</Btn></>} />
    <div className="mb-2 flex flex-wrap gap-2 text-xs">{(["etudes", "travail", "trading", "sport", "anglais", "revisions", "repos"] as Category[]).map((c) => <span key={c} className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded" style={{ background: CATEGORY_COLORS[c] }} />{CATEGORY_LABELS[c]}</span>)}<span className="text-red-600">▭ rouge = conflit</span></div>

    {(view === "jour" || view === "semaine") && <Card className="overflow-x-auto p-0"><div className="flex min-w-[720px]">
      <div className="w-12 shrink-0 border-r pt-8 text-right text-[10px] text-slate-500 dark:border-slate-800">{Array.from({ length: 24 }, (_, h) => <div key={h} style={{ height: PX }}>{h}h</div>)}</div>
      {days.map((d) => <div key={d.date} className="min-w-0 flex-1 border-r last:border-0 dark:border-slate-800">
        <div className={`h-8 text-center text-xs leading-8 ${d.date === todayISO() ? "font-bold text-indigo-600" : ""}`}>{dLabel(d.date)}</div>
        <div className="relative" style={{ height: PX * 24 }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => drop(e, d.date)}>
          {Array.from({ length: 24 }, (_, h) => <div key={h} className="absolute inset-x-0 border-t border-slate-100 dark:border-slate-800" style={{ top: h * PX }} />)}
          {d.usable.map((u, i) => <div key={i} className="absolute inset-x-0 bg-emerald-400/10" style={{ top: ((u.start - dayStart(d.date)) / 60) * PX, height: ((u.end - u.start) / 60) * PX }} />)}
          {d.blocks.filter((b) => b.category !== "repas").map((b) => { const top = ((b.start - dayStart(d.date)) / 60) * PX, h = Math.max(((b.end - b.start) / 60) * PX, 14), isPlan = b.source === "planning";
            return <div key={b.id + b.start} draggable={isPlan} onDragStart={(e) => e.dataTransfer.setData("id", b.id)} onClick={() => setSel(b)}
              className={`absolute inset-x-0.5 cursor-pointer overflow-hidden rounded px-1 text-[11px] leading-tight text-white ${conflictIds.has(b.id) ? "ring-2 ring-red-500" : ""} ${b.exclusive ? "" : "opacity-60"}`}
              style={{ top, height: h, background: CATEGORY_COLORS[b.category] }} title={`${b.title} ${fmtHM(b.start)}–${fmtHM(b.end)}`}>{b.title}<br />{fmtHM(b.start)}–{fmtHM(b.end)}</div>; })}
        </div></div>)}</div></Card>}

    {view === "mois" && <div className="grid grid-cols-7 gap-1.5">{["L", "M", "M", "J", "V", "S", "D"].map((x, i) => <div key={i} className="text-center text-xs text-slate-500">{x}</div>)}
      {days.map((d) => <button key={d.date} onClick={() => { setAnchor(d.date); setView("jour"); }} className={`min-h-[84px] rounded-lg border p-1.5 text-left text-xs dark:border-slate-800 ${d.date.slice(0, 7) !== anchor.slice(0, 7) ? "opacity-40" : ""} ${d.date === todayISO() ? "border-indigo-500" : ""}`}>
        <div className="font-medium">{+d.date.slice(8)}</div>{d.conflicts.length > 0 && <div className="text-red-600">⚠ {d.conflicts.length}</div>}
        <div className="mt-1 flex flex-wrap gap-0.5">{[...new Set(d.blocks.map((b) => b.category))].filter((c) => c !== "repas" && c !== "sommeil").map((c) => <i key={c} className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLORS[c] }} />)}</div>
        <div className="mt-1 text-emerald-600">{fh(d.usableMin)} libres</div></button>)}</div>}

    {view === "chrono" && <Card>{days.map((d) => { const items = [...d.blocks.map((b) => ({ s: b.start, e: b.end, t: b.title, c: CATEGORY_COLORS[b.category], free: false, b })), ...d.usable.map((u) => ({ s: u.start, e: u.end, t: "Créneau libre", c: "#10b981", free: true, b: null as Block | null }))].sort((a, b) => a.s - b.s);
      return <div key={d.date}><h3 className="mb-2 font-medium">{dLabel(d.date)}</h3><ol className="relative ml-3 space-y-2 border-l pl-4 dark:border-slate-700">{items.map((it, i) => <li key={i} onClick={() => it.b && setSel(it.b)} className="relative cursor-pointer text-sm"><i className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full" style={{ background: it.c }} /><span className="tabular-nums text-slate-500">{fmtHM(it.s)}–{fmtHM(it.e)}</span> {it.t}{it.b && conflictIds.has(it.b.id) && <b className="ml-2 text-red-600">conflit</b>}</li>)}</ol></div>; })}</Card>}

    <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.title ?? ""}>{sel && <div className="space-y-2 text-sm">
      <p>{CATEGORY_LABELS[sel.category]} · {fmtHM(sel.start)}–{fmtHM(sel.end)} · {sel.exclusive ? "exclusive" : "activités simultanées autorisées"}</p>
      {days.flatMap((d) => d.conflicts).filter((c) => c.a.id === sel.id || c.b.id === sel.id).map((c, i) => <p key={i} className="text-red-600">⚠ Chevauche « {c.a.id === sel.id ? c.b.title : c.a.title} »{c.hard ? " (conflit ferme)" : ""}</p>)}
      {sel.source === "planning" ? <div className="flex flex-wrap gap-2 pt-2"><Btn onClick={() => setStatus(sel.id, "done")}>Terminé</Btn><Btn variant="ghost" onClick={() => setStatus(sel.id, "skipped")}>Non réalisé</Btn>
        <Btn variant="ghost" onClick={async () => { const p = planning(sel.id)!; check(await sb.from("planning_events").update({ locked: !p.locked }).eq("id", sel.id), p.locked ? "Déverrouillé" : "Verrouillé"); setSel(null); reload(); }}>Verrouiller / déverrouiller</Btn><Btn variant="danger" onClick={() => del(sel.id)}>Supprimer</Btn></div>
        : <p className="text-slate-500">Source : {sel.source}. Modifiez-la depuis « {sel.source === "travail" ? "Mes horaires de travail" : sel.source === "cours" ? "Importer mon emploi du temps" : "Paramètres"} ».</p>}</div>}</Modal>
    <AddEvent open={add} onClose={() => setAdd(false)} sb={sb} date={anchor} onDone={() => { setAdd(false); reload(); }} />
  </>;
}
const weekdayN = (iso: string) => (new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7;

function AddEvent({ open, onClose, sb, date, onDone }: { open: boolean; onClose: () => void; sb: any; date: string; onDone: () => void }) {
  const [f, setF] = useState({ title: "", category: "revisions" as Category, date, start: "10:00", end: "11:00", parallel: false });
  const go = async () => { if (!f.title) return toast("Titre requis", "err");
    if (check(await sb.from("planning_events").insert({ user_id: await getUid(sb), date: f.date, start_time: f.start, end_time: f.end, title: f.title, category: f.category, allow_parallel: f.parallel }), "Événement ajouté")) onDone(); };
  return <Modal open={open} onClose={onClose} title="Nouvel événement"><div className="grid gap-3 md:grid-cols-2">
    <Label t="Titre"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Label>
    <Label t="Catégorie"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Category })}>{(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></Label>
    <Label t="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Label><div />
    <Label t="Début"><input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Label><Label t="Fin"><input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.parallel} onChange={(e) => setF({ ...f, parallel: e.target.checked })} />Autoriser les activités simultanées</label>
    <div className="flex justify-end"><Btn onClick={go}>Ajouter</Btn></div></div></Modal>;
}
