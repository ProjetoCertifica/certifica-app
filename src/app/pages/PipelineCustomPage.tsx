import React, { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DSButton } from "../components/ds/DSButton";
import { DSInput } from "../components/ds/DSInput";
import { DSTextarea } from "../components/ds/DSTextarea";
import { DSSelect } from "../components/ds/DSSelect";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
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
  Trash2,
  Edit3,
  MoreVertical,
  DollarSign,
  Calendar,
  User,
  Tag,
  Clock,
  Target,
  List,
  Columns3,
  GanttChart,
  Filter,
} from "lucide-react";
import { PipelineListView } from "../components/projetos/PipelineListView";
import { PipelineGanttView } from "../components/projetos/PipelineGanttView";
import { PipelineFunnelView } from "../components/projetos/PipelineFunnelView";

type PipelineViewMode = "lista" | "kanban" | "gantt" | "funil";

const pipelineViewConfig: { key: PipelineViewMode; label: string; icon: React.ElementType }[] = [
  { key: "lista", label: "Lista", icon: List },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "gantt", label: "Gantt", icon: GanttChart },
  { key: "funil", label: "Funil", icon: Filter },
];

const DND_TYPE = "PIPE_CARD";
const COLUMN_PALETTE = ["#2B8EAD", "#274C77", "#1F5E3B", "#8C6A1F", "#7A1E1E", "#0E2A47", "#6B7280"];

