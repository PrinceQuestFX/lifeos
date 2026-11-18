"use client";
import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { addDays, mondayOf, todayISO, weekday } from "@/lib/time";
import { getUid, useRows } from "@/lib/hooks";
import { check, toast } from "@/lib/toast";
import { DAYS } from "@/lib/fmt";
import { Btn, Card, Empty, Label, Loading, PageHead } from "@/components/ui";

export default function Habitudes() {
  const today = todayISO(), since = addDays(today, -90);
  const { sb, rows: habits, reload: r1 } = useRows<any>("habits", (q) => q.eq("active", true));
  const { rows: logs, reload: r2 } = useRows<any>("habit_logs", (q) => q.gte("date", since), [since]);
  const [f, setF] = useState({ name: "", minutes: 30, wd: [0, 1, 2, 3, 4, 5, 6] });
  if (!habits || !logs) return <Loading />;
  const done = (id: string, d: string) => logs.some((l) => l.habit_id === id && l.date === d && l.done);
  const sched = (h: any, d: string) => (h.weekdays ?? [0, 1, 2, 3, 4, 5, 6]).includes(weekday(d));
  const streak = (h: any) => { let n = 0, d = done(h.id, today) ? today : addDays(today, -1); for (let i = 0; i < 90; i++, d = addDays(d, -1)) { if (!sched(h, d)) continue; if (done(h.id, d)) n++; else break; } return n; };
  const rate = (h: any, days: number) => { const ds = Array.from({ length: days }, (_, i) => addDays(today, -i)).filter((d) => sched(h, d)); return ds.length ? Math.round((ds.filter((d) => done(h.id, d)).length / ds.length) * 100) : 0; };
  const toggle = async (h: any) => {
    const uid = await getUid(sb);
    const ok = done(h.id, today) ? check(await sb.from("habit_logs").delete().eq("habit_id", h.id).eq("date", today)) : check(await sb.from("habit_logs").upsert({ user_id: uid, habit_id: h.id, date: today, done: true }, { onConflict: "habit_id,date" }));
    if (ok) r2();
  };
  const add = async () => { if (!f.name) return toast("Nom requis", "err"); if (check(await sb.from("habits").insert({ user_id: await getUid(sb), name: f.name, minutes: f.minutes, weekdays: f.wd }), "Habitude ajoutée")) { setF({ ...f, name: "" }); r1(); } };
  const weeks = Array.from({ length: 8 }, (_, i) => { const s = addDays(mondayOf(today), -7 * (7 - i)); const row: any = { semaine: s.slice(5) };
    habits.forEach((h) => { const ds = Array.from({ length: 7 }, (_, k) => addDays(s, k)).filter((d) => d <= today && sched(h, d)); row[h.name] = ds.length ? Math.round((ds.filter((d) => done(h.id, d)).length / ds.length) * 100) : 0; }); return row; });
  return <>
    <PageHead title="Mes habitudes" sub="Série en jours planifiés consécutifs, taux hebdo et mensuel" />
    <Card className="mb-4"><div className="flex flex-wrap items-end gap-3"><Label t="Habitude"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Label><Label t="Durée (min)"><input type="number" className="w-24" value={f.minutes} onChange={(e) => setF({ ...f, minutes: +e.target.value })} /></Label>
      <div className="flex gap-2 text-sm">{DAYS.map((d, i) => <label key={d} className="flex items-center gap-0.5"><input type="checkbox" checked={f.wd.includes(i)} onChange={(e) => setF({ ...f, wd: e.target.checked ? [...f.wd, i] : f.wd.filter((x) => x !== i) })} />{d[0]}</label>)}</div><Btn onClick={add}>Ajouter</Btn></div></Card>
    {habits.length === 0 ? <Empty>Aucune habitude.</Empty> : <div className="grid gap-3 md:grid-cols-2">{habits.map((h) => <Card key={h.id}>
      <div className="flex items-center justify-between"><div><b>{h.name}</b><div className="text-xs text-slate-500">{h.minutes} min · {(h.weekdays ?? []).map((d: number) => DAYS[d].slice(0, 2)).join(" ")}</div></div>
        <Btn variant={done(h.id, today) ? "primary" : "ghost"} onClick={() => toggle(h)} disabled={!sched(h, today)}>{done(h.id, today) ? "✓ Fait aujourd'hui" : sched(h, today) ? "Marquer fait" : "Repos aujourd'hui"}</Btn></div>
      <div className="mt-3 grid grid-cols-3 text-center text-sm"><div><div className="text-xl font-semibold">{streak(h)}</div><div className="text-xs text-slate-500">série</div></div><div><div className="text-xl font-semibold">{rate(h, 7)} %</div><div className="text-xs text-slate-500">7 jours</div></div><div><div className="text-xl font-semibold">{rate(h, 30)} %</div><div className="text-xs text-slate-500">30 jours</div></div></div>
      <button className="mt-2 text-xs text-red-600" onClick={async () => { if (confirm("Archiver cette habitude ?") && check(await sb.from("habits").update({ active: false }).eq("id", h.id))) r1(); }}>Archiver</button></Card>)}</div>}
    {habits.length > 0 && <Card className="mt-4"><h2 className="mb-2 font-medium">Progression hebdomadaire (%)</h2><div className="h-64"><ResponsiveContainer><BarChart data={weeks}><XAxis dataKey="semaine" /><YAxis domain={[0, 100]} /><Tooltip />{habits.map((h, i) => <Bar key={h.id} dataKey={h.name} fill={["#6366f1", "#14b8a6", "#f97316", "#22c55e"][i % 4]} />)}</BarChart></ResponsiveContainer></div></Card>}
  </>;
}
