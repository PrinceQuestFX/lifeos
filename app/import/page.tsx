"use client";
import { useState } from "react";
import { getUid, useRows, useSB } from "@/lib/hooks";
import { pdfToLines, parseLines, type ParsedEvent } from "@/lib/pdf-parse";
import { classify } from "@/lib/groups";
import { check, toast } from "@/lib/toast";
import { Badge, Btn, Card, Empty, PageHead } from "@/components/ui";

const COLORS = { keep: "#22c55e", ignore: "#94a3b8", ambiguous: "#f59e0b" };
const LABELS = { keep: "Retenu", ignore: "Ignoré", ambiguous: "À valider" };

export default function Import() {
  const sb = useSB();
  const { rows: imports, reload } = useRows<any>("timetable_imports", (q) => q.order("created_at", { ascending: false }));
  const { rows: existing } = useRows<any>("timetable_events");
  const [file, setFile] = useState<File | null>(null);
  const [ev, setEv] = useState<ParsedEvent[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [cmp, setCmp] = useState<[string, string]>(["", ""]);
  const [prefs, setPrefs] = useState({ main: "A", english: "1", tec: "1" });

  const analyse = async (f: File) => {
    setBusy(true); setFile(f);
    try {
      const { data: p } = await sb.from("user_preferences").select("group_main,group_english,group_tec").maybeSingle();
      const gp = p ? { main: p.group_main, english: p.group_english, tec: p.group_tec } : prefs; setPrefs(gp);
      const lines = await pdfToLines(f);
      const parsed = parseLines(lines, gp, new Date().getFullYear());
      if (!parsed.length) toast("Aucun cours détecté : le format du PDF n'est probablement pas du texte (PDF scanné → OCR nécessaire).", "err");
      setEv(parsed);
    } catch (e: any) { toast("Lecture du PDF impossible : " + e.message, "err"); }
    setBusy(false);
  };
  const edit = (i: number, p: Partial<ParsedEvent>) => setEv((l) => l!.map((e, k) => {
    if (k !== i) return e; const n = { ...e, ...p };
    if (p.title !== undefined) { const g = classify(n.title, prefs); n.status = g.status; n.group_label = g.label; n.reason = g.reason; }
    n.uncertain = n.status === "ambiguous" || n.start_time >= n.end_time || n.date.startsWith("1970");
    n.fingerprint = `${n.date}|${n.start_time}|${n.end_time}|${n.title.toLowerCase().replace(/\s+/g, " ")}`; return n;
  }));

  const confirmImport = async () => {
    if (!ev || !file) return;
    const blocking = ev.filter((e) => e.status === "ambiguous" || e.date.startsWith("1970"));
    if (blocking.length && !confirm(`${blocking.length} information(s) incertaine(s) non résolue(s) : elles seront importées comme « ignorées » (aucune intégration silencieuse). Continuer ?`)) return;
    const uid = await getUid(sb); setBusy(true);
    const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const up = await sb.storage.from("timetables").upload(path, file);                 // l'ancien PDF est conservé
    if (up.error) toast("PDF non archivé : " + up.error.message, "err");
    const dates = ev.filter((e) => !e.date.startsWith("1970")).map((e) => e.date).sort();
    const final = ev.map((e) => (e.status === "ambiguous" || e.date.startsWith("1970") ? { ...e, status: "ignore" as const } : e));
    const { data: imp, error } = await sb.from("timetable_imports").insert({
      user_id: uid, file_name: file.name, storage_path: up.error ? null : path, period_from: dates[0] ?? null, period_to: dates[dates.length - 1] ?? null, version: (imports?.length ?? 0) + 1,
      stats: { kept: final.filter((e) => e.status === "keep").length, ignored: final.filter((e) => e.status === "ignore").length, fingerprints: final.filter((e) => e.status === "keep").map((e) => e.fingerprint) },
    }).select().single();
    if (error) { setBusy(false); return toast(error.message, "err"); }
    // upsert sur l'empreinte : pas de doublon ; jamais de suppression d'anciens cours
    const rows = final.filter((e) => !e.date.startsWith("1970")).map((e) => ({ user_id: uid, import_id: imp.id, date: e.date, start_time: e.start_time, end_time: e.end_time, title: e.title, group_label: e.group_label, status: e.status, kind: e.kind, category: "etudes", fingerprint: e.fingerprint }));
    const r = await sb.from("timetable_events").upsert(rows, { onConflict: "user_id,fingerprint" });
    setBusy(false);
    if (check(r, `Importé : ${imp.stats.kept} cours retenus, ${imp.stats.ignored} ignorés`)) { setEv(null); setFile(null); reload(); }
  };

  // comparaison de deux versions (par empreintes des cours retenus)
  const diff = (() => {
    const a = imports?.find((i) => i.id === cmp[0]), b = imports?.find((i) => i.id === cmp[1]);
    if (!a || !b) return null; const A = new Set<string>(a.stats.fingerprints ?? []), B = new Set<string>(b.stats.fingerprints ?? []);
    return { added: [...B].filter((x) => !A.has(x)), removed: [...A].filter((x) => !B.has(x)), same: [...A].filter((x) => B.has(x)).length };
  })();
  const fp = new Set((existing ?? []).map((e: any) => e.fingerprint));
  const cnt = (s: string) => ev?.filter((e) => e.status === s).length ?? 0;

  return <>
    <PageHead title="Importer mon emploi du temps" sub="PDF → contrôle manuel → import. Filtrage automatique Groupe A + Groupe 1." />
    <Card>
      <input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && analyse(e.target.files[0])} />
      {busy && <p className="mt-2 text-sm text-slate-500">Analyse en cours…</p>}
      <p className="mt-2 text-xs text-slate-500">PDF scannés (images) : l'OCR n'est pas inclus dans cette version — exportez un PDF texte, ou ajoutez tesseract.js dans lib/pdf-parse.ts.</p>
    </Card>
    {ev && <Card className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><Badge color={COLORS.keep}>{cnt("keep")} retenus</Badge><Badge color={COLORS.ignore}>{cnt("ignore")} ignorés</Badge><Badge color={COLORS.ambiguous}>{cnt("ambiguous")} à valider</Badge>
        <span className="text-slate-500">{ev.filter((e) => e.status === "keep" && fp.has(e.fingerprint)).length} déjà connus (pas de doublon)</span></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th>Date</th><th>Début</th><th>Fin</th><th>Intitulé</th><th>Groupe</th><th>Statut</th><th>Raison</th></tr></thead><tbody>
        {ev.map((e, i) => <tr key={i} className={`border-t align-top dark:border-slate-800 ${e.uncertain ? "bg-amber-50 dark:bg-amber-950/40" : ""}`}>
          <td><input type="date" value={e.date.startsWith("1970") ? "" : e.date} onChange={(x) => edit(i, { date: x.target.value })} /></td>
          <td><input type="time" value={e.start_time} onChange={(x) => edit(i, { start_time: x.target.value })} /></td><td><input type="time" value={e.end_time} onChange={(x) => edit(i, { end_time: x.target.value })} /></td>
          <td><input className="w-64" value={e.title} onChange={(x) => edit(i, { title: x.target.value })} /></td><td>{e.group_label ?? "commun"}</td>
          <td><select value={e.status} onChange={(x) => edit(i, { status: x.target.value as any })}>{Object.entries(LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
          <td className="text-xs text-slate-500">{e.reason}</td></tr>)}</tbody></table></div>
      <div className="mt-3 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setEv(null)}>Annuler</Btn><Btn onClick={confirmImport} disabled={busy || !ev.length}>Confirmer l'importation</Btn></div>
    </Card>}
    <Card className="mt-4"><h2 className="mb-2 font-medium">Historique des importations</h2>
      {!imports?.length ? <Empty>Aucun import pour le moment.</Empty> : <table className="w-full text-sm"><thead className="text-left text-xs text-slate-500"><tr><th>v</th><th>Fichier</th><th>Période</th><th>Retenus</th><th>Ignorés</th><th>Importé le</th></tr></thead><tbody>
        {imports.map((i) => <tr key={i.id} className="border-t dark:border-slate-800"><td>{i.version}</td><td>{i.file_name}</td><td>{i.period_from} → {i.period_to}</td><td>{i.stats.kept}</td><td>{i.stats.ignored}</td><td>{new Date(i.created_at).toLocaleDateString("fr-FR")}</td></tr>)}</tbody></table>}
      {(imports?.length ?? 0) > 1 && <div className="mt-3 text-sm"><b>Comparer deux versions :</b>{" "}
        {[0, 1].map((k) => <select key={k} className="mx-1" value={cmp[k]} onChange={(e) => setCmp((c): [string, string] => (k ? [c[0], e.target.value] : [e.target.value, c[1]]))}><option value="">—</option>{imports!.map((i) => <option key={i.id} value={i.id}>v{i.version} {i.file_name}</option>)}</select>)}
        {diff && <p className="mt-2">+{diff.added.length} ajoutés · −{diff.removed.length} retirés · {diff.same} identiques.{diff.added.slice(0, 5).map((x) => <span key={x} className="ml-2 text-emerald-600">+ {x.split("|").slice(0, 4).join(" ")}</span>)}{diff.removed.slice(0, 5).map((x) => <span key={x} className="ml-2 text-red-600">− {x.split("|").slice(0, 4).join(" ")}</span>)}</p>}</div>}
      <p className="mt-2 text-xs text-slate-500">Un nouvel import ne supprime jamais les anciens cours ; les cours déjà connus sont mis à jour, pas dupliqués.</p>
    </Card>
  </>;
}
