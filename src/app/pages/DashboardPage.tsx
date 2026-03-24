import React from "react";
import { useNavigate } from "react-router";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { DSCard } from "../components/ds/DSCard";
import { DSBadge } from "../components/ds/DSBadge";
import { DSButton } from "../components/ds/DSButton";
import { DSTable } from "../components/ds/DSTable";
import { XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import {
  Eye,
  ChevronRight,
  Plus,
  Clock,
  AlertCircle,
  ArrowUpRight,
  Filter,
  Brain,
  X,
  RefreshCw,
  ExternalLink,
  Bell,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboard, type DashboardFilters, type DashboardProject } from "../lib/useDashboard";
import { useProjetos } from "../lib/useProjetos";
import { useClientes } from "../lib/useClientes";
import { APIFallback } from "../components/ErrorBoundary";

type StatusVariant = "conformidade" | "nao-conformidade" | "observacao" | "oportunidade" | "outline";
type LayerMode = "operacional" | "executiva";
type KpiKey = "ativos" | "atrasos" | "auditorias" | "consultorias" | "treinamentos" | "risco";

const faseColors: Record<number, string> = { 1: "#274C77", 2: "#2F5E8E", 3: "#1F5E3B", 4: "#0E2A47" };

function useContainerReady(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

function riskScore(p: DashboardProject): number {
  if (!p.previsao) return 10;
  const daysLeft = (new Date(p.previsao).getTime() - Date.now()) / 86400_000;
  if (daysLeft < 0) return 100;
  if (daysLeft < 15) return 70;
  if (daysLeft < 30) return 40;
  return 10;
}

function riskSemaphore(score: number): { label: string; className: string } {
  if (score >= 70) return { label: "Vermelho", className: "bg-nao-conformidade" };
  if (score >= 40) return { label: "Amarelo", className: "bg-observacao" };
  return { label: "Verde", className: "bg-conformidade" };
}

function statusVariant(status: string): StatusVariant {
  if (status === "concluido") return "conformidade";
  if (status === "pausado" || status === "cancelado") return "nao-conformidade";
  if (status === "proposta") return "observacao";
  return "oportunidade";
}

/* ── Skeleton Components ── */
function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`bg-certifica-200/60 rounded animate-pulse ${className}`} />;
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-6 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white border border-certifica-200 rounded-[4px] px-3 py-2 space-y-2">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-6 w-12" />
          <SkeletonBlock className="h-2.5 w-20" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-4 w-20" />
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const chartRef = React.useRef<HTMLDivElement>(null);
  const chartSize = useContainerReady(chartRef);
  const [layerMode, setLayerMode] = React.useState<LayerMode>("operacional");
  const [selectedKpi, setSelectedKpi] = React.useState<KpiKey | null>(null);
  const [detailProject, setDetailProject] = React.useState<DashboardProject | null>(null);
  const [showNewProject, setShowNewProject] = React.useState(false);
  useBodyScrollLock(!!selectedKpi || !!detailProject || showNewProject);
  const [saving, setSaving] = React.useState(false);
  const [sendingAlerts, setSendingAlerts] = React.useState(false);

  const handleSendAlerts = async () => {
    setSendingAlerts(true);
    try {
      const res = await fetch("/api/notifications/check-alerts", { method: "POST" });
      const data = await res.json();
      if (data.sent) {
        toast.success(`Alertas enviados via WhatsApp!`, { description: `${data.details?.atrasados ?? 0} atrasos, ${data.details?.auditorias_proximas ?? 0} auditorias próximas, ${data.details?.prazo_proximo ?? 0} prazos críticos` });
      } else if (data.alerts === 0) {
        toast.info("Nenhum alerta para enviar. Tudo em dia!");
      } else {
        toast.error(data.error || data.message || "Erro ao enviar alertas");
      }
    } catch {
      toast.error("Erro de conexão ao enviar alertas");
    } finally {
      setSendingAlerts(false);
    }
  };
  const [lastUpdated, setLastUpdated] = React.useState<Date>(() => new Date());
  const [nextRefreshSecs, setNextRefreshSecs] = React.useState(300);

  /* ── Filters ── */
  const [filters, setFilters] = React.useState<DashboardFilters>({
    periodo: "30d",
    consultor: "todos",
    cliente: "todos",
    norma: "todas",
  });

  // Hooks that depend on filters must be declared BEFORE any useEffect that references them
  const dashboard = useDashboard(filters);
  const projetosHook = useProjetos();
  const clientesHook = useClientes();

  /* ── Auto-refresh every 5 minutes ── */
  React.useEffect(() => {
    const INTERVAL_MS = 5 * 60 * 1000; // 5 min
    const refreshTimer = setInterval(() => {
      dashboard.refetch();
      setLastUpdated(new Date());
      setNextRefreshSecs(300);
    }, INTERVAL_MS);

    // Countdown tick every second
    const countdownTimer = setInterval(() => {
      setNextRefreshSecs((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(refreshTimer);
      clearInterval(countdownTimer);
    };
  }, [dashboard.refetch]);

  // Reset countdown when data changes (manual refetch)
  React.useEffect(() => {
    if (!dashboard.loading) {
      setLastUpdated(new Date());
      setNextRefreshSecs(300);
    }
  }, [dashboard.loading]);

  /* ── New Project form ── */
  const [newProj, setNewProj] = React.useState({
    titulo: "",
    cliente_id: "",
    norma: "",
    consultor: "",
    escopo: "",
  });

  const handleCreateProject = async () => {
    if (!newProj.titulo || !newProj.cliente_id) return;
    setSaving(true);
    const code = `PRJ-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const result = await projetosHook.create(
      {
        codigo: code,
        titulo: newProj.titulo,
        cliente_id: newProj.cliente_id,
        norma: newProj.norma,
        fase: 1,
        fase_label: "Planejamento",
        status: "proposta",
        prioridade: "media",
        consultor: newProj.consultor || "A definir",
        equipe: [],
        inicio: null,
        previsao: null,
        escopo: newProj.escopo || "",
        valor: "0",
        condicoes_pagamento: "",
        total_documentos: 0,
        total_auditorias: 0,
        observacoes: "",
      },
      []
    );
    setSaving(false);
    if (result) {
      setShowNewProject(false);
      setNewProj({ titulo: "", cliente_id: "", norma: "", consultor: "", escopo: "" });
      dashboard.refetch();
    }
  };

  /* ── KPI config ── */
  const kpiList: { key: KpiKey; label: string }[] = [
    { key: "ativos", label: "Projetos ativos" },
    { key: "atrasos", label: "Atrasos" },
    { key: "auditorias", label: "Auditorias" },
    { key: "consultorias", label: "Consultorias" },
    { key: "treinamentos", label: "Treinamentos" },
    { key: "risco", label: "Risco de prazo" },
  ];

  /* ── Drill-down data ── */
  const drillData = React.useMemo(() => {
    if (!selectedKpi) return [];
    const now = new Date();
    switch (selectedKpi) {
      case "atrasos":
        return dashboard.projects.filter((p) => p.previsao && new Date(p.previsao) < now && p.status !== "concluido" && p.status !== "cancelado");
      case "risco":
        return dashboard.projects.filter((p) => riskScore(p) >= 40);
      case "auditorias": {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return dashboard.audits.filter((a) => {
          const d = a.data_inicio ? new Date(a.data_inicio) : null;
          return !d || d >= today;
        });
      }
      case "consultorias":
        return dashboard.projects.filter((p) => p.status === "em-andamento");
      case "treinamentos":
        return dashboard.trainings.filter((t) => t.status !== "cancelado");
      default:
        return dashboard.projects;
    }
  }, [selectedKpi, dashboard.projects, dashboard.audits, dashboard.trainings]);

  const drillTitle = kpiList.find((k) => k.key === selectedKpi)?.label ?? "";

  /* ── Recomendações do dia (lógica condicional) ── */
  const aiRecommendations = React.useMemo(() => {
    const recs: string[] = [];
    const p = dashboard.projects;
    const k = dashboard.kpis;

    // 1. Projetos com prazo vencido
    const vencidos = p.filter((proj) => riskScore(proj) >= 100);
    if (vencidos.length > 0) {
      recs.push(`${vencidos.length} projeto${vencidos.length > 1 ? "s" : ""} com prazo vencido — iniciar tratativa urgente com ${vencidos[0].cliente_nome}.`);
    }

    // 2. Projetos em zona de risco (prazo < 15 dias)
    const highRisk = p.filter((proj) => riskScore(proj) === 70);
    if (highRisk.length > 0 && recs.length < 3) {
      const dias = Math.ceil((new Date(highRisk[0].previsao!).getTime() - Date.now()) / 86400_000);
      recs.push(`${highRisk[0].cliente_nome} com entrega em ${dias} dia${dias !== 1 ? "s" : ""} — revisar cronograma e pendências.`);
    }

    // 3. Atrasos detectados
    if (k.atrasos > 0 && recs.length < 3) {
      recs.push(`${k.atrasos} projeto${k.atrasos > 1 ? "s" : ""} em atraso detectado${k.atrasos > 1 ? "s" : ""} — renegociar prazo ou realocar consultores.`);
    }

    // 4. Muitas propostas sem conversão
    const propostas = p.filter((proj) => proj.status === "proposta");
    if (propostas.length >= 3 && recs.length < 3) {
      recs.push(`${propostas.length} propostas abertas sem conversão — fazer follow-up com os clientes.`);
    }

    // 5. Treinamentos pendentes
    if (k.treinamentos > 0 && recs.length < 3) {
      recs.push(`${k.treinamentos} treinamento${k.treinamentos > 1 ? "s" : ""} registrado${k.treinamentos > 1 ? "s" : ""} — verificar cronograma e inscrições.`);
    }

    // 6. Parabéns se tudo bem
    if (recs.length === 0) {
      recs.push("Nenhuma ação crítica identificada. Bom momento para antecipar auditorias do próximo ciclo.");
    }

    // Completar até 3 com contexto geral
    if (recs.length < 3 && k.auditorias < p.filter((proj) => proj.status === "em-andamento").length) {
      recs.push("Projetos ativos sem auditoria registrada — agendar rodada de verificação interna.");
    }
    if (recs.length < 3) {
      recs.push(`Carteira com ${k.ativos} projeto${k.ativos !== 1 ? "s" : ""} ativo${k.ativos !== 1 ? "s" : ""} — revisar cronogramas para as próximas 4 semanas.`);
    }

    return recs.slice(0, 3);
  }, [dashboard.projects, dashboard.kpis]);

  /* ── Alerts ── */
  const alerts = React.useMemo(() => {
    const items: { id: string; priority: number; text: string }[] = [];
    dashboard.projects.forEach((p) => {
      const risk = riskScore(p);
      if (risk >= 40) {
        items.push({ id: p.id, priority: risk, text: `${p.cliente_nome}: risco ${risk} · ${p.norma}` });
      }
    });
    dashboard.audits.forEach((a) => {
      if (a.ncs_count > 0) {
        items.push({ id: a.id, priority: 70 + a.ncs_count * 5, text: `${a.cliente_nome}: ${a.ncs_count} NCs — ${a.norma}` });
      }
    });
    return items.sort((a, b) => b.priority - a.priority).slice(0, 6);
  }, [dashboard.projects, dashboard.audits]);

  /* ── Loading / Error states ── */
  if (dashboard.loading) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-certifica-900">Dashboard</h2>
            <SkeletonBlock className="h-3 w-48 mt-2" />
          </div>
          <SkeletonBlock className="h-8 w-28" />
        </div>
        <div className="bg-white border border-certifica-200 rounded-[4px] p-4">
          <div className="flex gap-2">
            <SkeletonBlock className="h-8 w-24" />
            <SkeletonBlock className="h-8 w-24" />
            <div className="flex-1" />
            <SkeletonBlock className="h-8 w-32" />
            <SkeletonBlock className="h-8 w-32" />
            <SkeletonBlock className="h-8 w-32" />
            <SkeletonBlock className="h-8 w-32" />
          </div>
        </div>
        <KpiSkeleton />
        <div className="grid grid-cols-[1fr_300px] gap-4">
          <DSCard><TableSkeleton /></DSCard>
          <div className="space-y-4">
            <DSCard><TableSkeleton rows={4} /></DSCard>
            <DSCard><TableSkeleton rows={3} /></DSCard>
          </div>
        </div>
      </div>
    );
  }

  if (dashboard.error) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-certifica-900">Dashboard</h2>
            <p className="text-[12px] text-certifica-500 mt-0.5">Visão operacional e executiva com priorização inteligente</p>
          </div>
        </div>
        <APIFallback error={dashboard.error} onRetry={dashboard.refetch} message="Falha ao carregar dados do dashboard" />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-certifica-900" style={{ letterSpacing: "-0.02em" }}>Dashboard</h2>
          <p className="text-[12px] text-certifica-500 mt-1 flex items-center gap-2 flex-wrap">
            <span className="capitalize">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>
            <span className="text-certifica-200">|</span>
            <span>{dashboard.projects.length} projetos · camada {layerMode}</span>
            <span className="inline-flex items-center gap-1 text-[10.5px] text-certifica-500/40">
              <RefreshCw className="w-2.5 h-2.5" strokeWidth={1.5} />
              {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              {" · "}
              {nextRefreshSecs >= 60 ? `${Math.ceil(nextRefreshSecs / 60)}min` : `${nextRefreshSecs}s`}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSendAlerts}
            disabled={sendingAlerts}
            className="h-7 px-2 flex items-center gap-1 rounded-[4px] border border-certifica-200 text-certifica-500/60 hover:text-green-700 hover:border-green-400 transition-colors cursor-pointer disabled:opacity-40"
            title="Enviar alertas via WhatsApp"
          >
            <Bell className={`w-3.5 h-3.5 ${sendingAlerts ? "animate-pulse" : ""}`} strokeWidth={1.5} />
            <span className="text-[10px]">Alertas WhatsApp</span>
          </button>
          <button
            onClick={() => { dashboard.refetch(); setLastUpdated(new Date()); setNextRefreshSecs(300); }}
            disabled={dashboard.loading}
            className="h-7 w-7 flex items-center justify-center rounded-[4px] border border-certifica-200 text-certifica-500/60 hover:text-certifica-700 hover:border-certifica-400 transition-colors cursor-pointer disabled:opacity-40"
            title="Atualizar agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${dashboard.loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
          </button>
          <DSButton variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={() => setShowNewProject(true)}>
            Novo Projeto
          </DSButton>
        </div>
      </div>

      {/* Filters bar */}
      <DSCard>
        <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setLayerMode("operacional")}
              className={`h-8 px-3 rounded-[4px] text-[11px] border cursor-pointer transition-colors ${layerMode === "operacional" ? "bg-certifica-accent text-white border-certifica-accent" : "border-certifica-200 text-certifica-500 hover:border-certifica-400"}`}
            >
              Operacional
            </button>
            <button
              onClick={() => setLayerMode("executiva")}
              className={`h-8 px-3 rounded-[4px] text-[11px] border cursor-pointer transition-colors ${layerMode === "executiva" ? "bg-certifica-dark text-white border-certifica-dark" : "border-certifica-200 text-certifica-500 hover:border-certifica-400"}`}
            >
              Executiva
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <select
              value={filters.periodo}
              onChange={(e) => setFilters((f) => ({ ...f, periodo: e.target.value as DashboardFilters["periodo"] }))}
              className="h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] cursor-pointer"
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="all">Todos</option>
            </select>
            <select
              value={filters.consultor}
              onChange={(e) => setFilters((f) => ({ ...f, consultor: e.target.value }))}
              className="h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] cursor-pointer"
            >
              {dashboard.consultores.map((c) => (
                <option key={c} value={c}>{c === "todos" ? "Todos consultores" : c}</option>
              ))}
            </select>
            <select
              value={filters.cliente}
              onChange={(e) => setFilters((f) => ({ ...f, cliente: e.target.value }))}
              className="h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] cursor-pointer"
            >
              {dashboard.clienteOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            <select
              value={filters.norma}
              onChange={(e) => setFilters((f) => ({ ...f, norma: e.target.value }))}
              className="h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] cursor-pointer"
            >
              {dashboard.normas.map((n) => (
                <option key={n} value={n}>{n === "todas" ? "Todas normas" : n}</option>
              ))}
            </select>
          </div>
        </div>
      </DSCard>

      {/* AI Recommendations */}
      <div className="bg-gradient-to-r from-certifica-900 to-certifica-800 rounded-[4px] p-4 overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #2B8EAD 0%, transparent 50%), radial-gradient(circle at 80% 80%, #2B8EAD 0%, transparent 50%)" }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-md bg-certifica-accent/20 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-certifica-accent" strokeWidth={1.5} />
            </div>
            <span className="text-[12px] text-white/90" style={{ fontWeight: 600 }}>Recomendações do dia</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {aiRecommendations.map((rec, i) => (
              <div key={i} className="text-[11px] text-white/80 bg-white/[0.06] border border-white/[0.08] rounded-[4px] px-3 py-2.5" style={{ lineHeight: "1.5" }}>
                {rec}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {kpiList.map((kpi) => {
          const value = dashboard.kpis[kpi.key];
          const compare = dashboard.monthCompare[kpi.key];
          const delta = compare.current - compare.previous;
          const positive = delta >= 0;
          const suffix = compare.suffix ?? "";
          return (
            <button
              key={kpi.key}
              onClick={() => setSelectedKpi(kpi.key)}
              className={`text-left bg-white border rounded-[4px] px-3 py-2 transition-colors cursor-pointer ${
                selectedKpi === kpi.key ? "border-certifica-accent ring-1 ring-certifica-accent/20" : "border-certifica-200 hover:border-certifica-accent/40"
              }`}
            >
              <div className="text-[10px] text-certifica-500">{kpi.label}</div>
              <div className="text-[18px] text-certifica-900" style={{ fontWeight: 600 }}>
                {value}
              </div>
              <div className={`text-[10px] ${positive ? "text-conformidade" : "text-nao-conformidade"}`}>
                {positive ? "+" : ""}{delta}{suffix} vs período anterior
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <div key={`left-${layerMode}`} className="space-y-4 min-w-0 certifica-fade-in">
          {layerMode === "operacional" ? (
            <>
              {/* Projects Table */}
              <DSCard
                header={
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Projetos com semáforo de risco</span>
                    <div className="flex items-center gap-2">
                      <DSButton variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-certifica-500 border-0">
                        <Filter className="w-3 h-3 mr-1" strokeWidth={1.5} />
                        Filtrar
                      </DSButton>
                      <DSButton
                        variant="ghost"
                        size="sm"
                        className="h-6 px-0 text-[11px] text-certifica-500 border-0 hover:bg-transparent hover:text-certifica-900"
                        onClick={() => navigate("/projetos")}
                      >
                        Ver todos <ChevronRight className="w-3 h-3 ml-0.5" strokeWidth={1.5} />
                      </DSButton>
                    </div>
                  </div>
                }
              >
                {dashboard.projects.length === 0 ? (
                  <div className="py-8 text-center text-[12px] text-certifica-500">Nenhum projeto encontrado para os filtros atuais.</div>
                ) : (
                  <DSTable
                    columns={[
                      {
                        key: "cliente",
                        header: "Cliente",
                        render: (row) => <span className="text-[12.5px] text-certifica-dark" style={{ fontWeight: 500 }}>{(row as any).cliente_nome}</span>,
                      },
                      {
                        key: "norma",
                        header: "Norma",
                        render: (row) => <span className="text-[12px] text-certifica-500 font-mono">{(row as any).norma}</span>,
                      },
                      {
                        key: "consultor",
                        header: "Consultor",
                        render: (row) => <span className="text-[12px] text-certifica-500">{(row as any).consultor}</span>,
                      },
                      {
                        key: "risco",
                        header: "Semáforo",
                        render: (row) => {
                          const score = riskScore(row as DashboardProject);
                          const sem = riskSemaphore(score);
                          return (
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${sem.className}`} />
                              <span className="text-[11px] text-certifica-700">{sem.label}</span>
                            </div>
                          );
                        },
                      },
                      {
                        key: "status",
                        header: "Status",
                        render: (row) => {
                          const p = row as DashboardProject;
                          return <DSBadge variant={statusVariant(p.status)}>{p.status}</DSBadge>;
                        },
                      },
                      {
                        key: "acoes",
                        header: "",
                        width: "36px",
                        render: (row) => (
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailProject(row as DashboardProject); }}
                            className="p-1 text-certifica-500/40 hover:text-certifica-700 transition-colors cursor-pointer"
                          >
                            <Eye className="w-[13px] h-[13px]" strokeWidth={1.5} />
                          </button>
                        ),
                      },
                    ]}
                    data={dashboard.projects.slice(0, 10)}
                  />
                )}
              </DSCard>

              {/* Charts */}
              <div className="grid grid-cols-[1fr_1fr] gap-4 min-w-0">
                <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Pipeline por fase</span>}>
                  <div className="space-y-2">
                    {dashboard.byPhase.length === 0 ? (
                      <div className="py-4 text-center text-[11px] text-certifica-500">Sem dados</div>
                    ) : (
                      dashboard.byPhase.map((item) => {
                        const total = dashboard.projects.length || 1;
                        return (
                          <div key={item.fase} className="flex items-center gap-3">
                            <div className="w-5 h-5 rounded-[2px] flex items-center justify-center text-white text-[9px]" style={{ backgroundColor: faseColors[item.fase] || "#274C77", fontWeight: 700 }}>
                              {item.fase}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[12px] text-certifica-dark">{item.label}</span>
                                <span className="text-[12px] text-certifica-900 font-mono" style={{ fontWeight: 600 }}>{item.count}</span>
                              </div>
                              <div className="h-[3px] bg-certifica-200 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${(item.count / total) * 100}%`, backgroundColor: faseColors[item.fase] || "#274C77" }} />
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </DSCard>

                <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Projetos por norma</span>}>
                  <div className="h-[160px] -mx-2 min-w-0" ref={chartRef}>
                    {dashboard.byNorma.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-[11px] text-certifica-500">Nenhum projeto com norma definida</div>
                    ) : chartSize.w > 0 && chartSize.h > 0 ? (
                      <BarChart width={chartSize.w} height={chartSize.h} data={dashboard.byNorma} margin={{ top: 4, right: 8, left: -28, bottom: 0 }} barSize={18}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E6E8EB" vertical={false} />
                        <XAxis dataKey="norma" tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={{ stroke: "#E6E8EB" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#6B7280" }} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: "#0E2A47", border: "none", borderRadius: "4px", fontSize: "11px", color: "#E6E8EB", padding: "6px 10px" }} />
                        <Bar dataKey="projetos" fill="#2B8EAD" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    ) : null}
                  </div>
                </DSCard>
              </div>
            </>
          ) : (
            <>
              {/* Executive by Consultant */}
              <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Carteira por consultor (executivo)</span>}>
                {dashboard.executiveByConsultor.length === 0 ? (
                  <div className="py-4 text-center text-[11px] text-certifica-500">Sem dados</div>
                ) : (
                  <DSTable
                    columns={[
                      { key: "consultor", header: "Consultor", render: (row) => <span className="text-[12.5px] text-certifica-dark" style={{ fontWeight: 500 }}>{(row as any).consultor}</span> },
                      { key: "projetos", header: "Projetos", render: (row) => <span className="text-[12px] font-mono">{(row as any).projetos}</span> },
                      {
                        key: "risco",
                        header: "Risco médio",
                        render: (row) => {
                          const sem = riskSemaphore((row as any).risco);
                          return (
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full ${sem.className}`} />
                              <span className="text-[11px] text-certifica-700">{(row as any).risco}</span>
                            </div>
                          );
                        },
                      },
                      { key: "auditorias", header: "Auditorias", render: (row) => <span className="text-[12px] font-mono">{(row as any).auditorias}</span> },
                    ]}
                    data={dashboard.executiveByConsultor}
                  />
                )}
              </DSCard>

              <div className="grid grid-cols-[1fr_1fr] gap-4 min-w-0">
                {/* Distribuição por Norma */}
                <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Distribuição por norma</span>}>
                  <div className="space-y-2">
                    {dashboard.executiveByNorma.map((item) => (
                      <div key={item.norma} className="flex items-center gap-3">
                        <span className="text-[11px] text-certifica-700 w-[54px] flex-shrink-0">{item.norma}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-certifica-500">{item.projetos} projetos · {item.auditorias} auditorias</span>
                          </div>
                          <div className="h-[4px] bg-certifica-200 rounded-full overflow-hidden">
                            <div className="h-full bg-certifica-accent rounded-full transition-all" style={{ width: `${Math.min(100, (item.projetos / Math.max(1, ...dashboard.executiveByNorma.map(n => n.projetos))) * 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </DSCard>

                {/* Revenue at Risk */}
                <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Receita em risco (estimada)</span>}>
                  <div className="space-y-2">
                    {dashboard.executiveByConsultor.map((row) => {
                      const valor = row.projetos * 45000 * (row.risco / 100);
                      return (
                        <div key={row.consultor} className="flex items-center justify-between border-b border-certifica-200/60 pb-1.5">
                          <span className="text-[11px] text-certifica-500">{row.consultor}</span>
                          <span className="text-[11px] text-certifica-dark font-mono" style={{ fontWeight: 600 }}>
                            {valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </DSCard>
              </div>
            </>
          )}
        </div>

        {/* Right Column */}
        <div key={layerMode} className="space-y-4 certifica-fade-in">
          {layerMode === "operacional" ? (
            <>
              {/* Critical Alerts */}
              <DSCard
                header={
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Pendências críticas</span>
                    <span className="text-[10px] bg-certifica-200 text-certifica-dark rounded-[2px] px-1.5 py-px">{alerts.length}</span>
                  </div>
                }
              >
                <div className="space-y-0">
                  {alerts.length === 0 ? (
                    <div className="py-4 text-center text-[11px] text-certifica-500">Nenhuma pendência crítica</div>
                  ) : (
                    alerts.map((item, idx) => (
                      <div key={item.id} className={`flex gap-2.5 py-2.5 ${idx > 0 ? "border-t border-certifica-200" : ""}`}>
                        <div className="flex-shrink-0 mt-0.5">
                          {item.priority >= 85 ? (
                            <AlertCircle className="w-[13px] h-[13px] text-nao-conformidade" strokeWidth={1.5} />
                          ) : item.priority >= 65 ? (
                            <Clock className="w-[13px] h-[13px] text-observacao" strokeWidth={1.5} />
                          ) : (
                            <ArrowUpRight className="w-[13px] h-[13px] text-certifica-500/50" strokeWidth={1.5} />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] text-certifica-dark" style={{ lineHeight: "1.5" }}>{item.text}</p>
                          <span className="text-[10px] text-certifica-500">Prioridade {item.priority}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </DSCard>

              {/* Agenda */}
              <DSCard
                header={
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Agenda</span>
                    <button
                      onClick={() => navigate("/reunioes")}
                      className="text-[11px] text-certifica-500 hover:text-certifica-900 transition-colors flex items-center gap-0.5 cursor-pointer"
                    >
                      Ver todas <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </div>
                }
              >
                <div className="space-y-0">
                  {dashboard.agenda.length === 0 ? (
                    <div className="py-4 text-center text-[11px] text-certifica-500">Nenhuma reunião agendada</div>
                  ) : (
                    dashboard.agenda.map((item, idx) => (
                      <div key={item.id} className={`flex gap-3 py-2.5 ${idx > 0 ? "border-t border-certifica-200" : ""}`}>
                        <div className="w-[44px] flex-shrink-0">
                          <div className="text-[11px] text-certifica-700 font-mono">{item.date}</div>
                          <div className="text-[10px] text-certifica-500/60">{item.time}</div>
                        </div>
                        <div className="text-[12px] text-certifica-dark">{item.event}</div>
                      </div>
                    ))
                  )}
                </div>
              </DSCard>
            </>
          ) : (
            <>
              {/* Executive Summary */}
              <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Resumo executivo</span>}>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Consultorias ativas", value: `${dashboard.kpis.consultorias}` },
                    { label: "Risco médio de prazo", value: `${dashboard.kpis.risco}` },
                    { label: "Auditorias", value: `${dashboard.kpis.auditorias}` },
                    { label: "Treinamentos", value: `${dashboard.kpis.treinamentos}` },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="text-[16px] text-certifica-900" style={{ fontWeight: 600 }}>{s.value}</div>
                      <div className="text-[10px] text-certifica-500">{s.label}</div>
                    </div>
                  ))}
                </div>
              </DSCard>

              {/* Trainings overview */}
              <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Treinamentos</span>}>
                <div className="space-y-0">
                  {dashboard.trainings.length === 0 ? (
                    <div className="py-4 text-center text-[11px] text-certifica-500">Nenhum treinamento agendado</div>
                  ) : (
                    dashboard.trainings.slice(0, 4).map((t, idx) => (
                      <div key={t.id} className={`flex items-center justify-between py-2 ${idx > 0 ? "border-t border-certifica-200" : ""}`}>
                        <div>
                          <div className="text-[12px] text-certifica-dark" style={{ fontWeight: 500 }}>{t.titulo}</div>
                          <div className="text-[10px] text-certifica-500">{t.norma} · {t.instrutor}</div>
                        </div>
                        <div className="text-[10px] text-certifica-500">{t.inscritos}/{t.vagas} vagas</div>
                      </div>
                    ))
                  )}
                </div>
              </DSCard>
            </>
          )}
        </div>
      </div>

      {/* ── KPI Drill-down Modal ── */}
      {selectedKpi && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-certifica-dark/45" onClick={() => setSelectedKpi(null)} />
          <div className="relative w-full max-w-[860px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] certifica-modal-content">
            <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
              <h3 className="text-[15px] text-certifica-900" style={{ fontWeight: 600 }}>Drill-down: {drillTitle}</h3>
              <button onClick={() => setSelectedKpi(null)} className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {drillData.length === 0 ? (
                <div className="py-8 text-center text-[12px] text-certifica-500">{selectedKpi === "auditorias" ? "Nenhuma auditoria futura agendada." : selectedKpi === "treinamentos" ? "Nenhum treinamento registrado." : "Nenhum registro encontrado."}</div>
              ) : selectedKpi === "treinamentos" ? (
                <DSTable
                  columns={[
                    { key: "titulo", header: "Treinamento", render: (row) => <span className="text-[12px]">{(row as any).titulo}</span> },
                    { key: "norma", header: "Norma", render: (row) => <span className="text-[12px]">{(row as any).norma}</span> },
                    { key: "instrutor", header: "Instrutor", render: (row) => <span className="text-[12px]">{(row as any).instrutor}</span> },
                    { key: "vagas", header: "Vagas", render: (row) => <span className="text-[12px] font-mono">{(row as any).inscritos}/{(row as any).vagas}</span> },
                    { key: "status", header: "Status", render: (row) => <DSBadge variant="outline">{(row as any).status}</DSBadge> },
                  ]}
                  data={drillData}
                />
              ) : selectedKpi === "auditorias" ? (
                <DSTable
                  columns={[
                    { key: "codigo", header: "Código", render: (row) => <span className="text-[12px] font-mono">{(row as any).codigo}</span> },
                    { key: "cliente", header: "Cliente", render: (row) => <span className="text-[12px]">{(row as any).cliente_nome}</span> },
                    { key: "tipo", header: "Tipo", render: (row) => <span className="text-[12px]">{(row as any).tipo}</span> },
                    { key: "norma", header: "Norma", render: (row) => <span className="text-[12px]">{(row as any).norma}</span> },
                    { key: "status", header: "Status", render: (row) => <DSBadge variant="outline">{(row as any).status}</DSBadge> },
                  ]}
                  data={drillData}
                />
              ) : (
                <DSTable
                  columns={[
                    { key: "cliente", header: "Cliente", render: (row) => <span className="text-[12px]">{(row as any).cliente_nome}</span> },
                    { key: "norma", header: "Norma", render: (row) => <span className="text-[12px]">{(row as any).norma}</span> },
                    { key: "consultor", header: "Consultor", render: (row) => <span className="text-[12px]">{(row as any).consultor}</span> },
                    {
                      key: "risco",
                      header: "Risco",
                      render: (row) => {
                        const score = riskScore(row as DashboardProject);
                        return <span className="text-[12px] font-mono">{score}</span>;
                      },
                    },
                    { key: "status", header: "Status", render: (row) => <DSBadge variant={statusVariant((row as any).status)}>{(row as any).status}</DSBadge> },
                    {
                      key: "ver",
                      header: "",
                      width: "36px",
                      render: (row) => (
                        <button
                          onClick={() => { setSelectedKpi(null); navigate("/projetos"); }}
                          className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                      ),
                    },
                  ]}
                  data={drillData}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Project Detail Modal ── */}
      {detailProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-certifica-dark/45" onClick={() => setDetailProject(null)} />
          <div className="relative w-full max-w-[600px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] certifica-modal-content">
            <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
              <h3 className="text-[15px] text-certifica-900" style={{ fontWeight: 600 }}>{detailProject.codigo} — {detailProject.titulo}</h3>
              <button onClick={() => setDetailProject(null)} className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Detail label="Cliente" value={detailProject.cliente_nome} />
                <Detail label="Norma" value={detailProject.norma} />
                <Detail label="Consultor" value={detailProject.consultor} />
                <Detail label="Status" value={detailProject.status} />
                <Detail label="Fase" value={`${detailProject.fase} — ${detailProject.fase_label}`} />
                <Detail label="Risco" value={`${riskScore(detailProject)}`} />
                <Detail label="Início" value={detailProject.inicio ? new Date(detailProject.inicio).toLocaleDateString("pt-BR") : "—"} />
                <Detail label="Previsão" value={detailProject.previsao ? new Date(detailProject.previsao).toLocaleDateString("pt-BR") : "—"} />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-certifica-200">
                <DSButton variant="ghost" size="sm" onClick={() => setDetailProject(null)}>Fechar</DSButton>
                <DSButton variant="primary" size="sm" onClick={() => { setDetailProject(null); navigate("/projetos"); }}>
                  Abrir no módulo <ExternalLink className="w-3 h-3 ml-1" strokeWidth={1.5} />
                </DSButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New Project Modal ── */}
      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-certifica-dark/45" onClick={() => setShowNewProject(false)} />
          <div className="relative w-full max-w-[520px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] certifica-modal-content">
            <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
              <h3 className="text-[15px] text-certifica-900" style={{ fontWeight: 600 }}>Novo Projeto</h3>
              <button onClick={() => setShowNewProject(false)} className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <FormField label="Título *" value={newProj.titulo} onChange={(v) => setNewProj((p) => ({ ...p, titulo: v }))} placeholder="Ex: Implantação ISO 9001" />
              <div>
                <label className="text-[11px] text-certifica-500 mb-1 block">Cliente *</label>
                <select
                  value={newProj.cliente_id}
                  onChange={(e) => setNewProj((p) => ({ ...p, cliente_id: e.target.value }))}
                  className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[12px]"
                >
                  <option value="">Selecione um cliente</option>
                  {clientesHook.clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>
                  ))}
                </select>
              </div>
              <FormField label="Norma" value={newProj.norma} onChange={(v) => setNewProj((p) => ({ ...p, norma: v }))} placeholder="Ex: ISO 9001:2015" />
              <FormField label="Consultor" value={newProj.consultor} onChange={(v) => setNewProj((p) => ({ ...p, consultor: v }))} placeholder="Nome do consultor" />
              <div>
                <label className="text-[11px] text-certifica-500 mb-1 block">Escopo</label>
                <textarea
                  value={newProj.escopo}
                  onChange={(e) => setNewProj((p) => ({ ...p, escopo: e.target.value }))}
                  className="w-full h-20 px-2 py-1.5 border border-certifica-200 rounded-[4px] text-[12px] resize-none"
                  placeholder="Descreva o escopo do projeto..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-certifica-200">
                <DSButton variant="ghost" size="sm" onClick={() => setShowNewProject(false)}>Cancelar</DSButton>
                <DSButton variant="primary" size="sm" onClick={handleCreateProject} disabled={saving || !newProj.titulo || !newProj.cliente_id}>
                  {saving ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                  {saving ? "Salvando..." : "Criar Projeto"}
                </DSButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tiny helper components ── */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-certifica-500">{label}</div>
      <div className="text-[12.5px] text-certifica-dark" style={{ fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[11px] text-certifica-500 mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[12px]"
      />
    </div>
  );
}