function parseCurrency(v: string): number {
  return parseFloat(v.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
}
function formatCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ── Card description JSON helpers ── */
interface CardData {
  descricao?: string;
  valor?: string;
  prioridade?: "alta" | "media" | "baixa";
  responsavel?: string;
  prazo?: string;
}

function parseCardData(desc: string): CardData {
  try { const p = JSON.parse(desc); return typeof p === "object" && p ? p : { descricao: desc }; }
  catch { return { descricao: desc || "" }; }
}
function serializeCardData(data: CardData): string {
  return JSON.stringify(data);
}

/* ══════════════════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════════════════ */

export default function PipelineCustomPage() {
  const { id: pipelineId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { pipelines, update: updatePipeline, remove: removePipeline } = usePipelines();
  const { columns, loading, error, load, createColumn, updateColumn, createCard, moveCard, removeCard, removeColumn } = usePipeline(pipelineId);

  const pipeline = pipelines.find((p) => p.id === pipelineId);

  /* ── State ── */
  const [viewMode, setViewMode] = useState<PipelineViewMode>(() => {
    const saved = localStorage.getItem(`certifica_pipeline_view_${pipelineId}`);
    return (saved as PipelineViewMode) || "kanban";
  });

  const handleViewChange = useCallback((mode: PipelineViewMode) => {
    setViewMode(mode);
    if (pipelineId) localStorage.setItem(`certifica_pipeline_view_${pipelineId}`, mode);
  }, [pipelineId]);

  const [showNewColumn, setShowNewColumn] = useState(false);
  const [showNewCard, setShowNewCard] = useState<string | null>(null); // column id
  const [showEditColumn, setShowEditColumn] = useState<string | null>(null);
  const [showRename, setShowRename] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // New column form
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState(COLUMN_PALETTE[0]);
  const [newColWip, setNewColWip] = useState("0");

  // Edit column form
  const [editColName, setEditColName] = useState("");
  const [editColColor, setEditColColor] = useState("");
  const [editColWip, setEditColWip] = useState("0");

  // New card form
  const [cardTitle, setCardTitle] = useState("");
  const [cardDesc, setCardDesc] = useState("");
  const [cardValor, setCardValor] = useState("");
  const [cardPrioridade, setCardPrioridade] = useState("media");
  const [cardResponsavel, setCardResponsavel] = useState("");
  const [cardPrazo, setCardPrazo] = useState("");
  const [cardTags, setCardTags] = useState("");

  // Rename form
  const [renameName, setRenameName] = useState("");

  const handleMoveCard = useCallback(
    async (cardId: string, fromColId: string, toColId: string) => {
      if (fromColId === toColId) return;
      await moveCard(cardId, fromColId, toColId);
    },
    [moveCard]
  );

  const handleCreateColumn = async () => {
    if (!newColName.trim()) return;
    await createColumn({
      title: newColName.trim(),
      position: columns.length,
      wip_limit: Number(newColWip) || 0,
      color: newColColor,
      pipeline_id: pipelineId ?? null,
    });
    setNewColName(""); setNewColWip("0"); setNewColColor(COLUMN_PALETTE[0]);
    setShowNewColumn(false);
    toast.success("Coluna criada!");
  };

  const handleEditColumn = async () => {
    if (!showEditColumn || !editColName.trim()) return;
    await updateColumn(showEditColumn, { title: editColName.trim(), color: editColColor, wip_limit: Number(editColWip) || 0 });
    setShowEditColumn(null);
    toast.success("Coluna atualizada!");
  };

  const handleCreateCard = async () => {
    if (!showNewCard || !cardTitle.trim()) return;
    const data: CardData = {
      descricao: cardDesc.trim(),
      valor: cardValor.trim(),
      prioridade: cardPrioridade as CardData["prioridade"],
      responsavel: cardResponsavel.trim(),
      prazo: cardPrazo,
    };
    await createCard({
      column_id: showNewCard,
      title: cardTitle.trim(),
      description: serializeCardData(data),
      position: columns.find((c) => c.id === showNewCard)?.cards.length ?? 0,
      assigned_to: cardResponsavel.trim(),
      due_date: cardPrazo || null,
      tags: cardTags ? cardTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      sla_days: 0,
    });
    resetCardForm();
    setShowNewCard(null);
    toast.success("Card criado!");
  };

  const resetCardForm = () => {
    setCardTitle(""); setCardDesc(""); setCardValor(""); setCardPrioridade("media");
    setCardResponsavel(""); setCardPrazo(""); setCardTags("");
  };

  const openEditColumn = (colId: string) => {
    const col = columns.find((c) => c.id === colId);
    if (!col) return;
    setEditColName(col.title);
    setEditColColor(col.color);
    setEditColWip(String(col.wip_limit));
    setShowEditColumn(colId);
  };

  /* ── Loading/Error ── */
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
          <DSButton variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={load}>Tentar novamente</DSButton>
        </div>
      </div>
    );
  }
  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-[12px] text-certifica-500">Pipeline não encontrado.</span>
          <DSButton variant="outline" size="sm" onClick={() => navigate("/projetos")}>Voltar</DSButton>
        </div>
      </div>
    );
  }

  // Find selected card across columns
  const selectedCard = selectedCardId
    ? columns.flatMap((c) => c.cards).find((c) => c.id === selectedCardId)
    : null;
  const selectedCardCol = selectedCard
    ? columns.find((c) => c.cards.some((cd) => cd.id === selectedCard.id))
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3 border-b border-certifica-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-certifica-900 text-[16px]" style={{ fontWeight: 700 }}>{pipeline.name}</h2>
            <button onClick={() => { setRenameName(pipeline.name); setShowRename(true); }} className="p-1 text-certifica-500/30 hover:text-certifica-500 transition-colors cursor-pointer">
              <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-certifica-500">
              {columns.length} colunas &middot; {columns.reduce((s, c) => s + c.cards.length, 0)} cards
            </span>
            <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 text-certifica-500/30 hover:text-nao-conformidade transition-colors cursor-pointer" title="Excluir pipeline">
              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        {pipeline.description && <p className="text-[11px] text-certifica-500 mt-0.5">{pipeline.description}</p>}

        {/* ── View Mode Tabs ── */}
        <div className="flex items-center bg-certifica-100/60 rounded-[4px] p-0.5 mt-3 w-fit">
          {pipelineViewConfig.map((v) => {
            const Icon = v.icon;
            const isActive = viewMode === v.key;
            return (
              <button
                key={v.key}
                onClick={() => handleViewChange(v.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[3px] transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-white text-certifica-accent-dark shadow-sm"
                    : "text-certifica-500 hover:text-certifica-dark"
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="text-[11px]" style={{ fontWeight: isActive ? 600 : 400 }}>{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── View Content ── */}
      {viewMode === "kanban" && (
      <DndProvider backend={HTML5Backend}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden px-5 py-4">
          <div className="flex gap-3 h-full min-w-min">
            {columns.map((col) => {
              const colValor = col.cards.reduce((s, c) => s + parseCurrency(parseCardData(c.description).valor || "0"), 0);
              return (
                <KanbanCol
                  key={col.id}
                  col={col}
                  colValor={colValor}
                  onMoveCard={handleMoveCard}
                  onAddCard={() => { resetCardForm(); setShowNewCard(col.id); }}
                  onEditColumn={() => openEditColumn(col.id)}
                  onRemoveColumn={() => removeColumn(col.id)}
                  onRemoveCard={removeCard}
                  onSelectCard={setSelectedCardId}
                />
              );
            })}
            <button
              onClick={() => { setNewColName(""); setNewColColor(COLUMN_PALETTE[0]); setNewColWip("0"); setShowNewColumn(true); }}
              className="w-[220px] flex-shrink-0 h-full min-h-[160px] border border-dashed border-certifica-300 rounded-[6px] bg-white/60 text-certifica-500 hover:text-certifica-dark hover:border-certifica-accent/40 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" strokeWidth={1.5} />
              <span className="text-[12px]" style={{ fontWeight: 500 }}>Nova coluna</span>
            </button>
          </div>
        </div>
      </DndProvider>
      )}

      {viewMode === "lista" && (
        <div className="flex-1 overflow-auto px-5 py-4">
          <PipelineListView cols={columns} onSelectCard={setSelectedCardId} onAddCard={(colId) => { resetCardForm(); setShowNewCard(colId); }} />
        </div>
      )}

      {viewMode === "gantt" && (
        <div className="flex-1 overflow-auto px-5 py-4">
          <PipelineGanttView cols={columns} onSelectCard={setSelectedCardId} />
        </div>
      )}

      {viewMode === "funil" && (
        <div className="flex-1 overflow-auto px-5 py-4">
          <PipelineFunnelView cols={columns} onSelectCard={setSelectedCardId} />
        </div>
      )}

      {/* ═══ MODALS ═══ */}

      {/* New Column Modal */}
      {showNewColumn && (
        <Modal title="Nova coluna" onClose={() => setShowNewColumn(false)}>
          <div className="space-y-3">
            <DSInput label="Nome da coluna" placeholder="Ex: Em progresso, Concluído..." value={newColName} onChange={(e) => setNewColName(e.target.value)} />
            <div>
              <label className="text-[11px] text-certifica-500 block mb-1.5" style={{ fontWeight: 600 }}>Cor</label>
              <div className="flex items-center gap-2">
                {COLUMN_PALETTE.map((c) => (
                  <button key={c} onClick={() => setNewColColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${newColColor === c ? "border-certifica-dark scale-110 shadow-md" : "border-white shadow-sm"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <DSInput label="Limite WIP (0 = sem limite)" type="number" value={newColWip} onChange={(e) => setNewColWip(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <DSButton variant="ghost" size="sm" onClick={() => setShowNewColumn(false)}>Cancelar</DSButton>
            <DSButton variant="primary" size="sm" disabled={!newColName.trim()} onClick={handleCreateColumn} icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}>Criar coluna</DSButton>
          </div>
        </Modal>
      )}

      {/* Edit Column Modal */}
      {showEditColumn && (
        <Modal title="Editar coluna" onClose={() => setShowEditColumn(null)}>
          <div className="space-y-3">
            <DSInput label="Nome" value={editColName} onChange={(e) => setEditColName(e.target.value)} />
            <div>
              <label className="text-[11px] text-certifica-500 block mb-1.5" style={{ fontWeight: 600 }}>Cor</label>
              <div className="flex items-center gap-2">
                {COLUMN_PALETTE.map((c) => (
                  <button key={c} onClick={() => setEditColColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${editColColor === c ? "border-certifica-dark scale-110 shadow-md" : "border-white shadow-sm"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <DSInput label="Limite WIP (0 = sem limite)" type="number" value={editColWip} onChange={(e) => setEditColWip(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <DSButton variant="ghost" size="sm" onClick={() => setShowEditColumn(null)}>Cancelar</DSButton>
            <DSButton variant="primary" size="sm" onClick={handleEditColumn}>Salvar</DSButton>
          </div>
        </Modal>
      )}

      {/* New Card Modal */}
      {showNewCard && (
        <Modal title="Novo card" onClose={() => setShowNewCard(null)} width={520}>
          <div className="space-y-3">
            <DSInput label="Título" placeholder="O que precisa ser feito?" value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} />
            <DSTextarea label="Descrição" placeholder="Detalhes, contexto, observações..." value={cardDesc} onChange={(e) => setCardDesc(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <DSInput label="Valor (R$)" placeholder="R$ 0,00" value={cardValor} onChange={(e) => setCardValor(e.target.value)} icon={<DollarSign className="w-3.5 h-3.5" strokeWidth={1.5} />} />
              <DSSelect label="Prioridade" value={cardPrioridade} onChange={(e) => setCardPrioridade(e.target.value)} options={[
                { value: "baixa", label: "Baixa" },
                { value: "media", label: "Média" },
                { value: "alta", label: "Alta" },
              ]} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DSInput label="Responsável" placeholder="Nome..." value={cardResponsavel} onChange={(e) => setCardResponsavel(e.target.value)} />
              <DSInput label="Prazo" type="date" value={cardPrazo} onChange={(e) => setCardPrazo(e.target.value)} />
            </div>
            <DSInput label="Tags (separadas por vírgula)" placeholder="vendas, urgente, follow-up..." value={cardTags} onChange={(e) => setCardTags(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <DSButton variant="ghost" size="sm" onClick={() => setShowNewCard(null)}>Cancelar</DSButton>
            <DSButton variant="primary" size="sm" disabled={!cardTitle.trim()} onClick={handleCreateCard} icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}>Criar card</DSButton>
          </div>
        </Modal>
      )}

      {/* Rename Pipeline Modal */}
      {showRename && (
        <Modal title="Renomear pipeline" onClose={() => setShowRename(false)} width={400}>
          <DSInput label="Nome do pipeline" value={renameName} onChange={(e) => setRenameName(e.target.value)} />
          <div className="flex justify-end gap-2 mt-4">
            <DSButton variant="ghost" size="sm" onClick={() => setShowRename(false)}>Cancelar</DSButton>
            <DSButton variant="primary" size="sm" disabled={!renameName.trim()} onClick={async () => {
              await updatePipeline(pipelineId!, { name: renameName.trim() });
              setShowRename(false);
              toast.success("Pipeline renomeado!");
            }}>Salvar</DSButton>
          </div>
        </Modal>
      )}

      {/* Delete Pipeline Confirm */}
      {showDeleteConfirm && (
        <Modal title="Excluir pipeline" onClose={() => setShowDeleteConfirm(false)} width={400}>
          <p className="text-[12px] text-certifica-500 leading-relaxed">
            Tem certeza que deseja excluir <strong className="text-certifica-dark">{pipeline.name}</strong>?
            Todas as colunas e cards serão removidos permanentemente.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <DSButton variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancelar</DSButton>
            <DSButton variant="primary" size="sm" className="!bg-nao-conformidade hover:!bg-nao-conformidade/90" onClick={async () => {
              await removePipeline(pipelineId!);
              navigate("/projetos");
              toast.success("Pipeline excluído.");
            }}>Excluir pipeline</DSButton>
          </div>
        </Modal>
      )}

      {/* Card Detail Slide-over */}
      {selectedCard && selectedCardCol && (
        <CardDetailPanel
          card={selectedCard}
          colTitle={selectedCardCol.title}
          colColor={selectedCardCol.color}
          onClose={() => setSelectedCardId(null)}
          onRemove={() => { removeCard(selectedCard.id, selectedCardCol.id); setSelectedCardId(null); }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Reusable Modal
   ══════════════════════════════════════════════════════════ */

function Modal({ title, onClose, children, width = 480 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  useBodyScrollLock(true);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: "certifica-fade-in 150ms ease-out" }}>
      <div className="absolute inset-0 bg-certifica-dark/40 certifica-modal-backdrop" onClick={onClose} />
      <div className="relative bg-white rounded-[6px] border border-certifica-200 shadow-xl flex flex-col max-h-[85vh] certifica-modal-content" style={{ width, animation: "certifica-scale-in 200ms cubic-bezier(.22,1,.36,1)" }}>
        <div className="px-5 py-3.5 border-b border-certifica-200 flex items-center justify-between flex-shrink-0">
          <span className="text-[14px] text-certifica-900" style={{ fontWeight: 600 }}>{title}</span>
          <button onClick={onClose} className="p-1 text-certifica-500/40 hover:text-certifica-dark transition-colors cursor-pointer">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
      </div>
      <style>{`
        @keyframes certifica-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes certifica-scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Kanban Column
   ══════════════════════════════════════════════════════════ */

function KanbanCol({
  col,
  colValor,
  onMoveCard,
  onAddCard,
  onEditColumn,
  onRemoveColumn,
  onRemoveCard,
  onSelectCard,
}: {
  col: { id: string; title: string; color: string; wip_limit: number; cards: any[] };
  colValor: number;
  onMoveCard: (cardId: string, fromColId: string, toColId: string) => void;
  onAddCard: () => void;
  onEditColumn: () => void;
  onRemoveColumn: () => void;
  onRemoveCard: (id: string, colId: string) => void;
  onSelectCard: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  const overWip = col.wip_limit > 0 && col.cards.length > col.wip_limit;

  const [{ isOver, canDrop }, drop] = useDrop(
    () => ({
      accept: DND_TYPE,
      drop: (item: { id: string; fromColId: string }) => onMoveCard(item.id, item.fromColId, col.id),
      collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
    }),
    [col.id, onMoveCard]
  );
  drop(ref);

  return (
    <div ref={ref} className={`w-[292px] flex-shrink-0 rounded-[6px] border flex flex-col transition-colors ${
      isOver && canDrop ? "border-certifica-accent/50 bg-certifica-accent/5" : "border-certifica-200 bg-certifica-50/70"
    }`}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-certifica-200 flex-shrink-0 bg-white rounded-t-[6px]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
            <span className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>{col.title}</span>
            <span className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full text-[9px] ${
              overWip ? "bg-nao-conformidade/10 text-nao-conformidade" : "bg-certifica-100 text-certifica-700"
            }`} style={{ fontWeight: 600 }}>{col.cards.length}</span>
            {col.wip_limit > 0 && (
              <span className={`text-[9px] ${overWip ? "text-nao-conformidade" : "text-certifica-500/40"}`}>/{col.wip_limit}</span>
            )}
          </div>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-0.5 text-certifica-500/30 hover:text-certifica-500 transition-colors cursor-pointer">
              <MoreVertical className="w-3 h-3" strokeWidth={1.5} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-36 bg-white border border-certifica-200 rounded-[4px] shadow-lg py-1">
                  <button onClick={() => { onEditColumn(); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-[11px] text-certifica-dark hover:bg-certifica-50 cursor-pointer flex items-center gap-2">
                    <Edit3 className="w-3 h-3" strokeWidth={1.5} /> Editar coluna
                  </button>
                  <button onClick={() => { onRemoveColumn(); setShowMenu(false); }} className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 cursor-pointer flex items-center gap-2">
                    <Trash2 className="w-3 h-3" strokeWidth={1.5} /> Excluir
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {colValor > 0 && (
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-certifica-500/40" strokeWidth={1.5} />
            <span className="text-[10px] text-certifica-500 font-mono" style={{ fontWeight: 500 }}>{formatCurrency(colValor)}</span>
          </div>
        )}
        {overWip && (
          <div className="mt-1.5 flex items-center gap-1 px-2 py-1 bg-nao-conformidade/5 border border-nao-conformidade/15 rounded-[2px]">
            <AlertTriangle className="w-3 h-3 text-nao-conformidade/60" strokeWidth={1.5} />
            <span className="text-[9px] text-nao-conformidade" style={{ fontWeight: 500 }}>WIP excedido</span>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {col.cards.length === 0 && !isOver && (
          <div className="py-6 text-center border border-dashed rounded-[3px] border-certifica-200">
            <p className="text-[11px] text-certifica-500/50">Arraste ou adicione um card</p>
          </div>
        )}
        {col.cards.length === 0 && isOver && (
          <div className="py-6 text-center border-2 border-dashed border-certifica-accent/40 bg-certifica-accent/5 rounded-[4px]">
            <span className="text-[11px] text-certifica-accent/60" style={{ fontWeight: 500 }}>Soltar aqui</span>
          </div>
        )}
        {col.cards.map((card: any) => (
          <RichCard key={card.id} card={card} colId={col.id} color={col.color} onRemove={onRemoveCard} onSelect={onSelectCard} />
        ))}
      </div>

      {/* Add */}
      <div className="px-2.5 pb-2.5">
        <button onClick={onAddCard}
          className="w-full h-8 border border-dashed border-certifica-200 rounded-[4px] text-[11px] text-certifica-500 hover:text-certifica-dark hover:border-certifica-300 transition-colors cursor-pointer flex items-center justify-center gap-1">
          <Plus className="w-3 h-3" strokeWidth={1.5} /> Novo card
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Rich Draggable Card
   ══════════════════════════════════════════════════════════ */

const prioridadeStyle: Record<string, { label: string; cls: string }> = {
  alta: { label: "Alta", cls: "bg-nao-conformidade/10 text-nao-conformidade" },
  media: { label: "Média", cls: "bg-observacao/12 text-observacao" },
  baixa: { label: "Baixa", cls: "bg-certifica-100 text-certifica-500" },
};

function RichCard({ card, colId, color, onRemove, onSelect }: {
  card: { id: string; title: string; description: string; assigned_to: string; due_date: string | null; tags: string[] };
  colId: string; color: string;
  onRemove: (id: string, colId: string) => void;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [{ isDragging }, drag] = useDrag(
    () => ({ type: DND_TYPE, item: { id: card.id, fromColId: colId }, collect: (m) => ({ isDragging: m.isDragging() }) }),
    [card.id, colId]
  );
  drag(ref);

  const data = parseCardData(card.description);
  const prio = prioridadeStyle[data.prioridade || "media"] || prioridadeStyle.media;
  const daysLeft = card.due_date ? Math.ceil((new Date(card.due_date).getTime() - Date.now()) / 86400000) : null;

  return (
    <div ref={ref} onClick={() => onSelect(card.id)}
      className={`bg-white border border-certifica-200 rounded-[6px] transition-all cursor-pointer hover:bg-[#EBF5FA] hover:border-certifica-accent/40 hover:shadow-[0_2px_8px_rgba(14,42,71,0.08)] group ${isDragging ? "opacity-30 scale-[0.97]" : ""}`}>
      <div className="h-1 rounded-t-[6px]" style={{ backgroundColor: color }} />
      <div className="px-2.5 pt-2 pb-1 flex items-center gap-1.5">
        <div className="p-0.5 text-certifica-200 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3" strokeWidth={1.5} />
        </div>
        <span className="text-[12px] text-certifica-dark flex-1 truncate" style={{ fontWeight: 600 }}>{card.title}</span>
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] flex-shrink-0 ${prio.cls}`} style={{ fontWeight: 600 }}>{prio.label}</span>
      </div>
      {data.descricao && (
        <div className="px-2.5 pb-1.5">
          <span className="text-[10.5px] text-certifica-500 line-clamp-2" style={{ lineHeight: "1.4" }}>{data.descricao}</span>
        </div>
      )}
      <div className="px-2.5 pb-2 flex items-center gap-2 flex-wrap">
        {card.assigned_to && (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-certifica-500/30" strokeWidth={1.5} />
            <span className="text-[10px] text-certifica-500">{card.assigned_to}</span>
          </div>
        )}
        {data.valor && (
          <div className="flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-certifica-500/30" strokeWidth={1.5} />
            <span className="text-[10px] text-certifica-500 font-mono" style={{ fontWeight: 500 }}>{data.valor}</span>
          </div>
        )}
        {daysLeft !== null && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] ${
            daysLeft < 0 ? "bg-nao-conformidade/8 text-nao-conformidade" :
            daysLeft <= 7 ? "bg-observacao/8 text-observacao" :
            "bg-certifica-50 text-certifica-500"
          }`}>
            <Clock className="w-3 h-3" strokeWidth={1.5} />
            <span className="text-[9px] font-mono" style={{ fontWeight: 500 }}>
              {daysLeft < 0 ? `${Math.abs(daysLeft)}d atraso` : `${daysLeft}d`}
            </span>
          </div>
        )}
      </div>
      {card.tags && card.tags.length > 0 && (
        <div className="px-2.5 pb-2 flex items-center gap-1 flex-wrap">
          {card.tags.slice(0, 3).map((t) => (
            <span key={t} className="px-1.5 py-0.5 bg-certifica-100 text-certifica-500 rounded-[2px] text-[9px]" style={{ fontWeight: 500 }}>{t}</span>
          ))}
          {card.tags.length > 3 && <span className="text-[9px] text-certifica-500/50">+{card.tags.length - 3}</span>}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Card Detail Panel (slide-over)
   ══════════════════════════════════════════════════════════ */

function CardDetailPanel({ card, colTitle, colColor, onClose, onRemove }: {
  card: { id: string; title: string; description: string; assigned_to: string; due_date: string | null; tags: string[]; created_at: string };
  colTitle: string; colColor: string;
  onClose: () => void; onRemove: () => void;
}) {
  const data = parseCardData(card.description);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <div className="fixed inset-0 bg-certifica-dark/30 z-40 certifica-modal-backdrop" onClick={onClose} style={{ animation: "certifica-fade-in 150ms ease-out" }} />
      <div className="fixed top-0 right-0 h-full w-[420px] bg-white shadow-[-4px_0_24px_rgba(0,0,0,0.08)] z-50 flex flex-col certifica-modal-slide" style={{ animation: "certifica-slide-right 250ms cubic-bezier(.22,1,.36,1)" }}>
        <div className="px-5 py-3.5 border-b border-certifica-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colColor }} />
            <span className="text-[11px] text-certifica-500">{colTitle}</span>
          </div>
          <div className="flex items-center gap-1">
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-certifica-500">Apagar?</span>
                <button onClick={onRemove} className="px-2 py-1 text-[11px] bg-nao-conformidade text-white rounded-[4px] cursor-pointer" style={{ fontWeight: 600 }}>Sim</button>
                <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-[11px] text-certifica-500 cursor-pointer">Não</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-1 text-certifica-500/30 hover:text-nao-conformidade transition-colors cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            )}
            <button onClick={onClose} className="p-1 text-certifica-500/40 hover:text-certifica-dark transition-colors cursor-pointer">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 border-b border-certifica-200">
            <h3 className="text-[16px] text-certifica-900 mb-2" style={{ fontWeight: 700 }}>{card.title}</h3>
            {data.prioridade && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${(prioridadeStyle[data.prioridade] || prioridadeStyle.media).cls}`} style={{ fontWeight: 600 }}>
                {(prioridadeStyle[data.prioridade] || prioridadeStyle.media).label}
              </span>
            )}
          </div>

          {data.descricao && (
            <div className="px-5 py-3 border-b border-certifica-200">
              <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-1.5" style={{ fontWeight: 600 }}>Descrição</div>
              <p className="text-[12px] text-certifica-dark" style={{ lineHeight: "1.6" }}>{data.descricao}</p>
            </div>
          )}

          <div className="px-5 py-3 border-b border-certifica-200 space-y-2">
            <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-1.5" style={{ fontWeight: 600 }}>Detalhes</div>
            {[
              { label: "Responsável", value: card.assigned_to || "—", icon: User },
              { label: "Valor", value: data.valor || "—", icon: DollarSign },
              { label: "Prazo", value: card.due_date ? new Date(card.due_date).toLocaleDateString("pt-BR") : "—", icon: Calendar },
              { label: "Criado em", value: card.created_at ? new Date(card.created_at).toLocaleDateString("pt-BR") : "—", icon: Clock },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <item.icon className="w-3 h-3 text-certifica-500/40" strokeWidth={1.5} />
                  <span className="text-[11px] text-certifica-500">{item.label}</span>
                </div>
                <span className="text-[11px] text-certifica-dark" style={{ fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}
          </div>

          {card.tags && card.tags.length > 0 && (
            <div className="px-5 py-3">
              <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-1.5" style={{ fontWeight: 600 }}>Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {card.tags.map((t) => (
                  <span key={t} className="px-2 py-0.5 bg-certifica-100 text-certifica-500 rounded-[3px] text-[11px]" style={{ fontWeight: 500 }}>
                    <Tag className="w-3 h-3 inline mr-1" strokeWidth={1.5} />{t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes certifica-slide-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>
    </>
  );
}
