import React, { useState, useCallback } from "react";
import { DSBadge } from "../components/ds/DSBadge";
import { DSButton } from "../components/ds/DSButton";
import {
  Video,
  Link2,
  Play,
  Square,
  Download,
  Search,
  Calendar,
  User,
  Building2,
  Bot,
  Copy,
  ExternalLink,
  Mic,
  CheckCircle2,
  Loader2,
  Plus,
  X,
  Check,
  Edit3,
  FileText,
  RefreshCw,
  Trash2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useMeetings, type MeetingWithClient } from "../lib/useMeetings";
import { useClientes } from "../lib/useClientes";
import { useProjetos } from "../lib/useProjetos";
import { useAuditLog } from "../lib/useAuditLog";
import { useGoogleCalendar } from "../lib/useGoogleCalendar";
import { APIFallback } from "../components/ErrorBoundary";
import type { MeetingAction } from "../lib/database.types";
import { generateMeetingSummary } from "../lib/openai";
import { toast as toastNotify } from "sonner";
import { exportPdf as exportCertificaPdf, buildMeetingPdf } from "../lib/usePdfExport";

type BadgeVariant = "conformidade" | "nao-conformidade" | "observacao" | "oportunidade" | "outline";
type MeetingStatus = "agendada" | "gravando" | "processando" | "transcrita" | "concluida" | "cancelada";

const statusMap: Record<MeetingStatus, { label: string; variant: BadgeVariant }> = {
  agendada: { label: "Agendada", variant: "oportunidade" },
  gravando: { label: "Gravando", variant: "nao-conformidade" },
  processando: { label: "Processando", variant: "observacao" },
  transcrita: { label: "Transcrita", variant: "conformidade" },
  concluida: { label: "Concluída", variant: "conformidade" },
  cancelada: { label: "Cancelada", variant: "outline" },
};

function validateMeetLink(link: string): boolean {
  if (!link) return false;
  const cleaned = link.trim().replace(/\s/g, "");
  if (cleaned.includes("meet.google.com/")) return true;
  if (cleaned.includes("zoom.us/")) return true;
  if (cleaned.includes("teams.microsoft.com/")) return true;
  return false;
}

