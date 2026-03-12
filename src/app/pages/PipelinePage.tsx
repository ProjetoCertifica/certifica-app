import React, { useState, useCallback, useRef, useMemo } from "react";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { DSButton } from "../components/ds/DSButton";
import { toast } from "sonner";
import {
  Search,
  Filter,
  X,
  GripVertical,
  Building2,
  Users,
  Calendar,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Target,
  ClipboardCheck,
  Phone,
  Mail,
  MapPin,
  FileText,
  Plus,
  Paperclip,
  MoreVertical,
  Hash,
  MessageSquare,
  Tag,
  Trash2,
} from "lucide-react";
import { usePipeline } from "../lib/usePipeline";
import type { ColumnWithCards } from "../lib/usePipeline";
import type {
  PipelineColumn,
  PipelineCard as DBPipelineCard,
  PipelineColumnInsert,
  PipelineCardInsert,
} from "../lib/database.types";

/* ══════════════════════════════════════════════════════════
   UI-layer types (kept identical so sub-components compile)
   ══════════════════════════════════════════════════════════ */

interface Entregavel {
  id: string;
  texto: string;
  concluido: boolean;
}

interface Contato {
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
}

/** Rich UI card — a superset of the DB card, mapped at render time */
interface PipelineCard {
  id: string;
  codigo: string;
  titulo: string;
  clienteNome: string;
  clienteCnpj: string;
  clienteSegmento: string;
  clienteEndereco: string;
  contato: Contato;
  norma: string;
  /** The DB column id this card lives in */
  columnId: string;
  /** Legacy numeric fase kept for colour/gantt helpers — derived from column position */
  fase: number;
  prioridade: "alta" | "media" | "baixa";
  consultor: string;
  equipe: string[];
  inicio: string;
  previsao: string;
  valor: string;
  condicoesPagamento: string;
  escopo: string;
  entregaveis: Entregavel[];
  totalDocumentos: number;
  totalAuditorias: number;
  observacoes: string;
  diasRestantes: number;
  criadoEm: string;
}

interface ColumnConfig {
  id: string;         // UUID from DB
  numericId: number;  // positional index (0-based) kept for colour helpers
  label: string;
  sublabel: string;
  color: string;
  wipLimit: number;
  slaDays: number;
  probability: number;
  collapsed: boolean;
}

interface AttachmentItem {
  id: string;
  name: string;
  type: string;
  url?: string;
}

interface ActivityItem {
  id: string;
  at: string;
  text: string;
}

interface CardMeta {
  comments: string[];
  attachments: AttachmentItem[];
  tags: string[];
  activities: ActivityItem[];
}

const DND_TYPE = "KANBAN_CARD";

/* ══════════════════════════════════════════════════════════
   Colour helpers (keyed by positional index)
   ══════════════════════════════════════════════════════════ */

const FALLBACK_COLORS = [
  "#6B7280", "#274C77", "#2B8EAD", "#1F5E3B", "#0E2A47",
  "#7A1E1E", "#8C6A1F",
];

const DEFAULT_PROBABILITIES = [20, 35, 55, 75, 90, 95, 100];
const DEFAULT_SLA = [14, 10, 7, 5, 7, 7, 7];

const consultores = ["Carlos Silva", "Ana Costa", "Pedro Souza", "Maria Santos", "Roberto Lima"];

/* ══════════════════════════════════════════════════════════
   DB → UI mapping helpers
   ══════════════════════════════════════════════════════════ */

/**
 * The DB `description` field stores an optional JSON payload with the
 * extended UI fields.  Falls back to sensible defaults when absent.
 */
function parseDescription(raw: string): Partial<PipelineCard> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // not JSON — treat as plain escopo text
  }
  return { escopo: raw || "" };
}

function dbColumnToConfig(col: PipelineColumn, index: number): ColumnConfig {
  return {
    id: col.id,
    numericId: index,
    label: col.title,
    sublabel: "",
    color: col.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    wipLimit: col.wip_limit ?? 5,
    slaDays: DEFAULT_SLA[index % DEFAULT_SLA.length],
    probability: DEFAULT_PROBABILITIES[index % DEFAULT_PROBABILITIES.length],
    collapsed: false,
  };
}

function dbCardToUI(
  card: DBPipelineCard,
  columnNumericId: number,
  columnId: string
): PipelineCard {
  const extra = parseDescription(card.description ?? "");
  const due = card.due_date ? new Date(`${card.due_date}T00:00:00`) : null;
  const previsao = due ? due.toLocaleDateString("pt-BR") : "—";
  const diasRestantes = due
    ? Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : -1;
  const criadoEm = card.created_at
    ? new Date(card.created_at).toLocaleDateString("pt-BR")
    : "—";

  return {
    id: card.id,
    codigo: (extra.codigo as string) || card.id.slice(0, 8).toUpperCase(),
    titulo: card.title,
    clienteNome: (extra.clienteNome as string) || card.title,
    clienteCnpj: (extra.clienteCnpj as string) || "—",
    clienteSegmento: (extra.clienteSegmento as string) || "A definir",
    clienteEndereco: (extra.clienteEndereco as string) || "A definir",
    contato: (extra.contato as Contato) || {
      nome: card.assigned_to || "Contato principal",
      cargo: "A definir",
      email: "contato@empresa.com",
      telefone: "(00) 00000-0000",
    },
    norma: (extra.norma as string) || (card.tags?.[0] ?? "—"),
    columnId,
    fase: columnNumericId,
    prioridade: ((extra.prioridade as PipelineCard["prioridade"]) || "media"),
    consultor: card.assigned_to || (extra.consultor as string) || "—",
    equipe: (extra.equipe as string[]) || [card.assigned_to || "—"],
    inicio: (extra.inicio as string) || criadoEm,
    previsao,
    valor: (extra.valor as string) || "R$ 0,00",
    condicoesPagamento: (extra.condicoesPagamento as string) || "A definir",
    escopo: (extra.escopo as string) || card.description || "",
    entregaveis: (extra.entregaveis as Entregavel[]) || [],
    totalDocumentos: (extra.totalDocumentos as number) ?? 0,
    totalAuditorias: (extra.totalAuditorias as number) ?? 0,
    observacoes: (extra.observacoes as string) || "",
    diasRestantes,
    criadoEm,
  };
}

/**
 * Serialises the extra UI fields that have no direct DB column into the
 * `description` JSON payload, preserving the card title separately.
 */
function uiCardToDescription(card: Partial<PipelineCard> & { escopo?: string }): string {
  const { titulo: _t, id: _i, columnId: _c, fase: _f, previsao: _p, diasRestantes: _d, criadoEm: _cr, ...rest } = card as any;
  return JSON.stringify(rest);
}

/* ══════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════ */

