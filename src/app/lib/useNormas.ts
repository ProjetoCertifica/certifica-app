import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";

export interface NormaVinculo {
  id: string;
  cliente_id: string;
  norma_code: string;
  status: "nao-iniciado" | "em-andamento" | "implementado" | "certificado";
  consultor: string;
  data_inicio: string | null;
  data_meta: string | null;
  progresso: number;
  observacoes: string;
  created_at: string;
  /* joined */
  cliente_nome?: string;
}

export interface NormaVinculoInsert {
  cliente_id: string;
  norma_code: string;
  status?: string;
  consultor: string;
  data_inicio?: string | null;
  data_meta?: string | null;
  progresso?: number;
  observacoes?: string;
}

export interface ClienteRef {
  id: string;
  nome_fantasia: string;
}

export function useNormas() {
  const [vinculos, setVinculos] = useState<NormaVinculo[]>([]);
  const [clientes, setClientes] = useState<ClienteRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, cRes] = await Promise.allSettled([
        supabase
          .from("norma_vinculos")
          .select("*, clientes(nome_fantasia)")
          .order("created_at", { ascending: false }),
        supabase
          .from("clientes")
          .select("id, nome_fantasia")
          .eq("status", "ativo")
          .order("nome_fantasia"),
      ]);

      if (vRes.status === "fulfilled" && vRes.value.data) {
        setVinculos(
          (vRes.value.data as any[]).map((v) => ({
            ...v,
            cliente_nome: v.clientes?.nome_fantasia ?? "",
          }))
        );
      }

      if (cRes.status === "fulfilled" && cRes.value.data) {
        setClientes(cRes.value.data as ClienteRef[]);
      }
    } catch (e) {
      console.error("[useNormas] Erro:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (data: NormaVinculoInsert): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.from("norma_vinculos").insert(data as any);
      if (error) { console.error("[useNormas] Erro ao criar:", error); return false; }
      await fetch();
      return true;
    } catch { return false; }
    finally { setSaving(false); }
  }, [fetch]);

  const update = useCallback(async (id: string, data: Partial<NormaVinculoInsert>): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.from("norma_vinculos").update(data as any).eq("id", id);
      if (error) { console.error("[useNormas] Erro ao atualizar:", error); return false; }
      await fetch();
      return true;
    } catch { return false; }
    finally { setSaving(false); }
  }, [fetch]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("norma_vinculos").delete().eq("id", id);
      if (error) { console.error("[useNormas] Erro ao remover:", error); return false; }
      await fetch();
      return true;
    } catch { return false; }
  }, [fetch]);

  /* lista de consultores únicos dos projetos */
  const [consultores, setConsultores] = useState<string[]>([]);
  useEffect(() => {
    supabase
      .from("projetos")
      .select("consultor")
      .then(({ data }) => {
        if (data) {
          const uniq = [...new Set((data as any[]).map((p) => p.consultor).filter(Boolean))].sort();
          setConsultores(uniq);
        }
      });
  }, []);

  return { vinculos, clientes, consultores, loading, saving, create, update, remove, refetch: fetch };
}
