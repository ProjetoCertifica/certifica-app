import React, { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { DSCard } from "../components/ds/DSCard";
import { DSBadge } from "../components/ds/DSBadge";
import {
  Briefcase,
  ClipboardCheck,
  GraduationCap,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Users,
} from "lucide-react";

/* ── Types ── */
interface ConsultorData {
  nome: string;
  projetos: { id: string; titulo: string; cliente: string; norma: string; status: string; inicio: string | null; previsao: string | null }[];
  auditorias: { id: string; codigo: string; cliente: string; norma: string; status: string; data_inicio: string | null }[];
  treinamentos: { id: string; titulo: string; status: string }[];
}

type CargaLevel = "leve" | "moderada" | "alta" | "critica";

function getCargaLevel(total: number): { level: CargaLevel; label: string; color: string; bgColor: string } {
  if (total <= 2) return { level: "leve", label: "Leve", color: "#10B981", bgColor: "#D1FAE5" };
  if (total <= 5) return { level: "moderada", label: "Moderada", color: "#F59E0B", bgColor: "#FEF3C7" };
  if (total <= 8) return { level: "alta", label: "Alta", color: "#F97316", bgColor: "#FFEDD5" };
  return { level: "critica", label: "Crítica", color: "#EF4444", bgColor: "#FEE2E2" };
}

function getAtrasosCount(projetos: ConsultorData["projetos"]): number {
  const now = new Date();
  return projetos.filter((p) => {
    if (!p.previsao || p.status === "concluido" || p.status === "cancelado") return false;
    return new Date(p.previsao) < now;
  }).length;
}

export default function ConsultoresPage() {
  const [consultores, setConsultores] = useState<ConsultorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsultor, setSelectedConsultor] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, auditRes, trainRes] = await Promise.allSettled([
        supabase.from("projetos").select("id, titulo, consultor, equipe, norma, status, inicio, previsao, clientes(nome_fantasia)").in("status", ["em-andamento", "proposta", "pausado"]),
        supabase.from("audits").select("id, codigo, auditor, norma, status, data_inicio, clientes(nome_fantasia)").in("status", ["planejada", "em-andamento"]),
        supabase.from("trainings").select("id, titulo, instrutor, status").in("status", ["agendado", "em-andamento"]),
      ]);

      const map = new Map<string, ConsultorData>();

      const getOrCreate = (nome: string): ConsultorData => {
        if (!map.has(nome)) map.set(nome, { nome, projetos: [], auditorias: [], treinamentos: [] });
        return map.get(nome)!;
      };

      if (projRes.status === "fulfilled" && projRes.value.data) {
        for (const p of projRes.value.data as any[]) {
          const c = getOrCreate(p.consultor);
          c.projetos.push({ id: p.id, titulo: p.titulo, cliente: p.clientes?.nome_fantasia ?? "—", norma: p.norma, status: p.status, inicio: p.inicio, previsao: p.previsao });
          if (Array.isArray(p.equipe)) {
            for (const member of p.equipe) {
              if (member && member !== p.consultor) {
                const m = getOrCreate(member);
                m.projetos.push({ id: p.id, titulo: p.titulo, cliente: p.clientes?.nome_fantasia ?? "—", norma: p.norma, status: p.status, inicio: p.inicio, previsao: p.previsao });
              }
            }
          }
        }
      }

      if (auditRes.status === "fulfilled" && auditRes.value.data) {
        for (const a of auditRes.value.data as any[]) {
          const c = getOrCreate(a.auditor);
          c.auditorias.push({ id: a.id, codigo: a.codigo, cliente: a.clientes?.nome_fantasia ?? "—", norma: a.norma, status: a.status, data_inicio: a.data_inicio });
        }
      }

      if (trainRes.status === "fulfilled" && trainRes.value.data) {
        for (const t of trainRes.value.data as any[]) {
          const c = getOrCreate(t.instrutor);
          c.treinamentos.push({ id: t.id, titulo: t.titulo, status: t.status });
        }
      }

      setConsultores(Array.from(map.values()).sort((a, b) => {
        const totalA = a.projetos.length + a.auditorias.length + a.treinamentos.length;
        const totalB = b.projetos.length + b.auditorias.length + b.treinamentos.length;
        return totalB - totalA;
      }));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const maxCarga = useMemo(() => {
    return Math.max(1, ...consultores.map((c) => c.projetos.length + c.auditorias.length + c.treinamentos.length));
  }, [consultores]);

  const selected = useMemo(() => {
    return consultores.find((c) => c.nome === selectedConsultor) ?? null;
  }, [consultores, selectedConsultor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-5 h-5 text-certifica-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4 certifica-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-certifica-900" style={{ letterSpacing: "-0.02em" }}>Painel de Consultores</h2>
          <p className="text-[12px] text-certifica-500 mt-0.5">{consultores.length} consultores · Visão de carga de trabalho</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="h-7 w-7 flex items-center justify-center rounded-[4px] border border-certifica-200 text-certifica-500/60 hover:text-certifica-700 hover:border-certifica-400 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
        </button>
      </div>

      {/* Heatmap Grid */}
      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Mapa de Ocupação</span>}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {consultores.map((c) => {
            const total = c.projetos.length + c.auditorias.length + c.treinamentos.length;
            const carga = getCargaLevel(total);
            const atrasos = getAtrasosCount(c.projetos);
            const isSelected = selectedConsultor === c.nome;
            const barWidth = Math.round((total / maxCarga) * 100);

            return (
              <button
                key={c.nome}
                onClick={() => setSelectedConsultor(isSelected ? null : c.nome)}
                className={`text-left p-3 rounded-[6px] border transition-all cursor-pointer ${
                  isSelected
                    ? "border-certifica-accent ring-1 ring-certifica-accent/20 bg-certifica-50"
                    : "border-certifica-200 hover:border-certifica-accent/40 bg-white"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: carga.color }}
                  >
                    {c.nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-certifica-dark font-medium truncate">{c.nome}</div>
                    <div className="text-[10px] text-certifica-500">{total} atividades</div>
                  </div>
                </div>

                {/* Carga bar */}
                <div className="h-[6px] bg-certifica-100 rounded-full overflow-hidden mb-1.5">
                  <div className="h-full rounded-full transition-all" style={{ width: `${barWidth}%`, backgroundColor: carga.color }} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[9px] px-1.5 py-px rounded-sm font-medium" style={{ color: carga.color, backgroundColor: carga.bgColor }}>
                    {carga.label}
                  </span>
                  {atrasos > 0 && (
                    <span className="text-[9px] text-nao-conformidade flex items-center gap-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" /> {atrasos} atraso{atrasos > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Mini breakdown */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] text-certifica-500 flex items-center gap-0.5">
                    <Briefcase className="w-2.5 h-2.5" /> {c.projetos.length}
                  </span>
                  <span className="text-[9px] text-certifica-500 flex items-center gap-0.5">
                    <ClipboardCheck className="w-2.5 h-2.5" /> {c.auditorias.length}
                  </span>
                  <span className="text-[9px] text-certifica-500 flex items-center gap-0.5">
                    <GraduationCap className="w-2.5 h-2.5" /> {c.treinamentos.length}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-certifica-200">
          {(["leve", "moderada", "alta", "critica"] as CargaLevel[]).map((level) => {
            const info = getCargaLevel(level === "leve" ? 1 : level === "moderada" ? 4 : level === "alta" ? 7 : 10);
            return (
              <div key={level} className="flex items-center gap-1.5">
                <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: info.color }} />
                <span className="text-[10px] text-certifica-500">{info.label} ({"≤"}{level === "leve" ? "2" : level === "moderada" ? "5" : level === "alta" ? "8" : "9+"})</span>
              </div>
            );
          })}
          <div className="flex items-center gap-1.5 ml-auto">
            <Briefcase className="w-3 h-3 text-certifica-400" />
            <span className="text-[10px] text-certifica-500">Projetos</span>
            <ClipboardCheck className="w-3 h-3 text-certifica-400 ml-2" />
            <span className="text-[10px] text-certifica-500">Auditorias</span>
            <GraduationCap className="w-3 h-3 text-certifica-400 ml-2" />
            <span className="text-[10px] text-certifica-500">Treinamentos</span>
          </div>
        </div>
      </DSCard>

      {/* Detail panel */}
      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Projetos */}
          <DSCard header={
            <div className="flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-certifica-accent" />
              <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Projetos ({selected.projetos.length})</span>
            </div>
          }>
            {selected.projetos.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-certifica-500">Nenhum projeto</div>
            ) : (
              <div className="space-y-0">
                {selected.projetos.map((p, idx) => {
                  const atrasado = p.previsao && new Date(p.previsao) < new Date() && p.status !== "concluido" && p.status !== "cancelado";
                  return (
                    <div key={`${p.id}-${idx}`} className={`py-2 ${idx > 0 ? "border-t border-certifica-200" : ""}`}>
                      <div className="text-[12px] text-certifica-dark font-medium">{p.titulo}</div>
                      <div className="text-[10px] text-certifica-500">{p.cliente} · {p.norma}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <DSBadge variant={p.status === "em-andamento" ? "oportunidade" : "outline"}>{p.status}</DSBadge>
                        {atrasado && <span className="text-[9px] text-nao-conformidade font-medium">ATRASADO</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DSCard>

          {/* Auditorias */}
          <DSCard header={
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Auditorias ({selected.auditorias.length})</span>
            </div>
          }>
            {selected.auditorias.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-certifica-500">Nenhuma auditoria</div>
            ) : (
              <div className="space-y-0">
                {selected.auditorias.map((a, idx) => (
                  <div key={a.id} className={`py-2 ${idx > 0 ? "border-t border-certifica-200" : ""}`}>
                    <div className="text-[12px] text-certifica-dark font-medium">{a.codigo}</div>
                    <div className="text-[10px] text-certifica-500">{a.cliente} · {a.norma}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <DSBadge variant="outline">{a.status}</DSBadge>
                      {a.data_inicio && <span className="text-[10px] text-certifica-500">{new Date(a.data_inicio).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DSCard>

          {/* Treinamentos */}
          <DSCard header={
            <div className="flex items-center gap-2">
              <GraduationCap className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Treinamentos ({selected.treinamentos.length})</span>
            </div>
          }>
            {selected.treinamentos.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-certifica-500">Nenhum treinamento</div>
            ) : (
              <div className="space-y-0">
                {selected.treinamentos.map((t, idx) => (
                  <div key={t.id} className={`py-2 ${idx > 0 ? "border-t border-certifica-200" : ""}`}>
                    <div className="text-[12px] text-certifica-dark font-medium">{t.titulo}</div>
                    <DSBadge variant="outline">{t.status}</DSBadge>
                  </div>
                ))}
              </div>
            )}
          </DSCard>
        </div>
      )}
    </div>
  );
}
