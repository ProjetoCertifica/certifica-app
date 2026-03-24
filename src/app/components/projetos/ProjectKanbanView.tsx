import React, { useCallback, useRef, useState, useMemo } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  GripVertical,
  Clock,
  Users,
  Building2,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import {
  type ProjetoUI,
  faseColors,
  faseLabels,
  prioridadeConfig,
  parseBrDate,
  getProgressPercent,
  getDaysRemaining,
  getRiskPrazo,
  getRiskEscopo,
} from "../../lib/projetosShared";

/* ── Types ── */

interface ProjectKanbanViewProps {
  projetos: ProjetoUI[];
  onSelect: (id: string) => void;
  onMoveFase: (projetoId: string, newFase: number) => void;
}

interface FaseColumn {
  fase: number;
  label: string;
  color: string;
}

const DND_TYPE = "PROJECT_CARD";

const COLUMNS: FaseColumn[] = [
  { fase: 0, label: "Proposta", color: "#6B7280" },
  { fase: 1, label: "Planejamento", color: "#274C77" },
  { fase: 2, label: "Solução", color: "#2F5E8E" },
  { fase: 3, label: "Verificação", color: "#1F5E3B" },
  { fase: 4, label: "Acompanhamento", color: "#0E2A47" },
];

function riskSemaphore(p: ProjetoUI): { label: string; className: string } {
  const score = Math.max(getRiskPrazo(p), getRiskEscopo(p));
  if (score >= 70) return { label: "Alto", className: "bg-nao-conformidade/10 text-nao-conformidade" };
  if (score >= 50) return { label: "Médio", className: "bg-observacao/12 text-observacao" };
  return { label: "Baixo", className: "bg-certifica-100 text-certifica-500" };
}

