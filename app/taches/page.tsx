"use client";
import { useState } from "react";
import { addDays, todayISO } from "@/lib/time";
import { getUid, useRows } from "@/lib/hooks";
import { check, toast } from "@/lib/toast";
import { CATEGORY_LABELS, type Category } from "@/lib/types";
import { Btn, Card, Empty, Label, Loading, PageHead } from "@/components/ui";

const NEXT: Record<string, string> = { todo: "doing", doing: "done", done: "todo" };
const LBL: Record<string, string> = { todo: "À faire", doing: "En cours", done: "Terminé" };

export default function Taches() {
  const { sb, rows, reload } = useRows<any>("tasks", (q) => q.order("due_date", { ascending: true, nullsFirst: false }));
  const [f, setF] = useState({ title: "", category: "autre", priority: 3, due: "", est: "", recurrence: "", description: "" }), [filter, setFilter] = useState("actives");
  if (!rows) return <Loading />;
  const parents = rows.filter((t) => !t.parent_id), kids = (id: string) => rows.filter((t) => t.parent_id === id);
  const progress = (t: any) => { const k = kids(t.id); return k.length ? Math.round((k.filter((x) => x.status === "done").length / k.length) * 100) : t.status === "done" ? 100 : t.status === "doing" ? 50 : 0; };
  const all = parents.length ? Math.round(parents.reduce((a, t) => a + progress(t), 0) / parents.length) : 0;
  const add = async () => { if (!f.title) return toast("Titre requis", "err");
    if (check(await sb.from("tasks").insert({ user_id: await getUid(sb), title: f.title, description: f.description || null, category: f.category, priority: f.priority, due_date: f.due || null, est_minutes: f.est ? +f.est : null, recurrence: f.recurrence || null }))) { setF({ ...f, title: "", description: "" }); reload(); } };
  const cycle = async (t: any) => {
    const status = NEXT[t.status];
    if (!check(await sb.from("tasks").update({ status }).eq("id", t.id))) return;
    if (status === "done" && t.recurrence) { // tâche récurrente : crée la prochaine occurrence
      const base = t.due_date ?? todayISO();
      await sb.from("tasks").insert({ user_id: t.user_id, title: t.title, description: t.description, category: t.category, priority: t.priority, est_minutes: t.est_minutes, recurrence: t.recurrence, due_date: addDays(base, t.recurrence === "daily" ? 1 : 7) });
      toast("Prochaine occurrence créée");
    }
    reload();
  };
  const sub = async (p: any, checklist: boolean) => { const title = prompt(checklist ? "Élément de checklist :" : "Sous-tâche :"); if (title && check(await sb.from("tasks").insert({ user_id: p.user_id, parent_id: p.id, title, is_checklist_item: checklist, category: p.category }))) reload(); };
  const del = async (id: string) => { if (confirm("Supprimer (et ses sous-éléments) ?") && check(await sb.from("tasks").delete().eq("id", id))) reload(); };
  const shown = parents.filter((t) => filter === "toutes" || (filter === "actives" ? t.status !== "done" : t.status === "done"));
  const Row = ({ t, child }: { t: any; child?: boolean }) => <div className={`flex items-center gap-2 text-sm ${child ? "ml-6 py-0.5" : "py-1.5"}`}>
    <button onClick={() => cycle(t)} className={`h-5 w-5 shrink-0 rounded border ${t.status === "done" ? "bg-emerald-500 text-white" : t.status === "doing" ? "bg-amber-300" : ""}`} aria-label="Changer le statut">{t.status === "done" && "✓"}</button>
    <span className={t.status === "done" ? "line-through opacity-60" : ""}>{t.is_checklist_item ? "☐ " : ""}{t.title}</span>
    {!child && <><span className="text-xs text-slate-500">{CATEGORY_LABELS[t.category as Category] ?? t.category} · P{t.priority}{t.due_date ? ` · ${t.due_date}` : ""}{t.est_minutes ? ` · ${t.est_minutes} min` : ""}{t.recurrence ? ` · ${t.recurrence === "daily" ? "quotidienne" : "hebdo"}` : ""}</span><span className="text-xs">{LBL[t.status]}</span></>}
    <span className="ml-auto flex gap-2 text-xs">{!child && <><button className="text-indigo-600" onClick={() => sub(t, false)}>+ sous-tâche</button><button className="text-indigo-600" onClick={() => sub(t, true)}>+ checklist</button></>}<button className="text-red-600" onClick={() => del(t.id)}>✕</button></span></div>;
  return <>
    <PageHead title="Mes tâches" sub={`Avancement global : ${all} %`} actions={["actives", "terminées", "toutes"].map((x) => <Btn key={x} variant={filter === x ? "primary" : "ghost"} onClick={() => setFilter(x)}>{x}</Btn>)} />
    <Card className="mb-4"><div className="grid gap-3 md:grid-cols-6">
      <div className="md:col-span-2"><Label t="Titre"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} /></Label></div>
      <Label t="Catégorie"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Label>
      <Label t="Priorité (1 = haute)"><select value={f.priority} onChange={(e) => setF({ ...f, priority: +e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></Label>
      <Label t="Échéance"><input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Label>
      <Label t="Durée (min)"><input type="number" value={f.est} onChange={(e) => setF({ ...f, est: e.target.value })} /></Label>
      <Label t="Récurrence"><select value={f.recurrence} onChange={(e) => setF({ ...f, recurrence: e.target.value })}><option value="">Ponctuelle</option><option value="daily">Quotidienne</option><option value="weekly">Hebdomadaire</option></select></Label>
      <div className="md:col-span-4"><Label t="Description"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Label></div><div className="flex items-end justify-end"><Btn onClick={add}>Ajouter</Btn></div></div></Card>
    <Card>{shown.length === 0 ? <Empty>Aucune tâche.</Empty> : <div className="divide-y dark:divide-slate-800">{shown.map((t) => <div key={t.id} className="py-1"><Row t={t} />
      {kids(t.id).length > 0 && <div className="mb-1 ml-7 h-1.5 w-40 overflow-hidden rounded bg-slate-200 dark:bg-slate-700"><div className="h-full bg-emerald-500" style={{ width: `${progress(t)}%` }} /></div>}{kids(t.id).map((k) => <Row key={k.id} t={k} child />)}</div>)}</div>}</Card>
  </>;
}
