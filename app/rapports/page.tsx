"use client";
import { useMemo, useState } from "react";
import { addDays, fmtHM, mondayOf, todayISO } from "@/lib/time";
import { computeRange, dateRange } from "@/lib/availability";
import { useInputs, useRows } from "@/lib/hooks";
import { CATEGORY_LABELS } from "@/lib/types";
import { csv, dLabel, download, fh } from "@/lib/fmt";
import { Btn, Card, Loading, PageHead } from "@/components/ui";

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c]);

export default function Rapports() {
  const [scope, setScope] = useState<"jour" | "semaine" | "mois">("semaine"), [anchor, setAnchor] = useState(todayISO());
  const from = scope === "jour" ? anchor : scope === "semaine" ? mondayOf(anchor) : anchor.slice(0, 8) + "01";
  const to = scope === "jour" ? anchor : scope === "semaine" ? addDays(from, 6) : addDays(new Date(Date.UTC(+anchor.slice(0, 4), +anchor.slice(5, 7), 1)).toISOString().slice(0, 10), -1);
  const { inputs } = useInputs(from, to);
  const { rows: tasks } = useRows<any>("tasks"), { rows: goals } = useRows<any>("goals"), { rows: habits } = useRows<any>("habits"), { rows: logs } = useRows<any>("habit_logs", (q) => q.gte("date", from).lte("date", to), [from, to]);
  const days = useMemo(() => (inputs ? computeRange(dateRange(from, to), inputs) : []), [inputs, from, to]);
  if (!inputs) return <Loading />;
  const statsRows = days.map((d) => ({ date: d.date, libre_h: (d.freeMin / 60).toFixed(2), exploitable_h: (d.usableMin / 60).toFixed(2), cours_h: ((d.minutes.etudes || 0) / 60).toFixed(2), travail_h: ((d.minutes.travail || 0) / 60).toFixed(2), trading_h: ((d.minutes.trading || 0) / 60).toFixed(2), sport_h: ((d.minutes.sport || 0) / 60).toFixed(2), revisions_h: ((d.minutes.revisions || 0) / 60).toFixed(2), conflits: d.conflicts.length }));
  const planRows = days.flatMap((d) => d.blocks.filter((b) => b.category !== "repas").map((b) => ({ date: d.date, debut: fmtHM(b.start), fin: fmtHM(b.end), activite: b.title, categorie: CATEGORY_LABELS[b.category], source: b.source })));

  // PDF : ouvre une page propre et lance l'impression (« Enregistrer au format PDF »).
  const pdf = () => {
    const w = window.open("", "_blank"); if (!w) return;
    const body = days.map((d) => `<h3>${esc(dLabel(d.date))} — libre ${fh(d.freeMin)} (exploitable ${fh(d.usableMin)})</h3><table>${d.blocks.filter((b) => b.category !== "repas").sort((a, b) => a.start - b.start).map((b) => `<tr><td>${fmtHM(b.start)}–${fmtHM(b.end)}</td><td>${esc(b.title)}</td><td>${CATEGORY_LABELS[b.category]}</td></tr>`).join("") || "<tr><td>Rien de prévu</td></tr>"}</table>`).join("");
    w.document.write(`<html><head><title>LIFEOS — Planning ${from}</title><style>body{font:13px system-ui;margin:24px;color:#111}h1{font-size:20px}h3{margin:16px 0 4px;font-size:14px}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #ddd;padding:3px 6px}</style></head><body><h1>LIFEOS — Planning ${scope} (${from} → ${to})</h1>${body}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
  };
  return <>
    <PageHead title="Mes rapports" sub="Exports PDF (via impression) et CSV" actions={<><select value={scope} onChange={(e) => setScope(e.target.value as any)}><option value="jour">Jour</option><option value="semaine">Semaine</option><option value="mois">Mois</option></select><input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} /></>} />
    <div className="grid gap-4 md:grid-cols-2">
      <Card><h2 className="mb-2 font-medium">Planning ({from} → {to})</h2><div className="flex flex-wrap gap-2"><Btn onClick={pdf}>PDF</Btn><Btn variant="ghost" onClick={() => download(`planning-${from}.csv`, csv(planRows))}>CSV</Btn></div></Card>
      <Card><h2 className="mb-2 font-medium">Statistiques de temps / productivité</h2><div className="flex gap-2"><Btn variant="ghost" onClick={() => download(`statistiques-${from}.csv`, csv(statsRows))}>CSV</Btn></div></Card>
      <Card><h2 className="mb-2 font-medium">Objectifs</h2><Btn variant="ghost" onClick={() => download("objectifs.csv", csv((goals ?? []).map((g: any) => ({ nom: g.name, categorie: g.category, priorite: g.priority, echeance: g.due_date, progression: g.progress, statut: g.status }))))}>CSV</Btn></Card>
      <Card><h2 className="mb-2 font-medium">Habitudes & tâches</h2><div className="flex gap-2"><Btn variant="ghost" onClick={() => download("habitudes.csv", csv((logs ?? []).map((l: any) => ({ habitude: habits?.find((h: any) => h.id === l.habit_id)?.name, date: l.date, fait: l.done }))))}>Habitudes CSV</Btn>
        <Btn variant="ghost" onClick={() => download("taches.csv", csv((tasks ?? []).map((t: any) => ({ titre: t.title, categorie: t.category, priorite: t.priority, echeance: t.due_date, statut: t.status }))))}>Tâches CSV</Btn></div></Card>
    </div></>;
}
