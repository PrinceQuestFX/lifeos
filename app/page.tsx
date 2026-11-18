"use client";
import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { addDays, dayStart, fmtHM, mondayOf, nowMin, todayISO } from "@/lib/time";
import { computeRange, dateRange } from "@/lib/availability";
import { useInputs, useRows } from "@/lib/hooks";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/types";
import { fh } from "@/lib/fmt";
import { Badge, Card, Empty, Loading, PageHead, Stat } from "@/components/ui";

export default function Dashboard() {
  const today = todayISO(), mon = mondayOf(today), sun = addDays(mon, 6);
  const { inputs } = useInputs(mon, sun);
  const { rows: goals } = useRows<any>("goals");
  const days = useMemo(() => (inputs ? computeRange(dateRange(mon, sun), inputs) : []), [inputs, mon, sun]);
  if (!inputs) return <Loading />;
  const td = days.find((d) => d.date === today)!;
  const now = dayStart(today) + nowMin();
  const sorted = [...td.blocks].sort((a, b) => a.start - b.start);
  const current = sorted.find((b) => b.start <= now && now < b.end && b.source !== "sommeil");
  const next = sorted.find((b) => b.start > now);
  const planToday = inputs.planning.filter((p) => p.date === today);
  const sum = (k: string) => days.reduce((a, d) => a + (d.minutes[k] || 0), 0);
  const free = days.reduce((a, d) => a + d.freeMin, 0), usable = days.reduce((a, d) => a + d.usableMin, 0);
  const wk = inputs.planning.filter((p) => p.date >= mon && p.date <= sun);
  const past = wk.filter((p) => p.status !== "planned" || p.date < today);
  const rate = past.length ? Math.round((past.filter((p) => p.status === "done").length / past.length) * 100) : null;
  const pie = [...Object.keys(CATEGORY_COLORS).map((k) => ({ name: CATEGORY_LABELS[k as keyof typeof CATEGORY_LABELS], value: sum(k), color: CATEGORY_COLORS[k as keyof typeof CATEGORY_COLORS] })), { name: "Libre", value: free, color: "#e2e8f0" }].filter((p) => p.value > 0);
  const avgGoal = goals?.length ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length) : null;

  return <>
    <PageHead title="Dashboard" sub={new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Casablanca" })} />
    <div className="grid gap-4 md:grid-cols-4">
      <Stat label="En cours" value={current ? current.title : "—"} hint={current ? `jusqu'à ${fmtHM(current.end)}` : "Aucune activité"} />
      <Stat label="Prochaine activité" value={next ? next.title : "—"} hint={next ? `${fmtHM(next.start)} · dans ${fh(next.start - now)}` : "Rien d'autre aujourd'hui"} />
      <Stat label="Libre aujourd'hui" value={fh(td.freeMin)} hint={`dont exploitable : ${fh(td.usableMin)}`} />
      <Stat label="Activités planifiées" value={`${planToday.filter((p) => p.status === "done").length}/${planToday.length}`} hint={`${planToday.filter((p) => p.status === "planned").length} restantes`} />
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2"><h2 className="mb-2 font-medium">Programme du jour</h2>
        {sorted.length === 0 ? <Empty>Rien de prévu. Importez votre emploi du temps ou configurez vos horaires.</Empty> :
          <ul className="space-y-1.5">{sorted.map((b) => <li key={b.id + b.start} className={`flex items-center gap-3 rounded-lg border-l-4 bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800 ${b.end <= now ? "opacity-50" : ""}`} style={{ borderColor: CATEGORY_COLORS[b.category] }}>
            <span className="w-24 tabular-nums text-slate-500">{fmtHM(b.start)}–{fmtHM(b.end)}</span><span className="flex-1">{b.title}</span><Badge color={CATEGORY_COLORS[b.category]}>{CATEGORY_LABELS[b.category]}</Badge></li>)}</ul>}
        {td.conflicts.length > 0 && <p className="mt-3 text-sm text-red-600">⚠ {td.conflicts.length} conflit(s) horaire(s) aujourd'hui — voir le calendrier.</p>}
      </Card>
      <Card><h2 className="mb-2 font-medium">Répartition de la semaine</h2>
        <div className="h-52"><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>{pie.map((p) => <Cell key={p.name} fill={p.color} />)}</Pie><Tooltip formatter={(v) => fh(Number(v))} /></PieChart></ResponsiveContainer></div>
      </Card>
    </div>
    <div className="mt-4 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      <Stat label="Cours" value={fh(sum("etudes"))} /><Stat label="Travail" value={fh(sum("travail"))} /><Stat label="Trading" value={fh(sum("trading"))} />
      <Stat label="Libre" value={fh(free)} hint={`exploitable ${fh(usable)}`} /><Stat label="Respect du planning" value={rate === null ? "—" : `${rate} %`} hint="terminé / prévu" />
      <Stat label="Objectifs" value={avgGoal === null ? "—" : `${avgGoal} %`} hint="progression moyenne" />
    </div>
  </>;
}
