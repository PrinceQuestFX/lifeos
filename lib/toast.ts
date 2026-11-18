export const toast = (msg: string, kind: "ok" | "err" = "ok") =>
  typeof window !== "undefined" && window.dispatchEvent(new CustomEvent("lifeos-toast", { detail: { msg, kind } }));
/** Affiche l'erreur Supabase si présente ; retourne true si OK. */
export const check = (r: { error: { message: string } | null }, okMsg?: string) => {
  if (r.error) { toast(r.error.message, "err"); return false; }
  if (okMsg) toast(okMsg); return true;
};
