"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Btn, Card } from "@/components/ui";

export default function Login() {
  const r = useRouter(); const [email, setEmail] = useState(""), [pw, setPw] = useState(""), [mode, setMode] = useState<"in" | "up">("in"), [msg, setMsg] = useState("");
  const go = async () => {
    const sb = supabaseBrowser();
    const res = mode === "in" ? await sb.auth.signInWithPassword({ email, password: pw }) : await sb.auth.signUp({ email, password: pw });
    if (res.error) return setMsg(res.error.message);
    if (mode === "up" && !res.data.session) return setMsg("Compte créé. Confirmez votre e-mail puis connectez-vous.");
    r.replace("/"); r.refresh();
  };
  return <div className="flex min-h-screen items-center justify-center p-4"><Card className="w-full max-w-sm space-y-3">
    <h1 className="text-xl font-semibold">LIFE<span className="text-indigo-500">OS</span></h1>
    <input className="w-full" type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
    <input className="w-full" type="password" placeholder="Mot de passe (8+ caractères)" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} />
    {msg && <p className="text-sm text-red-600">{msg}</p>}
    <Btn className="w-full" onClick={go}>{mode === "in" ? "Se connecter" : "Créer mon compte"}</Btn>
    <button className="text-sm text-indigo-600" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "Pas de compte ? Créer" : "Déjà un compte ? Connexion"}</button>
  </Card></div>;
}
