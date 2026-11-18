// Filtrage Groupe A + Groupe 1. Aucune supposition : cas douteux => "ambiguous".
export type GroupPrefs = { main: string; english: string; tec: string };
export type GroupStatus = "keep" | "ignore" | "ambiguous";
export type GroupResult = { status: GroupStatus; label: string | null; reason: string };

type Kind = "english" | "tec" | "main";
export const subjectKind = (title: string): Kind => {
  const t = title.toLowerCase();
  if (/business\s*english|\benglish\b|anglais/.test(t)) return "english";
  if (/\btec\b|communication/.test(t)) return "tec";
  return "main";
};
const TOKEN = /(?:groupe|group|gr\.?|g)\s*[:\-]?\s*([AB12])\b/gi;

export function extractGroups(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(TOKEN)) out.push(m[1].toUpperCase());
  return [...new Set(out)];
}

export function classify(title: string, prefs: GroupPrefs): GroupResult {
  const kind = subjectKind(title);
  const wanted = (kind === "english" ? prefs.english : kind === "tec" ? prefs.tec : prefs.main).toUpperCase();
  const found = extractGroups(title);
  if (found.length === 0) return { status: "keep", label: null, reason: "Cours commun (aucun groupe indiqué)" };
  const expectLetters = /[AB]/.test(wanted);
  const compatible = found.filter((g) => /[AB]/.test(g) === expectLetters);
  if (compatible.length === 0)
    return { status: "ambiguous", label: found.join("/"), reason: `Type de groupe inattendu pour ${kind} (attendu ${wanted})` };
  if (compatible.includes(wanted)) return { status: "keep", label: wanted, reason: `Groupe ${wanted} retenu` };
  return { status: "ignore", label: compatible.join("/"), reason: `Réservé au groupe ${compatible.join("/")}` };
}
