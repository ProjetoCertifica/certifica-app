import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DSButton } from "../components/ds/DSButton";
import { DSInput } from "../components/ds/DSInput";
import { usePipeline } from "../lib/usePipeline";
import { usePipelines } from "../lib/usePipelines";
import { toast } from "sonner";
import {
  Plus,
  X,
  GripVertical,
  Loader2,
  AlertTriangle,
  RefreshCw,
  List,
  Columns3,
  Trash2,
  Edit3,
  MoreVertical,
  Settings2,
} from "lucide-react";

/* ── Types ── */

type ViewMode = "kanban" | "lista";

const DND_TYPE = "PIPE_CARD";

const COLUMN_PALETTE = ["#2B8EAD", "#274C77", "#1F5E3B", "#8C6A1F", "#7A1E1E", "#0E2A47", "#6B7280"];

/* ══════════════════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════════════════ */

export default function PipelineCustomPage() {
  const { id: pipelineId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    pipelines,
    update: updatePipeline,
    remove: removePipeline,
  } = usePipelines();
  const {
    columns,
    loading,
    error,
    load,
    createColumn,
    updateColumn,
    createCard,
    moveCard,
    removeCard,
    removeColumn,
  } = usePipeline(pipelineId);

  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [showNewColumn, setShowNewColumn] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState(COLUMN_PALETTE[0]);
  const [editingPipeline, setEditingPipeline] = useState(false);
  const [pipelineName, setPipelineName] = useState("");

  useEffect(() => {
    if (pipeline) setPipelineName(pipeline.name);
  }, [pipeline?.name]);

  const handleCreateColumn = async () => {
    if (!newColName.trim()) return;
    await createColumn({
      title: newColName.trim(),
      position: columns.length,
      wip_limit: 0,
      color: newColColor,
      pipeline_id: pipelineId ?? null,
    });
    setNewColName("");
    setShowNewColumn(false);
    toast.success("Coluna criada!");
  };

  const handleMoveCard = useCallback(
    async (cardId: string, fromColId: string, toColId: string) => {
      if (fromColId === toColId) return;
      await moveCard(cardId, fromColId, toColId);
    },
    [moveCard]
  );

  const handleDeletePipeline = async () => {
    if (!confirm("Excluir este pipeline e todas as suas colunas/cards?")) return;
    await removePipeline(pipelineId!);
    navigate("/projetos");
    toast.success("Pipeline excluído.");
  };

  const handleRenamePipeline = async () => {
    if (!pipelineName.trim() || !pipelineId) return;
    await updatePipeline(pipelineId, { name: pipelineName.trim() });
    setEditingPipeline(false);
    toast.success("Pipeline renomeado!");
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-certifica-accent animate-spin" strokeWidth={1.5} />
          <span className="text-[12px] text-certifica-500">Carregando pipeline...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <AlertTriangle className="w-6 h-6 text-nao-conformidade" strokeWidth={1.5} />
          <span className="text-[12px] text-nao-conformidade" style={{ fontWeight: 500 }}>Erro ao carregar</span>
          <span className="text-[11px] text-certifica-500">{error}</span>
          <DSButton variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={load}>
            Tentar novamente
          </DSButton>
        </div>
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <AlertTriangle className="w-6 h-6 text-certifica-500" strokeWidth={1.5} />
          <span className="text-[12px] text-certifica-500">Pipeline não encontrado.</span>
          <DSButton variant="outline" size="sm" onClick={() => navigate("/projetos")}>
            Voltar para Projetos
          </DSButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3 border-b border-certifica-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {editingPipeline ? (
              <div className="flex items-center gap-2">
                <input
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRenamePipeline()}
                  className="h-8 px-2 border border-certifica-accent/50 rounded-[4px] text-[16px] text-certifica-900 focus:outline-none"
                  style={{ fontWeight: 700 }}
                  autoFocus
                />
                <button onClick={handleRenamePipeline} className="px-2 py-1 text-[11px] bg-certifica-accent text-white rounded-[4px] cursor-pointer" style={{ fontWeight: 600 }}>
                  Salvar
                </button>
                <button onClick={() => { setEditingPipeline(false); setPipelineName(pipeline.name); }} className="px-2 py-1 text-[11px] text-certifica-500 cursor-pointer">
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-certifica-900 text-[16px]" style={{ fontWeight: 700 }}>
                  {pipeline.name}
                </h2>
                <button
                  onClick={() => setEditingPipeline(true)}
                  className="p-1 text-certifica-500/30 hover:text-certifica-500 transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-certifica-100/60 rounded-[4px] p-0.5">
              {([
                { key: "kanban" as ViewMode, label: "Kanban", icon: Columns3 },
                { key: "lista" as ViewMode, label: "Lista", icon: List },
              ]).map((v) => {
                const isActive = viewMode === v.key;
                return (
                  <button
                    key={v.key}
                    onClick={() => setViewMode(v.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] transition-all duration-200 cursor-pointer ${
                      isActive ? "bg-white text-certifica-accent-dark shadow-sm" : "text-certifica-500 hover:text-certifica-dark"
                    }`}
                  >
                    <v.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                    <span className="text-[11px]" style={{ fontWeight: isActive ? 600 : 400 }}>{v.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              onClick={handleDeletePipeline}
              className="p-1.5 text-certifica-500/30 hover:text-nao-conformidade transition-colors cursor-pointer"
              title="Excluir pipeline"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        {pipeline.description && (
          <p className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>{pipeline.description}</p>
        )}
      </div>

      {/* ── Content ── */}
      {viewMode === "kanban" ? (
        <DndProvider backend={HTML5Backend}>
          <div className="flex-1 overflow-x-auto overflow-y-hidden px-5 py-4">
            <div className="flex gap-3 h-full min-w-min">
              {columns.map((col) => (
                <PipeColumn
                  key={col.id}
                  column={col}
                  onMoveCard={handleMoveCard}
                  onCreateCard={createCard}
                  onRemoveCard={removeCard}
                  onUpdateColumn={updateColumn}
                  onRemoveColumn={removeColumn}
                />
              ))}
              {/* Add column */}
              {showNewColumn ? (
                <div className="w-[280px] flex-shrink-0 bg-white border border-certifica-200 rounded-[6px] p-3 space-y-2">
                  <input
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateColumn()}
                    className="w-full h-8 px-2.5 border border-certifica-200 rounded-[4px] text-[12px] focus:outline-none focus:border-certifica-accent/50"
                    placeholder="Nome da coluna..."
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5">
                    {COLUMN_PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewColColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${newColColor === c ? "border-certifica-dark scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleCreateColumn} className="px-3 py-1 text-[11px] bg-certifica-accent text-white rounded-[4px] cursor-pointer" style={{ fontWeight: 600 }}>
                      Criar
                    </button>
                    <button onClick={() => setShowNewColumn(false)} className="px-3 py-1 text-[11px] text-certifica-500 cursor-pointer">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewColumn(true)}
                  className="w-[220px] flex-shrink-0 h-full min-h-[160px] border border-dashed border-certifica-300 rounded-[6px] bg-white/60 text-certifica-500 hover:text-certifica-dark hover:border-certifica-accent/40 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                  <span className="text-[12px]" style={{ fontWeight: 500 }}>Nova coluna</span>
                </button>
              )}
            </div>
          </div>
        </DndProvider>
      ) : (
        /* Lista view */
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {columns.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[12px] text-certifica-500">Nenhuma coluna criada. Troque para Kanban e crie suas colunas.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {columns.map((col) => (
                <div key={col.id} className="bg-white border border-certifica-200 rounded-[6px] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-certifica-200 flex items-center gap-2" style={{ borderLeft: `3px solid ${col.color}` }}>
                    <span className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>{col.title}</span>
                    <span className="text-[10px] text-certifica-500 bg-certifica-100 px-1.5 py-0.5 rounded-full" style={{ fontWeight: 500 }}>{col.cards.length}</span>
                  </div>
                  {col.cards.length === 0 ? (
                    <div className="px-4 py-4 text-[11px] text-certifica-500/50">Nenhum card nesta coluna.</div>
                  ) : (
                    <div className="divide-y divide-certifica-200/60">
                      {col.cards.map((card) => (
                        <div key={card.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-certifica-50/50 transition-colors">
                          <div>
                            <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 500 }}>{card.title}</span>
                            {card.assigned_to && (
                              <span className="text-[10px] text-certifica-500 ml-2">{card.assigned_to}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {card.due_date && (
                              <span className="text-[10px] text-certifica-500 font-mono">{new Date(card.due_date).toLocaleDateString("pt-BR")}</span>
                            )}
                            <button
                              onClick={() => removeCard(card.id, col.id)}
                              className="p-0.5 text-certifica-500/30 hover:text-nao-conformidade transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Kanban Column for custom pipeline
   ══════════════════════════════════════════════════════════ */

function PipeColumn({
  column: col,
  onMoveCard,
  onCreateCard,
  onRemoveCard,
  onUpdateColumn,
  onRemoveColumn,
}: {
  column: { id: string; title: string; color: string; wip_limit: number; cards: { id: string; title: string; assigned_to: string; column_id: string }[] };
  onMoveCard: (cardId: string, fromColId: string, toColId: string) => void;
  onCreateCard: (data: any) => void;
  onRemoveCard: (id: string, colId: string) => void;
  onUpdateColumn: (id: string, data: { title?: string; color?: string }) => void;
  onRemoveColumn: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: DND_TYPE,
      drop: (item: { id: string; fromColId: string }) => {
        onMoveCard(item.id, item.fromColId, col.id);
      },
      collect: (m) => ({ isOver: m.isOver() }),
    }),
    [col.id, onMoveCard]
  );
  drop(ref);

  const handleAddCard = async () => {
    if (!newCardTitle.trim()) return;
    await onCreateCard({
      column_id: col.id,
      title: newCardTitle.trim(),
      description: "",
      position: col.cards.length,
      assigned_to: "",
      due_date: null,
      tags: [],
      sla_days: 0,
    });
    setNewCardTitle("");
    setAddingCard(false);
  };

  return (
    <div
      ref={ref}
      className={`w-[280px] flex-shrink-0 rounded-[6px] border flex flex-col transition-colors ${
        isOver ? "border-certifica-accent/50 bg-certifica-accent/5" : "border-certifica-200 bg-certifica-50/70"
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-certifica-200 flex-shrink-0 bg-white rounded-t-[6px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
            <span className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>{col.title}</span>
            <span className="text-[9px] bg-certifica-100 text-certifica-700 px-1 py-0.5 rounded-full" style={{ fontWeight: 600 }}>{col.cards.length}</span>
          </div>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-0.5 text-certifica-500/30 hover:text-certifica-500 transition-colors cursor-pointer">
              <MoreVertical className="w-3 h-3" strokeWidth={1.5} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-32 bg-white border border-certifica-200 rounded-[4px] shadow-lg py-1">
                  <button
                    onClick={() => {
                      const name = prompt("Novo nome:", col.title);
                      if (name?.trim()) { onUpdateColumn(col.id, { title: name.trim() }); setShowMenu(false); }
                    }}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-certifica-dark hover:bg-certifica-50 cursor-pointer"
                  >
                    Renomear
                  </button>
                  <button
                    onClick={() => { onRemoveColumn(col.id); setShowMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {col.cards.length === 0 && !isOver && (
          <div className="py-6 text-center border border-dashed rounded-[3px] border-certifica-200">
            <p className="text-[11px] text-certifica-500/50">Arraste ou adicione um card</p>
          </div>
        )}
        {col.cards.map((card) => (
          <PipeCard key={card.id} card={card} colId={col.id} color={col.color} onRemove={onRemoveCard} />
        ))}
      </div>

      {/* Add card */}
      <div className="px-2.5 pb-2.5">
        {addingCard ? (
          <div className="space-y-1.5">
            <input
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddCard(); if (e.key === "Escape") setAddingCard(false); }}
              className="w-full h-8 px-2.5 border border-certifica-200 rounded-[4px] text-[12px] focus:outline-none focus:border-certifica-accent/50"
              placeholder="Título do card..."
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleAddCard} className="px-2.5 py-1 text-[11px] bg-certifica-accent text-white rounded-[4px] cursor-pointer" style={{ fontWeight: 600 }}>
                Adicionar
              </button>
              <button onClick={() => setAddingCard(false)} className="px-2.5 py-1 text-[11px] text-certifica-500 cursor-pointer">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingCard(true)}
            className="w-full h-8 border border-dashed border-certifica-200 rounded-[4px] text-[11px] text-certifica-500 hover:text-certifica-dark hover:border-certifica-300 transition-colors cursor-pointer flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" strokeWidth={1.5} />
            Novo card
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Draggable Card
   ══════════════════════════════════════════════════════════ */

function PipeCard({
  card,
  colId,
  color,
  onRemove,
}: {
  card: { id: string; title: string; assigned_to: string };
  colId: string;
  color: string;
  onRemove: (id: string, colId: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: DND_TYPE,
      item: { id: card.id, fromColId: colId },
      collect: (m) => ({ isDragging: m.isDragging() }),
    }),
    [card.id, colId]
  );
  drag(ref);

  return (
    <div
      ref={ref}
      className={`bg-white border border-certifica-200 rounded-[4px] transition-all cursor-grab active:cursor-grabbing hover:shadow-md group ${
        isDragging ? "opacity-30 scale-[0.97]" : ""
      }`}
    >
      <div className="h-[2px] rounded-t-[4px]" style={{ backgroundColor: color }} />
      <div className="px-2.5 py-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="w-3 h-3 text-certifica-200 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
          <div className="min-w-0">
            <span className="text-[12px] text-certifica-dark block truncate" style={{ fontWeight: 500 }}>{card.title}</span>
            {card.assigned_to && (
              <span className="text-[10px] text-certifica-500">{card.assigned_to}</span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(card.id, colId); }}
          className="p-0.5 text-certifica-500/20 hover:text-nao-conformidade transition-colors cursor-pointer opacity-0 group-hover:opacity-100 flex-shrink-0"
        >
          <Trash2 className="w-3 h-3" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
