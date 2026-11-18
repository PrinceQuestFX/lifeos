"use client";
import { ReactNode } from "react";
export const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(" ");
export const Card = ({ children, className }: { children: ReactNode; className?: string }) =>
  <section className={cx("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900", className)}>{children}</section>;
export const PageHead = ({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) =>
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{sub && <p className="text-sm text-slate-500">{sub}</p>}</div><div className="flex flex-wrap items-center gap-2">{actions}</div></div>;
export const Btn = ({ variant = "primary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) =>
  <button {...p} className={cx("rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50",
    variant === "primary" && "bg-indigo-600 text-white hover:bg-indigo-500", variant === "ghost" && "border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",
    variant === "danger" && "bg-red-600 text-white hover:bg-red-500", className)} />;
export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) =>
  <Card><div className="text-xs uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div>{hint && <div className="text-xs text-slate-500">{hint}</div>}</Card>;
export const Badge = ({ children, color = "#64748b" }: { children: ReactNode; color?: string }) =>
  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: color }}>{children}</span>;
export const Label = ({ t, children }: { t: string; children: ReactNode }) => <label className="flex flex-col gap-1 text-xs text-slate-500">{t}{children}</label>;
export const Modal = ({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) =>
  !open ? null : <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Fermer">✕</button></div>{children}</div></div>;
export const Loading = () => <div className="p-6 text-sm text-slate-500">Chargement…</div>;
export const Empty = ({ children }: { children: ReactNode }) => <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">{children}</div>;
