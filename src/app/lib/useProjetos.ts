import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Projeto, ProjetoInsert, ProjetoUpdate, Entregavel, EntregavelInsert } from "./database.types";

export interface ProjetoWithEntregaveis extends Projeto {
  entregaveis: Entregavel[];
  cliente_nome?: string;
  cliente_cnpj?: string;
}

const PROJETOS_CHANGED = "certifica:projetos-changed";
function notifyProjetosChanged() { window.dispatchEvent(new Event(PROJETOS_CHANGED)); }

export function useProjetos() {
  const [projetos, setProjetos] = useState<ProjetoWithEntregaveis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("projetos")
      .select("*, entregaveis(*), clientes(nome_fantasia, cnpj)")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const mapped: ProjetoWithEntregaveis[] = (data ?? []).map((p: any) => ({
      ...p,
      entregaveis: Array.isArray(p.entregaveis)
        ? p.entregaveis.sort((a: Entregavel, b: Entregavel) => a.ordem - b.ordem)
        : [],
      cliente_nome: p.clientes?.nome_fantasia ?? "",
      cliente_cnpj: p.clientes?.cnpj ?? "",
      clientes: undefined,
    }));
    setProjetos(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const handler = () => { fetch(); };
    window.addEventListener(PROJETOS_CHANGED, handler);
    return () => window.removeEventListener(PROJETOS_CHANGED, handler);
  }, [fetch]);

  const create = useCallback(async (input: ProjetoInsert, entregaveis?: string[]) => {
    setError(null);
    const { data, error: err } = await supabase
      .from("projetos")
      .insert(input)
      .select()
      .single();
    if (err) { setError(err.message); return null; }

    if (entregaveis && entregaveis.length > 0) {
      const rows: EntregavelInsert[] = entregaveis.map((texto, i) => ({
        projeto_id: data.id,
        texto,
        concluido: false,
        ordem: i + 1,
      }));
      await supabase.from("entregaveis").insert(rows);
    }

    await fetch();
    notifyProjetosChanged();
    return data as Projeto;
  }, [fetch]);

  const update = useCallback(async (id: string, patch: ProjetoUpdate) => {
    setError(null);
    const { error: err } = await supabase.from("projetos").update(patch).eq("id", id);
    if (err) { setError(err.message); return false; }
    setProjetos((prev) => prev.map((p) => p.id === id ? { ...p, ...patch } : p));
    notifyProjetosChanged();
    return true;
  }, []);

  const toggleEntregavel = useCallback(async (entregavelId: string, concluido: boolean) => {
    setError(null);
    const { error: err } = await supabase.from("entregaveis").update({ concluido }).eq("id", entregavelId);
    if (err) { setError(err.message); return false; }
    setProjetos((prev) => prev.map((p) => ({
      ...p,
      entregaveis: p.entregaveis.map((e) => e.id === entregavelId ? { ...e, concluido } : e),
    })));
    return true;
  }, []);

  const addEntregavel = useCallback(async (projetoId: string, texto: string) => {
    setError(null);
    const projeto = projetos.find((p) => p.id === projetoId);
    const maxOrdem = projeto?.entregaveis.reduce((max, e) => Math.max(max, e.ordem), 0) ?? 0;
    const { data, error: err } = await supabase
      .from("entregaveis")
      .insert({ projeto_id: projetoId, texto, concluido: false, ordem: maxOrdem + 1 })
      .select()
      .single();
    if (err) { setError(err.message); return false; }
    setProjetos((prev) => prev.map((p) => p.id === projetoId
      ? { ...p, entregaveis: [...p.entregaveis, data as Entregavel] }
      : p
    ));
    return true;
  }, [projetos]);

  const updateEntregavel = useCallback(async (id: string, patch: { texto?: string; concluido?: boolean }) => {
    setError(null);
    const { error: err } = await supabase.from("entregaveis").update(patch).eq("id", id);
    if (err) { setError(err.message); return false; }
    setProjetos((prev) => prev.map((p) => ({
      ...p,
      entregaveis: p.entregaveis.map((e) => e.id === id ? { ...e, ...patch } : e),
    })));
    return true;
  }, []);

  const removeEntregavel = useCallback(async (id: string) => {
    setError(null);
    const { error: err } = await supabase.from("entregaveis").delete().eq("id", id);
    if (err) { setError(err.message); return false; }
    setProjetos((prev) => prev.map((p) => ({
      ...p,
      entregaveis: p.entregaveis.filter((e) => e.id !== id),
    })));
    return true;
  }, []);

  const remove = useCallback(async (id: string) => {
    setError(null);
    const { error: err } = await supabase.from("projetos").delete().eq("id", id);
    if (err) { setError(err.message); return false; }
    await fetch();
    notifyProjetosChanged();
    return true;
  }, [fetch]);

  return { projetos, loading, error, refetch: fetch, create, update, remove, toggleEntregavel, addEntregavel, updateEntregavel, removeEntregavel };
}
