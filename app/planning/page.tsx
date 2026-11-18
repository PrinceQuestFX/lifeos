"use client";
import { useMemo, useState } from "react";
import { addDays, todayISO, weekday } from "@/lib/time";
import { computeRange, dateRange } from "@/lib/availability";
import { generatePlan, proposeMoves, type Need } from "@/lib/planner";
import { getUid, useInputs, useRows } from "@/lib/hooks";
import { check, toast } from "@/lib/toast";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "@/lib/types";
import { dLabel, hhmm } from "@/lib/fmt";
import { Badge, Btn, Card, Empty, Loading, PageHead } from "@/components/ui";

type Mode = "normal" | "examens" | "vacances" | "dev";
const MODES: Record<Mode, string> = { normal: "Normal", examens: "Spécial examens", vacances: "Spécial vacances", dev: "Développement personnel" };

export default function Planning() {
  const tomorrow = addDays(todayISO(), 1);
  const [span, setSpan] = useState<1 | 7 | 30>(7), [mode, setMode] = useState<Mode>("normal"), [regen, setRegen] = useState(false), [picked, setPicked] = useState<Set<number>>(new Set());
  const to = addDays(tomorrow, span - 1);
  const { sb, inputs, reload } = useInputs(todayISO(), addDays(tomorrow, 30));
  const { rows: acts } = useRows<any>("activities", (q) => q.eq("active", true));
  const [moves, setMoves] = useState<ReturnType<typeof proposeMoves> | null>(null);

  const needs: Need[] = useMemo(() => {
    let n: Need[] = (acts ?? []).map((a) => ({ title: a.title, category: a.category, minutesPerDay: a.minutes_per_day ?? Math.round((a.minutes_per_week ?? 0) / 7), minBlock: a.min_block ?? 30, priority: a.priority ?? 3, days: a.weekdays ?? undefined, preferred: a.preferred_from && a.preferred_to ? { from: hhmm(a.preferred_from), to: hhmm(a.preferred_to) } : undefined, allowParallel: a.allow_parallel }));
    if (mode === "examens") n = [{ title: "Révisions examens", category: "revisions", minutesPerDay: 180, minBlock: 60, priority: 1 }, ...n.map((x) => (x.category === "sport" ? { ...x, minutesPerDay: Math.round(x.minutesPerDay / 2), priority: 4 } : x))];
    if (mode === "vacances") n = [...n.filter((x) => x.category !== "revisions"), { title: "Repos / détente", category: "repos", minutesPerDay: 120, minBlock: 60, priority: 2 }];
    if (mode === "dev") n = n.filter((x) => ["anglais", "sport", "revisions"].includes(x.category));
    return n.filter((x) => x.minutesPerDay > 0);
  }, [acts, mode]);

  const result = useMemo(() => {
    if (!inputs) return null;
    const hyp = regen ? { ...inputs, planning: inputs.planning.filter((p) => p.locked || p.status !== "planned" || p.date < tomorrow || p.date > to) } : inputs;
    return generatePlan(computeRange(dateRange(tomorrow, to), hyp), needs, weekday);
  }, [inputs, needs, regen, tomorrow, to]);

  if (!inputs || !acts || !result) return <Loading />;
  const sel = (i: number) => picked.has(i) || (picked.size === 0 && !touched);
  const touched = picked.size > 0 && picked.has(-1);
  const toggle = (i: number) => setPicked((p) => { const n = new Set(p); if (!n.has(-1)) { n.add(-1); result.proposals.forEach((_, k) => n.add(k)); } n.has(i) ? n.delete(i) : n.add(i); return n; });

  const apply = async () => {
    const chosen = result.proposals.filter((_, i) => sel(i)); const uid = await getUid(sb);
    if (regen) {
      const del = inputs.planning.filter((p) => !p.locked && p.status === "planned" && p.date >= tomorrow && p.date <= to);
      if (del.length && !confirm(`Remplacer ${del.length} événement(s) planifié(s) non verrouillés dans cette période ? (les événements verrouillés, terminés ou passés sont conservés)`)) return;
      if (del.length) await sb.from("planning_events").delete().in("id", del.map((d) => d.id));
    }
    if (check(await sb.from("planning_events").insert(chosen.map(({ reason, ...p }) => ({ ...p, user_id: uid }))), `${chosen.length} activité(s) ajoutée(s)`)) { setPicked(new Set()); reload(); }
  };
  const missed = inputs.planning.filter((p) => !p.locked && (p.status === "skipped" || (p.status === "planned" && p.date < todayISO())));
  const findSlots = () => { const ds = computeRange(dateRange(todayISO(), addDays(todayISO(), 7)), inputs); setMoves(proposeMoves(missed, ds, weekday)); };
  const applyMove = async (id: string, p: any) => { if (check(await sb.from("planning_events").update({ date: p.date, start_time: p.start_time, end_time: p.end_time, status: "planned" }).eq("id", id), "Reprogrammé")) { setMoves((m) => m!.filter((x) => x.eventId !== id)); reload(); } };

  return <>
    <PageHead title="Mon planning intelligent" sub="Propositions calculées sur vos créneaux réellement libres. Rien n'est appliqué sans votre accord."
      actions={<>{([1, 7, 30] as const).map((s) => <Btn key={s} variant={span === s ? "primary" : "ghost"} onClick={() => { setSpan(s); setPicked(new Set()); }}>{s === 1 ? "Demain" : s === 7 ? "7 jours" : "Mois"}</Btn>)}</>} />
    <Card className="mb-4"><div className="flex flex-wrap items-center gap-3 text-sm">
      <select value={mode} onChange={(e) => { setMode(e.target.value as Mode); setPicked(new Set()); }}>{Object.entries(MODES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <label className="flex items-center gap-1"><input type="checkbox" checked={regen} onChange={(e) => { setRegen(e.target.checked); setPicked(new Set()); }} />Régénérer (remplacer les activités planifiées non verrouillées)</label>
      <span className="text-slate-500">Besoins pris en compte : {needs.map((n) => `${n.title} ${n.minutesPerDay} min/j`).join(" · ") || "aucun — ajoutez des activités dans Paramètres"}</span></div></Card>
    <Card><div className="mb-2 flex items-center justify-between"><h2 className="font-medium">Propositions ({result.proposals.length})</h2><Btn onClick={apply} disabled={!result.proposals.length}>Appliquer la sélection</Btn></div>
      {!result.proposals.length ? <Empty>Aucune proposition : pas de besoin défini ou pas de créneau libre.</Empty> : <table className="w-full text-sm"><tbody>{result.proposals.map((p, i) => <tr key={i} className="border-t dark:border-slate-800">
        <td className="py-1.5"><input type="checkbox" checked={sel(i)} onChange={() => toggle(i)} /></td><td>{dLabel(p.date)}</td><td className="tabular-nums">{p.start_time}–{p.end_time}</td><td>{p.title}</td><td><Badge color={CATEGORY_COLORS[p.category]}>{CATEGORY_LABELS[p.category]}</Badge></td><td className="text-xs text-slate-500">{p.reason}</td></tr>)}</tbody></table>}
      {result.unplaced.length > 0 && <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950">Impossible à placer : {result.unplaced.map((u) => `${dLabel(u.date)} ${u.title} (${u.missingMin} min manquantes)`).join(" · ")}</div>}
    </Card>
    <Card className="mt-4"><div className="mb-2 flex items-center justify-between"><h2 className="font-medium">Activités non réalisées ({missed.length})</h2>{missed.length > 0 && <Btn variant="ghost" onClick={findSlots}>Proposer de nouveaux créneaux</Btn>}</div>
      {missed.length === 0 ? <p className="text-sm text-slate-500">Rien à reprogrammer.</p> : <ul className="space-y-1 text-sm">{missed.map((m) => { const mv = moves?.find((x) => x.eventId === m.id); return <li key={m.id} className="flex flex-wrap items-center gap-2"><span>{dLabel(m.date)} {hhmm(m.start_time)} — {m.title}</span>
        {mv && (mv.proposal ? <><span className="text-emerald-600">→ {dLabel(mv.proposal.date)} {mv.proposal.start_time}–{mv.proposal.end_time}</span><Btn onClick={() => applyMove(m.id, mv.proposal)}>Accepter</Btn></> : <span className="text-red-600">aucun créneau sur 7 jours</span>)}</li>; })}</ul>}</Card>
  </>;
}
