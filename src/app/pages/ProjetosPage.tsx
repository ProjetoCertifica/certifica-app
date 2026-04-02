import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { DSButton } from "../components/ds/DSButton";
import { DSBadge } from "../components/ds/DSBadge";
import { DSInput } from "../components/ds/DSInput";
import { DSSelect } from "../components/ds/DSSelect";
import { DSTextarea } from "../components/ds/DSTextarea";
import { useProjetos } from "../lib/useProjetos";
import { useClientes } from "../lib/useClientes";
import type { ProjetoInsert } from "../lib/database.types";
import {
  mapProjetoToUI,
  faseColors,
  faseLabels,
  statusConfig,
  prioridadeConfig,
  getRiskPrazo,
  getRiskEscopo,
  getProgressPercent,
  consultores,
  type ProjetoUI,
  type EntregavelUI,
  type ClienteRef,
} from "../lib/projetosShared";
import {
  Search,
  Plus,
  X,
  ChevronRight,
  FolderOpen,
  ClipboardCheck,
  Building2,
  Calendar,
  FileText,
  Users,
  DollarSign,
  Target,
  CheckCircle2,
  Circle,
  Trash2,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  List,
  Columns3,
  GanttChart,
  Filter,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { ProjectListView } from "../components/projetos/ProjectListView";
import { ProjectKanbanView } from "../components/projetos/ProjectKanbanView";
import { ProjectGanttView } from "../components/projetos/ProjectGanttView";
import { ProjectFunnelView } from "../components/projetos/ProjectFunnelView";

/* ══════════════════════════════════════════════════════════
   View types
   ══════════════════════════════════════════════════════════ */

type ViewMode = "lista" | "kanban" | "gantt" | "funil";

const viewConfig: { key: ViewMode; label: string; icon: React.ElementType }[] = [
  { key: "lista", label: "Lista", icon: List },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "gantt", label: "Gantt", icon: GanttChart },
  { key: "funil", label: "Funil", icon: Filter },
];

/* ══════════════════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════════════════ */

