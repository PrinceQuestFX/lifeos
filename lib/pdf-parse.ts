import { classify, type GroupPrefs } from "./groups";
import type { Category } from "./types";

export type ParsedEvent = {
  date: string; start_time: string; end_time: string; title: string; group_label: string | null;
  status: "keep" | "ignore" | "ambiguous"; kind: "cours" | "evaluation" | "ferie" | "autre"; category: Category;
  reason: string; uncertain: boolean; fingerprint: string;
};

/** Extrait le texte d'un PDF dans le navigateur (pdfjs-dist), ligne par ligne. */
export async function pdfToLines(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const rows = new Map<number, { x: number; s: string }[]>();
    for (const it of content.items as any[]) {
      const y = Math.round(it.transform[5] / 3) * 3;
      rows.set(y, [...(rows.get(y) ?? []), { x: it.transform[4], s: it.str }]);
    }
    [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, r]) => lines.push(r.sort((a, b) => a.x - b.x).map((c) => c.s).join(" ").replace(/\s+/g, " ").trim()));
  }
  return lines.filter(Boolean);
}

const MONTHS: Record<string, number> = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
const norm = (n: number) => String(n).padStart(2, "0");
const DATE_NUM = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/;
const DATE_TXT = /(\d{1,2})\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s*(\d{4})?/i;
const TIME = /(\d{1,2})\s*[h:]\s*(\d{2})?\s*(?:-|–|—|à|a)\s*(\d{1,2})\s*[h:]\s*(\d{2})?/i;

const cleanTime = (h: string, m?: string) => `${norm(Number(h))}:${m ?? "00"}`;

/**
 * Analyse heuristique : une ligne "date" fixe la date courante, puis chaque ligne contenant une plage horaire est un cours.
 * Le format exact des PDF HESTIM n'étant pas garanti, TOUT est montré dans l'écran de contrôle avant import.
 */
export function parseLines(lines: string[], prefs: GroupPrefs, defaultYear: number): ParsedEvent[] {
  const out: ParsedEvent[] = []; let date: string | null = null;
  for (const raw of lines) {
    const dn = raw.match(DATE_NUM), dt = raw.match(DATE_TXT);
    if (dn) { const y = Number(dn[3]); date = `${y < 100 ? 2000 + y : y}-${norm(+dn[2])}-${norm(+dn[1])}`; }
    else if (dt) date = `${dt[3] ?? defaultYear}-${norm(MONTHS[dt[2].toLowerCase()])}-${norm(+dt[1])}`;
    const tm = raw.match(TIME);
    if (!tm) {
      if (date && /f[ée]ri[ée]|jour f[ée]ri[ée]/i.test(raw)) out.push(mk(date, "00:00", "23:59", raw, "ferie", prefs));
      continue;
    }
    if (!date) { out.push({ ...mk("1970-01-01", cleanTime(tm[1], tm[2]), cleanTime(tm[3], tm[4]), raw, "cours", prefs), uncertain: true, reason: "Date introuvable" }); continue; }
    const title = raw.replace(TIME, "").replace(DATE_NUM, "").replace(DATE_TXT, "").replace(/^\s*(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s*/i, "").replace(/\s+/g, " ").trim() || "Cours";
    const kind = /examen|ds\b|contr[oô]le|[ée]valuation|partiel|quiz/i.test(title) ? "evaluation" : "cours";
    out.push(mk(date, cleanTime(tm[1], tm[2]), cleanTime(tm[3], tm[4]), title, kind, prefs));
  }
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.fingerprint) ? false : (seen.add(e.fingerprint), true)));
}

function mk(date: string, s: string, e: string, title: string, kind: ParsedEvent["kind"], prefs: GroupPrefs): ParsedEvent {
  const g = kind === "ferie" ? { status: "keep" as const, label: null, reason: "Jour férié" } : classify(title, prefs);
  return {
    date, start_time: s, end_time: e, title, group_label: g.label, status: g.status, kind, category: "etudes", reason: g.reason,
    uncertain: g.status === "ambiguous" || s >= e, fingerprint: `${date}|${s}|${e}|${title.toLowerCase().replace(/\s+/g, " ")}`,
  };
}