function parseCurrency(v: string): number {
  return parseFloat(v.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
}

function formatCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ══════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════ */

export function ProjectKanbanView({ projetos, onSelect, onMoveFase }: ProjectKanbanViewProps) {
  const grouped = useMemo(() => {
    const map: Record<number, ProjetoUI[]> = {};
    COLUMNS.forEach((c) => (map[c.fase] = []));
    projetos.forEach((p) => {
      if (map[p.fase]) map[p.fase].push(p);
      else map[0].push(p); // fallback
    });
    return map;
  }, [projetos]);

  const handleDrop = useCallback(
    (projetoId: string, toFase: number) => {
      const projeto = projetos.find((p) => p.id === projetoId);
      if (!projeto || projeto.fase === toFase) return;
      onMoveFase(projetoId, toFase);
    },
    [projetos, onMoveFase]
  );

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-5 py-4 h-full">
        <div className="flex gap-3 h-full min-w-min">
          {COLUMNS.map((col) => {
            const cards = grouped[col.fase] || [];
            const colValor = cards.reduce((s, c) => s + parseCurrency(c.valor), 0);
            return (
              <KanbanColumn
                key={col.fase}
                column={col}
                cards={cards}
                colValor={colValor}
                onDrop={handleDrop}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      </div>
    </DndProvider>
  );
}

/* ══════════════════════════════════════════════════════════
   Column
   ══════════════════════════════════════════════════════════ */

function KanbanColumn({
  column,
  cards,
  colValor,
  onDrop,
  onSelect,
}: {
  column: FaseColumn;
  cards: ProjetoUI[];
  colValor: number;
  onDrop: (projetoId: string, toFase: number) => void;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: DND_TYPE,
      drop: (item: { id: string }) => {
        onDrop(item.id, column.fase);
      },
      collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
    }),
    [column.fase, onDrop]
  );

  drop(ref);

  return (
    <div
      ref={ref}
      className={`w-[292px] flex-shrink-0 rounded-[6px] border flex flex-col transition-colors ${
        isOver && canDrop
          ? "border-certifica-accent/50 bg-certifica-accent/5"
          : "border-certifica-200 bg-certifica-50/70"
      }`}
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-certifica-200 flex-shrink-0 bg-white rounded-t-[6px]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
            <span className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>
              {column.label}
            </span>
            <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full text-[9px] bg-certifica-100 text-certifica-700" style={{ fontWeight: 600 }}>
              {cards.length}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>
            Fase {column.fase}
          </span>
          <span className="text-[10px] text-certifica-500 font-mono" style={{ fontWeight: 500 }}>
            {formatCurrency(colValor)}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {cards.length === 0 && !isOver && (
          <div className="py-8 text-center border border-dashed rounded-[3px] border-certifica-200">
            <p className="text-[11px] text-certifica-500/50" style={{ fontWeight: 400 }}>
              Arraste um projeto aqui
            </p>
          </div>
        )}
        {cards.length === 0 && isOver && (
          <div className="py-6 text-center border-2 border-dashed border-certifica-accent/40 bg-certifica-accent/5 rounded-[4px]">
            <span className="text-[11px] text-certifica-accent/60" style={{ fontWeight: 500 }}>
              Soltar aqui
            </span>
          </div>
        )}
        {cards.map((p) => (
          <DraggableProjectCard key={p.id} projeto={p} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Card (draggable, rich style from old PipelinePage)
   ══════════════════════════════════════════════════════════ */

function DraggableProjectCard({
  projeto: p,
  onSelect,
}: {
  projeto: ProjetoUI;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: DND_TYPE,
      item: { id: p.id },
      collect: (m) => ({ isDragging: m.isDragging() }),
    }),
    [p.id]
  );

  drag(ref);

  const entC = p.entregaveis.filter((e) => e.concluido).length;
  const entT = p.entregaveis.length;
  const pct = entT > 0 ? Math.round((entC / entT) * 100) : 0;
  const days = getDaysRemaining(p);
  const isUrgent = days >= 0 && days <= 30;
  const isCritical = days >= 0 && days <= 14;
  const temp = riskSemaphore(p);
  const cardColor = faseColors[p.fase] || "#6B7280";

  return (
    <div
      ref={ref}
      onClick={() => onSelect(p.id)}
      className={`bg-white border border-certifica-200 rounded-[6px] transition-all cursor-pointer hover:bg-[#EBF5FA] hover:border-certifica-accent/40 hover:shadow-[0_2px_8px_rgba(14,42,71,0.08)] group ${
        isDragging ? "opacity-30 scale-[0.97] ring-2 ring-certifica-accent/30" : ""
      }`}
    >
      {/* Color strip */}
      <div className="h-1 rounded-t-[6px]" style={{ backgroundColor: cardColor }} />

      {/* Header: drag handle + codigo + temperatura */}
      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
        <div className="p-0.5 text-certifica-200 hover:text-certifica-500 cursor-grab active:cursor-grabbing flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3" strokeWidth={1.5} />
        </div>
        <span className="text-[10px] text-certifica-700 font-mono flex-1" style={{ fontWeight: 600 }}>
          {p.codigo}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[9px] ${temp.className}`}
          style={{ fontWeight: 600 }}
        >
          {temp.label}
        </span>
      </div>

      {/* Client + Title */}
      <div className="px-2.5 pb-1.5">
        <span className="text-[12px] text-certifica-dark block" style={{ fontWeight: 600, lineHeight: "1.4" }}>
          {p.clienteNome}
        </span>
        <span className="text-[10.5px] text-certifica-500 block mt-0.5" style={{ fontWeight: 400 }}>
          {p.titulo}
        </span>
      </div>

      {/* Norma + Consultor */}
      <div className="px-2.5 pb-2 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-certifica-500/30" strokeWidth={1.5} />
          <span className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>
            {p.consultor}
          </span>
        </div>
        <span className="text-[9px] text-certifica-500/30">&middot;</span>
        <span className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>
          {p.norma}
        </span>
      </div>

      {/* Progress bar */}
      {entT > 0 && (
        <div className="px-2.5 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-[3px] bg-certifica-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#1F5E3B" : "#2B8EAD" }}
              />
            </div>
            <span className="text-[9px] text-certifica-500 font-mono flex-shrink-0" style={{ fontWeight: 500 }}>
              {entC}/{entT}
            </span>
          </div>
        </div>
      )}

      {/* Footer: equipe + deadline */}
      <div className="px-2.5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3 h-3 text-certifica-500/30" strokeWidth={1.5} />
          <span className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>
            {p.equipe.length > 0 ? p.equipe[0] : "—"}
          </span>
        </div>
        {days >= 0 && days < 999 && (
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] ${
              isCritical
                ? "bg-nao-conformidade/8 text-nao-conformidade"
                : isUrgent
                ? "bg-observacao/8 text-observacao"
                : "bg-certifica-50 text-certifica-500"
            }`}
          >
            <Clock className="w-3 h-3" strokeWidth={1.5} />
            <span className="text-[9px] font-mono" style={{ fontWeight: 500 }}>
              {days}d
            </span>
          </div>
        )}
      </div>

      {/* Valor */}
      <div className="px-2.5 pb-2 border-t border-certifica-200/60 pt-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-certifica-500">Valor</span>
          <span className="text-[10px] text-certifica-500 font-mono" style={{ fontWeight: 600 }}>
            {p.valor || "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
