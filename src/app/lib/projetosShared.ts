import type { ProjetoWithEntregaveis } from "./useProjetos";

/* ── UI Types ── */

export interface EntregavelUI {
  id: string;
  texto: string;
  url: string;
  concluido: boolean;
}

export interface ProjetoUI {
  id: string;
  codigo: string;
  titulo: string;
  clienteId: string;
  clienteNome: string;
  clienteCnpj: string;
  norma: string;
  fase: number;
  faseLabel: string;
  status: "proposta" | "em-andamento" | "concluido" | "pausado" | "cancelado";
  prioridade: "alta" | "media" | "baixa";
  consultor: string;
  equipe: string[];
  inicio: string;
  previsao: string;
  escopo: string;
  valor: string;
  condicoesPagamento: string;
  entregaveis: EntregavelUI[];
  totalDocumentos: number;
  totalAuditorias: number;
  observacoes: string;
}

export interface ClienteRef {
  id: string;
  cnpj: string;
  nomeFantasia: string;
  razaoSocial: string;
}

export const consultores = ["Carlos Silva", "Ana Costa", "Pedro Souza", "Maria Santos", "Roberto Lima"];

/* ── Constants ── */

export const faseColors: Record<number, string> = {
  0: "#6B7280",
  1: "#274C77",
  2: "#2F5E8E",
  3: "#1F5E3B",
  4: "#0E2A47",
};

export const faseLabels: Record<number, string> = {
  0: "Proposta",
  1: "Planejamento",
  2: "Solucao",
  3: "Verificacao",
  4: "Acompanhamento",
};

export type StatusVariant = "conformidade" | "nao-conformidade" | "observacao" | "oportunidade" | "outline";

export const statusConfig: Record<string, { label: string; variant: StatusVariant }> = {
  proposta: { label: "Proposta", variant: "oportunidade" },
  "em-andamento": { label: "Em andamento", variant: "observacao" },
  concluido: { label: "Concluido", variant: "conformidade" },
  pausado: { label: "Pausado", variant: "outline" },
  cancelado: { label: "Cancelado", variant: "nao-conformidade" },
};

export const prioridadeConfig: Record<string, { label: string; color: string }> = {
  alta: { label: "Alta", color: "#7A1E1E" },
  media: { label: "Media", color: "#8C6A1F" },
  baixa: { label: "Baixa", color: "#6B7280" },
};

/* ── Helpers ── */

export function mapProjetoToUI(p: ProjetoWithEntregaveis): ProjetoUI {
  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
  };
  return {
    id: p.id,
    codigo: p.codigo,
    titulo: p.titulo,
    clienteId: p.cliente_id,
    clienteNome: p.cliente_nome ?? "",
    clienteCnpj: p.cliente_cnpj ?? "",
    norma: p.norma,
    fase: p.fase,
    faseLabel: p.fase_label,
    status: p.status,
    prioridade: p.prioridade,
    consultor: p.consultor,
    equipe: p.equipe ?? [],
    inicio: formatDate(p.inicio),
    previsao: formatDate(p.previsao),
    escopo: p.escopo,
    valor: p.valor,
    condicoesPagamento: p.condicoes_pagamento,
    entregaveis: p.entregaveis.map((e) => {
      const [texto, url = ""] = e.texto.split("|||");
      return { id: e.id, texto, url, concluido: e.concluido };
    }),
    totalDocumentos: p.total_documentos,
    totalAuditorias: p.total_auditorias,
    observacoes: p.observacoes,
  };
}

export function parseBrDate(date: string): Date | null {
  if (!date || date === "—") return null;
  const parts = date.split("/");
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getRiskPrazo(p: ProjetoUI): number {
  const end = parseBrDate(p.previsao);
  if (!end) return 0;
  const now = new Date();
  const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 95;
  if (days <= 7) return 85;
  if (days <= 15) return 70;
  if (days <= 30) return 55;
  return 25;
}

export function getRiskEscopo(p: ProjetoUI): number {
  const total = p.entregaveis.length;
  const done = p.entregaveis.filter((e) => e.concluido).length;
  if (total === 0) return 65;
  const pendingRatio = (total - done) / total;
  const docsPenalty = p.totalDocumentos < 5 ? 15 : 0;
  return Math.max(10, Math.min(95, Math.round(pendingRatio * 80 + docsPenalty)));
}

export function getDaysRemaining(p: ProjetoUI): number {
  const end = parseBrDate(p.previsao);
  if (!end) return 999;
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function getProgressPercent(p: ProjetoUI): number {
  const total = p.entregaveis.length;
  if (total === 0) return 0;
  return Math.round((p.entregaveis.filter((e) => e.concluido).length / total) * 100);
}
