export const fh = (min: number) => `${(Math.round((min / 60) * 10) / 10).toString().replace(".", ",")} h`;
export const hhmm = (s: string) => s.slice(0, 5);
export const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const dLabel = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
export const csv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return "";
  const h = Object.keys(rows[0]);
  return [h.join(";"), ...rows.map((r) => h.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\n");
};
export const download = (name: string, text: string, mime = "text/csv") => {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + text], { type: mime + ";charset=utf-8" })); a.download = name; a.click();
};