function formatDuration(min: number): string {
  if (!min || min <= 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${m > 0 ? `${m}min` : ""}`.trim();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ── Toast component ── */
function Toast({ message, type, onClose }: { message: string; type: "error" | "success"; onClose: () => void }) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-[9999] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border text-[13px] animate-in slide-in-from-right ${
      type === "error"
        ? "bg-red-50 border-red-200 text-red-800"
        : "bg-green-50 border-green-200 text-green-800"
    }`}>
      {type === "error" ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 flex-shrink-0" />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 p-0.5 hover:bg-black/5 rounded cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ReunioesPage() {
  const { meetings, loading, error, recallPhase, recallMessage, refetch, create, remove, startRecording, stopRecording, approveResume, editResume, completeMeeting, toggleAction, addAction, updateMeetLink } = useMeetings();
  const clientesHook = useClientes();
  const projetosHook = useProjetos();
  const auditLog = useAuditLog();
  const googleCalendar = useGoogleCalendar();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"resumo" | "transcricao" | "acoes">("resumo");
  const [displayTab, setDisplayTab] = useState<"resumo" | "transcricao" | "acoes">("resumo");
  const [tabFade, setTabFade] = useState<"in" | "out">("in");
  const [editingResume, setEditingResume] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [saving, setSaving] = useState(false);
  const [generatingResume, setGeneratingResume] = useState(false);
  const [showNewAction, setShowNewAction] = useState(false);
  const [newAction, setNewAction] = useState<MeetingAction>({ descricao: "", responsavel: "", prazo: "", concluida: false });
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "error" | "success" } | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(true);

  // Auto-fetch calendar meetings if connected
  React.useEffect(() => {
    if (googleCalendar.connected && googleCalendar.meetings.length === 0) {
      googleCalendar.fetchMeetings(7);
    }
  }, [googleCalendar.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── New meeting form ── */
  const [newMeeting, setNewMeeting] = useState({
    titulo: "",
    cliente_id: "",
    projeto_id: "",
    tipo: "acompanhamento" as "kickoff" | "acompanhamento" | "auditoria" | "analise-critica",
    data: "",
    hora: "",
    meet_link: "",
    participantes: "",
    pauta: "",
  });

  /* ── Selection ── */
  const selected = meetings.find((m) => m.id === selectedId) ?? null;
  const sc = selected ? statusMap[selected.status as MeetingStatus] ?? statusMap.agendada : null;

  React.useEffect(() => {
    if (meetings.length > 0 && !selectedId) {
      setSelectedId(meetings[0].id);
    }
  }, [meetings, selectedId]);

  /* ── Show error from hook as toast ── */
  React.useEffect(() => {
    if (error) {
      setToast({ message: error, type: "error" });
    }
  }, [error]);

  /* ── Filtered list ── */
  const filtered = meetings.filter((m) => {
    if (filterStatus !== "todos" && m.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!m.titulo.toLowerCase().includes(q) && !m.cliente_nome.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const statCounts = React.useMemo(() => ({
    transcritas: meetings.filter((m) => m.status === "transcrita" || m.status === "concluida").length,
    agendadas: meetings.filter((m) => m.status === "agendada").length,
  }), [meetings]);

  /* ── Tab fade ── */
  React.useEffect(() => {
    if (activeTab === displayTab) return;
    setTabFade("out");
    const t = window.setTimeout(() => {
      setDisplayTab(activeTab);
      setTabFade("in");
    }, 130);
    return () => window.clearTimeout(t);
  }, [activeTab, displayTab]);

  /* ── Handlers ── */
  const handleCreate = async () => {
    if (!newMeeting.titulo.trim()) {
      setToast({ message: "Preencha o título da reunião", type: "error" });
      return;
    }
    setSaving(true);
    const dataISO = newMeeting.data && newMeeting.hora
      ? new Date(`${newMeeting.data}T${newMeeting.hora}`).toISOString()
      : newMeeting.data ? new Date(newMeeting.data).toISOString() : null;

    try {
      const result = await create({
        titulo: newMeeting.titulo.trim(),
        tipo: newMeeting.tipo,
        cliente_id: newMeeting.cliente_id || null,
        projeto_id: newMeeting.projeto_id || null,
        data: dataISO,
        duracao_min: 0,
        local: "",
        pauta: newMeeting.pauta,
        participantes: newMeeting.participantes.split(",").map((p) => p.trim()).filter(Boolean),
        status: "agendada",
        ata: "",
        meet_link: newMeeting.meet_link || "",
        resumo: "",
        resumo_aprovado: false,
        resumo_historico: [] as unknown[],
        transcricao: [] as any[],
        acoes: [] as any[],
        gravacao_url: "",
        gravacao_inicio: null,
        gravacao_fim: null,
      } as any);

      if (result) {
        setSelectedId(result.id);
        auditLog.log({ tabela: "meetings", registro_id: result.id, acao: "INSERT", dados_depois: result });
        setToast({ message: "Reunião criada com sucesso!", type: "success" });
        setShowNewModal(false);
        setNewMeeting({ titulo: "", cliente_id: "", projeto_id: "", tipo: "acompanhamento", data: "", hora: "", meet_link: "", participantes: "", pauta: "" });
      } else {
        setToast({ message: "Erro ao criar reunião. Verifique o console para detalhes.", type: "error" });
      }
    } catch (e: unknown) {
      setToast({ message: e instanceof Error ? e.message : "Erro desconhecido ao criar reunião", type: "error" });
    }
    setSaving(false);
  };

  const handleStartRecording = async () => {
    if (!selected) return;
    if (!selected.meet_link) {
      setToast({ message: "Adicione um link de reunião antes de gravar", type: "error" });
      return;
    }
    setSaving(true);
    const ok = await startRecording(selected.id);
    if (ok) {
      auditLog.log({ tabela: "meetings", registro_id: selected.id, acao: "UPDATE", dados_depois: { status: "gravando" } });
      setToast({ message: "Bot enviado! Entrando na reunião...", type: "success" });
    }
    setSaving(false);
  };

  const handleStopRecording = async () => {
    if (!selected) return;
    setSaving(true);
    await stopRecording(selected.id);
    auditLog.log({ tabela: "meetings", registro_id: selected.id, acao: "UPDATE", dados_depois: { status: "processando" } });
    setSaving(false);
  };

  const handleApproveResume = async () => {
    if (!selected) return;
    await approveResume(selected.id);
    auditLog.log({ tabela: "meetings", registro_id: selected.id, acao: "UPDATE", dados_depois: { resumo_aprovado: true } });
  };

  const handleSaveResume = async () => {
    if (!selected) return;
    setSaving(true);
    await editResume(selected.id, resumeText);
    auditLog.log({ tabela: "meetings", registro_id: selected.id, acao: "UPDATE", dados_depois: { resumo: resumeText } });
    setEditingResume(false);
    setSaving(false);
  };

  const handleGenerateResumeAI = async () => {
    if (!selected) return;
    const transcricao = selected.transcricao ?? [];
    if (transcricao.length === 0) {
      toastNotify.warning("Nenhuma transcrição disponível para gerar resumo.");
      return;
    }
    setGeneratingResume(true);
    try {
      const transcricaoText = transcricao.map((l: any) => `[${l.time}] ${l.speaker}: ${l.text}`).join("\n");
      const resumo = await generateMeetingSummary(
        selected.titulo,
        selected.participantes ?? [],
        transcricaoText
      );
      await editResume(selected.id, resumo);
      toastNotify.success("Resumo gerado com sucesso!");
    } catch (err: any) {
      toastNotify.error("Erro ao gerar resumo: " + (err?.message ?? "tente novamente"));
    } finally {
      setGeneratingResume(false);
    }
  };

  const handleComplete = async () => {
    if (!selected) return;
    await completeMeeting(selected.id);
    auditLog.log({ tabela: "meetings", registro_id: selected.id, acao: "UPDATE", dados_depois: { status: "concluida" } });
  };

  const handleToggleAction = async (idx: number) => {
    if (!selected) return;
    await toggleAction(selected.id, idx);
  };

  const handleAddAction = async () => {
    if (!selected || !newAction.descricao) return;
    await addAction(selected.id, newAction);
    setNewAction({ descricao: "", responsavel: "", prazo: "", concluida: false });
    setShowNewAction(false);
  };

  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      if (selected) {
        auditLog.log({ tabela: "meetings", registro_id: selected.id, acao: "UPDATE", dados_depois: { copiado: field } });
      }
      setTimeout(() => setCopiedField(null), 2000);
    } catch { /* */ }
  }, [selected, auditLog]);

  const exportPdf = useCallback(() => {
    if (!selected) return;
    const doc = buildMeetingPdf({
      titulo: selected.titulo,
      data: `${formatDate(selected.data)} ${formatTime(selected.data)}`,
      participantes: selected.participantes,
      transcript: selected.transcricao,
      acoes: selected.acoes.map((a) => `${a.descricao} — ${a.responsavel} (prazo: ${a.prazo}) ${a.concluida ? "✅" : "⏳"}`),
      resumo: selected.resumo ?? undefined,
    });
    exportCertificaPdf(doc);
    toastNotify.success("PDF gerado! Use Ctrl+P para salvar.");
    auditLog.log({ tabela: "meetings", registro_id: selected.id, acao: "UPDATE", dados_depois: { exportado_pdf: true } });
  }, [selected, auditLog]);

  /* ── Loading / Error ── */
  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row lg:h-full overflow-auto lg:overflow-hidden">
        <div className="w-full lg:w-[300px] lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-certifica-200 bg-white flex flex-col min-h-[200px] lg:min-h-0">
          <div className="px-3 py-3 border-b border-certifica-200">
            <div className="h-6 w-20 bg-certifica-200/60 rounded animate-pulse mb-2" />
            <div className="h-7 w-full bg-certifica-200/60 rounded animate-pulse" />
          </div>
          <div className="flex-1 p-3 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3 w-24 bg-certifica-200/60 rounded animate-pulse" />
                <div className="h-4 w-full bg-certifica-200/60 rounded animate-pulse" />
                <div className="h-3 w-32 bg-certifica-200/60 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center bg-certifica-50/50 min-h-[200px] lg:min-h-0">
          <Loader2 className="w-6 h-6 text-certifica-500/40 animate-spin" />
        </div>
      </div>
    );
  }

  if (error && meetings.length === 0) {
    return (
      <div className="p-5">
        <APIFallback error={error} onRetry={refetch} message="Falha ao carregar reuniões" />
      </div>
    );
  }

  return (
    <>
      {/* Toast notification */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── New Meeting Modal ── */}
      {showNewModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm certifica-modal-backdrop" onClick={() => setShowNewModal(false)} />
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-[520px] mx-4 certifica-modal-content">
            <div className="flex items-center justify-between px-5 py-4 border-b border-certifica-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-certifica-accent/10 rounded-lg flex items-center justify-center">
                  <Video className="w-4 h-4 text-certifica-accent" strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-[14px] text-certifica-900" style={{ fontWeight: 600 }}>Nova Reunião</h3>
                  <p className="text-[11px] text-certifica-500">Preencha os dados e o Certifica cuida do resto</p>
                </div>
              </div>
              <button onClick={() => setShowNewModal(false)} className="p-1.5 hover:bg-certifica-100 rounded-md cursor-pointer transition-colors">
                <X className="w-4 h-4 text-certifica-500" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3.5">
              <div>
                <label className="text-[11px] text-certifica-500 mb-1 block" style={{ fontWeight: 500 }}>Título *</label>
                <input
                  value={newMeeting.titulo}
                  onChange={(e) => setNewMeeting((p) => ({ ...p, titulo: e.target.value }))}
                  className="w-full h-10 px-3 bg-white border border-certifica-200 rounded-md text-[13px] text-certifica-dark placeholder:text-certifica-500/40 focus:outline-none focus:ring-2 focus:ring-certifica-accent/30 focus:border-certifica-accent/50"
                  placeholder="Ex: Reunião de kick-off - ISO 9001"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] text-certifica-500 mb-1 block" style={{ fontWeight: 500 }}>Link da reunião (Meet, Zoom, Teams)</label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-certifica-500/40" strokeWidth={1.5} />
                  <input
                    value={newMeeting.meet_link}
                    onChange={(e) => setNewMeeting((p) => ({ ...p, meet_link: e.target.value }))}
                    className="w-full h-10 pl-10 pr-3 bg-white border border-certifica-200 rounded-md text-[13px] text-certifica-dark placeholder:text-certifica-500/40 focus:outline-none focus:ring-2 focus:ring-certifica-accent/30 focus:border-certifica-accent/50"
                    placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-certifica-500 mb-1 block" style={{ fontWeight: 500 }}>Cliente</label>
                  <select
                    value={newMeeting.cliente_id}
                    onChange={(e) => setNewMeeting((p) => ({ ...p, cliente_id: e.target.value }))}
                    className="w-full h-10 px-3 bg-white border border-certifica-200 rounded-md text-[12px] text-certifica-dark cursor-pointer focus:outline-none focus:ring-2 focus:ring-certifica-accent/30"
                  >
                    <option value="">Selecionar cliente</option>
                    {clientesHook.clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-certifica-500 mb-1 block" style={{ fontWeight: 500 }}>Tipo</label>
                  <select
                    value={newMeeting.tipo}
                    onChange={(e) => setNewMeeting((p) => ({ ...p, tipo: e.target.value as any }))}
                    className="w-full h-10 px-3 bg-white border border-certifica-200 rounded-md text-[12px] text-certifica-dark cursor-pointer focus:outline-none focus:ring-2 focus:ring-certifica-accent/30"
                  >
                    <option value="kickoff">Kick-off</option>
                    <option value="acompanhamento">Acompanhamento</option>
                    <option value="auditoria">Auditoria</option>
                    <option value="analise-critica">Análise Crítica</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-certifica-500 mb-1 block" style={{ fontWeight: 500 }}>Data</label>
                  <input
                    type="date"
                    value={newMeeting.data}
                    onChange={(e) => setNewMeeting((p) => ({ ...p, data: e.target.value }))}
                    className="w-full h-10 px-3 bg-white border border-certifica-200 rounded-md text-[12px] text-certifica-dark focus:outline-none focus:ring-2 focus:ring-certifica-accent/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-certifica-500 mb-1 block" style={{ fontWeight: 500 }}>Horário</label>
                  <input
                    type="time"
                    value={newMeeting.hora}
                    onChange={(e) => setNewMeeting((p) => ({ ...p, hora: e.target.value }))}
                    className="w-full h-10 px-3 bg-white border border-certifica-200 rounded-md text-[12px] text-certifica-dark focus:outline-none focus:ring-2 focus:ring-certifica-accent/30"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-certifica-500 mb-1 block" style={{ fontWeight: 500 }}>Participantes</label>
                <input
                  value={newMeeting.participantes}
                  onChange={(e) => setNewMeeting((p) => ({ ...p, participantes: e.target.value }))}
                  className="w-full h-10 px-3 bg-white border border-certifica-200 rounded-md text-[13px] placeholder:text-certifica-500/40 focus:outline-none focus:ring-2 focus:ring-certifica-accent/30"
                  placeholder="Nomes separados por vírgula"
                />
              </div>

              <div>
                <label className="text-[11px] text-certifica-500 mb-1 block" style={{ fontWeight: 500 }}>Pauta</label>
                <textarea
                  value={newMeeting.pauta}
                  onChange={(e) => setNewMeeting((p) => ({ ...p, pauta: e.target.value }))}
                  className="w-full h-20 px-3 py-2 bg-white border border-certifica-200 rounded-md text-[13px] placeholder:text-certifica-500/40 resize-none focus:outline-none focus:ring-2 focus:ring-certifica-accent/30"
                  placeholder="Pontos a serem discutidos..."
                />
              </div>
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-certifica-200 bg-certifica-50/30 rounded-b-lg">
              <p className="text-[10.5px] text-certifica-500">* Campo obrigatório</p>
              <div className="flex gap-2">
                <DSButton variant="ghost" size="sm" onClick={() => setShowNewModal(false)}>
                  Cancelar
                </DSButton>
                <DSButton
                  variant="primary"
                  size="sm"
                  onClick={handleCreate}
                  disabled={saving || !newMeeting.titulo.trim()}
                  icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}
                >
                  {saving ? "Criando..." : "Criar reunião"}
                </DSButton>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:h-full overflow-auto lg:overflow-hidden">
        {/* Left — meeting list */}
        <div className="w-full lg:w-[300px] lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-certifica-200 bg-white flex flex-col min-h-[260px] lg:min-h-0">
          <div className="px-3 py-3 border-b border-certifica-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Reuniões</span>
              <div className="flex items-center gap-1.5">
                {meetings.length > 0 && (
                  <DSButton
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-nao-conformidade hover:bg-nao-conformidade/10"
                    onClick={async () => {
                      if (!window.confirm("Tem certeza que deseja apagar todas as reuniões?")) return;
                      for (const m of meetings) await remove(m.id);
                      setSelectedId(null);
                    }}
                    icon={<Trash2 className="w-3 h-3" strokeWidth={1.5} />}
                  >
                    Apagar todas
                  </DSButton>
                )}
                <DSButton
                  variant="primary"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => setShowNewModal(true)}
                  icon={<Plus className="w-3 h-3" strokeWidth={1.5} />}
                >
                  Nova reunião
                </DSButton>
              </div>
            </div>

            {/* Search + filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-certifica-500/40" strokeWidth={1.5} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-7 pl-7 pr-3 bg-certifica-50 border border-certifica-200 rounded-[3px] text-[11px] placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-700/30"
                  placeholder="Buscar reunião..."
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-7 px-2 bg-white border border-certifica-200 rounded-[3px] text-[10.5px] text-certifica-dark cursor-pointer focus:outline-none pr-5"
              >
                <option value="todos">Todas</option>
                <option value="transcrita">Transcritas</option>
                <option value="concluida">Concluídas</option>
                <option value="agendada">Agendadas</option>
                <option value="gravando">Gravando</option>
              </select>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-12 text-center px-4">
                <Video className="w-8 h-8 text-certifica-500/20 mx-auto mb-3" />
                <p className="text-[12px] text-certifica-500 mb-3">Nenhuma reunião encontrada</p>
                <DSButton variant="primary" size="sm" onClick={() => setShowNewModal(true)} icon={<Plus className="w-3 h-3" strokeWidth={1.5} />}>
                  Criar reunião
                </DSButton>
              </div>
            ) : (
              filtered.map((m) => {
                const isActive = m.id === selectedId;
                const ms = statusMap[m.status as MeetingStatus] ?? statusMap.agendada;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-certifica-200/70 transition-colors cursor-pointer ${
                      isActive ? "bg-certifica-50" : "hover:bg-certifica-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        {m.status === "gravando" ? (
                          <span className="w-2 h-2 bg-nao-conformidade rounded-full animate-pulse" />
                        ) : m.status === "transcrita" || m.status === "concluida" ? (
                          <CheckCircle2 className="w-3 h-3 text-conformidade/60" strokeWidth={1.5} />
                        ) : m.status === "processando" ? (
                          <Loader2 className="w-3 h-3 text-observacao animate-spin" strokeWidth={1.5} />
                        ) : (
                          <Calendar className="w-3 h-3 text-certifica-500/40" strokeWidth={1.5} />
                        )}
                        <span className="text-[11px] text-certifica-500 font-mono">
                          {formatDate(m.data)} {formatTime(m.data)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-certifica-500/50">{formatDuration(m.duracao_min)}</span>
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Apagar "${m.titulo}"?`)) {
                              remove(m.id);
                              if (selectedId === m.id) setSelectedId(null);
                            }
                          }}
                          className="p-0.5 rounded hover:bg-nao-conformidade/10 text-certifica-500/30 hover:text-nao-conformidade transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                        </span>
                      </div>
                    </div>
                    <div className="text-[12.5px] text-certifica-dark mb-0.5" style={{ fontWeight: isActive ? 500 : 400, lineHeight: "1.4" }}>
                      {m.titulo}
                    </div>
                    <div className="text-[10.5px] text-certifica-500">
                      {m.cliente_nome} · {m.tipo}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer stats */}
          <div className="px-3 py-2 border-t border-certifica-200 bg-certifica-50/50">
            <div className="flex items-center gap-3 text-[10.5px] text-certifica-500">
              <span>{statCounts.transcritas} transcritas</span>
              <span className="text-certifica-200">|</span>
              <span>{statCounts.agendadas} agendadas</span>
            </div>
          </div>

          {/* ── Google Calendar upcoming meetings ── */}
          <div className="border-t border-certifica-200">
            <button
              onClick={() => setCalendarOpen((o) => !o)}
              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-certifica-50/60 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-certifica-accent" strokeWidth={1.5} />
                <span className="text-[11px] text-certifica-700" style={{ fontWeight: 600 }}>Google Agenda</span>
                {googleCalendar.connected && (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {googleCalendar.connected && googleCalendar.meetings.length > 0 && (
                  <span className="text-[10px] text-certifica-500">{googleCalendar.meetings.length}</span>
                )}
                <span className="text-[10px] text-certifica-500">{calendarOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {calendarOpen && (
              <div className="border-t border-certifica-200/60">
                {!googleCalendar.connected ? (
                  <div className="px-3 py-3 text-center">
                    <p className="text-[10.5px] text-certifica-500 mb-2">Conecte o Google Calendar para ver suas próximas reuniões</p>
                    <DSButton
                      variant="outline"
                      size="sm"
                      className="text-[10.5px]"
                      icon={googleCalendar.connecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calendar className="w-3 h-3" strokeWidth={1.5} />}
                      loading={googleCalendar.connecting}
                      onClick={() => googleCalendar.connect()}
                    >
                      Conectar Calendar
                    </DSButton>
                  </div>
                ) : googleCalendar.meetingsLoading ? (
                  <div className="px-3 py-3 flex items-center justify-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-certifica-500/40 animate-spin" />
                    <span className="text-[10.5px] text-certifica-500">Carregando...</span>
                  </div>
                ) : googleCalendar.meetings.length === 0 ? (
                  <div className="px-3 py-3 flex items-center justify-between">
                    <span className="text-[10.5px] text-certifica-500">Nenhuma reunião nos próximos 7 dias</span>
                    <button
                      onClick={() => googleCalendar.fetchMeetings(7)}
                      className="p-1 hover:bg-certifica-100 rounded cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3 text-certifica-500/50" strokeWidth={1.5} />
                    </button>
                  </div>
                ) : (
                  <div className="max-h-[240px] overflow-y-auto">
                    {googleCalendar.meetings.map((m) => {
                      const start = new Date(m.start_time);
                      const isToday = start.toDateString() === new Date().toDateString();
                      return (
                        <div key={m.id} className="px-3 py-2 border-b border-certifica-200/60 hover:bg-certifica-50/40">
                          <div className="flex items-start justify-between gap-1">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-0.5">
                                {isToday && (
                                  <span className="text-[9px] bg-certifica-accent/10 text-certifica-accent px-1 rounded" style={{ fontWeight: 600 }}>HOJE</span>
                                )}
                                {m.bot_id && (
                                  <span className="text-[9px] bg-nao-conformidade/10 text-nao-conformidade px-1 rounded flex items-center gap-0.5">
                                    <Bot className="w-2.5 h-2.5" strokeWidth={1.5} />
                                    Bot
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-certifica-dark truncate" style={{ fontWeight: 500 }}>
                                {m.title ?? "Reunião"}
                              </p>
                              <p className="text-[10px] text-certifica-500 font-mono">
                                {start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} {start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            {m.meeting_url && (
                              <button
                                onClick={() => window.open(m.meeting_url, "_blank")}
                                title="Abrir reunião"
                                className="flex-shrink-0 p-1 hover:bg-certifica-accent/10 rounded cursor-pointer text-certifica-500 hover:text-certifica-accent transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div className="px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[9.5px] text-certifica-500/50">Próximos 7 dias</span>
                      <button
                        onClick={() => googleCalendar.fetchMeetings(7)}
                        className="p-0.5 hover:bg-certifica-100 rounded cursor-pointer"
                      >
                        <RefreshCw className="w-2.5 h-2.5 text-certifica-500/40" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Center — meeting detail */}
        {selected && sc ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Meeting header */}
            <div className="px-5 py-4 bg-white border-b border-certifica-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <DSBadge variant={sc.variant} className="text-[9px] px-1.5 py-0">{sc.label}</DSBadge>
                    <span className="text-[10px] text-certifica-500">{selected.tipo}</span>
                  </div>
                  <h3 className="text-certifica-900 mb-1">{selected.titulo}</h3>
                  <div className="flex items-center gap-3 text-[12px] text-certifica-500 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-certifica-500/50" strokeWidth={1.5} />
                      <span>{selected.cliente_nome}</span>
                    </div>
                    <span className="text-certifica-200">|</span>
                    <span>{formatDate(selected.data)} {formatTime(selected.data)}</span>
                    {selected.duracao_min > 0 && (
                      <>
                        <span className="text-certifica-200">|</span>
                        <span>{formatDuration(selected.duracao_min)}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selected.meet_link && (
                    <DSButton
                      variant="outline"
                      size="sm"
                      icon={<ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />}
                      onClick={() => window.open(selected.meet_link, "_blank")}
                    >
                      Abrir Meet
                    </DSButton>
                  )}
                  {(selected.status === "transcrita" || selected.status === "concluida") && (
                    <DSButton variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={exportPdf}>
                      Exportar PDF
                    </DSButton>
                  )}
                  {selected.status === "transcrita" && (
                    <DSButton variant="primary" size="sm" icon={<Check className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={handleComplete}>
                      Concluir
                    </DSButton>
                  )}
                </div>
              </div>

              {/* Participants */}
              {selected.participantes.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-[10px] text-certifica-500" style={{ fontWeight: 500 }}>Participantes:</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    {selected.participantes.map((p) => (
                      <span key={p} className="text-[10.5px] bg-certifica-50 border border-certifica-200 text-certifica-dark rounded-[2px] px-1.5 py-px">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Meet link */}
              {selected.meet_link && (
                <div className="flex items-center gap-2 mt-2">
                  <Link2 className="w-3 h-3 text-certifica-500/40" strokeWidth={1.5} />
                  <span className="text-[11px] text-certifica-500 font-mono">{selected.meet_link}</span>
                  <button
                    onClick={() => copyToClipboard(selected.meet_link, "link")}
                    className="text-certifica-500/40 hover:text-certifica-700 transition-colors cursor-pointer"
                  >
                    {copiedField === "link" ? <Check className="w-3 h-3 text-conformidade" /> : <Copy className="w-3 h-3" strokeWidth={1.5} />}
                  </button>
                </div>
              )}
            </div>

            {/* Content — varies by status */}
            {(selected.status === "transcrita" || selected.status === "concluida") ? (
              <>
                {/* Tabs */}
                <div className="px-5 bg-white border-b border-certifica-200 flex gap-0">
                  {([
                    { key: "resumo" as const, label: "Resumo", icon: Bot },
                    { key: "transcricao" as const, label: "Transcrição", icon: FileText },
                    { key: "acoes" as const, label: `Plano de ação (${selected.acoes.length})`, icon: CheckCircle2 },
                  ]).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setActiveTab(t.key)}
                      className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] border-b-2 transition-colors cursor-pointer ${
                        activeTab === t.key
                          ? "text-certifica-dark border-certifica-accent"
                          : "text-certifica-500 border-transparent hover:text-certifica-700"
                      }`}
                      style={{ fontWeight: activeTab === t.key ? 500 : 400 }}
                    >
                      <t.icon className="w-3 h-3" strokeWidth={1.5} />
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className={`flex-1 overflow-y-auto bg-certifica-50/50 transition-opacity duration-200 ${tabFade === "out" ? "opacity-0" : "opacity-100"}`}>
                  {/* ── RESUMO TAB ── */}
                  {displayTab === "resumo" && (
                    <div className="max-w-[640px] mx-auto px-5 py-5 space-y-4">
                      <div className="bg-white border border-certifica-200 rounded-[4px] overflow-hidden">
                        <div className="px-4 py-2.5 bg-certifica-50/50 border-b border-certifica-200 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Bot className="w-3.5 h-3.5 text-oportunidade" strokeWidth={1.5} />
                            <span className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
                              Resumo automático (Certifica)
                            </span>
                            {selected.resumo_aprovado && (
                              <span className="text-[9px] bg-conformidade/10 text-conformidade px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <Check className="w-2.5 h-2.5" /> Aprovado
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyToClipboard(selected.resumo, "resumo")}
                              className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer"
                              title="Copiar resumo"
                            >
                              {copiedField === "resumo" ? <Check className="w-3 h-3 text-conformidade" /> : <Copy className="w-3 h-3" strokeWidth={1.5} />}
                            </button>
                            {!editingResume && (
                              <button
                                onClick={() => { setEditingResume(true); setResumeText(selected.resumo); }}
                                className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer"
                                title="Editar resumo"
                              >
                                <Edit3 className="w-3 h-3" strokeWidth={1.5} />
                              </button>
                            )}
                            <button
                              onClick={handleGenerateResumeAI}
                              disabled={generatingResume}
                              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-certifica-accent/10 text-certifica-accent hover:bg-certifica-accent/20 disabled:opacity-50 cursor-pointer"
                              title="Gerar resumo automaticamente"
                            >
                              {generatingResume ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Bot className="w-2.5 h-2.5" />}
                              {generatingResume ? "Gerando…" : "Gerar Resumo"}
                            </button>
                          </div>
                        </div>
                        <div className="px-4 py-3">
                          {editingResume ? (
                            <div className="space-y-2">
                              <textarea
                                value={resumeText}
                                onChange={(e) => setResumeText(e.target.value)}
                                className="w-full h-32 px-3 py-2 border border-certifica-200 rounded-[3px] text-[13px] text-certifica-dark resize-y focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                                style={{ lineHeight: "1.65" }}
                              />
                              <div className="flex justify-end gap-2">
                                <DSButton variant="ghost" size="sm" onClick={() => setEditingResume(false)}>Cancelar</DSButton>
                                <DSButton variant="primary" size="sm" onClick={handleSaveResume} disabled={saving}>
                                  {saving ? "Salvando..." : "Salvar alterações"}
                                </DSButton>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[13px] text-certifica-dark" style={{ lineHeight: "1.65" }}>
                              {selected.resumo || "Resumo ainda não gerado."}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Approve button */}
                      {selected.resumo && !selected.resumo_aprovado && !editingResume && (
                        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-[4px] px-4 py-3">
                          <div className="flex-1">
                            <p className="text-[12px] text-amber-800" style={{ fontWeight: 500 }}>Resumo pendente de aprovação</p>
                            <p className="text-[11px] text-amber-600/80 mt-0.5">Revise o conteúdo e aprove ou edite antes de concluir.</p>
                          </div>
                          <DSButton variant="primary" size="sm" onClick={handleApproveResume} icon={<Check className="w-3 h-3" />}>
                            Aprovar
                          </DSButton>
                        </div>
                      )}

                      {/* Revision history */}
                      {selected.resumo_historico && (selected.resumo_historico as any[]).length > 0 && (
                        <div className="bg-white border border-certifica-200 rounded-[4px] px-4 py-3">
                          <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
                            Histórico de revisões ({(selected.resumo_historico as any[]).length})
                          </div>
                          <div className="space-y-1.5">
                            {(selected.resumo_historico as any[]).map((h: any, idx: number) => (
                              <div key={h.aprovado_em ?? h.editado_em ?? idx} className="flex items-center gap-2 text-[11px] text-certifica-500">
                                <Clock className="w-3 h-3 text-certifica-500/40" strokeWidth={1.5} />
                                <span>
                                  {h.aprovado_em ? `Aprovado em ${new Date(h.aprovado_em).toLocaleString("pt-BR")}` : ""}
                                  {h.editado_em ? `Editado em ${new Date(h.editado_em).toLocaleString("pt-BR")}` : ""}
                                  {h.aprovado_por ? ` por ${h.aprovado_por}` : ""}
                                  {h.editado_por ? ` por ${h.editado_por}` : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action items preview */}
                      {selected.acoes.length > 0 && (
                        <div className="bg-white border border-certifica-200 rounded-[4px] overflow-hidden">
                          <div className="px-4 py-2.5 bg-certifica-50/50 border-b border-certifica-200">
                            <span className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
                              Ações ({selected.acoes.filter((a) => a.concluida).length}/{selected.acoes.length} concluídas)
                            </span>
                          </div>
                          <div className="px-4 py-3 space-y-2">
                            {selected.acoes.slice(0, 4).map((item, idx) => (
                              <div key={`action-${idx}-${item.descricao.slice(0, 12)}`} className="flex items-start gap-2">
                                <button
                                  onClick={() => handleToggleAction(idx)}
                                  className={`w-4 h-4 border rounded-[2px] flex-shrink-0 mt-0.5 cursor-pointer transition-colors flex items-center justify-center ${
                                    item.concluida ? "bg-conformidade border-conformidade" : "border-certifica-200 hover:border-certifica-700/40"
                                  }`}
                                >
                                  {item.concluida && <Check className="w-2.5 h-2.5 text-white" strokeWidth={2} />}
                                </button>
                                <span className={`text-[12.5px] ${item.concluida ? "line-through text-certifica-500" : "text-certifica-dark"}`} style={{ lineHeight: "1.5" }}>
                                  {item.descricao}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Meeting info */}
                      <div className="bg-white border border-certifica-200 rounded-[4px] px-4 py-3">
                        <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
                          Informações
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Cliente", value: selected.cliente_nome },
                            { label: "Tipo", value: selected.tipo },
                            { label: "Data", value: `${formatDate(selected.data)} ${formatTime(selected.data)}` },
                            { label: "Duração", value: formatDuration(selected.duracao_min) },
                            { label: "Participantes", value: `${selected.participantes.length} pessoas` },
                            { label: "Link Meet", value: selected.meet_link ? "Google Meet" : "—" },
                          ].map((d) => (
                            <div key={d.label} className="flex items-start justify-between py-1">
                              <span className="text-[11px] text-certifica-500">{d.label}</span>
                              <span className="text-[11px] text-certifica-dark text-right" style={{ fontWeight: 500 }}>{d.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── TRANSCRICAO TAB ── */}
                  {displayTab === "transcricao" && (
                    <div className="max-w-[640px] mx-auto px-5 py-5">
                      {selected.transcricao.length > 0 ? (
                        <div className="bg-white border border-certifica-200 rounded-[4px] overflow-hidden">
                          <div className="px-4 py-2.5 bg-certifica-50/50 border-b border-certifica-200 flex items-center justify-between">
                            <span className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
                              Transcrição completa (Certifica)
                            </span>
                            <button
                              onClick={() => {
                                const text = selected.transcricao.map((l) => `[${l.time}] ${l.speaker}: ${l.text}`).join("\n");
                                copyToClipboard(text, "transcricao");
                              }}
                              className="flex items-center gap-1 text-[10px] text-certifica-500 hover:text-certifica-700 cursor-pointer"
                            >
                              {copiedField === "transcricao" ? <Check className="w-3 h-3 text-conformidade" /> : <Copy className="w-3 h-3" strokeWidth={1.5} />}
                              Copiar
                            </button>
                          </div>
                          <div className="divide-y divide-certifica-200/60">
                            {selected.transcricao.map((line, idx) => (
                              <div key={`${line.time}-${idx}`} className="px-4 py-2.5 flex gap-3 hover:bg-certifica-50/30 transition-colors">
                                <div className="flex-shrink-0 w-[60px]">
                                  <span className="text-[10px] text-certifica-500 font-mono">{line.time}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[11px] text-certifica-700" style={{ fontWeight: 500 }}>{line.speaker}</span>
                                  <p className="text-[12.5px] text-certifica-dark mt-0.5" style={{ lineHeight: "1.55" }}>
                                    {line.text}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <FileText className="w-8 h-8 text-certifica-500/30 mx-auto mb-3" />
                          <p className="text-[12px] text-certifica-500">Transcrição não disponível para esta reunião.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── ACOES TAB ── */}
                  {displayTab === "acoes" && (
                    <div className="max-w-[640px] mx-auto px-5 py-5">
                      <div className="bg-white border border-certifica-200 rounded-[4px] overflow-hidden">
                        <div className="px-4 py-2.5 bg-certifica-50/50 border-b border-certifica-200 flex items-center justify-between">
                          <span className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
                            Plano de ação — {selected.acoes.filter((a) => a.concluida).length}/{selected.acoes.length} concluídas
                          </span>
                          <div className="flex items-center gap-1.5">
                            <DSButton
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-certifica-500 border-0"
                              icon={<Plus className="w-3 h-3" strokeWidth={1.5} />}
                              onClick={() => setShowNewAction(true)}
                            >
                              Adicionar
                            </DSButton>
                            <DSButton
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[10px] text-certifica-500 border-0"
                              icon={<Download className="w-3 h-3" strokeWidth={1.5} />}
                              onClick={exportPdf}
                            >
                              Exportar
                            </DSButton>
                          </div>
                        </div>

                        {/* New action form */}
                        {showNewAction && (
                          <div className="px-4 py-3 bg-certifica-50 border-b border-certifica-200 space-y-2">
                            <input
                              value={newAction.descricao}
                              onChange={(e) => setNewAction((p) => ({ ...p, descricao: e.target.value }))}
                              className="w-full h-8 px-3 bg-white border border-certifica-200 rounded-[3px] text-[12px] placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                              placeholder="Descrição da ação *"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                value={newAction.responsavel}
                                onChange={(e) => setNewAction((p) => ({ ...p, responsavel: e.target.value }))}
                                className="h-8 px-3 bg-white border border-certifica-200 rounded-[3px] text-[12px] placeholder:text-certifica-500/40 focus:outline-none"
                                placeholder="Responsável"
                              />
                              <input
                                type="date"
                                value={newAction.prazo}
                                onChange={(e) => setNewAction((p) => ({ ...p, prazo: e.target.value }))}
                                className="h-8 px-3 bg-white border border-certifica-200 rounded-[3px] text-[12px] focus:outline-none"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <DSButton variant="ghost" size="sm" onClick={() => setShowNewAction(false)}>Cancelar</DSButton>
                              <DSButton variant="primary" size="sm" onClick={handleAddAction} disabled={!newAction.descricao}>
                                Adicionar
                              </DSButton>
                            </div>
                          </div>
                        )}

                        <div className="divide-y divide-certifica-200/60">
                          {selected.acoes.length === 0 ? (
                            <div className="py-8 text-center text-[12px] text-certifica-500">Nenhuma ação identificada.</div>
                          ) : (
                            selected.acoes.map((item, idx) => (
                              <div key={`full-action-${idx}-${item.descricao.slice(0, 12)}`} className="px-4 py-3 flex items-start gap-3">
                                <button
                                  onClick={() => handleToggleAction(idx)}
                                  className={`w-4 h-4 border rounded-[2px] flex-shrink-0 mt-0.5 cursor-pointer transition-colors flex items-center justify-center ${
                                    item.concluida ? "bg-conformidade border-conformidade" : "border-certifica-200 hover:border-conformidade/40"
                                  }`}
                                >
                                  {item.concluida && <Check className="w-2.5 h-2.5 text-white" strokeWidth={2} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-[12.5px] mb-1 ${item.concluida ? "line-through text-certifica-500" : "text-certifica-dark"}`} style={{ lineHeight: "1.45" }}>
                                    {item.descricao}
                                  </p>
                                  <div className="flex items-center gap-3 text-[10.5px] text-certifica-500">
                                    {item.responsavel && (
                                      <div className="flex items-center gap-1">
                                        <User className="w-3 h-3 text-certifica-500/40" strokeWidth={1.5} />
                                        <span>{item.responsavel}</span>
                                      </div>
                                    )}
                                    {item.prazo && (
                                      <div className="flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-certifica-500/40" strokeWidth={1.5} />
                                        <span>{item.prazo}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (selected.status === "agendada" || selected.status === "gravando" || selected.status === "processando") ? (
              <div className="flex-1 flex flex-col bg-certifica-50/50">
                {/* ── RECORDING BANNER — always visible when recording/processing ── */}
                {(recallPhase !== "idle" && recallPhase !== "error") && (
                  <div className={`px-5 py-3 border-b flex items-center justify-between ${
                    recallPhase === "recording" ? "bg-red-50 border-red-200" :
                    recallPhase === "done" ? "bg-green-50 border-green-200" :
                    "bg-amber-50 border-amber-200"
                  }`}>
                    <div className="flex items-center gap-3">
                      {recallPhase === "recording" ? (
                        <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                          <Mic className="w-4 h-4 text-red-600 animate-pulse" strokeWidth={1.5} />
                        </div>
                      ) : recallPhase === "done" ? (
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-green-600" strokeWidth={1.5} />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-amber-600 animate-spin" strokeWidth={1.5} />
                        </div>
                      )}
                      <div>
                        <p className={`text-[13px] ${
                          recallPhase === "recording" ? "text-red-800" :
                          recallPhase === "done" ? "text-green-800" :
                          "text-amber-800"
                        }`} style={{ fontWeight: 600 }}>
                          {recallPhase === "recording" ? "Certifica Bot está gravando" :
                           recallPhase === "done" ? "Transcrição concluída!" :
                           "Certifica processando..."}
                        </p>
                        <p className={`text-[11px] ${
                          recallPhase === "recording" ? "text-red-600" :
                          recallPhase === "done" ? "text-green-600" :
                          "text-amber-600"
                        }`}>
                          {recallMessage}
                        </p>
                      </div>
                    </div>
                    {(recallPhase === "recording" || recallPhase === "in_call" || recallPhase === "waiting_room") && (
                      <DSButton
                        variant="destructive"
                        size="sm"
                        icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        onClick={handleStopRecording}
                        disabled={saving}
                      >
                        {saving ? "Encerrando..." : "Terminar gravação"}
                      </DSButton>
                    )}
                  </div>
                )}

                {/* ── MAIN CONTENT — depends on current phase ── */}
                <div className="flex-1 flex items-center justify-center">
                  {(recallPhase === "idle" || recallPhase === "error") && selected.status === "agendada" ? (
                    <div className="text-center max-w-[400px] px-4">
                      <div className="w-12 h-12 bg-certifica-accent/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-6 h-6 text-certifica-accent" strokeWidth={1.5} />
                      </div>
                      <p className="text-[15px] text-certifica-900 mb-1" style={{ fontWeight: 500 }}>Reunião agendada</p>
                      <p className="text-[12px] text-certifica-500 mb-5">
                        {formatDate(selected.data)} às {formatTime(selected.data)}.
                        {selected.meet_link
                          ? " Clique para enviar o bot e gravar automaticamente."
                          : " Cole o link da reunião para gravar automaticamente."}
                      </p>

                      {recallPhase === "error" && recallMessage && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4 text-left">
                          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                          <p className="text-[12px] text-red-700">{recallMessage}</p>
                        </div>
                      )}

                      {selected.meet_link ? (
                        <DSButton
                          variant="primary"
                          size="sm"
                          icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" strokeWidth={1.5} />}
                          onClick={handleStartRecording}
                          disabled={saving}
                          className="px-5"
                        >
                          {saving ? "Enviando bot..." : "Iniciar gravação"}
                        </DSButton>
                      ) : (
                        <div className="space-y-3">
                          <div className="relative max-w-[320px] mx-auto">
                            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-certifica-500/40" strokeWidth={1.5} />
                            <input
                              className="w-full h-10 pl-10 pr-3 bg-white border border-certifica-200 rounded-md text-[13px] text-certifica-dark placeholder:text-certifica-500/40 focus:outline-none focus:ring-2 focus:ring-certifica-accent/30 focus:border-certifica-accent/50"
                              placeholder="Cole o link (Meet, Zoom, Teams)..."
                              onBlur={async (e) => {
                                const link = e.target.value.trim();
                                if (link && validateMeetLink(link)) {
                                  await updateMeetLink(selected.id, link);
                                  setToast({ message: "Link salvo!", type: "success" });
                                } else if (link) {
                                  setToast({ message: "Link inválido.", type: "error" });
                                }
                              }}
                              onKeyDown={async (e) => {
                                if (e.key === "Enter") {
                                  const link = (e.target as HTMLInputElement).value.trim();
                                  if (link && validateMeetLink(link)) {
                                    await updateMeetLink(selected.id, link);
                                    setToast({ message: "Link salvo!", type: "success" });
                                  } else if (link) {
                                    setToast({ message: "Link inválido.", type: "error" });
                                  }
                                }
                              }}
                            />
                          </div>
                          {selected.pauta && (
                            <div className="text-left bg-white border border-certifica-200 rounded-md px-4 py-3 max-w-[320px] mx-auto">
                              <div className="text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 500 }}>Pauta:</div>
                              <p className="text-[12px] text-certifica-dark" style={{ lineHeight: "1.5" }}>{selected.pauta}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (recallPhase === "sending" || recallPhase === "waiting_room" || recallPhase === "in_call") ? (
                    <div className="text-center max-w-[400px] px-4">
                      <Loader2 className="w-10 h-10 text-certifica-accent animate-spin mx-auto mb-4" strokeWidth={1.5} />
                      <p className="text-[15px] text-certifica-900 mb-1" style={{ fontWeight: 500 }}>Conectando bot...</p>
                      <p className="text-[12px] text-certifica-500">{recallMessage}</p>
                    </div>
                  ) : recallPhase === "recording" ? (
                    <div className="text-center max-w-[400px] px-4">
                      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                        <Mic className="w-7 h-7 text-red-500" strokeWidth={1.5} />
                        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-white" />
                      </div>
                      <p className="text-[16px] text-certifica-900 mb-2" style={{ fontWeight: 600 }}>Certifica Bot está gravando</p>
                      <p className="text-[12px] text-certifica-500 mb-1">{selected.titulo}</p>
                      <p className="text-[11px] text-certifica-500/60 mb-6">
                        A gravação e transcrição estão sendo feitas automaticamente.
                        Quando todos saírem da call, o bot encerra e processa sozinho.
                      </p>
                      <DSButton
                        variant="destructive"
                        size="sm"
                        icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Square className="w-3.5 h-3.5" strokeWidth={1.5} />}
                        onClick={handleStopRecording}
                        disabled={saving}
                        className="px-6"
                      >
                        {saving ? "Encerrando..." : "Terminar gravação"}
                      </DSButton>
                    </div>
                  ) : (recallPhase === "processing" || recallPhase === "call_ended") ? (
                    <div className="text-center max-w-[400px] px-4">
                      <Loader2 className="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" strokeWidth={1.5} />
                      <p className="text-[15px] text-certifica-900 mb-2" style={{ fontWeight: 500 }}>Processando gravação...</p>
                      <p className="text-[12px] text-certifica-500 mb-1">{recallMessage}</p>
                      <p className="text-[11px] text-certifica-500/60">
                        Gerando transcrição, resumo e plano de ação. Aguarde...
                      </p>
                    </div>
                  ) : recallPhase === "done" ? (
                    <div className="text-center max-w-[400px] px-4">
                      <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-7 h-7 text-green-500" strokeWidth={1.5} />
                      </div>
                      <p className="text-[15px] text-certifica-900 mb-2" style={{ fontWeight: 500 }}>Transcrição pronta!</p>
                      <p className="text-[12px] text-certifica-500">A reunião foi transcrita com sucesso. Atualizando...</p>
                    </div>
                  ) : (
                    <div className="text-center max-w-[400px] px-4">
                      <Loader2 className="w-8 h-8 text-certifica-500/40 animate-spin mx-auto mb-3" strokeWidth={1.5} />
                      <p className="text-[12px] text-certifica-500">Carregando...</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-certifica-50/50">
                <div className="text-center">
                  <CheckCircle2 className="w-8 h-8 text-certifica-500/30 mx-auto mb-3" />
                  <p className="text-[12px] text-certifica-500">Selecione uma reunião para ver detalhes.</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-certifica-50/50">
            <div className="text-center">
              <Video className="w-10 h-10 text-certifica-500/20 mx-auto mb-4" />
              <p className="text-[15px] text-certifica-900 mb-1" style={{ fontWeight: 500 }}>Nenhuma reunião selecionada</p>
              <p className="text-[12px] text-certifica-500 mb-4">Crie uma nova reunião para começar a gravar e transcrever</p>
              <DSButton variant="primary" size="sm" onClick={() => setShowNewModal(true)} icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Nova reunião
              </DSButton>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
