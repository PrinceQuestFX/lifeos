"use client";
import { useState } from "react";
import { getUid, useRows } from "@/lib/hooks";
import { check, toast } from "@/lib/toast";
import { CATEGORY_LABELS } from "@/lib/types";
import { Btn, Card, Empty, Label, Loading, PageHead } from "@/components/ui";

export default function Objectifs() {
  const { sb, rows, reload } = useRows<any>("goals", (q) => q.order("due_date", { ascending: true, nullsFirst: false }));
  const [f, setF] = useState({ name: "", description: "", category: "anglais", priority: 3, due: "", est: "", frequency: "" });
  if (!rows) return <Loading />;
  const add = async () => { if (!f.name) return toast("Nom requis", "err");
    if (check(await sb.from("goals").insert({ user_id: await getUid(sb), name: f.name, description: f.description || null, category: f.category, priority: f.priority, due_date: f.due || null, est_minutes: f.est ? +f.est : null, frequency: f.frequency || null }), "Objectif créé")) { setF({ ...f, name: "", description: "" }); reload(); } };
  const upd = async (id: string, p: any) => { if (check(await sb.from("goals").update(p).eq("id", id))) reload(); };
  return <>
    <PageHead title="Mes objectifs" sub="Progression, priorités et échéances" />
    <Card className="mb-4"><div className="grid gap-3 md:grid-cols-4">
      <Label t="Nom"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Label>
      <Label t="Catégorie"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{Object.entries(CATEGORY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Label>
      <Label t="Priorité (1 = haute)"><select value={f.priority} onChange={(e) => setF({ ...f, priority: +e.target.value })}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</select></Label>
      <Label t="Date limite"><input type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} /></Label>
      <Label t="Durée estimée (min)"><input type="number" value={f.est} onChange={(e) => setF({ ...f, est: e.target.value })} /></Label>
      <Label t="Fréquence (ex. 3x/semaine)"><input value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })} /></Label>
      <div className="md:col-span-1"><Label t="Description"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Label></div><div className="flex items-end justify-end"><Btn onClick={add}>Créer</Btn></div></div></Card>
    {rows.length === 0 ? <Empty>Aucun objectif. Ex. « Améliorer mon anglais », « Régularité au sport ».</Empty> : <div className="grid gap-3 md:grid-cols-2">{rows.map((g) => <Card key={g.id}>
      <div className="flex items-start justify-between"><div><b>{g.name}</b><div className="text-xs text-slate-500">{CATEGORY_LABELS[g.category as keyof typeof CATEGORY_LABELS]} · P{g.priority}{g.due_date ? ` · avant le ${g.due_date}` : ""}{g.frequency ? ` · ${g.frequency}` : ""}{g.est_minutes ? ` · ${g.est_minutes} min` : ""}</div></div>
        <button className="text-red-600" onClick={async () => { if (confirm("Supprimer cet objectif ?") && check(await sb.from("goals").delete().eq("id", g.id))) reload(); }}>✕</button></div>
      {g.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{g.description}</p>}
      <div className="mt-3 flex items-center gap-3"><input type="range" min={0} max={100} step={5} defaultValue={g.progress} onMouseUp={(e) => upd(g.id, { progress: +(e.target as HTMLInputElement).value, status: +(e.target as HTMLInputElement).value === 100 ? "done" : "active" })} onTouchEnd={(e) => upd(g.id, { progress: +(e.target as HTMLInputElement).value })} className="flex-1 p-0" /><span className="w-12 text-right text-sm font-medium">{g.progress} %</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-200 dark:bg-slate-700"><div className="h-full bg-indigo-500" style={{ width: `${g.progress}%` }} /></div></Card>)}</div>}
  </>;
}
