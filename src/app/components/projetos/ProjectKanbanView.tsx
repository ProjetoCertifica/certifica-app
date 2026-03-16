"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  Plus,
  MoreVertical,
  GripVertical,
  Clock,
  Target,
  Users,
  Building2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import {
  usePipeline,
  type ColumnWithCards,
  type PipelineCard,
} from "../../lib/usePipeline";
import {
  type ProjetoUI,
  faseColors,
  statusConfig,
  prioridadeConfig,
  getProgressPercent,
  getDaysRemaining,
} from "../../lib/projetosShared";
import { DSButton } from "../ds/DSButton";

/* ── Types ─────────────────────────────────────────────── */

interface ProjectKanbanViewProps {
  pipelineId: string | null;
  projetos: ProjetoUI[];
  onSelectProject: (id: string) => void;
}

interface DragItem {
  type: "KANBAN_CARD";
  cardId: string;
  columnId: string;
}

const ITEM_TYPE = "KANBAN_CARD";

/* ── DraggableCard ─────────────────────────────────────── */

interface DraggableCardProps {
  card: PipelineCard;
  columnId: string;
  projeto: ProjetoUI | null;
  onClick: () => void;
}

function DraggableCard({ card, columnId, projeto, onClick }: DraggableCardProps) {
  const [{ isDragging }, dragRef, previewRef] = useDrag<DragItem, void, { isDragging: boolean }>({
    type: ITEM_TYPE,
    item: { type: ITEM_TYPE, cardId: card.id, columnId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const progress = projeto ? getProgressPercent(projeto) : 0;
  const daysLeft = projeto ? getDaysRemaining(projeto) : null;
  const prioridadeCfg = projeto ? prioridadeConfig[projeto.prioridade] : null;
  const faseCor = projeto ? faseColors[projeto.fase] ?? "#6B7280" : null;

  const initials = card.assigned_to
    ? card.assigned_to
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  const daysColor =
    daysLeft !== null && daysLeft !== 999
      ? daysLeft < 0
        ? "text-nao-conformidade"
        : daysLeft <= 7
          ? "text-nao-conformidade"
          : daysLeft <= 15
            ? "text-observacao"
            : "text-certifica-500"
      : "";

  return (
    <div
      ref={previewRef as unknown as React.Ref<HTMLDivElement>}
      className={`group relative bg-white border border-certifica-200 rounded-[4px] p-3 shadow-sm
        hover:shadow-md transition-shadow duration-150 cursor-pointer select-none
        ${isDragging ? "opacity-50" : "opacity-100"}`}
      onClick={onClick}
    >
      {/* Drag handle */}
      <div
        ref={dragRef as unknown as React.Ref<HTMLDivElement>}
        className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity
          cursor-grab active:cursor-grabbing text-certifica-400 hover:text-certifica-600"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical size={14} strokeWidth={2} />
      </div>

      {/* Title */}
      <p
        className="text-[13px] font-medium text-certifica-dark leading-[1.35] pr-5
          line-clamp-2"
      >
        {card.title}
      </p>

      {/* Badges: prioridade + fase */}
      {projeto && (
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {prioridadeCfg && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-certifica-500">
              <span
                className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                style={{ backgroundColor: prioridadeCfg.color }}
              />
              {prioridadeCfg.label}
            </span>
          )}
          {faseCor && (
            <span
              className="text-[10px] font-medium px-1.5 py-[1px] rounded-[3px] text-white"
              style={{ backgroundColor: faseCor }}
            >
              {projeto.faseLabel}
            </span>
          )}
        </div>
      )}

      {/* Client name */}
      {projeto?.clienteNome && (
        <div className="flex items-center gap-1 mt-1.5 text-[11px] text-certifica-400">
          <Building2 size={11} strokeWidth={1.8} />
          <span className="truncate">{projeto.clienteNome}</span>
        </div>
      )}

      {/* Progress bar */}
      {projeto && projeto.entregaveis.length > 0 && (
        <div className="mt-2">
          <div className="w-full h-[3px] bg-certifica-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                backgroundColor: progress === 100 ? "#1F5E3B" : "#274C77",
              }}
            />
          </div>
          <p className="text-[10px] text-certifica-400 mt-0.5 text-right">
            {progress}%
          </p>
        </div>
      )}

      {/* Footer row: days remaining + avatar */}
      <div className="flex items-center justify-between mt-1.5">
        {daysLeft !== null && daysLeft !== 999 ? (
          <span className={`flex items-center gap-1 text-[10px] font-medium ${daysColor}`}>
            {daysLeft < 0 && <AlertTriangle size={10} strokeWidth={2} />}
            {daysLeft < 0 && <Clock size={10} strokeWidth={2} />}
            {daysLeft >= 0 && <Clock size={10} strokeWidth={2} />}
            {daysLeft < 0 ? `${Math.abs(daysLeft)}d atrasado` : `${daysLeft}d restantes`}
          </span>
        ) : card.due_date ? (
          <span className="flex items-center gap-1 text-[10px] text-certifica-400">
            <Clock size={10} strokeWidth={2} />
            {new Date(card.due_date).toLocaleDateString("pt-BR")}
          </span>
        ) : (
          <span />
        )}

        {initials && (
          <span
            className="w-[22px] h-[22px] rounded-full bg-certifica-accent/10 text-certifica-accent
              text-[9px] font-semibold flex items-center justify-center flex-shrink-0"
          >
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── DroppableColumn ───────────────────────────────────── */

interface DroppableColumnProps {
  column: ColumnWithCards;
  projetos: ProjetoUI[];
  onSelectProject: (id: string) => void;
  onMoveCard: (cardId: string, fromColumnId: string, toColumnId: string) => void;
  onAddCard: (columnId: string) => void;
}

function DroppableColumn({
  column,
  projetos,
  onSelectProject,
  onMoveCard,
  onAddCard,
}: DroppableColumnProps) {
  const [{ isOver, canDrop }, dropRef] = useDrop<DragItem, void, { isOver: boolean; canDrop: boolean }>({
    accept: ITEM_TYPE,
    drop: (item) => {
      if (item.columnId !== column.id) {
        onMoveCard(item.cardId, item.columnId, column.id);
      }
    },
    canDrop: (item) => item.columnId !== column.id,
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const isWipExceeded = column.wip_limit > 0 && column.cards.length >= column.wip_limit;
  const activeDropTarget = isOver && canDrop;

  const findProjeto = useCallback(
    (card: PipelineCard): ProjetoUI | null => {
      if (card.projeto_id) {
        const match = projetos.find((p) => p.id === card.projeto_id);
        if (match) return match;
      }
      const titleMatch = projetos.find(
        (p) => p.titulo.toLowerCase() === card.title.toLowerCase()
      );
      return titleMatch ?? null;
    },
    [projetos]
  );

  const handleCardClick = useCallback(
    (card: PipelineCard) => {
      const projeto = findProjeto(card);
      if (projeto) {
        onSelectProject(projeto.id);
      }
    },
    [findProjeto, onSelectProject]
  );

  return (
    <div
      ref={dropRef as unknown as React.Ref<HTMLDivElement>}
      className={`flex-shrink-0 w-[280px] flex flex-col bg-white border border-certifica-200
        rounded-[6px] transition-all duration-200
        ${activeDropTarget ? "ring-2 ring-certifica-accent/40 border-certifica-accent/30" : ""}`}
    >
      {/* Column color strip */}
      <div
        className="w-full h-[3px] rounded-t-[6px]"
        style={{ backgroundColor: column.color || "#274C77" }}
      />

      {/* Column header */}
      <div className="px-3 pt-2.5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-[13px] font-semibold text-certifica-dark truncate">
            {column.title}
          </h3>
          <span
            className={`text-[11px] font-medium px-1.5 py-[1px] rounded-full
              ${isWipExceeded
                ? "bg-nao-conformidade/10 text-nao-conformidade"
                : "bg-certifica-100 text-certifica-500"
              }`}
          >
            {column.cards.length}
            {column.wip_limit > 0 && `/${column.wip_limit}`}
          </span>
        </div>
        <button
          className="text-certifica-400 hover:text-certifica-600 transition-colors p-0.5 rounded
            hover:bg-certifica-50"
          aria-label="Opcoes da coluna"
        >
          <MoreVertical size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Cards area */}
      <div className="flex-1 px-2 pb-2 flex flex-col gap-2 min-h-[120px] overflow-y-auto">
        {column.cards.length === 0 ? (
          <div
            className={`flex-1 flex items-center justify-center text-[12px] text-certifica-400
              border border-dashed border-certifica-200 rounded-[4px] m-1 min-h-[80px]
              ${activeDropTarget ? "border-certifica-accent/40 bg-certifica-accent/5" : ""}`}
          >
            Arraste um card para ca
          </div>
        ) : (
          column.cards.map((card) => (
            <DraggableCard
              key={card.id}
              card={card}
              columnId={column.id}
              projeto={findProjeto(card)}
              onClick={() => handleCardClick(card)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-2 pb-2">
        <button
          onClick={() => onAddCard(column.id)}
          className="w-full flex items-center justify-center gap-1.5 text-[12px] text-certifica-400
            hover:text-certifica-accent hover:bg-certifica-50 rounded-[4px] py-1.5
            transition-colors duration-150"
        >
          <Plus size={13} strokeWidth={2} />
          Adicionar
        </button>
      </div>
    </div>
  );
}

/* ── ProjectKanbanView (main) ──────────────────────────── */

export function ProjectKanbanView({
  pipelineId,
  projetos,
  onSelectProject,
}: ProjectKanbanViewProps) {
  const {
    columns,
    loading,
    error,
    moveCard,
    createCard,
  } = usePipeline(pipelineId);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [addingCardColumn, setAddingCardColumn] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Card move handler ── */
  const handleMoveCard = useCallback(
    async (cardId: string, fromColumnId: string, toColumnId: string) => {
      const ok = await moveCard(cardId, fromColumnId, toColumnId);
      if (ok) {
        toast.success("Card movido com sucesso");
      } else {
        toast.error("Erro ao mover card");
      }
    },
    [moveCard]
  );

  /* ── Add card handler ── */
  const handleAddCardStart = useCallback((columnId: string) => {
    setAddingCardColumn(columnId);
    setNewCardTitle("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleAddCardConfirm = useCallback(
    async (columnId: string) => {
      const title = newCardTitle.trim();
      if (!title) {
        setAddingCardColumn(null);
        return;
      }

      const col = columns.find((c) => c.id === columnId);
      const position = col ? col.cards.length : 0;

      const card = await createCard({
        column_id: columnId,
        title,
        description: "",
        position,
        assigned_to: "",
        due_date: null,
        tags: [],
        sla_days: 0,
        projeto_id: null,
      });

      if (card) {
        toast.success("Card criado");
      } else {
        toast.error("Erro ao criar card");
      }

      setAddingCardColumn(null);
      setNewCardTitle("");
    },
    [newCardTitle, columns, createCard]
  );

  const handleAddCardKeyDown = useCallback(
    (e: React.KeyboardEvent, columnId: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleAddCardConfirm(columnId);
      } else if (e.key === "Escape") {
        setAddingCardColumn(null);
        setNewCardTitle("");
      }
    },
    [handleAddCardConfirm]
  );

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-certifica-400">
          <div className="w-5 h-5 border-2 border-certifica-300 border-t-certifica-accent rounded-full animate-spin" />
          <span className="text-[13px]">Carregando pipeline...</span>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2 text-center">
          <AlertTriangle size={24} className="text-nao-conformidade" strokeWidth={1.8} />
          <p className="text-[13px] text-certifica-dark font-medium">Erro ao carregar pipeline</p>
          <p className="text-[12px] text-certifica-400">{error}</p>
        </div>
      </div>
    );
  }

  /* ── No pipeline selected ── */
  if (!pipelineId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2 text-center">
          <Target size={24} className="text-certifica-400" strokeWidth={1.8} />
          <p className="text-[13px] text-certifica-dark font-medium">
            Selecione um pipeline para visualizar o Kanban
          </p>
        </div>
      </div>
    );
  }

  /* ── Empty pipeline ── */
  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3 text-center">
          <Target size={24} className="text-certifica-400" strokeWidth={1.8} />
          <p className="text-[13px] text-certifica-dark font-medium">
            Pipeline sem colunas
          </p>
          <p className="text-[12px] text-certifica-400">
            Adicione colunas ao pipeline para comecar a organizar seus projetos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto pb-4 scroll-smooth"
        style={{ minHeight: "calc(100vh - 280px)" }}
      >
        {columns.map((column) => (
          <div key={column.id} className="flex flex-col flex-shrink-0 w-[280px]">
            <DroppableColumn
              column={column}
              projetos={projetos}
              onSelectProject={onSelectProject}
              onMoveCard={handleMoveCard}
              onAddCard={handleAddCardStart}
            />

            {/* Inline add-card input */}
            {addingCardColumn === column.id && (
              <div className="mt-2 px-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  onKeyDown={(e) => handleAddCardKeyDown(e, column.id)}
                  onBlur={() => handleAddCardConfirm(column.id)}
                  placeholder="Titulo do card..."
                  className="w-full text-[12px] px-2.5 py-2 border border-certifica-300
                    rounded-[4px] outline-none focus:ring-2 focus:ring-certifica-accent/30
                    focus:border-certifica-accent/50 text-certifica-dark
                    placeholder:text-certifica-300"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </DndProvider>
  );
}

// named export only
