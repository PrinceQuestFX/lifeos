"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, ReactNode } from "react";
import { CalendarDays, LayoutDashboard, Sparkles, Gauge, FileUp, Briefcase, CheckSquare, Target, Repeat, BarChart3, Bot, FileText, Settings, Moon, Sun, Menu, LogOut } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { seedDefaults } from "@/lib/seed";

const NAV = [
  ["/", "Dashboard", LayoutDashboard], ["/calendrier", "Mon calendrier", CalendarDays], ["/planning", "Mon planning intelligent", Sparkles],
  ["/disponibilites", "Mes disponibilités", Gauge], ["/import", "Importer mon emploi du temps", FileUp], ["/travail", "Mes horaires de travail", Briefcase],
  ["/taches", "Mes tâches", CheckSquare], ["/objectifs", "Mes objectifs", Target], ["/habitudes", "Mes habitudes", Repeat],
  ["/statistiques", "Mes statistiques", BarChart3], ["/assistant", "Mon assistant IA", Bot], ["/rapports", "Mes rapports", FileText], ["/parametres", "Paramètres", Settings],
] as const;

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname(), router = useRouter();
  const [dark, setDark] = useState(false), [open, setOpen] = useState(false), [ready, setReady] = useState(path === "/login");
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);

  useEffect(() => { const d = localStorage.getItem("theme") === "dark"; setDark(d); document.documentElement.classList.toggle("dark", d); }, []);
  useEffect(() => {
    const h = (e: any) => { const id = Date.now() + Math.random(); setToasts((t) => [...t, { id, ...e.detail }]); setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500); };
    window.addEventListener("lifeos-toast", h); return () => window.removeEventListener("lifeos-toast", h);
  }, []);
  useEffect(() => {
    if (path === "/login") { setReady(true); return; }
    (async () => {
      const sb = supabaseBrowser(); const { data: { user } } = await sb.auth.getUser();
      if (!user) return router.replace("/login");
      let { data: p } = await sb.from("user_preferences").select("setup_done").maybeSingle();
      if (!p) { await seedDefaults(sb, user.id); p = { setup_done: false }; }  // premier lancement : valeurs initiales A / 1 / horaires
      if (!p.setup_done && path !== "/parametres") router.replace("/parametres?setup=1");
      setReady(true);
    })();
  }, [path, router]);

  if (path === "/login") return <>{children}</>;
  const toggle = () => { const d = !dark; setDark(d); localStorage.setItem("theme", d ? "dark" : "light"); document.documentElement.classList.toggle("dark", d); };
  return (
    <div className="flex min-h-screen">
      <aside className={`${open ? "block" : "hidden"} fixed inset-y-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:static lg:block`}>
        <div className="mb-4 px-2 text-lg font-bold tracking-tight">LIFE<span className="text-indigo-500">OS</span></div>
        <nav className="space-y-0.5">{NAV.map(([href, label, Icon]) =>
          <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${path === href ? "bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}><Icon size={16} />{label}</Link>)}</nav>
        <div className="mt-4 flex gap-2 px-1">
          <button onClick={toggle} className="rounded-lg border p-2 dark:border-slate-700" aria-label="Thème">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button onClick={async () => { await supabaseBrowser().auth.signOut(); router.replace("/login"); }} className="flex items-center gap-1 rounded-lg border px-2 text-sm dark:border-slate-700"><LogOut size={14} />Quitter</button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="noprint sticky top-0 z-30 flex items-center gap-2 border-b bg-white/80 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:hidden">
          <button onClick={() => setOpen(!open)} aria-label="Menu"><Menu /></button><span className="font-bold">LIFEOS</span>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-6">{ready ? children : <div className="p-6 text-sm text-slate-500">Chargement…</div>}</main>
      </div>
      <div className="fixed bottom-4 right-4 z-[60] space-y-2">{toasts.map((t) => <div key={t.id} className={`rounded-lg px-3 py-2 text-sm text-white shadow-lg ${t.kind === "err" ? "bg-red-600" : "bg-emerald-600"}`}>{t.msg}</div>)}</div>
    </div>
  );
}
