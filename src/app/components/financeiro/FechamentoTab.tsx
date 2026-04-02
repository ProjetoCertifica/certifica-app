import React, { useState, useMemo, useCallback } from "react";
import { DSCard } from "../ds/DSCard";
import { DSBadge } from "../ds/DSBadge";
import { DSSelect } from "../ds/DSSelect";
import {
  ChevronDown,
  ChevronRight,
  Download,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Building2,
} from "lucide-react";
import { type Faturamento, parseValorBR } from "../../lib/useFinanceiro";

/* ── tipos ────────────────────────────────────── */

interface ProjetoResumo {
  id: string;
  codigo: string;
  titulo: string;
  valor: string;
  consultor: string;
  cliente_id: string;
  cliente_nome: string;
  status: string;
}

export interface FechamentoTabProps {
  faturas: Faturamento[];
  projetos: ProjetoResumo[];
  mesAtual: string;
}

interface ProjetoFechamento {
  projetoId: string | null;
  projetoCodigo: string;
  projetoTitulo: string;
  clienteNome: string;
  clienteId: string | null;
  valorContrato: number;
  nfs: Faturamento[];
  totalFaturado: number;
  totalPago: number;
  totalPendente: number;
  totalVencido: number;
}

interface ConsultorFechamento {
  consultor: string;
  projetos: ProjetoFechamento[];
  totalContratado: number;
  totalFaturado: number;
  totalPago: number;
  totalPendente: number;
  totalVencido: number;
}

interface DiaNFs {
  dia: string;
  diaLabel: string;
  nfs: Faturamento[];
  total: number;
}

/* ── helpers ──────────────────────────────────── */

