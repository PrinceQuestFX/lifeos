"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "./supabase/client";
import { loadInputs } from "./data";
import { addDays } from "./time";
import type { DayInputs } from "./types";

export const useSB = () => useMemo(() => supabaseBrowser(), []);
export const getUid = async (sb: ReturnType<typeof supabaseBrowser>) => (await sb.auth.getUser()).data.user!.id;

/** Charge les données pour [from,to] (marge d'un jour pour les services de nuit). */
export function useInputs(from: string, to: string) {
  const sb = useSB();
  const [inputs, setInputs] = useState<DayInputs | null>(null);
  const reload = useCallback(async () => setInputs(await loadInputs(sb, addDays(from, -1), addDays(to, 1))), [sb, from, to]);
  useEffect(() => { reload(); }, [reload]);
  return { sb, inputs, reload };
}
/** Lecture simple d'une table filtrée/triée. */
export function useRows<T = any>(table: string, build?: (q: any) => any, deps: unknown[] = []) {
  const sb = useSB();
  const [rows, setRows] = useState<T[] | null>(null);
  const reload = useCallback(async () => {
    const r = await (build ? build(sb.from(table).select("*")) : sb.from(table).select("*"));
    setRows((r.data as T[]) ?? []);
  }, [sb, table, ...deps]); // eslint-disable-line
  useEffect(() => { reload(); }, [reload]);
  return { sb, rows, reload };
}
