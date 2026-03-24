import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabase";

export interface Faturamento {
  id: string;
  projeto_id: string | null;
  cliente_id: string | null;
  consultor: string;
  numero_nf: string;
  descricao: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  status: string;
  tipo: string;
  mes_competencia: string;
  observacoes: string;
  created_at: string;
  // joined
  projeto_titulo?: string;
  projeto_codigo?: string;
  cliente_nome?: string;
}

export interface FaturamentoInsert {
  projeto_id?: string | null;
  cliente_id?: string | null;
  consultor: string;
  numero_nf: string;
  descricao: string;
  valor: number;
  data_emissao: string;
  data_vencimento?: string | null;
  data_pagamento?: string | null;
  status?: string;
  tipo?: string;
  mes_competencia: string;
  observacoes?: string;
}

export interface FinanceiroKPIs {
  totalContratado: number;
  faturadoMes: number;
  faturadoAno: number;
  aReceber: number;
  totalNFs: number;
  nfsPagas: number;
  nfsVencidas: number;
}

export interface FechamentoConsultor {
  consultor: string;
  totalProjetos: number;
  valorContratado: number;
  valorFaturado: number;
  valorPago: number;
  valorPendente: number;
}

export interface FaturamentoMensal {
  mes: string;
  faturado: number;
  pago: number;
}

export function useFinanceiro() {
  const [faturas, setFaturas] = useState<Faturamento[]>([]);
  const [projetos, setProjetos] = useState<{ id: string; codigo: string; titulo: string; valor: string; consultor: string; cliente_id: string; cliente_nome: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [fatRes, projRes] = await Promise.allSettled([
        supabase
          .from("faturamento")
          .select("*, projetos(titulo, codigo), clientes(nome_fantasia)")
          .order("data_emissao", { ascending: false }),
        supabase
          .from("projetos")
          .select("id, codigo, titulo, valor, consultor, cliente_id, status, clientes(nome_fantasia)")
          .order("created_at", { ascending: false }),
      ]);

      if (fatRes.status === "fulfilled" && fatRes.value.data) {
        setFaturas(
          (fatRes.value.data as any[]).map((f) => ({
            ...f,
            valor: Number(f.valor) || 0,
            projeto_titulo: f.projetos?.titulo ?? "",
            projeto_codigo: f.projetos?.codigo ?? "",
            cliente_nome: f.clientes?.nome_fantasia ?? "",
          }))
        );
      }

      if (projRes.status === "fulfilled" && projRes.value.data) {
        setProjetos(
          (projRes.value.data as any[]).map((p) => ({
            id: p.id,
            codigo: p.codigo,
            titulo: p.titulo,
            valor: p.valor,
            consultor: p.consultor,
            cliente_id: p.cliente_id,
            cliente_nome: p.clientes?.nome_fantasia ?? "",
            status: p.status,
          }))
        );
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (data: FaturamentoInsert): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.from("faturamento").insert(data as any);
      if (error) { console.error(error); return false; }
      await fetch();
      return true;
    } catch { return false; }
    finally { setSaving(false); }
  }, [fetch]);

  const update = useCallback(async (id: string, data: Partial<FaturamentoInsert>): Promise<boolean> => {
    setSaving(true);
    try {
      const { error } = await supabase.from("faturamento").update(data as any).eq("id", id);
      if (error) { console.error(error); return false; }
      await fetch();
      return true;
    } catch { return false; }
    finally { setSaving(false); }
  }, [fetch]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("faturamento").delete().eq("id", id);
      if (error) return false;
      await fetch();
      return true;
    } catch { return false; }
  }, [fetch]);

  // KPIs
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const anoAtual = String(now.getFullYear());

  const kpis: FinanceiroKPIs = useMemo(() => {
    const totalContratado = projetos
      .filter((p) => p.status !== "cancelado")
      .reduce((s, p) => s + (Number(p.valor) || 0), 0);

    const faturasDoMes = faturas.filter((f) => f.mes_competencia === mesAtual && f.status !== "cancelada");
    const faturadoMes = faturasDoMes.reduce((s, f) => s + f.valor, 0);

    const faturasDoAno = faturas.filter((f) => f.mes_competencia.startsWith(anoAtual) && f.status !== "cancelada");
    const faturadoAno = faturasDoAno.reduce((s, f) => s + f.valor, 0);

    const aReceber = faturas
      .filter((f) => f.status === "emitida")
      .reduce((s, f) => s + f.valor, 0);

    const totalNFs = faturas.filter((f) => f.status !== "cancelada").length;
    const nfsPagas = faturas.filter((f) => f.status === "paga").length;
    const nfsVencidas = faturas.filter((f) => {
      if (f.status !== "emitida" || !f.data_vencimento) return false;
      return new Date(f.data_vencimento) < now;
    }).length;

    return { totalContratado, faturadoMes, faturadoAno, aReceber, totalNFs, nfsPagas, nfsVencidas };
  }, [faturas, projetos, mesAtual, anoAtual]);

  // Fechamento por consultor
  const fechamentoConsultores: FechamentoConsultor[] = useMemo(() => {
    const map = new Map<string, FechamentoConsultor>();
    for (const p of projetos) {
      if (p.status === "cancelado") continue;
      const c = map.get(p.consultor) ?? { consultor: p.consultor, totalProjetos: 0, valorContratado: 0, valorFaturado: 0, valorPago: 0, valorPendente: 0 };
      c.totalProjetos++;
      c.valorContratado += Number(p.valor) || 0;
      map.set(p.consultor, c);
    }
    for (const f of faturas) {
      if (f.status === "cancelada") continue;
      const c = map.get(f.consultor);
      if (!c) continue;
      c.valorFaturado += f.valor;
      if (f.status === "paga") c.valorPago += f.valor;
      else c.valorPendente += f.valor;
    }
    return Array.from(map.values()).sort((a, b) => b.valorContratado - a.valorContratado);
  }, [faturas, projetos]);

  // Faturamento mensal (últimos 12 meses)
  const faturamentoMensal: FaturamentoMensal[] = useMemo(() => {
    const meses: FaturamentoMensal[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const doMes = faturas.filter((f) => f.mes_competencia === key && f.status !== "cancelada");
      meses.push({
        mes: key,
        faturado: doMes.reduce((s, f) => s + f.valor, 0),
        pago: doMes.filter((f) => f.status === "paga").reduce((s, f) => s + f.valor, 0),
      });
    }
    return meses;
  }, [faturas]);

  return {
    faturas, projetos, loading, saving,
    create, update, remove, refetch: fetch,
    kpis, fechamentoConsultores, faturamentoMensal,
    mesAtual,
  };
}