const prioridadeConfig: Record<string, { label: string; color: string; dot: string }> = {
  alta: { label: "Alta", color: "#7A1E1E", dot: "bg-nao-conformidade" },
  media: { label: "Media", color: "#8C6A1F", dot: "bg-observacao" },
  baixa: { label: "Baixa", color: "#6B7280", dot: "bg-certifica-500" },
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function parseCurrency(v: string): number {
  return parseFloat(v.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
}

function formatCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBrDate(value: string): Date | null {
  if (!value || value === "—") return null;
  const [dd, mm, yyyy] = value.split("/");
  if (!dd || !mm || !yyyy) return null;
  const parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDefaultCardMeta(card: PipelineCard): CardMeta {
  return {
    comments: [`Registro inicial da oportunidade ${card.codigo}.`],
    attachments: [],
    tags: [],
    activities: [
      { id: `${card.id}-a1`, at: "agora", text: "Card criado no pipeline" },
    ],
  };
}

/* ══════════════════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════════════════ */

export default function PipelinePage() {
  const {
    columns: dbColumns,
    loading,
    error: pipelineError,
    createColumn: dbCreateColumn,
    updateColumn: dbUpdateColumn,
    createCard: dbCreateCard,
    moveCard: dbMoveCard,
    removeCard: dbRemoveCard,
    removeColumn: dbRemoveColumn,
  } = usePipeline();

  /* ── Derived UI columns & cards ── */
  const columns: ColumnConfig[] = useMemo(
    () => dbColumns.map((col, i) => dbColumnToConfig(col, i)),
    [dbColumns]
  );

  const cards: PipelineCard[] = useMemo(
    () =>
      dbColumns.flatMap((col, i) =>
        col.cards.map((c) => dbCardToUI(c, i, col.id))
      ),
    [dbColumns]
  );

  /* ── Local UI state ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [filterConsultor, setFilterConsultor] = useState("todos");
  const [filterPrioridade, setFilterPrioridade] = useState("todos");
  const [selectedCard, setSelectedCard] = useState<PipelineCard | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"kanban" | "gantt">("kanban");
  const [isCreateColumnOpen, setIsCreateColumnOpen] = useState(false);
  const [isCreateOpportunityOpen, setIsCreateOpportunityOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<{ id: string; title: string; color: string; wip_limit: number } | null>(null);
  const [savingColumn, setSavingColumn] = useState(false);
  useBodyScrollLock(!!selectedCard || isCreateColumnOpen || isCreateOpportunityOpen || !!editingColumn);
  const [targetColumnId, setTargetColumnId] = useState<string | null>(null);
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const isBoardDraggingRef = useRef(false);
  const [isBoardDragging, setIsBoardDragging] = useState(false);
  const boardDragStartXRef = useRef(0);
  const boardDragStartScrollRef = useRef(0);

  /** Local collapse state keyed by column DB id */
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>({});
  /** Local column order (array of DB ids) — re-seeded when dbColumns changes */
  const [colOrder, setColOrder] = useState<string[]>([]);
  const effectiveOrder = useMemo(() => {
    if (colOrder.length === columns.length && colOrder.every((id) => columns.find((c) => c.id === id))) {
      return colOrder;
    }
    return columns.map((c) => c.id);
  }, [colOrder, columns]);

  const columnPalette = ["#6B7280", "#274C77", "#2B8EAD", "#1F5E3B", "#0E2A47", "#7A1E1E", "#8C6A1F"];

  const [newColumnForm, setNewColumnForm] = useState({
    label: "",
    sublabel: "",
    color: columnPalette[0],
    wipLimit: "5",
    slaDays: "7",
    probability: "50",
  });
  const [newOpportunityForm, setNewOpportunityForm] = useState({
    clienteNome: "",
    titulo: "",
    norma: "ISO 9001:2015",
    consultor: consultores[0],
    prioridade: "media" as PipelineCard["prioridade"],
    valor: "R$ 0,00",
    contatoNome: "",
    contatoEmail: "",
    contatoTelefone: "",
    previsao: "",
  });
  const [cardMetaMap, setCardMetaMap] = useState<Record<string, CardMeta>>({});

  /* ── Actions ── */

  const handleMoveCard = useCallback(
    async (cardId: string, toColumnId: string, _targetIndex?: number) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      if (card.columnId === toColumnId) return;

      const fromColLabel = columns.find((c) => c.id === card.columnId)?.label ?? card.columnId;
      const toColLabel = columns.find((c) => c.id === toColumnId)?.label ?? toColumnId;

      const ok = await dbMoveCard(cardId, card.columnId, toColumnId);
      if (!ok) {
        toast.error("Erro ao mover o card.");
        return;
      }

      const at = new Date().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
      setCardMetaMap((prev) => {
        const base = prev[cardId] ?? getDefaultCardMeta(card);
        return {
          ...prev,
          [cardId]: {
            ...base,
            activities: [
              { id: `mv-${Date.now()}`, at, text: `Card movido de ${fromColLabel} para ${toColLabel}` },
              ...base.activities,
            ],
          },
        };
      });

      // Keep the detail overlay in sync
      setSelectedCard((prev) => {
        if (prev?.id !== cardId) return prev;
        const toColNumericId = columns.findIndex((c) => c.id === toColumnId);
        return { ...prev, columnId: toColumnId, fase: toColNumericId };
      });
    },
    [cards, columns, dbMoveCard]
  );

  /** Local-only update for the detail overlay fields (no DB write for now) */
  const updateCard = useCallback((cardId: string, patch: Partial<PipelineCard>) => {
    setSelectedCard((prev) => (prev?.id === cardId ? { ...prev, ...patch } : prev));
  }, []);

  const updateCardMeta = useCallback((cardId: string, updater: (meta: CardMeta) => CardMeta) => {
    setCardMetaMap((prev) => {
      const card = cards.find((c) => c.id === cardId);
      const current = prev[cardId] ?? getDefaultCardMeta(card ?? ({} as PipelineCard));
      return { ...prev, [cardId]: updater(current) };
    });
  }, [cards]);

  const toggleCollapse = (colId: string) => {
    setCollapsedCols((prev) => ({ ...prev, [colId]: !prev[colId] }));
  };

  const moveColumnOrder = (colId: string, direction: "left" | "right") => {
    setColOrder((prev) => {
      const list = prev.length === columns.length ? [...prev] : columns.map((c) => c.id);
      const idx = list.indexOf(colId);
      if (idx < 0) return list;
      const target = direction === "left" ? idx - 1 : idx + 1;
      if (target < 0 || target >= list.length) return list;
      [list[idx], list[target]] = [list[target], list[idx]];
      return list;
    });
  };

  const openCreateColumn = () => {
    const defaultColor = columnPalette[columns.length % columnPalette.length];
    setNewColumnForm({
      label: "",
      sublabel: "",
      color: defaultColor,
      wipLimit: "5",
      slaDays: String(DEFAULT_SLA[columns.length % DEFAULT_SLA.length]),
      probability: String(DEFAULT_PROBABILITIES[columns.length % DEFAULT_PROBABILITIES.length]),
    });
    setIsCreateColumnOpen(true);
  };

  const openCreateOpportunity = (columnId: string) => {
    setTargetColumnId(columnId);
    setNewOpportunityForm({
      clienteNome: "",
      titulo: "",
      norma: "ISO 9001:2015",
      consultor: consultores[0],
      prioridade: "media",
      valor: "R$ 0,00",
      contatoNome: "",
      contatoEmail: "",
      contatoTelefone: "",
      previsao: "",
    });
    setIsCreateOpportunityOpen(true);
  };

  const submitCreateColumn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const label = newColumnForm.label.trim();
    if (!label) return;
    const wip = Number.parseInt(newColumnForm.wipLimit, 10);
    const wipLimit = Number.isFinite(wip) ? Math.max(0, Math.min(99, wip)) : 5;

    const insertData: PipelineColumnInsert = {
      title: label,
      position: columns.length,
      wip_limit: wipLimit,
      color: newColumnForm.color,
    };

    const result = await dbCreateColumn(insertData);
    if (!result) {
      toast.error("Erro ao criar coluna.");
      return;
    }
    toast.success(`Coluna "${label}" criada.`);
    setIsCreateColumnOpen(false);
  };

  const submitCreateOpportunity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!targetColumnId) return;

    const clienteNome = newOpportunityForm.clienteNome.trim();
    const titulo = newOpportunityForm.titulo.trim();
    if (!clienteNome || !titulo) return;

    const createdAt = new Date();
    const criadoEm = createdAt.toLocaleDateString("pt-BR");

    let due_date: string | undefined;
    if (newOpportunityForm.previsao) {
      due_date = newOpportunityForm.previsao; // ISO yyyy-mm-dd from <input type="date">
    }

    const rawValor = parseCurrency(newOpportunityForm.valor);
    const valor = formatCurrency(rawValor);

    const descriptionPayload: Partial<PipelineCard> = {
      clienteNome,
      clienteCnpj: "—",
      clienteSegmento: "A definir",
      clienteEndereco: "A definir",
      contato: {
        nome: newOpportunityForm.contatoNome.trim() || "Contato principal",
        cargo: "A definir",
        email: newOpportunityForm.contatoEmail.trim() || "contato@empresa.com",
        telefone: newOpportunityForm.contatoTelefone.trim() || "(00) 00000-0000",
      },
      norma: newOpportunityForm.norma.trim() || "ISO 9001:2015",
      prioridade: newOpportunityForm.prioridade,
      consultor: newOpportunityForm.consultor,
      equipe: [newOpportunityForm.consultor],
      inicio: criadoEm,
      valor,
      condicoesPagamento: "A definir",
      escopo: titulo,
      entregaveis: [],
      totalDocumentos: 0,
      totalAuditorias: 0,
      observacoes: "",
    };

    const insertData: PipelineCardInsert = {
      column_id: targetColumnId,
      title: titulo,
      description: JSON.stringify(descriptionPayload),
      assigned_to: newOpportunityForm.consultor,
      due_date: due_date ?? null,
      tags: [newOpportunityForm.norma.trim() || "ISO 9001:2015"],
      sla_days: 14,
      position: cards.filter((c) => c.columnId === targetColumnId).length,
    };

    const result = await dbCreateCard(insertData);
    if (!result) {
      toast.error("Erro ao criar oportunidade.");
      return;
    }
    toast.success(`Oportunidade "${titulo}" criada.`);
    setIsCreateOpportunityOpen(false);
    setTargetColumnId(null);
  };

  const deleteColumn = async (colId: string) => {
    const col = columns.find((c) => c.id === colId);
    if (!col) return;
    if (columns.length <= 1) return;
    const ok = await dbRemoveColumn(colId);
    if (!ok) {
      toast.error("Erro ao remover coluna.");
      return;
    }
    toast.success(`Coluna "${col.label}" removida.`);
    setColOrder((prev) => prev.filter((id) => id !== colId));
  };

  /* ── Filtering ── */
  const filtered = cards.filter((c) => {
    if (filterConsultor !== "todos" && c.consultor !== filterConsultor) return false;
    if (filterPrioridade !== "todos" && c.prioridade !== filterPrioridade) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.titulo.toLowerCase().includes(q) ||
        c.clienteNome.toLowerCase().includes(q) ||
        c.norma.toLowerCase().includes(q) ||
        c.codigo.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const orderedColumns: ColumnConfig[] = useMemo(() => {
    return effectiveOrder
      .map((id) => columns.find((c) => c.id === id))
      .filter(Boolean) as ColumnConfig[];
  }, [effectiveOrder, columns]);

  const totalValor = filtered.reduce((s, c) => s + parseCurrency(c.valor), 0);
  const urgentes = filtered.filter((c) => c.diasRestantes > 0 && c.diasRestantes <= 30).length;
  const phaseForecast = useMemo(() => {
    const now = new Date();
    return orderedColumns.map((col) => {
      const colCards = filtered.filter((c) => c.columnId === col.id);
      const prob = col.probability / 100;
      const sla = col.slaDays;
      const expectedRevenue = colCards.reduce((sum, c) => sum + parseCurrency(c.valor) * prob, 0);
      const slaBreaches = colCards.filter((c) => {
        const created = parseBrDate(c.criadoEm);
        if (!created) return false;
        const elapsed = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return elapsed > sla;
      }).length;
      return { colId: col.id, label: col.label, probability: prob, expectedRevenue, slaDays: sla, slaBreaches };
    });
  }, [orderedColumns, filtered]);
  const totalExpectedRevenue = phaseForecast.reduce((sum, item) => sum + item.expectedRevenue, 0);
  const totalSlaBreaches = phaseForecast.reduce((sum, item) => sum + item.slaBreaches, 0);

  const handleBoardMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, [data-kanban-card], [data-dnd-handle]")) return;
    const scroller = boardScrollRef.current;
    if (!scroller) return;
    e.preventDefault();
    isBoardDraggingRef.current = true;
    setIsBoardDragging(true);
    boardDragStartXRef.current = e.clientX;
    boardDragStartScrollRef.current = scroller.scrollLeft;
  };

  const handleBoardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isBoardDraggingRef.current) return;
    const scroller = boardScrollRef.current;
    if (!scroller) return;
    e.preventDefault();
    const deltaX = e.clientX - boardDragStartXRef.current;
    scroller.scrollLeft = boardDragStartScrollRef.current - deltaX;
  };

  const handleBoardMouseUp = () => {
    isBoardDraggingRef.current = false;
    setIsBoardDragging(false);
  };

  /* ── Loading / error states ── */
  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 bg-certifica-50/40">
        <div className="w-6 h-6 border-2 border-certifica-accent/40 border-t-certifica-accent rounded-full animate-spin" />
        <p className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>Carregando pipeline...</p>
      </div>
    );
  }

  if (pipelineError) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3 bg-certifica-50/40">
        <AlertTriangle className="w-6 h-6 text-nao-conformidade/70" strokeWidth={1.5} />
        <p className="text-[12px] text-nao-conformidade" style={{ fontWeight: 500 }}>{pipelineError}</p>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-full overflow-hidden bg-certifica-50/40">
        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-certifica-900">Kanban</h2>
              <p className="text-[12px] text-certifica-500 mt-0.5" style={{ fontWeight: 400 }}>
                Gerencie seus projetos no processo "Pipeline de Consultoria" &middot; {filtered.length} cards
                {urgentes > 0 && (
                  <span className="text-nao-conformidade ml-1" style={{ fontWeight: 500 }}>
                    &middot; {urgentes} urgente{urgentes > 1 ? "s" : ""}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DSButton
                variant={showFilters ? "secondary" : "ghost"}
                size="sm"
                icon={<Filter className="w-3.5 h-3.5" strokeWidth={1.5} />}
                onClick={() => setShowFilters(!showFilters)}
              >
                Filtros
              </DSButton>
            </div>
          </div>

          {/* ── View tabs + summary ── */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-5 pb-3 border-b border-certifica-200">
            {/* View tabs */}
            <div className="flex items-center bg-certifica-100 rounded-[3px] p-0.5">
              {(["kanban", "gantt"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={`px-3 py-1 rounded-[2px] text-[11px] transition-all cursor-pointer ${
                    viewMode === v ? "bg-white text-certifica-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]" : "text-certifica-500 hover:text-certifica-dark"
                  }`}
                  style={{ fontWeight: viewMode === v ? 600 : 400 }}
                >
                  {v === "kanban" ? "Kanban" : "Gantt"}
                </button>
              ))}
            </div>

            <div className="w-px h-3 bg-certifica-200" />

            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-certifica-500/40" strokeWidth={1.5} />
              <span className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Total</span>
              <span className="text-[12px] text-certifica-900 font-mono" style={{ fontWeight: 600 }}>{formatCurrency(totalValor)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-certifica-500/40" strokeWidth={1.5} />
              <span className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Receita esperada</span>
              <span className="text-[12px] text-certifica-900 font-mono" style={{ fontWeight: 600 }}>{formatCurrency(totalExpectedRevenue)}</span>
            </div>

            {urgentes > 0 && (
              <div className="flex items-center gap-1 contents-none">
                <div className="w-px h-3 bg-certifica-200" />
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-nao-conformidade/60" strokeWidth={1.5} />
                  <span className="text-[11px] text-nao-conformidade" style={{ fontWeight: 500 }}>{urgentes} prazo &lt;30d</span>
                </div>
              </div>
            )}
            {totalSlaBreaches > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-px h-3 bg-certifica-200" />
                <Clock className="w-3.5 h-3.5 text-observacao/70" strokeWidth={1.5} />
                <span className="text-[11px] text-observacao" style={{ fontWeight: 500 }}>
                  {totalSlaBreaches} em SLA estourado
                </span>
              </div>
            )}

            <div className="ml-auto relative max-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-certifica-500/40" strokeWidth={1.5} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-8 pr-3 bg-certifica-50 border border-certifica-200 rounded-[3px] text-[11.5px] placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-700/30"
                placeholder="Buscar projeto..."
                style={{ fontWeight: 400 }}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 py-2 border-b border-certifica-200 overflow-x-auto">
            {phaseForecast.map((phase) => (
              <div key={phase.colId} className="px-2 py-1 rounded-[3px] bg-white border border-certifica-200">
                <div className="text-[10px] text-certifica-500" style={{ fontWeight: 500 }}>{phase.label}</div>
                <div className="text-[10px] text-certifica-700 font-mono" style={{ fontWeight: 600 }}>
                  {(phase.probability * 100).toFixed(0)}% · {formatCurrency(phase.expectedRevenue)}
                </div>
              </div>
            ))}
          </div>

          {/* ── Filter row ── */}
          {showFilters && (
            <div className="flex items-center gap-3 py-2.5 border-b border-certifica-200">
              <select value={filterConsultor} onChange={(e) => setFilterConsultor(e.target.value)}
                className="h-7 px-2 bg-white border border-certifica-200 rounded-[3px] text-[11.5px] text-certifica-dark appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-certifica-700/30 pr-6" style={{ fontWeight: 400 }}>
                <option value="todos">Todos consultores</option>
                {consultores.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterPrioridade} onChange={(e) => setFilterPrioridade(e.target.value)}
                className="h-7 px-2 bg-white border border-certifica-200 rounded-[3px] text-[11.5px] text-certifica-dark appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-certifica-700/30 pr-6" style={{ fontWeight: 400 }}>
                <option value="todos">Todas prioridades</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baixa">Baixa</option>
              </select>
              {(filterConsultor !== "todos" || filterPrioridade !== "todos") && (
                <button onClick={() => { setFilterConsultor("todos"); setFilterPrioridade("todos"); }}
                  className="text-[11px] text-certifica-accent cursor-pointer hover:underline" style={{ fontWeight: 500 }}>
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Empty State Onboarding ── */}
        {orderedColumns.length === 0 && viewMode === "kanban" && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-[480px] text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-full bg-certifica-accent-light flex items-center justify-center">
                <ClipboardCheck className="w-8 h-8 text-certifica-accent" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-[16px] text-certifica-900 mb-1" style={{ fontWeight: 600 }}>Pipeline ainda vazio</h3>
                <p className="text-[12.5px] text-certifica-500 leading-relaxed">
                  O Kanban de consultoria organiza seus projetos por fases — da prospecção até a certificação.
                  Comece criando suas colunas de processo.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-3 text-left">
                {[
                  { emoji: "🎯", label: "Prospecção", desc: "Leads e oportunidades identificadas" },
                  { emoji: "📋", label: "Diagnóstico", desc: "Análise inicial e gap assessment" },
                  { emoji: "⚙️", label: "Implementação", desc: "Projetos em execução ativa" },
                  { emoji: "🏆", label: "Certificação", desc: "Prontos para auditoria externa" },
                ].map((step) => (
                  <div key={step.label} className="bg-white border border-certifica-200 rounded-[4px] p-2.5">
                    <div className="text-lg mb-1">{step.emoji}</div>
                    <div className="text-[11px] text-certifica-900 mb-0.5" style={{ fontWeight: 600 }}>{step.label}</div>
                    <div className="text-[9.5px] text-certifica-500">{step.desc}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-3">
                <DSButton
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  onClick={openCreateColumn}
                >
                  Criar primeira coluna
                </DSButton>
                <DSButton
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    // Create default pipeline columns
                    const defaultCols = [
                      { title: "Prospecção", wip_limit: 0, position: 0, color: "#2B8EAD" },
                      { title: "Diagnóstico", wip_limit: 5, position: 1, color: "#8C6A1F" },
                      { title: "Implementação", wip_limit: 8, position: 2, color: "#1F5E3B" },
                      { title: "Certificação", wip_limit: 3, position: 3, color: "#1F3F66" },
                      { title: "Concluído", wip_limit: 0, position: 4, color: "#0E2A47" },
                    ];
                    for (const col of defaultCols) {
                      await dbCreateColumn(col);
                    }
                    toast.success("Pipeline padrão criado! 5 fases adicionadas.");
                  }}
                >
                  Usar pipeline padrão
                </DSButton>
              </div>
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {viewMode === "kanban" && orderedColumns.length > 0 ? (
          <div
            ref={boardScrollRef}
            className={`flex-1 overflow-x-auto overflow-y-hidden px-5 py-4 ${isBoardDragging ? "cursor-grabbing" : "cursor-default"}`}
            onMouseDown={handleBoardMouseDown}
            onMouseMove={handleBoardMouseMove}
            onMouseUp={handleBoardMouseUp}
            onMouseLeave={handleBoardMouseUp}
            style={{ userSelect: "none" }}
          >
            <div className="flex gap-3 h-full min-w-min">
              {orderedColumns.map((col, index) => {
                const colCards = filtered.filter((c) => c.columnId === col.id);
                const colValor = colCards.reduce((s, c) => s + parseCurrency(c.valor), 0);
                const overWip = col.wipLimit > 0 && colCards.length > col.wipLimit;
                const isCollapsed = collapsedCols[col.id] ?? false;
                return (
                  <KanbanColumn
                    key={col.id}
                    column={{ ...col, collapsed: isCollapsed }}
                    cards={colCards}
                    colValor={colValor}
                    overWip={overWip}
                    slaDays={col.slaDays}
                    slaBreaches={phaseForecast.find((p) => p.colId === col.id)?.slaBreaches ?? 0}
                    moveCard={handleMoveCard}
                    onToggleCollapse={() => toggleCollapse(col.id)}
                    onSelectCard={setSelectedCard}
                    onMoveLeft={() => moveColumnOrder(col.id, "left")}
                    onMoveRight={() => moveColumnOrder(col.id, "right")}
                    onDelete={() => deleteColumn(col.id)}
                    onEdit={() => {
                      const dbCol = dbColumns.find((c) => c.id === col.id);
                      if (dbCol) setEditingColumn({ id: dbCol.id, title: dbCol.title, color: dbCol.color, wip_limit: dbCol.wip_limit });
                    }}
                    onCreateOpportunity={() => openCreateOpportunity(col.id)}
                    isFirst={index === 0}
                    isLast={index === orderedColumns.length - 1}
                  />
                );
              })}
              <div className="w-[220px] flex-shrink-0">
                <button
                  onClick={openCreateColumn}
                  className="w-full h-full min-h-[160px] border border-dashed border-certifica-300 rounded-[6px] bg-white/60 text-certifica-500 hover:text-certifica-dark hover:border-certifica-accent/40 transition-colors flex flex-col items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" strokeWidth={1.5} />
                  <span className="text-[12px]" style={{ fontWeight: 500 }}>Nova coluna</span>
                </button>
              </div>
            </div>
          </div>
        ) : viewMode === "gantt" ? (
          <GanttView cards={filtered} columns={orderedColumns} onSelectCard={setSelectedCard} />
        ) : null}

        {/* ── Detail overlay ── */}
        {selectedCard && (
          <CardDetailOverlay
            card={selectedCard}
            columns={orderedColumns}
            cardMeta={cardMetaMap[selectedCard.id] ?? getDefaultCardMeta(selectedCard)}
            onClose={() => setSelectedCard(null)}
            moveCard={handleMoveCard}
            onUpdateCard={updateCard}
            onUpdateCardMeta={updateCardMeta}
            onDeleteCard={async (id, columnId) => { await dbRemoveCard(id, columnId); setSelectedCard(null); }}
          />
        )}

        {isCreateColumnOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-certifica-dark/45 certifica-modal-backdrop" onClick={() => setIsCreateColumnOpen(false)} />
            <div className="relative w-full max-w-[520px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] certifica-modal-content">
              <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
                <div>
                  <h3 className="text-certifica-900 text-[15px]" style={{ fontWeight: 600 }}>Nova coluna</h3>
                  <p className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>
                    Defina título, cor e WIP limit.
                  </p>
                </div>
                <button onClick={() => setIsCreateColumnOpen(false)} className="p-1 text-certifica-500/40 hover:text-certifica-700 transition-colors cursor-pointer">
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              <form onSubmit={submitCreateColumn} className="p-4 grid grid-cols-2 gap-3">
                <label className="col-span-2 text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Título
                  <input
                    required
                    value={newColumnForm.label}
                    onChange={(e) => setNewColumnForm((prev) => ({ ...prev, label: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                    placeholder="Ex.: Auditoria documental"
                  />
                </label>

                <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Cor
                  <input
                    type="color"
                    value={newColumnForm.color}
                    onChange={(e) => setNewColumnForm((prev) => ({ ...prev, color: e.target.value }))}
                    className="mt-1 w-full h-9 p-1 border border-certifica-200 rounded-[4px] bg-white cursor-pointer"
                  />
                </label>

                <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  WIP limit
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={newColumnForm.wipLimit}
                    onChange={(e) => setNewColumnForm((prev) => ({ ...prev, wipLimit: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                  />
                </label>

                <div className="col-span-2">
                  <div className="text-[10px] text-certifica-500 mb-1">Sugestões de cor</div>
                  <div className="flex items-center gap-1.5">
                    {columnPalette.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewColumnForm((prev) => ({ ...prev, color }))}
                        className={`w-6 h-6 rounded-full border-2 ${newColumnForm.color === color ? "border-certifica-dark" : "border-white"}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2 pt-1">
                  <DSButton type="button" variant="outline" size="sm" onClick={() => setIsCreateColumnOpen(false)}>
                    Cancelar
                  </DSButton>
                  <DSButton type="submit" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                    Criar coluna
                  </DSButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {isCreateOpportunityOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-certifica-dark/45 certifica-modal-backdrop" onClick={() => setIsCreateOpportunityOpen(false)} />
            <div className="relative w-full max-w-[620px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] certifica-modal-content">
              <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
                <div>
                  <h3 className="text-certifica-900 text-[15px]" style={{ fontWeight: 600 }}>Nova oportunidade</h3>
                  <p className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Cadastre cliente, escopo comercial e prioridade inicial.</p>
                </div>
                <button onClick={() => setIsCreateOpportunityOpen(false)} className="p-1 text-certifica-500/40 hover:text-certifica-700 transition-colors cursor-pointer">
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>

              <form onSubmit={submitCreateOpportunity} className="p-4 grid grid-cols-2 gap-3">
                <label className="col-span-2 text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Cliente
                  <input
                    required
                    value={newOpportunityForm.clienteNome}
                    onChange={(e) => setNewOpportunityForm((prev) => ({ ...prev, clienteNome: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                    placeholder="Ex.: Industria Aurora"
                  />
                </label>

                <label className="col-span-2 text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Título da oportunidade
                  <input
                    required
                    value={newOpportunityForm.titulo}
                    onChange={(e) => setNewOpportunityForm((prev) => ({ ...prev, titulo: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                    placeholder="Ex.: Implementação ISO 9001"
                  />
                </label>

                <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Norma
                  <input
                    value={newOpportunityForm.norma}
                    onChange={(e) => setNewOpportunityForm((prev) => ({ ...prev, norma: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                    placeholder="Ex.: ISO 14001:2015"
                  />
                </label>

                <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Consultor responsável
                  <select
                    value={newOpportunityForm.consultor}
                    onChange={(e) => setNewOpportunityForm((prev) => ({ ...prev, consultor: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                  >
                    {consultores.map((consultor) => (
                      <option key={consultor} value={consultor}>{consultor}</option>
                    ))}
                  </select>
                </label>

                <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Prioridade
                  <select
                    value={newOpportunityForm.prioridade}
                    onChange={(e) => setNewOpportunityForm((prev) => ({ ...prev, prioridade: e.target.value as PipelineCard["prioridade"] }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                  >
                    <option value="alta">Alta</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </label>

                <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Valor estimado
                  <input
                    value={newOpportunityForm.valor}
                    onChange={(e) => setNewOpportunityForm((prev) => ({ ...prev, valor: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                    placeholder="R$ 0,00"
                  />
                </label>

                <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Previsão
                  <input
                    type="date"
                    value={newOpportunityForm.previsao}
                    onChange={(e) => setNewOpportunityForm((prev) => ({ ...prev, previsao: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                  />
                </label>

                <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Contato
                  <input
                    value={newOpportunityForm.contatoNome}
                    onChange={(e) => setNewOpportunityForm((prev) => ({ ...prev, contatoNome: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                    placeholder="Nome do contato"
                  />
                </label>

                <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  E-mail do contato
                  <input
                    type="email"
                    value={newOpportunityForm.contatoEmail}
                    onChange={(e) => setNewOpportunityForm((prev) => ({ ...prev, contatoEmail: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                    placeholder="contato@empresa.com"
                  />
                </label>

                <label className="col-span-2 text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Telefone do contato
                  <input
                    value={newOpportunityForm.contatoTelefone}
                    onChange={(e) => setNewOpportunityForm((prev) => ({ ...prev, contatoTelefone: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                    placeholder="(00) 00000-0000"
                  />
                </label>

                <div className="col-span-2 flex items-center justify-end gap-2 pt-1">
                  <DSButton type="button" variant="outline" size="sm" onClick={() => setIsCreateOpportunityOpen(false)}>
                    Cancelar
                  </DSButton>
                  <DSButton type="submit" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                    Criar oportunidade
                  </DSButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Edit column modal ── */}
        {editingColumn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-certifica-dark/45 certifica-modal-backdrop" onClick={() => setEditingColumn(null)} />
            <div className="relative bg-white rounded-[6px] border border-certifica-200 shadow-xl w-[340px] certifica-modal-content">
              <div className="px-5 py-4 border-b border-certifica-200 flex items-center justify-between">
                <span className="text-[13px] text-certifica-dark" style={{ fontWeight: 600 }}>Editar coluna</span>
                <button onClick={() => setEditingColumn(null)} className="text-certifica-500/50 hover:text-certifica-dark cursor-pointer">
                  <X className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <label className="block">
                  <span className="text-[11px] text-certifica-500 mb-1 block" style={{ fontWeight: 600 }}>Nome da coluna</span>
                  <input
                    value={editingColumn.title}
                    onChange={(e) => setEditingColumn((p) => p ? { ...p, title: e.target.value } : p)}
                    className="w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px] focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-certifica-500 mb-1 block" style={{ fontWeight: 600 }}>Cor da coluna</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editingColumn.color}
                      onChange={(e) => setEditingColumn((p) => p ? { ...p, color: e.target.value } : p)}
                      className="h-9 w-12 p-1 border border-certifica-200 rounded-[4px] cursor-pointer"
                    />
                    <span className="text-[11px] text-certifica-500 font-mono">{editingColumn.color}</span>
                  </div>
                </label>
                <label className="block">
                  <span className="text-[11px] text-certifica-500 mb-1 block" style={{ fontWeight: 600 }}>Limite WIP</span>
                  <input
                    type="number"
                    min={1}
                    value={editingColumn.wip_limit}
                    onChange={(e) => setEditingColumn((p) => p ? { ...p, wip_limit: Number(e.target.value) } : p)}
                    className="w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px] focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                  />
                </label>
              </div>
              <div className="px-5 pb-4 flex justify-end gap-2">
                <DSButton variant="outline" size="sm" onClick={() => setEditingColumn(null)}>Cancelar</DSButton>
                <DSButton
                  size="sm"
                  loading={savingColumn}
                  onClick={async () => {
                    if (!editingColumn.title.trim()) return;
                    setSavingColumn(true);
                    const ok = await dbUpdateColumn(editingColumn.id, {
                      title: editingColumn.title.trim(),
                      color: editingColumn.color,
                      wip_limit: editingColumn.wip_limit,
                    });
                    setSavingColumn(false);
                    if (ok) setEditingColumn(null);
                  }}
                >
                  Salvar
                </DSButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
}

/* ══════════════════════════════════════════════════════════
   Kanban Column
   ══════════════════════════════════════════════════════════ */

function DropIndicator() {
  return (
    <div className="relative h-1 -my-0.5 z-10 pointer-events-none">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-certifica-accent rounded-full" />
      <div className="absolute -left-1 -top-[3px] w-[9px] h-[9px] rounded-full bg-certifica-accent" />
      <div className="absolute -right-1 -top-[3px] w-[9px] h-[9px] rounded-full bg-certifica-accent" />
    </div>
  );
}

function EmptyDropZone() {
  return (
    <div className="py-6 text-center border-2 border-dashed border-certifica-accent/40 bg-certifica-accent/5 rounded-[4px]">
      <span className="text-[11px] text-certifica-accent/60" style={{ fontWeight: 500 }}>Soltar aqui</span>
    </div>
  );
}

function KanbanColumn({ column, cards, colValor, overWip, slaDays, slaBreaches, moveCard, onToggleCollapse, onSelectCard, onMoveLeft, onMoveRight, onDelete, onEdit, onCreateOpportunity, isFirst, isLast }: {
  column: ColumnConfig; cards: PipelineCard[]; colValor: number; overWip: boolean; slaDays: number; slaBreaches: number;
  moveCard: (id: string, columnId: string, idx?: number) => void; onToggleCollapse: () => void; onSelectCard: (c: PipelineCard) => void;
  onMoveLeft: () => void; onMoveRight: () => void; onDelete: () => void; onEdit: () => void; onCreateOpportunity: () => void; isFirst: boolean; isLast: boolean;
}) {
  const ghostRef = useRef<number | null>(null);
  const [ghostIndex, setGhostIndex] = useState<number | null>(null);
  const updateGhost = useCallback((idx: number | null) => {
    if (ghostRef.current === idx) return;
    ghostRef.current = idx;
    setGhostIndex(idx);
  }, []);

  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: DND_TYPE,
    hover: (_item: { id: string }, monitor) => {
      if (!monitor.isOver({ shallow: true })) return;
      updateGhost(cards.length);
    },
    drop: (item: { id: string }, monitor) => {
      if (monitor.didDrop()) return;
      moveCard(item.id, column.id, ghostRef.current ?? cards.length);
      updateGhost(null);
    },
    collect: (m) => ({ isOver: m.isOver(), canDrop: m.canDrop() }),
  }), [column.id, moveCard, cards.length, updateGhost]);

  const handleCardHover = useCallback((index: number, position: "top" | "bottom") => {
    updateGhost(position === "top" ? index : index + 1);
  }, [updateGhost]);

  const handleCardDrop = useCallback((item: { id: string }) => {
    moveCard(item.id, column.id, ghostRef.current ?? cards.length);
    updateGhost(null);
  }, [moveCard, column.id, cards.length, updateGhost]);

  React.useEffect(() => {
    if (!isOver) updateGhost(null);
  }, [isOver, updateGhost]);

  const ref = useRef<HTMLDivElement>(null);
  drop(ref);

  if (column.collapsed) {
    return (
      <div ref={ref} onClick={onToggleCollapse}
        className={`w-10 flex-shrink-0 rounded-[4px] border cursor-pointer flex flex-col items-center py-3 gap-2 transition-colors hover:border-certifica-accent/40 ${
          isOver ? "border-certifica-accent bg-certifica-accent/5" : "border-certifica-200 bg-white"
        }`}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] text-certifica-500" style={{ fontWeight: 500, writingMode: "vertical-rl", textOrientation: "mixed" }}>
            {column.label} ({cards.length})
          </span>
        </div>
        <ChevronRight className="w-3 h-3 text-certifica-500/40" strokeWidth={1.5} />
      </div>
    );
  }

  const renderCards = () => {
    const elements: React.ReactNode[] = [];
    if (ghostIndex === 0 && isOver) elements.push(<DropIndicator key="drop-top" />);

    cards.forEach((card, i) => {
      elements.push(
        <DraggableDropCard
          key={card.id}
          card={card}
          index={i}
          onSelect={onSelectCard}
          onHover={handleCardHover}
          onDrop={handleCardDrop}
        />
      );
      if (ghostIndex === i + 1 && isOver) elements.push(<DropIndicator key={`drop-${i}`} />);
    });

    return elements;
  };

  return (
    <div ref={ref} className={`w-[292px] flex-shrink-0 rounded-[6px] border flex flex-col transition-colors ${
      isOver && canDrop ? "border-certifica-accent/50 bg-certifica-accent/5" : "border-certifica-200 bg-certifica-50/70"
    }`}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-certifica-200 flex-shrink-0 bg-white rounded-t-[6px]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: column.color }} />
            <span className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>{column.label}</span>
            <span className={`inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full text-[9px] ${
              overWip ? "bg-nao-conformidade/10 text-nao-conformidade" : "bg-certifica-100 text-certifica-700"
            }`} style={{ fontWeight: 600 }}>{cards.length}</span>
            {column.wipLimit > 0 && (
              <span className={`text-[9px] ${overWip ? "text-nao-conformidade" : "text-certifica-500/40"}`} style={{ fontWeight: 400 }}>/{column.wipLimit}</span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={onMoveLeft}
              disabled={isFirst}
              className="p-0.5 text-certifica-500/40 enabled:hover:text-certifica-dark disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" strokeWidth={1.5} />
            </button>
            <button
              onClick={onMoveRight}
              disabled={isLast}
              className="p-0.5 text-certifica-500/40 enabled:hover:text-certifica-dark disabled:opacity-30 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
            </button>
            <button onClick={onDelete} className="p-0.5 text-certifica-500/40 hover:text-nao-conformidade transition-colors cursor-pointer">
              <Trash2 className="w-3 h-3" strokeWidth={1.5} />
            </button>
            <button onClick={onEdit} className="p-0.5 text-certifica-500/40 hover:text-certifica-dark transition-colors cursor-pointer">
              <MoreVertical className="w-3 h-3" strokeWidth={1.5} />
            </button>
            <button onClick={onToggleCollapse} className="p-0.5 text-certifica-500/30 hover:text-certifica-dark transition-colors cursor-pointer">
              <ChevronDown className="w-3 h-3" strokeWidth={1.5} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>{column.sublabel}</span>
          <span className="text-[10px] text-certifica-500 font-mono" style={{ fontWeight: 500 }}>{formatCurrency(colValor)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[9px] text-certifica-500/60" style={{ fontWeight: 400 }}>SLA fase: {slaDays}d</span>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-certifica-500/60" style={{ fontWeight: 500 }}>Prob: {column.probability}%</span>
            {slaBreaches > 0 && (
              <span className="text-[9px] text-observacao" style={{ fontWeight: 500 }}>
                {slaBreaches} estourado{slaBreaches > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        {overWip && (
          <div className="mt-1.5 flex items-center gap-1 px-2 py-1 bg-nao-conformidade/5 border border-nao-conformidade/15 rounded-[2px]">
            <AlertTriangle className="w-3 h-3 text-nao-conformidade/60" strokeWidth={1.5} />
            <span className="text-[9px] text-nao-conformidade" style={{ fontWeight: 500 }}>WIP excedido ({cards.length}/{column.wipLimit})</span>
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {cards.length === 0 && !isOver && (
          <div className="py-8 text-center border border-dashed rounded-[3px] border-certifica-200">
            <p className="text-[11px] text-certifica-500/50" style={{ fontWeight: 400 }}>Arraste um projeto aqui</p>
          </div>
        )}
        {cards.length === 0 && isOver && <EmptyDropZone />}
        {cards.length > 0 && renderCards()}
      </div>

      <div className="px-2.5 pb-2.5">
        <button
          onClick={onCreateOpportunity}
          className="w-full h-8 border border-dashed border-certifica-200 rounded-[4px] text-[11px] text-certifica-500 hover:text-certifica-dark hover:border-certifica-300 transition-colors cursor-pointer"
        >
          Nova oportunidade
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Kanban Card (with drag + drop target for positioning)
   ══════════════════════════════════════════════════════════ */

function DraggableDropCard({ card, index, onSelect, onHover, onDrop }: {
  card: PipelineCard; index: number;
  onSelect: (c: PipelineCard) => void;
  onHover: (index: number, position: "top" | "bottom") => void;
  onDrop: (item: { id: string }) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: DND_TYPE, item: { id: card.id },
    collect: (m) => ({ isDragging: m.isDragging() }),
  }), [card.id]);

  const lastPos = useRef<"top" | "bottom">("bottom");

  const [, dropRef] = useDrop(() => ({
    accept: DND_TYPE,
    hover: (item: { id: string }, monitor) => {
      if (item.id === card.id || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const y = monitor.getClientOffset()?.y ?? 0;
      const relY = (y - rect.top) / rect.height;
      if (relY < 0.35) {
        lastPos.current = "top";
      } else if (relY > 0.65) {
        lastPos.current = "bottom";
      }
      onHover(index, lastPos.current);
    },
    drop: (item: { id: string }, monitor) => {
      if (monitor.didDrop()) return;
      onDrop(item);
    },
  }), [card.id, index, onHover, onDrop]);

  drag(dropRef(cardRef));
  preview(cardRef);

  return <KanbanCardContent ref={cardRef} card={card} isDragging={isDragging} onSelect={onSelect} />;
}

const KanbanCardContent = React.forwardRef<HTMLDivElement, { card: PipelineCard; isDragging: boolean; onSelect: (c: PipelineCard) => void }>(
  ({ card, isDragging, onSelect }, ref) => {
  const temperatura: Record<PipelineCard["prioridade"], { label: string; className: string }> = {
    alta: { label: "Quente", className: "bg-nao-conformidade/10 text-nao-conformidade" },
    media: { label: "Morno", className: "bg-observacao/12 text-observacao" },
    baixa: { label: "Frio", className: "bg-certifica-100 text-certifica-500" },
  };
  const entC = card.entregaveis.filter((e) => e.concluido).length;
  const entT = card.entregaveis.length;
  const pct = entT > 0 ? Math.round((entC / entT) * 100) : 0;
  const isUrgent = card.diasRestantes > 0 && card.diasRestantes <= 30;
  const isCritical = card.diasRestantes > 0 && card.diasRestantes <= 14;
  // Use the column colour stored on the card's fase index
  const cardTopColor = FALLBACK_COLORS[card.fase % FALLBACK_COLORS.length];

  return (
    <div ref={ref} data-kanban-card onClick={() => onSelect(card)}
      className={`bg-white border border-certifica-200 rounded-[6px] transition-all cursor-pointer hover:bg-[#EBF5FA] hover:border-certifica-accent/40 hover:shadow-[0_2px_8px_rgba(14,42,71,0.08)] group ${isDragging ? "opacity-30 scale-[0.97] ring-2 ring-certifica-accent/30" : ""}`}>
      <div className="h-1 rounded-t-[6px]" style={{ backgroundColor: cardTopColor }} />

      <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
        <div data-dnd-handle className="p-0.5 text-certifica-200 hover:text-certifica-500 cursor-grab active:cursor-grabbing flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-3 h-3" strokeWidth={1.5} />
        </div>
        <span className="text-[10px] text-certifica-700 font-mono flex-1" style={{ fontWeight: 600 }}>{card.codigo}</span>
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${temperatura[card.prioridade].className}`} style={{ fontWeight: 600 }}>
          {temperatura[card.prioridade].label}
        </span>
      </div>
      <div className="px-2.5 pb-1.5">
        <span className="text-[12px] text-certifica-dark block" style={{ fontWeight: 600, lineHeight: "1.4" }}>{card.clienteNome}</span>
        <span className="text-[10.5px] text-certifica-500 block mt-0.5" style={{ fontWeight: 400 }}>{card.titulo}</span>
      </div>
      <div className="px-2.5 pb-2 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Users className="w-3 h-3 text-certifica-500/30" strokeWidth={1.5} />
          <span className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>{card.contato.nome}</span>
        </div>
        <span className="text-[9px] text-certifica-500/30">&middot;</span>
        <span className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>{card.norma}</span>
      </div>
      <div className="px-2.5 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-[3px] bg-certifica-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#1F5E3B" : "#2B8EAD" }} />
          </div>
          <span className="text-[9px] text-certifica-500 font-mono flex-shrink-0" style={{ fontWeight: 500 }}>{entC}/{entT}</span>
        </div>
      </div>
      <div className="px-2.5 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3 h-3 text-certifica-500/30" strokeWidth={1.5} />
          <span className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>{card.consultor}</span>
        </div>
        {card.diasRestantes > 0 && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] ${
            isCritical ? "bg-nao-conformidade/8 text-nao-conformidade" : isUrgent ? "bg-observacao/8 text-observacao" : "bg-certifica-50 text-certifica-500"
          }`}>
            <Clock className="w-3 h-3" strokeWidth={1.5} />
            <span className="text-[9px] font-mono" style={{ fontWeight: 500 }}>{card.diasRestantes}d</span>
          </div>
        )}
      </div>
      <div className="px-2.5 pb-2 border-t border-certifica-200/60 pt-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-certifica-500">Valor do negocio</span>
          <span className="text-[10px] text-certifica-500 font-mono" style={{ fontWeight: 600 }}>{card.valor}</span>
        </div>
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════════
   Card Detail Overlay (Pipefy style)
   ══════════════════════════════════════════════════════════ */

function CardDetailOverlay({
  card,
  columns,
  cardMeta,
  onClose,
  moveCard,
  onUpdateCard,
  onUpdateCardMeta,
  onDeleteCard,
}: {
  card: PipelineCard;
  columns: ColumnConfig[];
  cardMeta: CardMeta;
  onClose: () => void;
  moveCard: (id: string, columnId: string, idx?: number) => void;
  onUpdateCard: (cardId: string, patch: Partial<PipelineCard>) => void;
  onUpdateCardMeta: (cardId: string, updater: (meta: CardMeta) => CardMeta) => void;
  onDeleteCard: (id: string, columnId: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pr = prioridadeConfig[card.prioridade];
  const entC = card.entregaveis.filter((e) => e.concluido).length;
  const entT = card.entregaveis.length;
  const pct = entT > 0 ? Math.round((entC / entT) * 100) : 0;
  const [activeTab, setActiveTab] = useState<"atividades" | "anexos" | "checklists" | "comentarios">("atividades");
  const [commentInput, setCommentInput] = useState("");
  const [checklistInput, setChecklistInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [activityInput, setActivityInput] = useState("");
  const [attachmentDraft, setAttachmentDraft] = useState({ name: "", type: "Arquivo", url: "" });

  const allColumnIds = columns.map((c) => c.id);
  const currentIndex = columns.findIndex((c) => c.id === card.columnId);
  const nextColumnIds = currentIndex >= 0 ? columns.slice(currentIndex + 1).map((c) => c.id) : [];
  const prevColumnId = currentIndex > 0 ? columns[currentIndex - 1].id : null;
  const getColLabel = (colId: string) => columns.find((c) => c.id === colId)?.label ?? colId;
  const getColColor = (colId: string) => columns.find((c) => c.id === colId)?.color ?? "#6B7280";
  const getPrioridadeTemperatura = (p: PipelineCard["prioridade"]) => (p === "alta" ? "Quente" : p === "media" ? "Morno" : "Frio");
  const fixedTags = [card.norma, getPrioridadeTemperatura(card.prioridade), getColLabel(card.columnId)];

  const toIsoDate = (br: string) => {
    if (!br || br === "—") return "";
    const [dd, mm, yyyy] = br.split("/");
    if (!dd || !mm || !yyyy) return "";
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  };
  const toBrDate = (iso: string) => {
    if (!iso) return "—";
    const [yyyy, mm, dd] = iso.split("-");
    if (!dd || !mm || !yyyy) return "—";
    return `${dd}/${mm}/${yyyy}`;
  };

  const updateContato = (patch: Partial<Contato>) => {
    onUpdateCard(card.id, { contato: { ...card.contato, ...patch } });
  };

  const updatePrevisao = (iso: string) => {
    if (!iso) {
      onUpdateCard(card.id, { previsao: "—", diasRestantes: -1 });
      return;
    }
    const dueDate = new Date(`${iso}T00:00:00`);
    const now = new Date();
    const diasRestantes = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    onUpdateCard(card.id, { previsao: toBrDate(iso), diasRestantes });
  };

  const addComment = () => {
    const value = commentInput.trim();
    if (!value) return;
    onUpdateCardMeta(card.id, (meta) => ({ ...meta, comments: [value, ...meta.comments] }));
    setCommentInput("");
  };

  const addChecklist = () => {
    const value = checklistInput.trim();
    if (!value) return;
    const next = [...card.entregaveis, { id: `e${Date.now()}`, texto: value, concluido: false }];
    onUpdateCard(card.id, { entregaveis: next });
    setChecklistInput("");
  };

  const addTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    onUpdateCardMeta(card.id, (meta) => {
      if (meta.tags.includes(value)) return meta;
      return { ...meta, tags: [...meta.tags, value] };
    });
    setTagInput("");
  };

  const addAttachment = () => {
    const name = attachmentDraft.name.trim();
    if (!name) return;
    let nextCount = card.totalDocumentos;
    onUpdateCardMeta(card.id, (meta) => {
      const nextAttachments = [
        ...meta.attachments,
        { id: `att-${Date.now()}`, name, type: attachmentDraft.type.trim() || "Arquivo", url: attachmentDraft.url.trim() || undefined },
      ];
      nextCount = nextAttachments.length;
      return { ...meta, attachments: nextAttachments };
    });
    onUpdateCard(card.id, { totalDocumentos: nextCount });
    setAttachmentDraft({ name: "", type: "Arquivo", url: "" });
  };

  const addActivity = () => {
    const text = activityInput.trim();
    if (!text) return;
    onUpdateCardMeta(card.id, (meta) => ({
      ...meta,
      activities: [{ id: `act-${Date.now()}`, at: "agora", text }, ...meta.activities],
    }));
    setActivityInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex" style={{ animation: "overlayFadeIn .25s ease-out" }}>
      <div className="absolute inset-0 bg-certifica-dark/50" onClick={onClose} style={{ animation: "overlayBackdrop .3s ease-out" }} />
      <div className="relative ml-auto bg-white w-full max-w-[1080px] h-full flex flex-col shadow-[-4px_0_24px_rgba(0,0,0,0.08)]" style={{ animation: "overlaySlideIn .3s cubic-bezier(.22,1,.36,1)" }}>
        <div className="px-5 py-3 border-b border-certifica-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-certifica-accent font-mono px-1.5 py-0.5 bg-certifica-accent-light rounded-[2px]" style={{ fontWeight: 600 }}>{card.codigo}</span>
            <span className="text-[15px] text-certifica-900" style={{ fontWeight: 600 }}>{card.clienteNome}</span>
          </div>
          <div className="flex items-center gap-1">
            {confirmDelete ? (
              <>
                <span className="text-[11px] text-certifica-500 mr-1">Apagar card?</span>
                <button onClick={() => onDeleteCard(card.id, card.columnId)}
                  className="px-2.5 py-1 text-[11px] bg-nao-conformidade text-white rounded-[4px] cursor-pointer hover:opacity-90 transition-opacity" style={{ fontWeight: 600 }}>
                  Confirmar
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1 text-[11px] border border-certifica-200 text-certifica-500 rounded-[4px] cursor-pointer hover:text-certifica-dark transition-colors" style={{ fontWeight: 500 }}>
                  Cancelar
                </button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                title="Apagar card"
                className="p-1.5 text-certifica-500/30 hover:text-nao-conformidade transition-colors cursor-pointer">
                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-certifica-500/40 hover:text-certifica-dark transition-colors cursor-pointer">
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="w-full lg:w-[350px] lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-certifica-200 overflow-y-auto max-h-[45vh] lg:max-h-none">
            <div className="px-4 py-3 border-b border-certifica-200 space-y-2">
              <label className="text-[10px] text-certifica-500 uppercase tracking-[0.06em]" style={{ fontWeight: 600 }}>Título</label>
              <input value={card.titulo} onChange={(e) => onUpdateCard(card.id, { titulo: e.target.value })}
                className="w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px] bg-white" />
              <div className="grid grid-cols-2 gap-2">
                <select value={card.consultor} onChange={(e) => onUpdateCard(card.id, { consultor: e.target.value, equipe: [e.target.value] })}
                  className="h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white">
                  {consultores.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={card.prioridade} onChange={(e) => onUpdateCard(card.id, { prioridade: e.target.value as PipelineCard["prioridade"] })}
                  className="h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white">
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>
              <div className="text-[10px] text-certifica-500">Prioridade atual: {pr.label}</div>
            </div>

            <div className="px-4 py-3 border-b border-certifica-200 space-y-2">
              <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>Contato</div>
              <input value={card.contato.nome} onChange={(e) => updateContato({ nome: e.target.value })} placeholder="Nome"
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" />
              <input value={card.contato.cargo} onChange={(e) => updateContato({ cargo: e.target.value })} placeholder="Cargo"
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" />
              <input value={card.contato.email} onChange={(e) => updateContato({ email: e.target.value })} placeholder="E-mail"
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" />
              <input value={card.contato.telefone} onChange={(e) => updateContato({ telefone: e.target.value })} placeholder="Telefone"
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" />
            </div>

            <div className="px-4 py-3 border-b border-certifica-200 space-y-2">
              <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>Empresa</div>
              <input value={card.clienteNome} onChange={(e) => onUpdateCard(card.id, { clienteNome: e.target.value })}
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" placeholder="Empresa" />
              <input value={card.clienteCnpj} onChange={(e) => onUpdateCard(card.id, { clienteCnpj: e.target.value })}
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" placeholder="CNPJ" />
              <input value={card.clienteSegmento} onChange={(e) => onUpdateCard(card.id, { clienteSegmento: e.target.value })}
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" placeholder="Segmento" />
              <input value={card.clienteEndereco} onChange={(e) => onUpdateCard(card.id, { clienteEndereco: e.target.value })}
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" placeholder="Endereço" />
            </div>

            <div className="px-4 py-3 border-b border-certifica-200 space-y-2">
              <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>Comercial</div>
              <input value={card.norma} onChange={(e) => onUpdateCard(card.id, { norma: e.target.value })}
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" placeholder="Norma" />
              <input value={card.valor} onChange={(e) => onUpdateCard(card.id, { valor: e.target.value })}
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white font-mono" placeholder="Valor" />
              <input value={card.condicoesPagamento} onChange={(e) => onUpdateCard(card.id, { condicoesPagamento: e.target.value })}
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" placeholder="Condições de pagamento" />
            </div>

            <div className="px-4 py-3 border-b border-certifica-200 space-y-2">
              <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>Cronograma</div>
              <label className="text-[10px] text-certifica-500">Início</label>
              <input type="date" value={toIsoDate(card.inicio)} onChange={(e) => onUpdateCard(card.id, { inicio: toBrDate(e.target.value) })}
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" />
              <label className="text-[10px] text-certifica-500">Previsão</label>
              <input type="date" value={toIsoDate(card.previsao)} onChange={(e) => updatePrevisao(e.target.value)}
                className="w-full h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] bg-white" />
              <div className="text-[10px] text-certifica-500">Restante: {card.diasRestantes > 0 ? `${card.diasRestantes} dias` : "sem prazo"}</div>
            </div>

            <div className="px-4 py-3 space-y-2">
              <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>Escopo e observações</div>
              <textarea value={card.escopo} onChange={(e) => onUpdateCard(card.id, { escopo: e.target.value })} rows={3}
                className="w-full px-2 py-1.5 border border-certifica-200 rounded-[4px] text-[11px] bg-white resize-y" />
              <textarea value={card.observacoes} onChange={(e) => onUpdateCard(card.id, { observacoes: e.target.value })} rows={3}
                className="w-full px-2 py-1.5 border border-certifica-200 rounded-[4px] text-[11px] bg-white resize-y" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-3 border-b border-certifica-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 600 }}>Fase atual</span>
                <span className="px-2.5 py-0.5 rounded-[2px] text-white text-[11px]" style={{ backgroundColor: getColColor(card.columnId), fontWeight: 600 }}>
                  {getColLabel(card.columnId)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {fixedTags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-certifica-50 border border-certifica-200 rounded-full text-[10px] text-certifica-700">
                    <Tag className="w-3 h-3" strokeWidth={1.5} />
                    {tag}
                  </span>
                ))}
                {cardMeta.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-certifica-accent-light border border-certifica-accent/20 rounded-full text-[10px] text-certifica-accent">
                    <Tag className="w-3 h-3" strokeWidth={1.5} />
                    {tag}
                    <button onClick={() => onUpdateCardMeta(card.id, (meta) => ({ ...meta, tags: meta.tags.filter((t) => t !== tag) }))}>
                      <X className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px] w-[220px]"
                  placeholder="Nova tag personalizada"
                />
                <button onClick={addTag} className="h-8 px-2.5 text-[11px] rounded-[4px] bg-certifica-accent text-white">Adicionar tag</button>
              </div>
            </div>

            <div className="px-5 py-2 border-b border-certifica-200 bg-certifica-50/50 flex items-center gap-1.5">
              {[
                { id: "atividades", label: "Atividades", icon: FileText },
                { id: "anexos", label: "Anexos", icon: Paperclip },
                { id: "checklists", label: "Checklists", icon: CheckCircle2 },
                { id: "comentarios", label: "Comentários", icon: MessageSquare },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as "atividades" | "anexos" | "checklists" | "comentarios")}
                  className={`h-7 px-2.5 rounded-[3px] text-[11px] flex items-center gap-1.5 transition-colors ${
                    activeTab === tab.id ? "bg-white border border-certifica-200 text-certifica-dark" : "text-certifica-500 hover:text-certifica-dark"
                  }`}
                  style={{ fontWeight: activeTab === tab.id ? 600 : 400 }}
                >
                  <tab.icon className="w-3 h-3" strokeWidth={1.5} />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "atividades" && (
              <div className="px-5 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={activityInput} onChange={(e) => setActivityInput(e.target.value)} placeholder="Nova atividade"
                    className="flex-1 h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px]" />
                  <button onClick={addActivity} className="h-8 px-2.5 text-[11px] rounded-[4px] bg-certifica-accent text-white">Registrar</button>
                </div>
                {cardMeta.activities.map((activity) => (
                  <div key={activity.id} className="border border-certifica-200 rounded-[4px] px-3 py-2 bg-white">
                    <div className="text-[10px] text-certifica-500 mb-1">{activity.at}</div>
                    <div className="text-[12px] text-certifica-dark">{activity.text}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "anexos" && (
              <div className="px-5 py-3">
                <div className="space-y-1.5 mb-3">
                  {cardMeta.attachments.map((file) => (
                    <div key={file.id} className="flex items-center gap-2 border border-certifica-200 bg-white rounded-[4px] px-3 py-2">
                      <div className="flex-1">
                        <div className="text-[12px] text-certifica-dark">{file.name}</div>
                        {file.url && <div className="text-[10px] text-certifica-500">{file.url}</div>}
                      </div>
                      <span className="text-[10px] px-1.5 py-px bg-certifica-50 border border-certifica-200 rounded-[2px]">{file.type}</span>
                      <button onClick={() => {
                        let nextCount = card.totalDocumentos;
                        onUpdateCardMeta(card.id, (meta) => {
                          const nextAttachments = meta.attachments.filter((a) => a.id !== file.id);
                          nextCount = nextAttachments.length;
                          return { ...meta, attachments: nextAttachments };
                        });
                        onUpdateCard(card.id, { totalDocumentos: nextCount });
                      }} className="text-certifica-500/50 hover:text-nao-conformidade">
                        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input value={attachmentDraft.name} onChange={(e) => setAttachmentDraft((p) => ({ ...p, name: e.target.value }))} placeholder="Nome"
                    className="h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px]" />
                  <input value={attachmentDraft.type} onChange={(e) => setAttachmentDraft((p) => ({ ...p, type: e.target.value }))} placeholder="Tipo"
                    className="h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px]" />
                  <input value={attachmentDraft.url} onChange={(e) => setAttachmentDraft((p) => ({ ...p, url: e.target.value }))} placeholder="URL (opcional)"
                    className="h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px]" />
                </div>
                <button onClick={addAttachment} className="mt-2 h-8 px-3 text-[11px] rounded-[4px] bg-certifica-accent text-white">Adicionar anexo</button>
              </div>
            )}

            {activeTab === "checklists" && (
              <div className="px-5 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
                    Checklists ({entC}/{entT})
                  </div>
                  <span className="text-[12px] text-certifica-900 font-mono" style={{ fontWeight: 600 }}>{pct}%</span>
                </div>
                <div className="h-[5px] bg-certifica-200 rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#1F5E3B" : "#2B8EAD" }} />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input value={checklistInput} onChange={(e) => setChecklistInput(e.target.value)} placeholder="Novo item de checklist"
                    className="flex-1 h-8 px-2 border border-certifica-200 rounded-[4px] text-[11px]" />
                  <button onClick={addChecklist} className="h-8 px-2.5 text-[11px] rounded-[4px] bg-certifica-accent text-white">Adicionar</button>
                </div>
                <div className="space-y-0.5">
                  {card.entregaveis.map((ent, idx) => (
                    <div key={ent.id} className="flex items-start gap-2 py-2 border-b border-certifica-200/50 last:border-0">
                      <button onClick={() => onUpdateCard(card.id, {
                        entregaveis: card.entregaveis.map((item) => item.id === ent.id ? { ...item, concluido: !item.concluido } : item),
                      })} className="mt-px flex-shrink-0">
                        {ent.concluido ? <CheckCircle2 className="w-4 h-4 text-conformidade" strokeWidth={1.5} /> : <Circle className="w-4 h-4 text-certifica-200" strokeWidth={1.5} />}
                      </button>
                      <input
                        value={ent.texto}
                        onChange={(e) => onUpdateCard(card.id, {
                          entregaveis: card.entregaveis.map((item) => item.id === ent.id ? { ...item, texto: e.target.value } : item),
                        })}
                        className={`text-[12px] flex-1 bg-transparent border-0 p-0 focus:outline-none ${ent.concluido ? "text-certifica-500 line-through" : "text-certifica-dark"}`}
                      />
                      <button onClick={() => onUpdateCard(card.id, { entregaveis: card.entregaveis.filter((item) => item.id !== ent.id) })}
                        className="text-certifica-500/40 hover:text-nao-conformidade">
                        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                      <span className="text-[9px] text-certifica-500/30 font-mono">{String(idx + 1).padStart(2, "0")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "comentarios" && (
              <div className="px-5 py-3">
                <div className="space-y-2 mb-3">
                  {cardMeta.comments.map((comment, idx) => (
                    <div key={`${idx}-${comment}`} className="border border-certifica-200 rounded-[4px] bg-white px-3 py-2 flex items-start gap-2">
                      <div className="text-[12px] text-certifica-dark flex-1" style={{ lineHeight: "1.5" }}>{comment}</div>
                      <button onClick={() => onUpdateCardMeta(card.id, (meta) => ({ ...meta, comments: meta.comments.filter((_, i) => i !== idx) }))}>
                        <X className="w-3.5 h-3.5 text-certifica-500/40 hover:text-nao-conformidade" strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  rows={3}
                  placeholder="Digite aqui..."
                  className="w-full px-3 py-2 rounded-[4px] border border-certifica-200 bg-white text-[12px] resize-y"
                />
                <div className="mt-2 flex justify-end">
                  <button onClick={addComment} className="h-8 px-3 rounded-[4px] bg-certifica-accent text-white text-[11px]" style={{ fontWeight: 600 }}>
                    Adicionar nota
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="w-[220px] flex-shrink-0 border-l border-certifica-200 overflow-y-auto bg-certifica-50/50">
            <div className="px-3.5 py-3 border-b border-certifica-200">
              <span className="text-[11px] text-certifica-900" style={{ fontWeight: 600 }}>Mover card para fase</span>
            </div>
            <div className="px-3.5 py-3 space-y-2">
              {nextColumnIds.map((colId) => (
                <button key={colId} onClick={() => moveCard(card.id, colId)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-[3px] border transition-colors cursor-pointer hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  style={{ borderColor: `${getColColor(colId)}40`, backgroundColor: `${getColColor(colId)}08` }}>
                  <span className="text-[11px]" style={{ fontWeight: 500, color: getColColor(colId) }}>{getColLabel(colId)}</span>
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} style={{ color: getColColor(colId) }} />
                </button>
              ))}
              {nextColumnIds.length === 0 && (
                <div className="py-3 text-center">
                  <CheckCircle2 className="w-5 h-5 text-conformidade mx-auto mb-1.5" strokeWidth={1.5} />
                  <span className="text-[11px] text-certifica-500">Última fase</span>
                </div>
              )}
              {prevColumnId !== null && (
                <div className="pt-2 border-t border-certifica-200 mt-3">
                  <button onClick={() => moveCard(card.id, prevColumnId)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-[3px] border border-certifica-200 bg-white transition-colors cursor-pointer hover:border-certifica-accent/30">
                    <ChevronLeft className="w-3.5 h-3.5 text-certifica-500" strokeWidth={1.5} />
                    <span className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>{getColLabel(prevColumnId)}</span>
                  </button>
                </div>
              )}
            </div>
            <div className="px-3.5 py-3 border-t border-certifica-200 mt-2">
              <span className="text-[9px] tracking-[0.06em] uppercase text-certifica-500/60 block mb-2" style={{ fontWeight: 600 }}>Fases</span>
              {allColumnIds.map((colId) => (
                <div key={colId} className={`flex items-center gap-2 py-1 ${colId === card.columnId ? "opacity-100" : "opacity-40"}`}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getColColor(colId) }} />
                  <span className="text-[10px] text-certifica-dark" style={{ fontWeight: colId === card.columnId ? 600 : 400 }}>{getColLabel(colId)}</span>
                  {colId === card.columnId && <span className="text-[8px] text-certifica-accent ml-auto" style={{ fontWeight: 600 }}>ATUAL</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Gantt View
   ══════════════════════════════════════════════════════════ */

function GanttView({ cards, columns, onSelectCard }: { cards: PipelineCard[]; columns: ColumnConfig[]; onSelectCard: (c: PipelineCard) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);

  // Only show cards with valid dates
  const ganttCards = useMemo(() => {
    return cards
      .filter((c) => c.inicio !== "—" && c.previsao !== "—")
      .sort((a, b) => a.fase - b.fase || a.inicio.localeCompare(b.inicio));
  }, [cards]);

  const parseDate = (d: string) => {
    const [dd, mm, yyyy] = d.split("/");
    return new Date(+yyyy, +mm - 1, +dd);
  };

  const toDayOffset = (date: Date, base: Date) => {
    return Math.max(0, Math.floor((date.getTime() - base.getTime()) / 86400000));
  };

  const getColColorByFase = (fase: number) =>
    columns[fase]?.color ?? FALLBACK_COLORS[fase % FALLBACK_COLORS.length];

  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (ganttCards.length === 0) return { minDate: new Date(), maxDate: new Date(), totalDays: 1 };
    let min = parseDate(ganttCards[0].inicio);
    let max = parseDate(ganttCards[0].previsao);
    ganttCards.forEach((c) => {
      const s = parseDate(c.inicio);
      const e = parseDate(c.previsao);
      if (s < min) min = s;
      if (e > max) max = e;
    });
    min = new Date(min.getTime() - 15 * 86400000);
    max = new Date(max.getTime() + 15 * 86400000);
    const days = Math.ceil((max.getTime() - min.getTime()) / 86400000);
    return { minDate: min, maxDate: max, totalDays: days };
  }, [ganttCards]);

  const dayWidth = 3.2;
  const timelineWidth = Math.max(1400, totalDays * dayWidth);

  const months = useMemo(() => {
    const result: { label: string; startDay: number; widthDay: number }[] = [];
    const cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cur <= maxDate) {
      const monthStart = Math.max(0, (cur.getTime() - minDate.getTime()) / 86400000);
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const monthEnd = Math.min(totalDays, (nextMonth.getTime() - minDate.getTime()) / 86400000);
      result.push({
        label: cur.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""),
        startDay: monthStart,
        widthDay: monthEnd - monthStart,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
    return result;
  }, [minDate, maxDate, totalDays]);

  const today = new Date();
  const todayX = Math.max(0, Math.min(timelineWidth, toDayOffset(today, minDate) * dayWidth));

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select")) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartScrollRef.current = scroller.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStartXRef.current;
    scroller.scrollLeft = dragStartScrollRef.current - deltaX;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  if (ganttCards.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[12.5px] text-certifica-500" style={{ fontWeight: 400 }}>Nenhum projeto com datas para exibir no Gantt.</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto px-5 py-4"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ userSelect: "none" }}
    >
      <div className="min-w-[1100px]">
        {/* Month headers */}
        <div className="flex h-7 mb-0.5 border-b border-certifica-200">
          <div className="w-[220px] flex-shrink-0 flex items-center px-3">
            <span className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>Projeto</span>
          </div>
          <div className="relative" style={{ width: timelineWidth }}>
            {months.map((m, i) => {
              const leftPx = m.startDay * dayWidth;
              const widthPx = Math.max(1, m.widthDay * dayWidth);
              return (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-certifica-200/60 text-[10px] text-certifica-500 flex items-center justify-center"
                  style={{ left: leftPx, width: widthPx, fontWeight: 400 }}
                >
                  {widthPx > 54 ? m.label : ""}
                </div>
              );
            })}
            <div className="absolute top-0 bottom-0 w-px bg-certifica-200/60" style={{ left: timelineWidth }} />
            <div className="absolute top-0 bottom-0 w-px bg-nao-conformidade/45 z-10" style={{ left: todayX }}>
              <div className="absolute -top-0 left-1/2 -translate-x-1/2 px-1 py-px bg-nao-conformidade text-white text-[7px] rounded-[1px]" style={{ fontWeight: 600 }}>
                Hoje
              </div>
            </div>
          </div>
        </div>

        {/* Rows */}
        {ganttCards.map((card) => {
          const startDate = parseDate(card.inicio);
          const endDate = parseDate(card.previsao);
          const entC = card.entregaveis.filter((e) => e.concluido).length;
          const entT = card.entregaveis.length;
          const pct = entT > 0 ? Math.round((entC / entT) * 100) : 0;
          const pr = prioridadeConfig[card.prioridade];
          const barColor = getColColorByFase(card.fase);

          return (
            <div key={card.id} className="flex items-center h-10 border-b border-certifica-200/40 hover:bg-certifica-50/50 cursor-pointer group"
              onClick={() => onSelectCard(card)}>
              {/* Label */}
              <div className="w-[220px] flex-shrink-0 flex items-center gap-2 px-3 overflow-hidden">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${pr.dot}`} />
                <span className="text-[10px] text-certifica-700 font-mono flex-shrink-0" style={{ fontWeight: 600 }}>{card.codigo}</span>
                <span className="text-[11px] text-certifica-dark truncate" style={{ fontWeight: 500 }}>{card.clienteNome.split(" ").slice(0, 2).join(" ")}</span>
              </div>

              {/* Bar */}
              <div className="relative h-full flex items-center" style={{ width: timelineWidth }}>
                {months.map((m, i) => (
                  <div key={i} className="absolute top-0 bottom-0 border-l border-certifica-200/30" style={{ left: m.startDay * dayWidth }} />
                ))}
                <div className="absolute top-0 bottom-0 w-px bg-nao-conformidade/20 z-10" style={{ left: todayX }} />

                <div className="absolute h-5 rounded-[3px] flex items-center overflow-hidden transition-shadow group-hover:shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
                  style={{
                    left: toDayOffset(startDate, minDate) * dayWidth,
                    width: Math.max(8, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) * dayWidth),
                    backgroundColor: barColor + "18",
                    border: `1px solid ${barColor}40`,
                  }}>
                  <div className="absolute left-0 top-0 bottom-0 rounded-l-[2px]"
                    style={{ width: `${pct}%`, backgroundColor: barColor + "30" }} />
                  {Math.max(8, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) * dayWidth) > 90 && (
                    <span className="relative z-10 px-2 text-[9px] truncate" style={{ color: barColor, fontWeight: 600 }}>
                      {card.norma} — {pct}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
