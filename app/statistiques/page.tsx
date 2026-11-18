"use client";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, mondayOf, todayISO } from "@/lib/time";
import { computeRange, dateRange } from "@/lib/availability";
import { useInputs, useRows } from "@/lib/hooks";
import { CATEGORY_LABELS, type Category } from "@/lib/types";
import { Btn, Card, Loading, PageHead } from "@/components/ui";

const mins = (s: string, e: string) => { const [a, b] = [s, e].map((x) => +x.slice(0, 2) * 60 + +x.slice(3, 5)); return b > a ? b - a : b + 1440 - a; };
const COLORS = ["#3b82f6", "#8b5cf6", "#f97316", "#22c55e", "#14b8a6", "#6366f1", "#9ca3af", "#e2e8f0"];

export default function Stats() {
  const [weeks, setWeeks] = useState(4);
  const today = todayISO(), from = addDays(mondayOf(today), -7 * (weeks - 1)), to = addDays(mondayOf(today), 6);
  const { inputs } = useInputs(from, to);
  const { rows: logs } = useRows<any>("habit_logs", (q) => q.gte("date", from), [from]);
  const { rows: habits } = useRows<any>("habits");
  const days = useMemo(() => (inputs ? computeRange(dateRange(from, to), inputs) : []), [inputs, from, to]);
  if (!inputs || !logs || !habits) return <Loading />;
  const cats: Category[] = ["etudes", "travail", "trading", "sport", "anglais", "revisions", "repos"];
  const weekly = Array.from({ length: weeks }, (_, i) => {
    const s = addDays(from, i * 7), e = addDays(s, 6), ds = days.filter((d) => d.date >= s && d.date <= e);
    const row: any = { semaine: s.slice(5) };
    cats.forEach((c) => (row[CATEGORY_LABELS[c]] = +(ds.reduce((a, d) => a + (d.minutes[c] || 0), 0) / 60).toFixed(1)));
    row.Libre = +(ds.reduce((a, d) => a + d.freeMin, 0) / 60).toFixed(1);
    const pe = inputs.planning.filter((p) => p.date >= s && p.date <= e && (p.status !== "planned" || p.date < today));
    row.respect = pe.length ? Math.round((pe.filter((p) => p.status === "done").length / pe.length) * 100) : null;
    return row;
  });
  const pr = cats.map((c) => { const ev = inputs.planning.filter((p) => p.category === c);
    return { cat: CATEGORY_LABELS[c], Prévu: +(ev.filter((p) => p.status !== "skipped").reduce((a, p) => a + mins(p.start_time, p.end_time), 0) / 60).toFixed(1), Réel: +(ev.filter((p) => p.status === "done").reduce((a, p) => a + mins(p.start_time, p.end_time), 0) / 60).toFixed(1) }; });
  const hRate = habits.map((h: any) => ({ Habitude: h.name, Réalisations: logs.filter((x: any) => x.habit_id === h.id && x.done).length }));
  return <>
    <PageHead title="Mes statistiques" sub="Calculées sur les données réelles — aucune valeur fictive" actions={[4, 8, 12].map((w) => <Btn key={w} variant={weeks === w ? "primary" : "ghost"} onClick={() => setWeeks(w)}>{w} sem.</Btn>)} />
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="mb-2 font-medium">Heures par semaine</h2><div className="h-72"><ResponsiveContainer><BarChart data={weekly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="semaine" /><YAxis /><Tooltip /><Legend />
        {[...cats.map((c) => CATEGORY_LABELS[c]), "Libre"].map((k, i) => <Bar key={k} dataKey={k} stackId="a" fill={COLORS[i]} />)}</BarChart></ResponsiveContainer></div></Card>
      <Card><h2 className="mb-2 font-medium">Prévu vs réel (heures)</h2><div className="h-72"><ResponsiveContainer><BarChart data={pr}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="cat" /><YAxis /><Tooltip /><Legend /><Bar dataKey="Prévu" fill="#94a3b8" /><Bar dataKey="Réel" fill="#6366f1" /></BarChart></ResponsiveContainer></div></Card>
      <Card><h2 className="mb-2 font-medium">Respect du planning (%)</h2><div className="h-64"><ResponsiveContainer><BarChart data={weekly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="semaine" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="respect" name="Respect" fill="#22c55e" /></BarChart></ResponsiveContainer></div></Card>
      <Card><h2 className="mb-2 font-medium">Habitudes réalisées ({weeks} sem.)</h2>{hRate.length ? <div className="h-64"><ResponsiveContainer><BarChart data={hRate} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="Habitude" width={110} /><Tooltip /><Bar dataKey="Réalisations" fill="#14b8a6" /></BarChart></ResponsiveContainer></div> : <p className="text-sm text-slate-500">Aucune habitude enregistrée.</p>}</Card>
    </div></>;
}
