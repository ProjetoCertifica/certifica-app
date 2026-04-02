import React, { useState } from "react";
import { DSCard } from "../components/ds/DSCard";
import { DSButton } from "../components/ds/DSButton";
import { DSBadge } from "../components/ds/DSBadge";
import { DSTable } from "../components/ds/DSTable";
import { DSInput } from "../components/ds/DSInput";
import { DSSelect } from "../components/ds/DSSelect";
import { DSTextarea } from "../components/ds/DSTextarea";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  AlertCircle,
  Plus,
  X,
  RefreshCw,
  FileText,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useFinanceiro, type FaturamentoInsert } from "../lib/useFinanceiro";
import FechamentoTab from "../components/financeiro/FechamentoTab";
import { toast } from "sonner";

function currency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mesLabel(mes: string): string {
  const [y, m] = mes.split("-");
  const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${names[Number(m) - 1]}/${y.slice(2)}`;
}

type StatusVariant = "conformidade" | "nao-conformidade" | "observacao" | "oportunidade" | "outline";

function statusBadge(status: string): { label: string; variant: StatusVariant } {
  if (status === "paga") return { label: "Paga", variant: "conformidade" };
  if (status === "vencida") return { label: "Vencida", variant: "nao-conformidade" };
  if (status === "cancelada") return { label: "Cancelada", variant: "outline" };
  return { label: "Emitida", variant: "observacao" };
}

export default function FinanceiroPage() {
  const fin = useFinanceiro();
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<"visao" | "nfs" | "fechamento">("visao");

  // NF form
  const [form, setForm] = useState<FaturamentoInsert>({
    projeto_id: "",
    cliente_id: "",
    consultor: "",
    numero_nf: "",
    descricao: "",
    valor: 0,
    data_emissao: new Date().toISOString().split("T")[0],
    data_vencimento: "",
    mes_competencia: fin.mesAtual,
    tipo: "servico",
    observacoes: "",
  });

  const handleCreate = async () => {
    if (!form.numero_nf || !form.valor || !form.consultor) {
      toast.error("Preencha número da NF, valor e consultor.");
      return;
    }
    const payload = {
      ...form,
      projeto_id: form.projeto_id || null,
      cliente_id: form.cliente_id || null,
      data_vencimento: form.data_vencimento || null,
    };
    const ok = await fin.create(payload);
    if (ok) {
      toast.success("NF registrada!");
      setShowModal(false);
      setForm({ projeto_id: "", cliente_id: "", consultor: "", numero_nf: "", descricao: "", valor: 0, data_emissao: new Date().toISOString().split("T")[0], data_vencimento: "", mes_competencia: fin.mesAtual, tipo: "servico", observacoes: "" });
    } else {
      toast.error("Erro ao registrar NF.");
    }
  };

  const handleMarkPaid = async (id: string) => {
    const ok = await fin.update(id, { status: "paga", data_pagamento: new Date().toISOString().split("T")[0] } as any);
    if (ok) toast.success("NF marcada como paga!");
  };

  const consultores = [...new Set(fin.projetos.map((p) => p.consultor).filter(Boolean))].sort();
  const clientes = [...new Map(fin.projetos.map((p) => [p.cliente_id, p.cliente_nome])).entries()].filter(([id]) => id).sort((a, b) => a[1].localeCompare(b[1]));

  // Auto-fill when project is selected
  const handleProjectSelect = (projetoId: string) => {
    const p = fin.projetos.find((x) => x.id === projetoId);
    if (p) {
      setForm((f) => ({
        ...f,
        projeto_id: projetoId,
        cliente_id: p.cliente_id,
        consultor: p.consultor,
        descricao: `${p.codigo} — ${p.titulo}`,
      }));
    } else {
      setForm((f) => ({ ...f, projeto_id: projetoId }));
    }
  };

  if (fin.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-5 h-5 text-certifica-accent animate-spin" />
      </div>
    );
  }

  const chartData = fin.faturamentoMensal.map((m) => ({
    mes: mesLabel(m.mes),
    Faturado: m.faturado,
    Pago: m.pago,
  }));

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-certifica-900" style={{ letterSpacing: "-0.02em" }}>Financeiro</h2>
          <p className="text-[12px] text-certifica-500 mt-0.5">Faturamento, NFs e fechamento mensal</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fin.refetch}
            disabled={fin.loading}
            className="h-7 w-7 flex items-center justify-center rounded-[4px] border border-certifica-200 text-certifica-500/60 hover:text-certifica-700 hover:border-certifica-400 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fin.loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
          </button>
          <DSButton variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={() => setShowModal(true)}>
            Nova NF
          </DSButton>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-certifica-50 rounded-[4px] p-0.5 w-fit">
        {([["visao", "Visão Geral"], ["nfs", "Notas Fiscais"], ["fechamento", "Fechamento"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-[11px] rounded-[3px] transition-colors cursor-pointer ${
              tab === key ? "bg-white text-certifica-accent shadow-sm font-medium" : "text-certifica-500 hover:text-certifica-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {[
          { label: "Total Contratado", value: currency(fin.kpis.totalContratado), icon: DollarSign, color: "#0E2A47" },
          { label: "Faturado Mês", value: currency(fin.kpis.faturadoMes), icon: Receipt, color: "#2B8EAD" },
          { label: "Faturado Ano", value: currency(fin.kpis.faturadoAno), icon: TrendingUp, color: "#1F5E3B" },
          { label: "A Receber", value: currency(fin.kpis.aReceber), icon: FileText, color: "#D97706" },
          { label: "NFs Emitidas", value: String(fin.kpis.totalNFs), icon: Receipt, color: "#274C77" },
          { label: "NFs Pagas", value: String(fin.kpis.nfsPagas), icon: Receipt, color: "#10B981" },
          { label: "NFs Vencidas", value: String(fin.kpis.nfsVencidas), icon: AlertCircle, color: "#EF4444" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-certifica-200 rounded-[4px] px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <kpi.icon className="w-3 h-3" style={{ color: kpi.color }} strokeWidth={1.5} />
              <span className="text-[10px] text-certifica-500">{kpi.label}</span>
            </div>
            <div className="text-[16px] text-certifica-900" style={{ fontWeight: 600 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Tab content */}
      {tab === "visao" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
          {/* Chart */}
          <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Faturamento Mensal (12 meses)</span>}>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EB" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={{ stroke: "#E6E8EB" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0E2A47", border: "none", borderRadius: "4px", fontSize: "11px", color: "#E6E8EB", padding: "8px 12px" }}
                    formatter={(value: number) => currency(value)}
                  />
                  <Legend wrapperStyle={{ fontSize: "10px" }} />
                  <Bar dataKey="Faturado" fill="#2B8EAD" radius={[2, 2, 0, 0]} barSize={16} />
                  <Bar dataKey="Pago" fill="#10B981" radius={[2, 2, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DSCard>

          {/* Últimas NFs */}
          <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Últimas NFs</span>}>
            <div className="space-y-0">
              {fin.faturas.length === 0 ? (
                <div className="py-6 text-center text-[11px] text-certifica-500">Nenhuma NF registrada</div>
              ) : (
                fin.faturas.slice(0, 8).map((f, idx) => {
                  const badge = statusBadge(f.status);
                  return (
                    <div key={f.id} className={`flex items-center gap-3 py-2 ${idx > 0 ? "border-t border-certifica-200" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-certifica-dark font-medium truncate">NF {f.numero_nf}</div>
                        <div className="text-[10px] text-certifica-500 truncate">{f.cliente_nome || f.descricao}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[12px] text-certifica-900 font-mono" style={{ fontWeight: 600 }}>{currency(f.valor)}</div>
                        <DSBadge variant={badge.variant}>{badge.label}</DSBadge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DSCard>
        </div>
      )}

      {tab === "nfs" && (
        <DSCard header={
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Notas Fiscais ({fin.faturas.length})</span>
          </div>
        }>
          {fin.faturas.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-certifica-500">Nenhuma NF registrada. Clique em "Nova NF" para começar.</div>
          ) : (
            <DSTable
              columns={[
                { key: "nf", header: "NF", render: (row) => <span className="text-[12px] font-mono text-certifica-dark" style={{ fontWeight: 500 }}>NF {(row as any).numero_nf}</span> },
                { key: "cliente", header: "Cliente", render: (row) => <span className="text-[12px] text-certifica-500">{(row as any).cliente_nome || "—"}</span> },
                { key: "projeto", header: "Projeto", render: (row) => <span className="text-[12px] text-certifica-500">{(row as any).projeto_codigo || "—"}</span> },
                { key: "consultor", header: "Consultor", render: (row) => <span className="text-[12px] text-certifica-500">{(row as any).consultor}</span> },
                { key: "competencia", header: "Competência", render: (row) => <span className="text-[12px] font-mono text-certifica-500">{mesLabel((row as any).mes_competencia)}</span> },
                { key: "valor", header: "Valor", render: (row) => <span className="text-[12px] font-mono text-certifica-900" style={{ fontWeight: 600 }}>{currency((row as any).valor)}</span> },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => {
                    const b = statusBadge((row as any).status);
                    return <DSBadge variant={b.variant}>{b.label}</DSBadge>;
                  },
                },
                {
                  key: "acoes",
                  header: "",
                  width: "60px",
                  render: (row) => {
                    const f = row as any;
                    if (f.status === "emitida") {
                      return (
                        <button onClick={() => handleMarkPaid(f.id)} className="text-[10px] text-conformidade hover:underline cursor-pointer">
                          Pagar
                        </button>
                      );
                    }
                    return null;
                  },
                },
              ]}
              data={fin.faturas}
            />
          )}
        </DSCard>
      )}

      {tab === "fechamento" && (
        <FechamentoTab faturas={fin.faturas} projetos={fin.projetos} mesAtual={fin.mesAtual} />
      )}

      {/* New NF Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-certifica-dark/45" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-[560px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] max-h-[85vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-[15px] text-certifica-900" style={{ fontWeight: 600 }}>Registrar Nota Fiscal</h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <DSInput label="Número da NF *" value={form.numero_nf} onChange={(e) => setForm((f) => ({ ...f, numero_nf: e.target.value }))} placeholder="Ex: 001234" />
                <DSInput label="Valor (R$) *" type="number" value={String(form.valor)} onChange={(e) => setForm((f) => ({ ...f, valor: Number(e.target.value) || 0 }))} placeholder="0.00" />
              </div>

              <DSSelect
                label="Projeto (opcional)"
                value={form.projeto_id || ""}
                onChange={(e) => handleProjectSelect(e.target.value)}
                options={[{ value: "", label: "Selecione um projeto..." }, ...fin.projetos.map((p) => ({ value: p.id, label: `${p.codigo} — ${p.titulo} (${p.cliente_nome})` }))]}
              />

              <div className="grid grid-cols-2 gap-3">
                <DSSelect
                  label="Consultor *"
                  value={form.consultor}
                  onChange={(e) => setForm((f) => ({ ...f, consultor: e.target.value }))}
                  options={[{ value: "", label: "Selecione..." }, ...consultores.map((c) => ({ value: c, label: c }))]}
                />
                <DSSelect
                  label="Cliente"
                  value={form.cliente_id || ""}
                  onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))}
                  options={[{ value: "", label: "Selecione..." }, ...clientes.map(([id, nome]) => ({ value: id, label: nome }))]}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <DSInput label="Data Emissão" type="date" value={form.data_emissao} onChange={(e) => setForm((f) => ({ ...f, data_emissao: e.target.value }))} />
                <DSInput label="Vencimento" type="date" value={form.data_vencimento || ""} onChange={(e) => setForm((f) => ({ ...f, data_vencimento: e.target.value }))} />
                <DSInput label="Competência" value={form.mes_competencia} onChange={(e) => setForm((f) => ({ ...f, mes_competencia: e.target.value }))} placeholder="2026-03" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DSSelect
                  label="Tipo"
                  value={form.tipo || "servico"}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                  options={[
                    { value: "servico", label: "Serviço" },
                    { value: "consultoria", label: "Consultoria" },
                    { value: "auditoria", label: "Auditoria" },
                    { value: "treinamento", label: "Treinamento" },
                  ]}
                />
                <DSInput label="Descrição" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descrição da NF" />
              </div>

              <DSTextarea label="Observações" value={form.observacoes || ""} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} placeholder="Observações adicionais..." rows={2} />

              <div className="flex justify-end gap-2 pt-2 border-t border-certifica-200">
                <DSButton variant="ghost" size="sm" onClick={() => setShowModal(false)}>Cancelar</DSButton>
                <DSButton variant="primary" size="sm" onClick={handleCreate} disabled={fin.saving}>
                  {fin.saving ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                  {fin.saving ? "Salvando..." : "Registrar NF"}
                </DSButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