function currency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mesLabelLongo(mes: string): string {
  const [y, m] = mes.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function diaLabelCurto(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function statusBadge(status: string): { label: string; variant: "conformidade" | "nao-conformidade" | "observacao" | "outline" } {
  if (status === "paga") return { label: "Paga", variant: "conformidade" };
  if (status === "vencida") return { label: "Vencida", variant: "nao-conformidade" };
  if (status === "cancelada") return { label: "Cancelada", variant: "outline" };
  return { label: "Emitida", variant: "observacao" };
}

function isVencida(f: Faturamento): boolean {
  if (f.status !== "emitida" || !f.data_vencimento) return false;
  return new Date(f.data_vencimento) < new Date();
}

/* ── componente ──────────────────────────────── */

export default function FechamentoTab({ faturas, projetos, mesAtual }: FechamentoTabProps) {
  const [mesSel, setMesSel] = useState(mesAtual);
  const [consultorSel, setConsultorSel] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  /* opções do seletor de mês (últimos 24 meses) */
  const monthOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ value, label: mesLabelLongo(value) });
    }
    return opts;
  }, []);

  /* opções do seletor de consultor */
  const consultorOptions = useMemo(() => {
    const uniq = [...new Set([
      ...faturas.map((f) => f.consultor),
      ...projetos.map((p) => p.consultor),
    ])].filter(Boolean).sort();
    return [
      { value: "", label: "Todos os consultores" },
      ...uniq.map((c) => ({ value: c, label: c })),
    ];
  }, [faturas, projetos]);

  /* dados por consultor */
  const dadosFechamento = useMemo((): ConsultorFechamento[] => {
    const faturasMes = faturas.filter((f) => f.mes_competencia === mesSel && f.status !== "cancelada");
    const projetosAtivos = projetos.filter((p) => p.status !== "cancelado");

    // agrupar projetos por consultor
    const mapConsultor = new Map<string, ConsultorFechamento>();

    for (const p of projetosAtivos) {
      if (consultorSel && p.consultor !== consultorSel) continue;
      if (!p.consultor) continue;

      let entry = mapConsultor.get(p.consultor);
      if (!entry) {
        entry = { consultor: p.consultor, projetos: [], totalContratado: 0, totalFaturado: 0, totalPago: 0, totalPendente: 0, totalVencido: 0 };
        mapConsultor.set(p.consultor, entry);
      }

      const nfsProj = faturasMes.filter((f) => f.projeto_id === p.id);
      const totalFat = nfsProj.reduce((s, f) => s + f.valor, 0);
      const totalPago = nfsProj.filter((f) => f.status === "paga").reduce((s, f) => s + f.valor, 0);
      const totalPend = nfsProj.filter((f) => f.status === "emitida").reduce((s, f) => s + f.valor, 0);
      const totalVenc = nfsProj.filter(isVencida).reduce((s, f) => s + f.valor, 0);
      const valorContrato = parseValorBR(p.valor);

      entry.projetos.push({
        projetoId: p.id,
        projetoCodigo: p.codigo,
        projetoTitulo: p.titulo,
        clienteNome: p.cliente_nome,
        clienteId: p.cliente_id,
        valorContrato,
        nfs: nfsProj,
        totalFaturado: totalFat,
        totalPago,
        totalPendente: totalPend,
        totalVencido: totalVenc,
      });

      entry.totalContratado += valorContrato;
      entry.totalFaturado += totalFat;
      entry.totalPago += totalPago;
      entry.totalPendente += totalPend;
      entry.totalVencido += totalVenc;
    }

    // NFs sem projeto vinculado
    const nfsSemProjeto = faturasMes.filter((f) => !f.projeto_id);
    for (const nf of nfsSemProjeto) {
      if (consultorSel && nf.consultor !== consultorSel) continue;
      if (!nf.consultor) continue;

      let entry = mapConsultor.get(nf.consultor);
      if (!entry) {
        entry = { consultor: nf.consultor, projetos: [], totalContratado: 0, totalFaturado: 0, totalPago: 0, totalPendente: 0, totalVencido: 0 };
        mapConsultor.set(nf.consultor, entry);
      }

      // agrupar NFs sem projeto num "projeto virtual"
      let projAvulso = entry.projetos.find((p) => p.projetoId === null);
      if (!projAvulso) {
        projAvulso = {
          projetoId: null,
          projetoCodigo: "",
          projetoTitulo: "NFs avulsas (sem projeto)",
          clienteNome: nf.cliente_nome || "",
          clienteId: nf.cliente_id,
          valorContrato: 0,
          nfs: [],
          totalFaturado: 0,
          totalPago: 0,
          totalPendente: 0,
          totalVencido: 0,
        };
        entry.projetos.push(projAvulso);
      }

      projAvulso.nfs.push(nf);
      projAvulso.totalFaturado += nf.valor;
      const isPago = nf.status === "paga";
      if (isPago) projAvulso.totalPago += nf.valor;
      else projAvulso.totalPendente += nf.valor;
      if (isVencida(nf)) projAvulso.totalVencido += nf.valor;

      entry.totalFaturado += nf.valor;
      if (isPago) entry.totalPago += nf.valor;
      else entry.totalPendente += nf.valor;
      if (isVencida(nf)) entry.totalVencido += nf.valor;
    }

    // ordenar: maior faturamento primeiro; dentro de cada consultor, projetos com NFs primeiro
    const result = Array.from(mapConsultor.values()).sort((a, b) => b.totalFaturado - a.totalFaturado);
    for (const c of result) {
      c.projetos.sort((a, b) => b.totalFaturado - a.totalFaturado);
    }
    return result;
  }, [faturas, projetos, mesSel, consultorSel]);

  /* totais gerais */
  const totais = useMemo(() => ({
    faturado: dadosFechamento.reduce((s, c) => s + c.totalFaturado, 0),
    pago: dadosFechamento.reduce((s, c) => s + c.totalPago, 0),
    pendente: dadosFechamento.reduce((s, c) => s + c.totalPendente, 0),
    vencido: dadosFechamento.reduce((s, c) => s + c.totalVencido, 0),
    contratado: dadosFechamento.reduce((s, c) => s + c.totalContratado, 0),
  }), [dadosFechamento]);

  /* timeline dia-a-dia */
  const dadosDiarios = useMemo((): DiaNFs[] => {
    const faturasMes = faturas.filter((f) =>
      f.mes_competencia === mesSel &&
      f.status !== "cancelada" &&
      (!consultorSel || f.consultor === consultorSel)
    );

    const map = new Map<string, Faturamento[]>();
    for (const f of faturasMes) {
      const dia = f.data_emissao; // "YYYY-MM-DD"
      if (!dia) continue;
      const arr = map.get(dia) ?? [];
      arr.push(f);
      map.set(dia, arr);
    }

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dia, nfs]) => ({
        dia,
        diaLabel: diaLabelCurto(dia),
        nfs,
        total: nfs.reduce((s, f) => s + f.valor, 0),
      }));
  }, [faturas, mesSel, consultorSel]);

  /* expand/collapse */
  const toggle = useCallback((consultor: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(consultor)) next.delete(consultor);
      else next.add(consultor);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandidos(new Set(dadosFechamento.map((c) => c.consultor)));
  }, [dadosFechamento]);

  const collapseAll = useCallback(() => {
    setExpandidos(new Set());
  }, []);

  /* export CSV */
  const handleExport = useCallback(() => {
    const sep = ";";
    const bom = "\uFEFF";
    const headers = ["Consultor", "Cliente", "Projeto", "Codigo", "NF", "Valor", "Status", "Emissao", "Vencimento", "Pagamento", "Tipo", "Descricao"];
    const rows: string[][] = [];

    for (const c of dadosFechamento) {
      for (const p of c.projetos) {
        if (p.nfs.length > 0) {
          for (const nf of p.nfs) {
            rows.push([
              c.consultor,
              p.clienteNome || nf.cliente_nome || "",
              p.projetoTitulo,
              p.projetoCodigo,
              nf.numero_nf,
              nf.valor.toFixed(2).replace(".", ","),
              nf.status,
              nf.data_emissao,
              nf.data_vencimento || "",
              nf.data_pagamento || "",
              nf.tipo,
              nf.descricao,
            ]);
          }
        } else {
          // projeto sem NFs no mes — mostra linha com valores zerados
          rows.push([
            c.consultor,
            p.clienteNome,
            p.projetoTitulo,
            p.projetoCodigo,
            "",
            "0,00",
            "sem faturamento",
            "",
            "",
            "",
            "",
            "",
          ]);
        }
      }
    }

    const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = bom + [headers.map(quote).join(sep), ...rows.map((r) => r.map(quote).join(sep))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fechamento_${mesSel}${consultorSel ? "_" + consultorSel.replace(/\s+/g, "_") : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [dadosFechamento, mesSel, consultorSel]);

  /* ── render ────────────────────────────────── */

  const temDados = dadosFechamento.length > 0;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-[220px]">
          <DSSelect
            label="Mês de competência"
            value={mesSel}
            onChange={(e) => setMesSel(e.target.value)}
            options={monthOptions}
          />
        </div>
        <div className="w-[220px]">
          <DSSelect
            label="Consultor"
            value={consultorSel}
            onChange={(e) => setConsultorSel(e.target.value)}
            options={consultorOptions}
          />
        </div>
        <button
          onClick={handleExport}
          disabled={!temDados}
          className="h-[34px] px-3 flex items-center gap-1.5 text-[11px] font-medium rounded-[4px] border border-certifica-200 text-certifica-600 hover:text-certifica-800 hover:border-certifica-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
          Exportar CSV
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Faturado no mês", value: totais.faturado, icon: DollarSign, color: "#2B8EAD" },
          { label: "Recebido", value: totais.pago, icon: CheckCircle2, color: "#10B981" },
          { label: "Pendente", value: totais.pendente, icon: Clock, color: "#D97706" },
          { label: "Vencido", value: totais.vencido, icon: AlertTriangle, color: "#EF4444" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-certifica-200 rounded-[4px] px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} strokeWidth={1.5} />
              <span className="text-[10px] text-certifica-500 uppercase tracking-[0.04em]">{kpi.label}</span>
            </div>
            <div className="text-[18px] text-certifica-900 font-mono" style={{ fontWeight: 700 }}>{currency(kpi.value)}</div>
          </div>
        ))}
      </div>

      {/* Por consultor */}
      <DSCard
        header={
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>
              Fechamento por Consultor — {mesLabelLongo(mesSel)}
            </span>
            {temDados && (
              <div className="flex items-center gap-2">
                <button onClick={expandAll} className="text-[10px] text-certifica-accent hover:underline cursor-pointer">Expandir tudo</button>
                <span className="text-certifica-300">|</span>
                <button onClick={collapseAll} className="text-[10px] text-certifica-accent hover:underline cursor-pointer">Recolher</button>
              </div>
            )}
          </div>
        }
      >
        {!temDados ? (
          <div className="py-10 text-center text-[12px] text-certifica-500">
            Nenhum dado de faturamento para {mesLabelLongo(mesSel)}
            {consultorSel ? ` (${consultorSel})` : ""}.
          </div>
        ) : (
          <div className="divide-y divide-certifica-200">
            {dadosFechamento.map((c) => {
              const aberto = expandidos.has(c.consultor);
              const percFaturado = c.totalContratado > 0
                ? Math.round((c.totalFaturado / c.totalContratado) * 100)
                : 0;

              return (
                <div key={c.consultor}>
                  {/* header consultor */}
                  <button
                    onClick={() => toggle(c.consultor)}
                    className="w-full flex items-center gap-3 px-3 py-3 hover:bg-certifica-50/60 transition-colors cursor-pointer text-left"
                  >
                    {aberto
                      ? <ChevronDown className="w-4 h-4 text-certifica-400 flex-shrink-0" strokeWidth={1.5} />
                      : <ChevronRight className="w-4 h-4 text-certifica-400 flex-shrink-0" strokeWidth={1.5} />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>{c.consultor}</span>
                        <span className="text-[10px] text-certifica-500">
                          {c.projetos.length} projeto{c.projetos.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-0.5">
                        <span className="text-[11px] text-certifica-500">
                          Contratado: <span className="font-mono text-certifica-700" style={{ fontWeight: 500 }}>{currency(c.totalContratado)}</span>
                        </span>
                        <span className="text-[11px] text-certifica-500">
                          Faturado: <span className="font-mono text-certifica-accent" style={{ fontWeight: 600 }}>{currency(c.totalFaturado)}</span>
                        </span>
                        <span className="text-[11px] text-certifica-500">
                          Pago: <span className="font-mono" style={{ fontWeight: 600, color: "#10B981" }}>{currency(c.totalPago)}</span>
                        </span>
                        {c.totalPendente > 0 && (
                          <span className="text-[11px] text-certifica-500">
                            Pendente: <span className="font-mono" style={{ fontWeight: 600, color: "#D97706" }}>{currency(c.totalPendente)}</span>
                          </span>
                        )}
                        {c.totalVencido > 0 && (
                          <span className="text-[11px] text-certifica-500">
                            Vencido: <span className="font-mono" style={{ fontWeight: 600, color: "#EF4444" }}>{currency(c.totalVencido)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {/* mini barra de progresso */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-16 h-[5px] bg-certifica-100 rounded-full overflow-hidden">
                        <div className="h-full bg-certifica-accent rounded-full transition-all" style={{ width: `${Math.min(100, percFaturado)}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-certifica-500 w-8 text-right">{percFaturado}%</span>
                    </div>
                  </button>

                  {/* detalhe expandido */}
                  {aberto && (
                    <div className="pb-3 px-3 pl-10">
                      {c.projetos.map((p, pIdx) => (
                        <div key={p.projetoId ?? `avulso-${pIdx}`} className={`${pIdx > 0 ? "mt-3 pt-3 border-t border-certifica-100" : ""}`}>
                          {/* header projeto */}
                          <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-3.5 h-3.5 text-certifica-400" strokeWidth={1.5} />
                            <span className="text-[12px] text-certifica-800" style={{ fontWeight: 600 }}>
                              {p.projetoCodigo ? `${p.projetoCodigo} — ` : ""}{p.projetoTitulo}
                            </span>
                            {p.clienteNome && (
                              <span className="text-[11px] text-certifica-500">({p.clienteNome})</span>
                            )}
                            {p.valorContrato > 0 && (
                              <span className="text-[10px] font-mono text-certifica-400 ml-auto">
                                Contrato: {currency(p.valorContrato)}
                              </span>
                            )}
                          </div>

                          {/* NFs do projeto */}
                          {p.nfs.length > 0 ? (
                            <div className="border border-certifica-200 rounded-[4px] overflow-hidden">
                              <table className="w-full">
                                <thead>
                                  <tr className="bg-certifica-50 border-b border-certifica-200">
                                    {["NF", "Descrição", "Emissão", "Vencimento", "Valor", "Status"].map((h) => (
                                      <th key={h} className="px-3 py-1.5 text-left text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
                                        {h}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.nfs.map((nf) => {
                                    const badge = statusBadge(isVencida(nf) ? "vencida" : nf.status);
                                    return (
                                      <tr key={nf.id} className="border-b border-certifica-100 last:border-b-0 hover:bg-certifica-50/40">
                                        <td className="px-3 py-2 text-[12px] font-mono text-certifica-dark" style={{ fontWeight: 500 }}>
                                          {nf.numero_nf}
                                        </td>
                                        <td className="px-3 py-2 text-[12px] text-certifica-500 max-w-[200px] truncate">
                                          {nf.descricao || "—"}
                                        </td>
                                        <td className="px-3 py-2 text-[11px] font-mono text-certifica-500">
                                          {nf.data_emissao ? new Date(nf.data_emissao + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                                        </td>
                                        <td className="px-3 py-2 text-[11px] font-mono text-certifica-500">
                                          {nf.data_vencimento ? new Date(nf.data_vencimento + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                                        </td>
                                        <td className="px-3 py-2 text-[12px] font-mono text-certifica-900" style={{ fontWeight: 600 }}>
                                          {currency(nf.valor)}
                                        </td>
                                        <td className="px-3 py-2">
                                          <DSBadge variant={badge.variant}>{badge.label}</DSBadge>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-[11px] text-certifica-400 italic pl-6">
                              Sem faturamento neste mês
                            </div>
                          )}

                          {/* subtotal do projeto */}
                          {p.nfs.length > 1 && (
                            <div className="flex items-center gap-4 mt-1.5 pl-6">
                              <span className="text-[10px] text-certifica-500">
                                Subtotal: <span className="font-mono" style={{ fontWeight: 600 }}>{currency(p.totalFaturado)}</span>
                              </span>
                              {p.totalPago > 0 && (
                                <span className="text-[10px]" style={{ color: "#10B981" }}>
                                  Pago: <span className="font-mono" style={{ fontWeight: 600 }}>{currency(p.totalPago)}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* totais gerais */}
            <div className="px-3 py-3 bg-certifica-50/60">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Total Contratado", value: currency(totais.contratado), color: "#0E2A47" },
                  { label: "Total Faturado", value: currency(totais.faturado), color: "#2B8EAD" },
                  { label: "Total Recebido", value: currency(totais.pago), color: "#10B981" },
                  { label: "Total Pendente", value: currency(totais.pendente), color: "#D97706" },
                  { label: "Total Vencido", value: currency(totais.vencido), color: "#EF4444" },
                ].map((t) => (
                  <div key={t.label} className="text-center">
                    <div className="text-[10px] text-certifica-500 uppercase tracking-[0.04em]">{t.label}</div>
                    <div className="text-[15px] font-mono" style={{ fontWeight: 700, color: t.color }}>{t.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DSCard>

      {/* Timeline dia-a-dia */}
      {dadosDiarios.length > 0 && (
        <DSCard
          header={
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-certifica-accent" strokeWidth={1.5} />
              <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>
                Dia a dia — {mesLabelLongo(mesSel)}
              </span>
              <span className="text-[11px] text-certifica-500 ml-2">
                {dadosDiarios.length} dia{dadosDiarios.length !== 1 ? "s" : ""} com movimentação
              </span>
            </div>
          }
        >
          <div className="divide-y divide-certifica-100">
            {dadosDiarios.map((dia) => (
              <div key={dia.dia} className="flex gap-3 py-2.5 px-1">
                {/* marcador do dia */}
                <div className="flex-shrink-0 w-[60px] text-right">
                  <div className="text-[12px] text-certifica-800 font-mono" style={{ fontWeight: 600 }}>{dia.diaLabel}</div>
                  <div className="text-[10px] font-mono text-certifica-accent" style={{ fontWeight: 600 }}>{currency(dia.total)}</div>
                </div>
                <div className="w-px bg-certifica-200 flex-shrink-0" />
                {/* NFs do dia */}
                <div className="flex-1 space-y-1">
                  {dia.nfs.map((nf) => {
                    const badge = statusBadge(isVencida(nf) ? "vencida" : nf.status);
                    return (
                      <div key={nf.id} className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-certifica-700" style={{ fontWeight: 500 }}>
                          NF {nf.numero_nf}
                        </span>
                        <span className="text-[11px] text-certifica-500">
                          {nf.cliente_nome || nf.descricao}
                        </span>
                        <span className="text-[11px] text-certifica-400">{nf.consultor}</span>
                        <span className="text-[12px] font-mono text-certifica-900 ml-auto" style={{ fontWeight: 600 }}>
                          {currency(nf.valor)}
                        </span>
                        <DSBadge variant={badge.variant}>{badge.label}</DSBadge>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </DSCard>
      )}
    </div>
  );
}
