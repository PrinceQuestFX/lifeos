import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { loadInputs } from "@/lib/data";
import { computeRange, dateRange } from "@/lib/availability";
import { addDays, todayISO } from "@/lib/time";

export const runtime = "nodejs";

// Fournisseurs interchangeables : ajouter une entrée suffit. Les clés restent côté serveur.
const PROVIDERS: Record<string, (system: string, msgs: { role: string; content: string }[]) => Promise<string>> = {
  async anthropic(system, msgs) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.AI_MODEL || "claude-sonnet-4-5", max_tokens: 1200, system, messages: msgs }),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}`);
    return (await r.json()).content?.map((c: any) => c.text ?? "").join("") ?? "";
  },
  async openai(system, msgs) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.AI_MODEL || "gpt-4o-mini", messages: [{ role: "system", content: system }, ...msgs] }),
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    return (await r.json()).choices?.[0]?.message?.content ?? "";
  },
};

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const provider = process.env.AI_PROVIDER || "anthropic";
  const keyOk = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
  if (!keyOk) return NextResponse.json({ error: `Clé API manquante (${provider}). Ajoutez-la dans .env.local côté serveur.` }, { status: 503 });

  const { messages } = (await req.json()) as { messages: { role: "user" | "assistant"; content: string }[] };
  const from = todayISO(), to = addDays(from, 14);
  const inputs = await loadInputs(sb, addDays(from, -1), addDays(to, 1));
  const days = computeRange(dateRange(from, to), inputs).map((d) => ({
    date: d.date, libre_h: +(d.freeMin / 60).toFixed(2), exploitable_h: +(d.usableMin / 60).toFixed(2),
    creneaux_libres: d.usable.map((i) => `${String(Math.floor((i.start % 1440) / 60)).padStart(2, "0")}:${String(i.start % 60).padStart(2, "0")}-${String(Math.floor((i.end % 1440) / 60)).padStart(2, "0")}:${String(i.end % 60).padStart(2, "0")}`),
    blocs: d.blocks.map((b) => `${b.title}[${b.category}]`), conflits: d.conflicts.length,
  }));
  const system = `Tu es l'assistant de LIFEOS. Réponds en français, de façon concise.
RÈGLES : utilise UNIQUEMENT les données ci-dessous (aujourd'hui = ${from}). N'invente ni cours ni disponibilité. Si une donnée manque, dis-le.
Toute modification du calendrier est une PROPOSITION. Termine ta réponse, si besoin, par un bloc \`\`\`json {"proposals":[...]} \`\`\` avec des objets:
 {"type":"work_exception","date":"YYYY-MM-DD","kind":"off"|"replace"|"extra","start":"HH:MM","end":"HH:MM","label":"..."}
 {"type":"planning_event","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","title":"...","category":"revisions|anglais|sport|repos|autre","label":"..."}
Les créneaux proposés doivent appartenir à "creneaux_libres". L'utilisateur confirmera avant application.
DONNÉES (15 prochains jours) : ${JSON.stringify(days)}`;

  try {
    const reply = await PROVIDERS[provider](system, messages.slice(-12));
    const m = reply.match(/```json\s*([\s\S]*?)```/);
    let proposals: unknown[] = [];
    if (m) { try { proposals = JSON.parse(m[1]).proposals ?? []; } catch {} }
    const text = reply.replace(/```json[\s\S]*?```/, "").trim();
    await sb.from("ai_conversations").insert([{ user_id: user.id, role: "user", content: messages[messages.length - 1].content }, { user_id: user.id, role: "assistant", content: text, proposals }]);
    return NextResponse.json({ reply: text, proposals });
  } catch (e: any) {
    return NextResponse.json({ error: `Erreur fournisseur IA : ${e.message}` }, { status: 502 });
  }
}
