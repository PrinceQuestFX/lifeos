"use client";
import { useEffect, useRef, useState } from "react";
import { getUid, useSB } from "@/lib/hooks";
import { check, toast } from "@/lib/toast";
import { Btn, Card, PageHead } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string; proposals?: any[] };
const EX = ["Organise ma journée de demain.", "Quels sont mes jours libres cette semaine ?", "Trouve-moi trois heures pour réviser.", "Je ne travaille pas samedi.", "Combien d'heures libres ai-je cette semaine ?", "Prépare un planning spécial examens."];

export default function Assistant() {
  const sb = useSB();
  const [msgs, setMsgs] = useState<Msg[]>([]), [input, setInput] = useState(""), [busy, setBusy] = useState(false), end = useRef<HTMLDivElement>(null);
  useEffect(() => { sb.from("ai_conversations").select("role,content,proposals").order("created_at", { ascending: false }).limit(20).then((r) => setMsgs(((r.data as Msg[]) ?? []).reverse().map((m) => ({ ...m, proposals: [] })))); }, [sb]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return; const next = [...msgs, { role: "user" as const, content: text }]; setMsgs(next); setInput(""); setBusy(true);
    const r = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return toast(j.error ?? "Erreur", "err");
    setMsgs([...next, { role: "assistant", content: j.reply, proposals: j.proposals }]);
  };
  // Application d'une proposition : UNIQUEMENT après clic de confirmation.
  const applyOne = async (mi: number, pi: number) => {
    const p = msgs[mi].proposals![pi], uid = await getUid(sb); let ok = false;
    if (p.type === "work_exception") {
      const kind = p.kind === "off" ? "off" : p.kind === "extra" ? "extra" : "replace";
      if (kind !== "extra") await sb.from("work_schedule_exceptions").delete().eq("date", p.date).in("kind", ["replace", "off", "cancel", "late"]);
      const { data, error } = await sb.from("work_schedule_exceptions").insert({ user_id: uid, date: p.date, kind, start_time: kind === "off" ? null : p.start, end_time: kind === "off" ? null : p.end, reason: p.label ?? "Assistant IA" }).select("id").single();
      ok = check({ error }, "Horaires modifiés");
      if (ok) await sb.from("work_schedule_history").insert({ user_id: uid, change_type: "exception", scope: "assistant", period_from: p.date, period_to: p.date, reason: p.label ?? "Assistant IA", before: { removed: [] }, after: { added_ids: [data!.id] } });
    } else if (p.type === "planning_event") ok = check(await sb.from("planning_events").insert({ user_id: uid, date: p.date, start_time: p.start, end_time: p.end, title: p.title, category: p.category ?? "autre" }), "Événement ajouté");
    if (ok) setMsgs((m) => m.map((x, i) => (i === mi ? { ...x, proposals: x.proposals!.filter((_, k) => k !== pi) } : x)));
  };
  return <>
    <PageHead title="Mon assistant IA" sub="Utilise vos données réelles. Les modifications sont proposées, puis appliquées seulement après votre confirmation." />
    <Card className="flex h-[65vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {msgs.length === 0 && <div className="flex flex-wrap gap-2">{EX.map((e) => <button key={e} onClick={() => send(e)} className="rounded-full border px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">{e}</button>)}</div>}
        {msgs.map((m, i) => <div key={i} className={m.role === "user" ? "text-right" : ""}><div className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-left text-sm ${m.role === "user" ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}>{m.content}</div>
          {m.proposals?.map((p, k) => <div key={k} className="mt-1.5 max-w-[85%] rounded-xl border border-amber-300 bg-amber-50 p-2 text-sm dark:bg-amber-950/40"><b>Proposition :</b> {p.label ?? p.title ?? p.type} — {p.date} {p.start && `${p.start}–${p.end}`} {p.kind === "off" && "(repos)"}
            <span className="ml-2 inline-flex gap-1"><Btn onClick={() => applyOne(i, k)}>Appliquer</Btn><Btn variant="ghost" onClick={() => setMsgs((x) => x.map((y, j) => (j === i ? { ...y, proposals: y.proposals!.filter((_, z) => z !== k) } : y)))}>Ignorer</Btn></span></div>)}</div>)}
        {busy && <p className="text-sm text-slate-500">Réflexion…</p>}<div ref={end} />
      </div>
      <div className="mt-3 flex gap-2"><input className="flex-1" placeholder="Ex. : je travaille exceptionnellement demain après-midi" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send(input)} /><Btn onClick={() => send(input)} disabled={busy}>Envoyer</Btn></div>
    </Card></>;
}