export default function ProjetosPage() {
  const {
    projetos: rawProjetos,
    loading: dbLoading,
    error: dbError,
    create,
    update,
    refetch,
    toggleEntregavel,
    addEntregavel,
    updateEntregavel,
    removeEntregavel,
  } = useProjetos();
  const { clientes: rawClientes } = useClientes();

  const projetosList = useMemo(() => rawProjetos.map(mapProjetoToUI), [rawProjetos]);
  const clientesDisponiveis: ClienteRef[] = useMemo(
    () =>
      rawClientes.map((c) => ({
        id: c.id,
        cnpj: c.cnpj,
        nomeFantasia: c.nome_fantasia,
        razaoSocial: c.razao_social,
      })),
    [rawClientes]
  );

  /* ── State ── */
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("certifica_projetos_view");
    return (saved as ViewMode) || "lista";
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterFase, setFilterFase] = useState("todos");
  const [filterConsultor, setFilterConsultor] = useState("todos");
  const [showNewModal, setShowNewModal] = useState(false);
  const [detailTab, setDetailTab] = useState<"info" | "entregaveis" | "proposta">("info");
  const [transitionError, setTransitionError] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── Persist view mode ── */
  useEffect(() => {
    localStorage.setItem("certifica_projetos_view", viewMode);
  }, [viewMode]);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    return projetosList.filter((p) => {
      if (filterStatus !== "todos" && p.status !== filterStatus) return false;
      if (filterFase !== "todos" && String(p.fase) !== filterFase) return false;
      if (filterConsultor !== "todos" && p.consultor !== filterConsultor) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          p.titulo.toLowerCase().includes(q) ||
          p.clienteNome.toLowerCase().includes(q) ||
          p.norma.toLowerCase().includes(q) ||
          p.codigo.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projetosList, filterStatus, filterFase, filterConsultor, searchQuery]);

  const selected = projetosList.find((p) => p.id === selectedId);

  /* ── Summary ── */
  const totalAtivos = projetosList.filter((p) => p.status === "em-andamento").length;
  const totalPropostas = projetosList.filter((p) => p.status === "proposta").length;

  /* ── Handlers ── */
  const handleAdvancePhase = async (projectId: string) => {
    setTransitionError("");
    const target = projetosList.find((p) => p.id === projectId);
    if (!target || target.fase >= 4) return;
    const newFase = target.fase + 1;
    await update(projectId, {
      fase: newFase,
      fase_label: faseLabels[newFase],
      status: newFase >= 4 ? "concluido" : "em-andamento",
    });
  };

  const handleCreateProject = async (payload: {
    clienteId: string;
    titulo: string;
    norma: string;
    prioridade: string;
    descricao: string;
    valor: string;
    condicoes: string;
    entregaveis: string[];
    observacoes: string;
    inicio: string;
    previsao: string;
    consultor: string;
    equipe: string[];
  }) => {
    setSaving(true);
    const nextCode =
      projetosList.reduce((max, p) => {
        const m = p.codigo.match(/^PRJ-(\d+)$/);
        return m ? Math.max(max, Number(m[1])) : max;
      }, 0) + 1;
    const code = `PRJ-${String(nextCode).padStart(3, "0")}`;
    const insert: ProjetoInsert = {
      codigo: code,
      titulo: payload.titulo.trim(),
      cliente_id: payload.clienteId,
      norma: payload.norma.trim(),
      fase: 1,
      fase_label: faseLabels[1],
      status: "em-andamento",
      prioridade: payload.prioridade as "alta" | "media" | "baixa",
      consultor: payload.consultor,
      equipe: payload.equipe,
      inicio: payload.inicio || null,
      previsao: payload.previsao || null,
      escopo: payload.descricao.trim(),
      valor: payload.valor.trim(),
      condicoes_pagamento: payload.condicoes.trim(),
      total_documentos: 0,
      total_auditorias: 0,
      observacoes: payload.observacoes.trim(),
    };
    const entTexts = payload.entregaveis.filter((e) => e.trim());
    const result = await create(insert, entTexts);
    setSaving(false);
    if (result) {
      setSelectedId(result.id);
      setShowNewModal(false);
      setDetailTab("info");
      toast.success("Projeto criado com sucesso!");
    }
  };

  const handleMoveFase = async (projetoId: string, newFase: number) => {
    await update(projetoId, {
      fase: newFase,
      fase_label: faseLabels[newFase],
      status: newFase === 0 ? "proposta" : newFase >= 4 ? "concluido" : "em-andamento",
    });
    toast.success(`Projeto movido para ${faseLabels[newFase]}`);
  };

  /* ── Loading ── */
  if (dbLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-certifica-accent animate-spin" strokeWidth={1.5} />
          <span className="text-[12px] text-certifica-500">Carregando projetos...</span>
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <AlertTriangle className="w-6 h-6 text-nao-conformidade" strokeWidth={1.5} />
          <span className="text-[12px] text-nao-conformidade" style={{ fontWeight: 500 }}>
            Erro ao carregar projetos
          </span>
          <span className="text-[11px] text-certifica-500">{dbError}</span>
          <DSButton
            variant="outline"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />}
            onClick={refetch}
          >
            Tentar novamente
          </DSButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ══════════════════════════════════════════════════════════
         Main content area
         ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* ── Toolbar ── */}
        <div className="px-5 pt-4 pb-0 flex-shrink-0">
          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-certifica-900 text-[16px]" style={{ fontWeight: 700 }}>
                  Projetos
                </h2>
                <p className="text-[11px] text-certifica-500 mt-0.5" style={{ fontWeight: 400 }}>
                  {projetosList.length} {projetosList.length === 1 ? "projeto" : "projetos"} &middot; {totalAtivos} em andamento
                  {totalPropostas > 0 && (
                    <span className="text-oportunidade ml-1" style={{ fontWeight: 500 }}>
                      &middot; {totalPropostas} proposta{totalPropostas > 1 ? "s" : ""}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View switcher */}
              <div className="flex items-center bg-certifica-100/60 rounded-[4px] p-0.5">
                {viewConfig.map((v) => {
                  const isActive = viewMode === v.key;
                  return (
                    <button
                      key={v.key}
                      onClick={() => setViewMode(v.key)}
                      title={v.label}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] transition-all duration-200 cursor-pointer ${
                        isActive
                          ? "bg-white text-certifica-accent-dark shadow-sm"
                          : "text-certifica-500 hover:text-certifica-dark"
                      }`}
                    >
                      <v.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span
                        className="text-[11px] hidden sm:inline"
                        style={{ fontWeight: isActive ? 600 : 400 }}
                      >
                        {v.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <DSButton
                variant="primary"
                size="sm"
                icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}
                onClick={() => setShowNewModal(true)}
              >
                Novo Projeto
              </DSButton>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 pb-3 border-b border-certifica-200">
            <div className="relative flex-1 max-w-[260px]">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-certifica-500/40"
                strokeWidth={1.5}
              />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-8 pr-3 bg-certifica-50 border border-certifica-200 rounded-[3px] text-[11.5px] placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-700/30"
                placeholder="Buscar projeto, cliente, norma..."
                style={{ fontWeight: 400 }}
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-7 px-2 bg-white border border-certifica-200 rounded-[3px] text-[11.5px] text-certifica-dark appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-certifica-700/30 pr-6"
              style={{ fontWeight: 400 }}
            >
              <option value="todos">Todos os status</option>
              <option value="proposta">Proposta</option>
              <option value="em-andamento">Em andamento</option>
              <option value="concluido">Concluido</option>
              <option value="pausado">Pausado</option>
            </select>
            <select
              value={filterFase}
              onChange={(e) => setFilterFase(e.target.value)}
              className="h-7 px-2 bg-white border border-certifica-200 rounded-[3px] text-[11.5px] text-certifica-dark appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-certifica-700/30 pr-6"
              style={{ fontWeight: 400 }}
            >
              <option value="todos">Todas as fases</option>
              <option value="0">Proposta</option>
              <option value="1">1 — Planejamento</option>
              <option value="2">2 — Solução</option>
              <option value="3">3 — Verificação</option>
              <option value="4">4 — Acompanhamento</option>
            </select>
            <select
              value={filterConsultor}
              onChange={(e) => setFilterConsultor(e.target.value)}
              className="h-7 px-2 bg-white border border-certifica-200 rounded-[3px] text-[11.5px] text-certifica-dark appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-certifica-700/30 pr-6"
              style={{ fontWeight: 400 }}
            >
              <option value="todos">Todos os consultores</option>
              {consultores.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="ml-auto text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>
              {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* ── View content ── */}
        <div className="flex-1 flex overflow-hidden">
          <div
            className="flex-1 overflow-auto"
            style={{
              animation: "certifica-view-enter 250ms ease-out",
            }}
            key={viewMode}
          >
            {viewMode === "lista" && (
              <ProjectListView
                projetos={filtered}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setDetailTab("info");
                }}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />
            )}
            {viewMode === "kanban" && (
              <ProjectKanbanView
                projetos={filtered}
                onSelect={(id) => {
                  setSelectedId(id);
                  setDetailTab("info");
                }}
                onMoveFase={handleMoveFase}
              />
            )}
            {viewMode === "gantt" && (
              <ProjectGanttView
                projetos={filtered}
                onSelect={(id) => {
                  setSelectedId(id);
                  setDetailTab("info");
                }}
              />
            )}
            {viewMode === "funil" && (
              <ProjectFunnelView
                projetos={filtered}
                onSelect={(id) => {
                  setSelectedId(id);
                  setDetailTab("info");
                }}
              />
            )}
          </div>

          {/* ══════════════════════════════════════════════════════════
             Detail panel
             ══════════════════════════════════════════════════════════ */}
          {selected && (
            <div
              className="w-[320px] flex-shrink-0 border-l border-certifica-200 bg-white flex flex-col overflow-hidden"
              style={{
                animation: "certifica-slide-in 200ms ease-out",
              }}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-certifica-200 flex-shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-certifica-700 font-mono" style={{ fontWeight: 600 }}>
                    {selected.codigo}
                  </span>
                  <button
                    onClick={() => setSelectedId(null)}
                    className="p-1 text-certifica-500/40 hover:text-certifica-dark transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="text-[14px] text-certifica-900 mb-1" style={{ fontWeight: 600, lineHeight: "1.35" }}>
                  {selected.titulo}
                </div>
                <div className="flex items-center gap-2 mb-2.5">
                  <DSBadge variant={statusConfig[selected.status].variant}>
                    {statusConfig[selected.status].label}
                  </DSBadge>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: prioridadeConfig[selected.prioridade].color }}
                    />
                    <span className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>
                      {prioridadeConfig[selected.prioridade].label}
                    </span>
                  </div>
                </div>

                {/* Fase stepper */}
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((f) => (
                    <div key={f} className="flex items-center gap-1 flex-1">
                      <div
                        className={`h-1 flex-1 rounded-full ${f <= selected.fase ? "" : "bg-certifica-200"}`}
                        style={f <= selected.fase ? { backgroundColor: faseColors[f] } : {}}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-certifica-500" style={{ fontWeight: 400 }}>
                    Planejamento
                  </span>
                  <span className="text-[9px] text-certifica-500" style={{ fontWeight: 400 }}>
                    Acompanhamento
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  <DSButton
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[10.5px]"
                    disabled={selected.fase >= 4}
                    onClick={() => handleAdvancePhase(selected.id)}
                  >
                    Avançar fase
                  </DSButton>
                  {selected.fase >= 4 && <DSBadge variant="conformidade">Projeto concluído</DSBadge>}
                </div>
                {transitionError && (
                  <p className="mt-1.5 text-[10.5px] text-nao-conformidade" style={{ fontWeight: 500 }}>
                    {transitionError}
                  </p>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-certifica-200 flex-shrink-0">
                {(
                  [
                    { key: "info" as const, label: "Detalhes" },
                    { key: "entregaveis" as const, label: "Entregáveis" },
                    { key: "proposta" as const, label: "Proposta" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key)}
                    className={`flex-1 py-2 text-[11px] text-center transition-colors cursor-pointer ${
                      detailTab === tab.key
                        ? "text-certifica-900 border-b-2 border-certifica-accent"
                        : "text-certifica-500 hover:text-certifica-dark"
                    }`}
                    style={{ fontWeight: detailTab === tab.key ? 600 : 400 }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {detailTab === "info" && (
                  <DetailInfo
                    projeto={selected}
                    onUpdateDocs={(n) => update(selected.id, { total_documentos: n })}
                    onUpdateAuditorias={(n) => update(selected.id, { total_auditorias: n })}
                  />
                )}
                {detailTab === "entregaveis" && (
                  <DetailEntregaveis
                    projeto={selected}
                    onToggle={(id, val) => toggleEntregavel(id, val)}
                    onAdd={(texto, url) => addEntregavel(selected.id, url ? `${texto}|||${url}` : texto)}
                    onUpdate={(id, texto, url) => updateEntregavel(id, { texto: url ? `${texto}|||${url}` : texto })}
                    onRemove={(id) => removeEntregavel(id)}
                  />
                )}
                {detailTab === "proposta" && (
                  <DetailProposta projeto={selected} onSave={(patch) => update(selected.id, patch)} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── New project modal ── */}
      {showNewModal && (
        <NewProjectModal
          clientesDisponiveis={clientesDisponiveis}
          saving={saving}
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreateProject}
        />
      )}

      <style>{`
        @keyframes certifica-view-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes certifica-slide-in {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Detail tab — Info
   ══════════════════════════════════════════════════════════ */

function DetailInfo({
  projeto: p,
  onUpdateDocs,
  onUpdateAuditorias,
}: {
  projeto: ProjetoUI;
  onUpdateDocs: (n: number) => void;
  onUpdateAuditorias: (n: number) => void;
}) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-certifica-200">
        <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
          Cliente
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-certifica-500/40" strokeWidth={1.5} />
          <div>
            <span className="text-[12px] text-certifica-dark block" style={{ fontWeight: 500 }}>
              {p.clienteNome}
            </span>
            <span className="text-[10px] text-certifica-500 font-mono" style={{ fontWeight: 400 }}>
              {p.clienteCnpj}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-certifica-200">
        <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
          Informacoes
        </div>
        <div className="space-y-1.5">
          {[
            { label: "Norma", value: p.norma },
            { label: "Fase", value: `${p.fase > 0 ? p.fase + " — " : ""}${p.faseLabel}` },
            { label: "Consultor", value: p.consultor },
            { label: "Início", value: p.inicio },
            { label: "Previsão", value: p.previsao },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>
                {item.label}
              </span>
              <span className="text-[11px] text-certifica-dark" style={{ fontWeight: 500 }}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-certifica-200">
        <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
          Equipe ({p.equipe.length})
        </div>
        <div className="flex flex-wrap gap-1.5">
          {p.equipe.map((nome) => (
            <span
              key={nome}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-certifica-50 border border-certifica-200 rounded-[2px] text-[11px] text-certifica-dark"
              style={{ fontWeight: 400 }}
            >
              <Users className="w-3 h-3 text-certifica-500/50" strokeWidth={1.5} />
              {nome}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-b border-certifica-200">
        <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
          Escopo
        </div>
        <p className="text-[11.5px] text-certifica-dark" style={{ fontWeight: 400, lineHeight: "1.55" }}>
          {p.escopo}
        </p>
      </div>

      <div className="px-4 py-3 border-b border-certifica-200">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-certifica-500/40" strokeWidth={1.5} />
            <button
              onClick={() => onUpdateDocs(Math.max(0, p.totalDocumentos - 1))}
              className="w-4 h-4 flex items-center justify-center rounded text-certifica-500/50 hover:text-certifica-dark hover:bg-certifica-100 transition-colors cursor-pointer text-[12px] leading-none"
            >
              −
            </button>
            <span
              className={`text-[11px] w-4 text-center ${
                p.totalDocumentos < 3 ? "text-nao-conformidade" : "text-certifica-dark"
              }`}
              style={{ fontWeight: 600 }}
            >
              {p.totalDocumentos}
            </span>
            <button
              onClick={() => onUpdateDocs(p.totalDocumentos + 1)}
              className="w-4 h-4 flex items-center justify-center rounded text-certifica-500/50 hover:text-certifica-dark hover:bg-certifica-100 transition-colors cursor-pointer text-[12px] leading-none"
            >
              +
            </button>
            <span className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>
              evidências
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ClipboardCheck className="w-3.5 h-3.5 text-certifica-500/40" strokeWidth={1.5} />
            <button
              onClick={() => onUpdateAuditorias(Math.max(0, p.totalAuditorias - 1))}
              className="w-4 h-4 flex items-center justify-center rounded text-certifica-500/50 hover:text-certifica-dark hover:bg-certifica-100 transition-colors cursor-pointer text-[12px] leading-none"
            >
              −
            </button>
            <span
              className={`text-[11px] w-4 text-center ${
                p.fase >= 3 && p.totalAuditorias < 1 ? "text-nao-conformidade" : "text-certifica-dark"
              }`}
              style={{ fontWeight: 600 }}
            >
              {p.totalAuditorias}
            </span>
            <button
              onClick={() => onUpdateAuditorias(p.totalAuditorias + 1)}
              className="w-4 h-4 flex items-center justify-center rounded text-certifica-500/50 hover:text-certifica-dark hover:bg-certifica-100 transition-colors cursor-pointer text-[12px] leading-none"
            >
              +
            </button>
            <span className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>
              auditorias
            </span>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div className="bg-certifica-50 border border-certifica-200 rounded-[3px] px-2 py-1.5">
            <div className="text-[10px] text-certifica-500">Risco de prazo</div>
            <div
              className={`text-[12px] font-mono ${
                getRiskPrazo(p) >= 70
                  ? "text-nao-conformidade"
                  : getRiskPrazo(p) >= 50
                  ? "text-observacao"
                  : "text-conformidade"
              }`}
              style={{ fontWeight: 600 }}
            >
              {getRiskPrazo(p)}
            </div>
          </div>
          <div className="bg-certifica-50 border border-certifica-200 rounded-[3px] px-2 py-1.5">
            <div className="text-[10px] text-certifica-500">Risco de escopo</div>
            <div
              className={`text-[12px] font-mono ${
                getRiskEscopo(p) >= 70
                  ? "text-nao-conformidade"
                  : getRiskEscopo(p) >= 50
                  ? "text-observacao"
                  : "text-conformidade"
              }`}
              style={{ fontWeight: 600 }}
            >
              {getRiskEscopo(p)}
            </div>
          </div>
        </div>
      </div>

      {p.observacoes && (
        <div className="px-4 py-3">
          <div
            className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2"
            style={{ fontWeight: 600 }}
          >
            Observações
          </div>
          <p className="text-[11.5px] text-certifica-dark" style={{ fontWeight: 400, lineHeight: "1.55" }}>
            {p.observacoes}
          </p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Detail tab — Entregáveis
   ══════════════════════════════════════════════════════════ */

function DetailEntregaveis({
  projeto: p,
  onToggle,
  onAdd,
  onUpdate,
  onRemove,
}: {
  projeto: ProjetoUI;
  onToggle: (id: string, val: boolean) => void;
  onAdd: (texto: string, url: string) => void;
  onUpdate: (id: string, texto: string, url: string) => void;
  onRemove: (id: string) => void;
}) {
  const concluidos = p.entregaveis.filter((e) => e.concluido).length;
  const total = p.entregaveis.length;
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  const [newTexto, setNewTexto] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");
  const [editUrl, setEditUrl] = useState("");

  const handleAdd = () => {
    const t = newTexto.trim();
    if (!t) return;
    onAdd(t, newUrl.trim());
    setNewTexto("");
    setNewUrl("");
  };

  const startEdit = (ent: EntregavelUI) => {
    setEditingId(ent.id);
    setEditTexto(ent.texto);
    setEditUrl(ent.url);
  };

  const saveEdit = () => {
    if (!editingId || !editTexto.trim()) return;
    onUpdate(editingId, editTexto.trim(), editUrl.trim());
    setEditingId(null);
  };

  return (
    <div>
      <div className="px-4 py-3 border-b border-certifica-200">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-certifica-dark" style={{ fontWeight: 500 }}>
            {concluidos} de {total} concluídos
          </span>
          <span className="text-[12px] text-certifica-900 font-mono" style={{ fontWeight: 600 }}>
            {pct}%
          </span>
        </div>
        <div className="h-[4px] bg-certifica-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#1F5E3B" : "#2B8EAD" }}
          />
        </div>
      </div>

      <div className="px-4 py-2">
        {p.entregaveis.map((ent, idx) => (
          <div key={ent.id} className={`py-2.5 ${idx > 0 ? "border-t border-certifica-200" : ""}`}>
            {editingId === ent.id ? (
              <div className="space-y-1.5">
                <input
                  value={editTexto}
                  onChange={(e) => setEditTexto(e.target.value)}
                  className="w-full h-8 px-2.5 border border-certifica-accent/50 rounded-[4px] text-[12px] bg-white focus:outline-none"
                  placeholder="Descrição"
                  autoFocus
                />
                <input
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full h-8 px-2.5 border border-certifica-200 rounded-[4px] text-[11px] bg-white focus:outline-none"
                  placeholder="URL do documento (opcional)"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveEdit}
                    className="px-3 py-1 text-[11px] bg-certifica-accent text-white rounded-[4px] cursor-pointer hover:opacity-90"
                    style={{ fontWeight: 600 }}
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 text-[11px] border border-certifica-200 text-certifica-500 rounded-[4px] cursor-pointer hover:text-certifica-dark"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 group">
                <button onClick={() => onToggle(ent.id, !ent.concluido)} className="mt-0.5 flex-shrink-0 cursor-pointer">
                  {ent.concluido ? (
                    <CheckCircle2 className="w-4 h-4 text-conformidade" strokeWidth={1.5} />
                  ) : (
                    <Circle
                      className="w-4 h-4 text-certifica-200 hover:text-certifica-400 transition-colors"
                      strokeWidth={1.5}
                    />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-[12px] ${ent.concluido ? "text-certifica-500 line-through" : "text-certifica-dark"}`}
                    style={{ fontWeight: 400, lineHeight: "1.45" }}
                  >
                    {ent.texto}
                  </span>
                  {ent.url && (
                    <a
                      href={ent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 mt-0.5 text-[10px] text-certifica-accent hover:underline"
                    >
                      <FileText className="w-3 h-3" strokeWidth={1.5} />
                      <span className="truncate">{ent.url}</span>
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => startEdit(ent)}
                    className="p-0.5 text-certifica-400 hover:text-certifica-dark cursor-pointer transition-colors"
                  >
                    <FileText className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => onRemove(ent.id)}
                    className="p-0.5 text-certifica-400 hover:text-nao-conformidade cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-certifica-200 space-y-1.5">
        <input
          value={newTexto}
          onChange={(e) => setNewTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="w-full h-8 px-2.5 border border-certifica-200 rounded-[4px] text-[12px] bg-white focus:outline-none focus:border-certifica-accent/50"
          placeholder="Novo entregável..."
        />
        <div className="flex gap-2">
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="flex-1 h-8 px-2.5 border border-certifica-200 rounded-[4px] text-[11px] bg-white focus:outline-none focus:border-certifica-accent/50"
            placeholder="URL do documento (opcional)"
          />
          <button
            onClick={handleAdd}
            disabled={!newTexto.trim()}
            className="px-3 h-8 text-[11px] bg-certifica-accent text-white rounded-[4px] cursor-pointer hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            style={{ fontWeight: 600 }}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Detail tab — Proposta
   ══════════════════════════════════════════════════════════ */

function DetailProposta({
  projeto: p,
  onSave,
}: {
  projeto: ProjetoUI;
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [valor, setValor] = useState(p.valor);
  const [condicoes, setCondicoes] = useState(p.condicoesPagamento);
  const [escopo, setEscopo] = useState(p.escopo);

  useEffect(() => {
    setValor(p.valor);
    setCondicoes(p.condicoesPagamento);
    setEscopo(p.escopo);
  }, [p.id, p.valor, p.condicoesPagamento, p.escopo]);

  const save = () => onSave({ valor: valor.trim(), condicoes_pagamento: condicoes.trim(), escopo: escopo.trim() });

  const fieldClass =
    "w-full px-2.5 py-1.5 border border-certifica-200 rounded-[4px] text-[12px] bg-white focus:outline-none focus:border-certifica-accent/50 transition-colors";
  const labelClass = "text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-1 block";

  return (
    <div>
      <div className="px-4 py-3 border-b border-certifica-200 space-y-3">
        <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-1" style={{ fontWeight: 600 }}>
          Valores
        </div>
        <div>
          <label className={labelClass} style={{ fontWeight: 600 }}>
            Valor do projeto
          </label>
          <input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={save}
            className={fieldClass}
            placeholder="R$ 0,00"
          />
        </div>
        <div>
          <label className={labelClass} style={{ fontWeight: 600 }}>
            Condições de pagamento
          </label>
          <input
            value={condicoes}
            onChange={(e) => setCondicoes(e.target.value)}
            onBlur={save}
            className={fieldClass}
            placeholder="Ex: 50% entrada + 50% conclusão"
          />
        </div>
      </div>

      <div className="px-4 py-3 border-b border-certifica-200">
        <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
          Escopo da Proposta
        </div>
        <textarea
          value={escopo}
          onChange={(e) => setEscopo(e.target.value)}
          onBlur={save}
          className="w-full px-2.5 py-1.5 border border-certifica-200 rounded-[4px] text-[12px] bg-white focus:outline-none focus:border-certifica-accent/50 transition-colors resize-none"
          rows={5}
          placeholder="Descreva o escopo do projeto..."
        />
      </div>

      <div className="px-4 py-3 border-b border-certifica-200">
        <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
          Entregáveis ({p.entregaveis.length})
        </div>
        <div className="space-y-1.5">
          {p.entregaveis.map((ent, idx) => (
            <div key={ent.id} className="flex items-start gap-2">
              <span className="text-[10px] text-certifica-500 font-mono mt-px flex-shrink-0" style={{ fontWeight: 500 }}>
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span
                className={`text-[11.5px] ${ent.concluido ? "text-certifica-500 line-through" : "text-certifica-dark"}`}
                style={{ fontWeight: 400, lineHeight: "1.45" }}
              >
                {ent.texto}
              </span>
            </div>
          ))}
          {p.entregaveis.length === 0 && (
            <span className="text-[11px] text-certifica-500">Nenhum entregável. Adicione na aba Entregáveis.</span>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
          Cronograma
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-certifica-500">Início</span>
            <span className="text-[11px] text-certifica-dark font-mono" style={{ fontWeight: 500 }}>
              {p.inicio}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-certifica-500">Previsão conclusão</span>
            <span className="text-[11px] text-certifica-dark font-mono" style={{ fontWeight: 500 }}>
              {p.previsao}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-certifica-500">Equipe</span>
            <span className="text-[11px] text-certifica-dark" style={{ fontWeight: 500 }}>
              {p.equipe.join(", ")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   New Project Modal
   ══════════════════════════════════════════════════════════ */

function NewProjectModal({
  onClose,
  onCreate,
  clientesDisponiveis,
  saving,
}: {
  onClose: () => void;
  onCreate: (payload: {
    clienteId: string;
    titulo: string;
    norma: string;
    prioridade: string;
    descricao: string;
    valor: string;
    condicoes: string;
    entregaveis: string[];
    observacoes: string;
    inicio: string;
    previsao: string;
    consultor: string;
    equipe: string[];
  }) => void;
  clientesDisponiveis: ClienteRef[];
  saving: boolean;
}) {
  useBodyScrollLock(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [wizardError, setWizardError] = useState("");

  const [clienteId, setClienteId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [norma, setNorma] = useState("");
  const [prioridade, setPrioridade] = useState("media");
  const [descricao, setDescricao] = useState("");

  const [valor, setValor] = useState("");
  const [condicoes, setCondicoes] = useState("");
  const [entregaveis, setEntregaveis] = useState<string[]>([""]);
  const [observacoes, setObservacoes] = useState("");

  const [inicio, setInicio] = useState("");
  const [previsao, setPrevisao] = useState("");
  const [consultorPrincipal, setConsultorPrincipal] = useState("");
  const [equipeSelecionada, setEquipeSelecionada] = useState<string[]>([]);

  const selectedClient = clientesDisponiveis.find((c) => c.id === clienteId);

  const addEntregavelItem = () => setEntregaveis([...entregaveis, ""]);
  const removeEntregavelItem = (idx: number) => {
    if (entregaveis.length <= 1) return;
    setEntregaveis(entregaveis.filter((_, i) => i !== idx));
  };
  const updateEntregavelItem = (idx: number, val: string) => {
    const copy = [...entregaveis];
    copy[idx] = val;
    setEntregaveis(copy);
  };

  const toggleEquipe = (nome: string) => {
    setEquipeSelecionada((prev) => (prev.includes(nome) ? prev.filter((n) => n !== nome) : [...prev, nome]));
  };

  const stepLabels = ["Identificação", "Proposta", "Cronograma"];

  const canGoNextFromStep1 = clienteId.trim() !== "" && titulo.trim() !== "" && norma.trim() !== "" && descricao.trim() !== "";
  const canGoNextFromStep2 = valor.trim() !== "" && condicoes.trim() !== "" && entregaveis.filter((e) => e.trim()).length > 0;
  const canCreate = consultorPrincipal.trim() !== "" && equipeSelecionada.length > 0 && inicio.trim() !== "" && previsao.trim() !== "";

  const handleNext = () => {
    setWizardError("");
    if (step === 1 && !canGoNextFromStep1) {
      setWizardError("Preencha os campos obrigatórios da etapa de Identificação.");
      return;
    }
    if (step === 2 && !canGoNextFromStep2) {
      setWizardError("Defina valor, condições e ao menos 1 entregável.");
      return;
    }
    setStep((step + 1) as 1 | 2 | 3);
  };

  const handleCreate = () => {
    setWizardError("");
    if (!canCreate) {
      setWizardError("Preencha cronograma, consultor principal e equipe.");
      return;
    }
    if (!clienteId) {
      setWizardError("Selecione um cliente válido.");
      return;
    }
    onCreate({
      clienteId,
      titulo: titulo.trim(),
      norma: norma.trim(),
      prioridade,
      descricao: descricao.trim(),
      valor: valor.trim(),
      condicoes: condicoes.trim(),
      entregaveis: entregaveis.filter((e) => e.trim()),
      observacoes: observacoes.trim(),
      inicio,
      previsao,
      consultor: consultorPrincipal,
      equipe: equipeSelecionada,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-certifica-dark/40 certifica-modal-backdrop" onClick={onClose} />
      <div className="relative bg-white rounded-[4px] border border-certifica-200 w-[620px] max-h-[88vh] flex flex-col certifica-modal-content">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-certifica-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-certifica-accent" strokeWidth={1.5} />
            <span className="text-[14px] text-certifica-900" style={{ fontWeight: 600 }}>
              Novo Projeto
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-certifica-500/40 hover:text-certifica-dark transition-colors cursor-pointer">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 py-3 border-b border-certifica-200 flex items-center gap-3 flex-shrink-0">
          {stepLabels.map((label, idx) => {
            const stepNum = (idx + 1) as 1 | 2 | 3;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={label} className="contents">
                {idx > 0 && <div className={`flex-1 h-px ${isDone ? "bg-certifica-accent" : "bg-certifica-200"}`} />}
                <button onClick={() => setStep(stepNum)} className="flex items-center gap-1.5 cursor-pointer">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      isActive
                        ? "bg-certifica-accent text-white"
                        : isDone
                        ? "bg-certifica-accent/20 text-certifica-accent"
                        : "bg-certifica-200 text-certifica-500"
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    {isDone ? "✓" : stepNum}
                  </div>
                  <span className={`text-[11px] ${isActive ? "text-certifica-900" : "text-certifica-500"}`} style={{ fontWeight: isActive ? 600 : 400 }}>
                    {label}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-3" style={{ fontWeight: 600 }}>
                  Cliente
                </div>
                <DSSelect
                  label="Selecione o cliente"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                  options={[
                    { value: "", label: "Escolha um cliente cadastrado..." },
                    ...clientesDisponiveis.map((c) => ({ value: c.id, label: `${c.nomeFantasia} — ${c.cnpj}` })),
                  ]}
                />
                {selectedClient && (
                  <div className="mt-2 px-3 py-2 bg-certifica-50 border border-certifica-200 rounded-[3px] flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-certifica-500/50" strokeWidth={1.5} />
                    <div>
                      <span className="text-[11.5px] text-certifica-dark block" style={{ fontWeight: 500 }}>
                        {selectedClient.razaoSocial}
                      </span>
                      <span className="text-[10px] text-certifica-500 font-mono" style={{ fontWeight: 400 }}>
                        {selectedClient.cnpj}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="border-t border-certifica-200" />
              <div>
                <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-3" style={{ fontWeight: 600 }}>
                  Dados do Projeto
                </div>
                <div className="space-y-3">
                  <DSInput label="Titulo do projeto" placeholder="Ex: Certificacao ISO 9001:2015" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <DSSelect
                      label="Norma / Referencial"
                      value={norma}
                      onChange={(e) => setNorma(e.target.value)}
                      options={[
                        { value: "", label: "Selecione..." },
                        { value: "ISO 9001:2015", label: "ISO 9001:2015 — Qualidade" },
                        { value: "ISO 14001:2015", label: "ISO 14001:2015 — Meio Ambiente" },
                        { value: "ISO 45001:2018", label: "ISO 45001:2018 — SSO" },
                        { value: "ISO 50001:2018", label: "ISO 50001:2018 — Energia" },
                        { value: "ISO 22000:2018", label: "ISO 22000:2018 — Seguranca Alimentar" },
                        { value: "FSC COC", label: "FSC — Cadeia de Custodia" },
                        { value: "CERFLOR", label: "CERFLOR" },
                        { value: "BPF", label: "BPF — Boas Praticas" },
                        { value: "Lean", label: "Lean Manufacturing" },
                        { value: "ESG", label: "ESG" },
                        { value: "ISO 9001 + 14001", label: "Integrado — 9001 + 14001" },
                        { value: "Outro", label: "Outro..." },
                      ]}
                    />
                    <DSSelect
                      label="Prioridade"
                      value={prioridade}
                      onChange={(e) => setPrioridade(e.target.value)}
                      options={[
                        { value: "baixa", label: "Baixa" },
                        { value: "media", label: "Media" },
                        { value: "alta", label: "Alta" },
                      ]}
                    />
                  </div>
                  <DSTextarea
                    label="Descricao / Escopo"
                    placeholder="Descreva o escopo do projeto, objetivos, processos envolvidos..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-3" style={{ fontWeight: 600 }}>
                  Valores
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DSInput
                    label="Valor do projeto"
                    placeholder="R$ 0,00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    icon={<DollarSign className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  />
                  <DSInput
                    label="Condicoes de pagamento"
                    placeholder="Ex: 6x de R$ 8.000,00"
                    value={condicoes}
                    onChange={(e) => setCondicoes(e.target.value)}
                  />
                </div>
              </div>
              <div className="border-t border-certifica-200" />
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
                    Entregáveis
                  </div>
                  <button onClick={addEntregavelItem} className="flex items-center gap-1 text-[11px] text-certifica-accent cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
                    <Plus className="w-3 h-3" strokeWidth={1.5} />
                    Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {entregaveis.map((ent, idx) => (
                    <div key={`ent-${idx}-${ent.slice(0, 8)}`} className="flex items-center gap-2">
                      <span className="text-[10px] text-certifica-500 font-mono flex-shrink-0 w-5 text-right" style={{ fontWeight: 500 }}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <input
                        value={ent}
                        onChange={(e) => updateEntregavelItem(idx, e.target.value)}
                        placeholder="Descreva o entregável..."
                        className="flex-1 h-8 px-3 bg-white border border-certifica-200 rounded-[3px] text-[12px] text-certifica-dark placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-700/30"
                        style={{ fontWeight: 400 }}
                      />
                      <button
                        onClick={() => removeEntregavelItem(idx)}
                        className={`p-1 transition-colors cursor-pointer ${
                          entregaveis.length > 1 ? "text-certifica-500/30 hover:text-nao-conformidade" : "text-certifica-200 cursor-not-allowed"
                        }`}
                        disabled={entregaveis.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-certifica-200" />
              <DSTextarea label="Observações" placeholder="Condições especiais, restrições..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-3" style={{ fontWeight: 600 }}>
                  Cronograma
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DSInput label="Início previsto" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                  <DSInput label="Conclusão prevista" type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
                </div>
              </div>
              <div className="border-t border-certifica-200" />
              <div>
                <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-3" style={{ fontWeight: 600 }}>
                  Equipe
                </div>
                <DSSelect
                  label="Consultor principal"
                  value={consultorPrincipal}
                  onChange={(e) => {
                    setConsultorPrincipal(e.target.value);
                    if (e.target.value && !equipeSelecionada.includes(e.target.value)) {
                      setEquipeSelecionada([...equipeSelecionada, e.target.value]);
                    }
                  }}
                  options={[{ value: "", label: "Selecione..." }, ...consultores.map((c) => ({ value: c, label: c }))]}
                />
                <div className="mt-3">
                  <label className="text-[13px] text-certifica-dark block mb-1.5" style={{ fontWeight: 500 }}>
                    Membros da equipe
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {consultores.map((nome) => {
                      const isSelected = equipeSelecionada.includes(nome);
                      return (
                        <button
                          key={nome}
                          onClick={() => toggleEquipe(nome)}
                          className={`px-2.5 py-1 rounded-[3px] text-[11.5px] transition-colors cursor-pointer border ${
                            isSelected
                              ? "bg-certifica-accent/10 border-certifica-accent/30 text-certifica-accent"
                              : "bg-white border-certifica-200 text-certifica-500 hover:border-certifica-accent/30"
                          }`}
                          style={{ fontWeight: isSelected ? 500 : 400 }}
                        >
                          {nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="border-t border-certifica-200" />
              <div className="px-3 py-3 bg-certifica-50 border border-certifica-200 rounded-[3px]">
                <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
                  Resumo
                </div>
                <div className="space-y-1">
                  {[
                    { label: "Cliente", value: selectedClient?.nomeFantasia || "—" },
                    { label: "Projeto", value: titulo || "—" },
                    { label: "Norma", value: norma || "—" },
                    { label: "Valor", value: valor || "—" },
                    { label: "Entregáveis", value: `${entregaveis.filter((e) => e.trim()).length} itens` },
                    { label: "Equipe", value: equipeSelecionada.length > 0 ? equipeSelecionada.join(", ") : "—" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-[10.5px] text-certifica-500" style={{ fontWeight: 400 }}>
                        {item.label}
                      </span>
                      <span className="text-[10.5px] text-certifica-dark" style={{ fontWeight: 500 }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {wizardError && (
          <div className="px-5 pb-2">
            <div className="px-3 py-2 bg-nao-conformidade/6 border border-nao-conformidade/20 rounded-[3px] text-[11px] text-nao-conformidade" style={{ fontWeight: 500 }}>
              {wizardError}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-certifica-200 flex items-center justify-between bg-certifica-50/30 flex-shrink-0">
          <div>
            {step > 1 && (
              <DSButton variant="ghost" size="sm" onClick={() => setStep((step - 1) as 1 | 2 | 3)}>
                Voltar
              </DSButton>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DSButton variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </DSButton>
            {step < 3 ? (
              <DSButton variant="primary" size="sm" onClick={handleNext} icon={<ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Proximo
              </DSButton>
            ) : (
              <DSButton
                variant="primary"
                size="sm"
                disabled={saving}
                onClick={handleCreate}
                icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}
              >
                {saving ? "Salvando..." : "Criar Projeto"}
              </DSButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

