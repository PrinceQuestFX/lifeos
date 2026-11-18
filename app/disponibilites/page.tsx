"use client";
import { useMemo, useState } from "react";
import { addDays, fmtHM, mondayOf, subtract, todayISO, total } from "@/lib/time";
import { computeRange, dateRange } from "@/lib/availability";
import { useInputs } from "@/lib/hooks";
import { fh, dLabel } from "@/lib/fmt";
import { Btn, Card, Loading, PageHead, Stat } from "@/components/ui";

// Demi-journée libre = la fenêtre entière est libre (pas de bloc exclusif dessus).
const HALF = { matin: [8 * 60, 13 * 60], "après-midi": [14 * 60, 19 * 60] } as const;

export default function Dispos() {
  const [scope, setScope] = useState<"semaine" | "mois">("semaine");
  const today = todayISO();
  const from = scope === "semaine" ? mondayOf(today) : today.slice(0, 8) + "01";
  const to = scope === "semaine" ? addDays(from, 6) : addDays(new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 1)).toISOString().slice(0, 10), -1);
  const { inputs } = useInputs(from, to);
  const days = useMemo(() => (inputs ? computeRange(dateRange(from, to), inputs) : []), [inputs, from, to]);
  if (!inputs) return <Loading />;
  const sum = (k: string) => days.reduce((a, d) => a + (d.minutes[k] || 0), 0);
  const free = days.reduce((a, d) => a + d.freeMin, 0), usable = days.reduce((a, d) => a + d.usableMin, 0), par = days.reduce((a, d) => a + d.parallelMin, 0);
  const pct = (m: number) => `${Math.round((m / (days.length * 1440)) * 100)} %`;
  const freeDays = days.filter((d) => !d.blocks.some((b) => b.exclusive)).map((d) => d.date);
  const day0 = (iso: string) => Math.floor(Date.parse(iso + "T00:00:00Z") / 60000);
  return <>
    <PageHead title="Mes disponibilités" sub="Sans double comptage — libre théorique ≠ libre exploitable (créneaux ≥ 30 min)"
      actions={<><Btn variant={scope === "semaine" ? "primary" : "ghost"} onClick={() => setScope("semaine")}>Semaine</Btn><Btn variant={scope === "mois" ? "primary" : "ghost"} onClick={() => setScope("mois")}>Mois</Btn></>} />
    <div className="grid gap-4 md:grid-cols-4">
      <Stat label="Libre théorique" value={fh(free)} hint={pct(free)} /><Stat label="Libre exploitable" value={fh(usable)} hint={pct(usable)} />
      <Stat label="Travail compatible" value={fh(par)} hint="activités secondaires possibles" /><Stat label="Jours entièrement libres" value={freeDays.length} hint={freeDays.map(dLabel).join(", ") || "aucun"} />
    </div>
    <div className="mt-4 grid gap-4 md:grid-cols-4 lg:grid-cols-7">
      {[["Cours", "etudes"], ["Travail", "travail"], ["Trading", "trading"], ["Sport", "sport"], ["Révisions", "revisions"], ["Anglais", "anglais"], ["Repos", "repos"]].map(([l, k]) => <Stat key={k} label={l} value={fh(sum(k))} hint={pct(sum(k))} />)}
    </div>
    <Card className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th className="py-1">Jour</th><th>Libre</th><th>Exploitable</th><th>Compatible</th><th>Demi-journées libres</th><th>Créneaux exploitables</th><th>Conflits</th></tr></thead>
      <tbody>{days.map((d) => {
        const b = day0(d.date);
        const halves = Object.entries(HALF).filter(([, [s, e]]) => total(subtract([{ start: b + s, end: b + e }], d.free)) === 0).map(([n]) => n);
        return <tr key={d.date} className="border-t dark:border-slate-800"><td className="py-1.5">{dLabel(d.date)}</td><td>{fh(d.freeMin)}</td><td>{fh(d.usableMin)}</td><td>{fh(d.parallelMin)}</td><td>{halves.join(", ") || "—"}</td>
          <td className="text-xs text-slate-600 dark:text-slate-300">{d.usable.map((i) => `${fmtHM(i.start)}–${fmtHM(i.end)}`).join(" · ") || "—"}</td><td className={d.conflicts.length ? "text-red-600" : ""}>{d.conflicts.length}</td></tr>;
      })}</tbody></table></Card>
  </>;
}
