import { useState, useCallback } from "react";
import { supabase } from "./supabase";

interface Projeto360 {
  id: string;
  codigo: string;
  titulo: string;
  norma: string;
  status: string;
  fase_label: string;
  consultor: string;
  previsao: string | null;
}

interface Audit360 {
  id: string;
  codigo: string;
  tipo: string;
  norma: string;
  status: string;
  data_inicio: string | null;
  findings_count: number;
}

interface Document360 {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  status: string;
  created_at: string;
}

interface Meeting360 {
  id: string;
  titulo: string;
  tipo: string;
  data: string | null;
  status: string;
}

export interface Cliente360Data {
  projetos: Projeto360[];
  auditorias: Audit360[];
  documentos: Document360[];
  reunioes: Meeting360[];
}

export function useCliente360() {
  const [data, setData] = useState<Cliente360Data | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async (clienteId: string) => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const [projRes, audRes, docRes, meetRes] = await Promise.allSettled([
        supabase
          .from("projetos")
          .select("id, codigo, titulo, norma, status, fase_label, consultor, previsao")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false }),
        supabase
          .from("audits")
          .select("id, codigo, tipo, norma, status, data_inicio, audit_findings(id)")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false }),
        supabase
          .from("documents")
          .select("id, codigo, titulo, tipo, status, created_at")
          .eq("cliente_id", clienteId)
          .order("created_at", { ascending: false }),
        supabase
          .from("meetings")
          .select("id, titulo, tipo, data, status")
          .eq("cliente_id", clienteId)
          .order("data", { ascending: false }),
      ]);

      const projetos: Projeto360[] =
        projRes.status === "fulfilled" && projRes.value.data
          ? projRes.value.data.map((p: any) => ({
              id: p.id, codigo: p.codigo, titulo: p.titulo, norma: p.norma,
              status: p.status, fase_label: p.fase_label, consultor: p.consultor, previsao: p.previsao,
            }))
          : [];

      const auditorias: Audit360[] =
        audRes.status === "fulfilled" && audRes.value.data
          ? audRes.value.data.map((a: any) => ({
              id: a.id, codigo: a.codigo, tipo: a.tipo, norma: a.norma,
              status: a.status, data_inicio: a.data_inicio,
              findings_count: Array.isArray(a.audit_findings) ? a.audit_findings.length : 0,
            }))
          : [];

      const documentos: Document360[] =
        docRes.status === "fulfilled" && docRes.value.data
          ? docRes.value.data.map((d: any) => ({
              id: d.id, codigo: d.codigo, titulo: d.titulo, tipo: d.tipo,
              status: d.status, created_at: d.created_at,
            }))
          : [];

      const reunioes: Meeting360[] =
        meetRes.status === "fulfilled" && meetRes.value.data
          ? meetRes.value.data.map((m: any) => ({
              id: m.id, titulo: m.titulo, tipo: m.tipo,
              data: m.data, status: m.status,
            }))
          : [];

      setData({ projetos, auditorias, documentos, reunioes });
    } catch {
      setData({ projetos: [], auditorias: [], documentos: [], reunioes: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, fetch };
}
