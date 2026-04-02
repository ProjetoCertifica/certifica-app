import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { DSButton } from "../components/ds/DSButton";
import { DSBadge } from "../components/ds/DSBadge";
import { DSInput } from "../components/ds/DSInput";
import { DSSelect } from "../components/ds/DSSelect";
import { useClientes, type ClienteWithProjetos } from "../lib/useClientes";
import { useCliente360, type Cliente360Data } from "../lib/useCliente360";
import { useAuditLog } from "../lib/useAuditLog";
import { APIFallback } from "../components/ErrorBoundary";
import type { ClienteInsert, ClienteUpdate } from "../lib/database.types";
import { validateCNPJ, formatCNPJ, validateEmail, formatPhone, validatePhone, consultarCNPJ, type BrasilAPIResponse } from "../lib/validators";
import {
  Search, Plus, Eye, Building2, Phone, Mail, MapPin, X, Loader2,
  ChevronRight, FolderOpen, ClipboardCheck, ExternalLink, UserCircle,
  Hash, Calendar, AlertTriangle, RefreshCw, Edit3, Check, Ban, RotateCcw,
  FileText, Video, Shield, UserPlus, Trash2, MessageSquare, Camera,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useContatos } from "../lib/useContatos";
import type { ContatoInsert } from "../lib/database.types";

/* ── Company Avatar with Upload ── */
function CompanyAvatarSmall({ name, id, logoUrl, onLogoChange }: { name: string; id: string; logoUrl?: string | null; onLogoChange?: (url: string) => void }) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [localUrl, setLocalUrl] = React.useState(logoUrl);
  React.useEffect(() => { setLocalUrl(logoUrl); }, [logoUrl]);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  const hue = Math.abs(id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 360;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onLogoChange) return;
    setUploading(true);
    try {
      const path = `logos/${id}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from("clientes").update({ logo_url: publicUrl }).eq("id", id);
      setLocalUrl(publicUrl);
      onLogoChange(publicUrl);
    } catch (err: any) { console.error("Upload error:", err); toast.error(err?.message ?? "Erro ao fazer upload da imagem."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  return (
    <div className="relative group flex-shrink-0 w-11 h-11">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      {localUrl ? (
        <img src={localUrl} alt={name} className="w-11 h-11 rounded-lg object-cover shadow" />
      ) : (
        <div className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-sm shadow"
          style={{ fontWeight: 700, background: `linear-gradient(135deg, hsl(${hue}, 65%, 50%), hsl(${(hue + 40) % 360}, 55%, 40%))` }}>
          {initials || "?"}
        </div>
      )}
      {onLogoChange && (
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="absolute inset-0 rounded-lg bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer">
          {uploading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" strokeWidth={1.5} />}
        </button>
      )}
    </div>
  );
}

/* ── Types ── */
interface ClienteUI {
  id: string;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  segmento: string;
  porte: "MEI" | "ME" | "EPP" | "Medio" | "Grande";
  status: "ativo" | "inativo" | "prospect";
  contatoNome: string;
  contatoCargo: string;
  contatoEmail: string;
  contatoTelefone: string;
  endereco: string;
  cidade: string;
  uf: string;
  cadastro: string;
  consultorResponsavel: string;
  projetosCount: number;
  logoUrl: string | null;
}

const statusMap: Record<string, { label: string; variant: "conformidade" | "nao-conformidade" | "observacao" | "oportunidade" | "outline" }> = {
  ativo: { label: "Ativo", variant: "conformidade" },
  inativo: { label: "Inativo", variant: "nao-conformidade" },
  prospect: { label: "Prospect", variant: "oportunidade" },
};

function mapToUI(c: ClienteWithProjetos): ClienteUI {
  return {
    id: c.id,
    cnpj: c.cnpj,
    razaoSocial: c.razao_social,
    nomeFantasia: c.nome_fantasia,
    segmento: c.segmento,
    porte: c.porte,
    status: c.status,
    contatoNome: c.contato_nome,
    contatoCargo: c.contato_cargo,
    contatoEmail: c.contato_email,
    contatoTelefone: c.contato_telefone,
    endereco: c.endereco,
    cidade: c.cidade,
    uf: c.uf,
    cadastro: new Date(c.created_at).toLocaleDateString("pt-BR"),
    consultorResponsavel: c.consultor_responsavel,
    projetosCount: c.projetos_count,
    logoUrl: c.logo_url ?? null,
  };
}

function getSaude(c: ClienteUI): number {
  let score = 60 + c.projetosCount * 6;
  if (c.status === "inativo") score -= 30;
  if (c.status === "prospect") score -= 12;
  return Math.max(0, Math.min(100, score));
}

function getSaudeLabel(score: number) {
  return score >= 75 ? "Boa" : score >= 55 ? "Atenção" : "Crítica";
}

interface HealthFactor {
  label: string;
  impact: "positive" | "negative" | "neutral";
  detail: string;
}

function computeHealth360(c: ClienteUI, data: Cliente360Data): { score: number; factors: HealthFactor[] } {
  let score = 60;
  const factors: HealthFactor[] = [];

  // — Status —
  if (c.status === "inativo") {
    score -= 25;
    factors.push({ label: "Cliente inativo", impact: "negative", detail: "-25 pts" });
  } else if (c.status === "ativo") {
    score += 5;
    factors.push({ label: "Cliente ativo", impact: "positive", detail: "+5 pts" });
  }

  // — Projetos ativos —
  const activePrj = data.projetos.filter((p) =>
    ["ativo", "em_andamento", "em andamento", "em progresso", "iniciado"].includes(p.status.toLowerCase())
  ).length;
  const completedPrj = data.projetos.filter((p) =>
    ["concluido", "concluído", "certificado", "aprovado"].includes(p.status.toLowerCase())
  ).length;
  const prjBonus = Math.min(activePrj * 5 + completedPrj * 3, 20);
  if (prjBonus > 0) {
    score += prjBonus;
    const prjLabel = activePrj > 0
      ? `${activePrj} ${activePrj === 1 ? "projeto" : "projetos"} ${activePrj === 1 ? "ativo" : "ativos"}`
      : `${completedPrj} ${completedPrj === 1 ? "projeto" : "projetos"} ${completedPrj === 1 ? "concluído" : "concluídos"}`;
    factors.push({ label: prjLabel, impact: "positive", detail: `+${prjBonus} pts` });
  } else if (data.projetos.length === 0) {
    score -= 5;
    factors.push({ label: "Sem projetos", impact: "negative", detail: "-5 pts" });
  }

  // — NCs de auditoria (findings) —
  const totalFindings = data.auditorias.reduce((sum, a) => sum + a.findings_count, 0);
  const approvedAudits = data.auditorias.filter((a) =>
    ["aprovada", "aprovado", "concluida", "concluído", "certificado"].includes(a.status.toLowerCase())
  ).length;
  if (totalFindings > 0) {
    const penalty = Math.min(totalFindings * 4, 20);
    score -= penalty;
    factors.push({ label: `${totalFindings} ${totalFindings === 1 ? "não-conformidade" : "não-conformidades"}`, impact: "negative", detail: `-${penalty} pts` });
  }
  if (approvedAudits > 0) {
    const bonus = Math.min(approvedAudits * 4, 12);
    score += bonus;
    factors.push({ label: `${approvedAudits} ${approvedAudits === 1 ? "auditoria aprovada" : "auditorias aprovadas"}`, impact: "positive", detail: `+${bonus} pts` });
  }

  // — Documentos obsoletos —
  const obsoleteDocs = data.documentos.filter((d) =>
    ["obsoleto", "cancelado", "revogado", "vencido"].includes(d.status.toLowerCase())
  ).length;
  if (obsoleteDocs > 0) {
    const penalty = Math.min(obsoleteDocs * 3, 9);
    score -= penalty;
    factors.push({ label: `${obsoleteDocs} ${obsoleteDocs === 1 ? "doc obsoleto" : "docs obsoletos"}`, impact: "negative", detail: `-${penalty} pts` });
  } else if (data.documentos.length > 0) {
    score += 3;
    factors.push({ label: "Documentação em dia", impact: "positive", detail: "+3 pts" });
  }

  // — Recência de reuniões (engajamento) —
  const now = new Date();
  const meetingsWithDate = data.reunioes.filter((m) => m.data);
  if (meetingsWithDate.length > 0) {
    const sorted = [...meetingsWithDate].sort(
      (a, b) => new Date(b.data!).getTime() - new Date(a.data!).getTime()
    );
    const lastDays = (now.getTime() - new Date(sorted[0].data!).getTime()) / (1000 * 60 * 60 * 24);
    if (lastDays <= 30) {
      score += 5;
      factors.push({ label: "Reunião recente (≤30d)", impact: "positive", detail: "+5 pts" });
    } else if (lastDays > 60) {
      score -= 8;
      factors.push({ label: `Última reunião há ${Math.round(lastDays)}d`, impact: "negative", detail: "-8 pts" });
    } else {
      factors.push({ label: `Última reunião há ${Math.round(lastDays)}d`, impact: "neutral", detail: "0 pts" });
    }
  } else {
    factors.push({ label: "Sem reuniões registradas", impact: "neutral", detail: "0 pts" });
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), factors };
}

/* ── Page ── */
export default function ClientesPage() {
  const navigate = useNavigate();
  const { clientes: rawClientes, loading: dbLoading, error: dbError, create, update, remove, refetch } = useClientes();
  const auditLog = useAuditLog();
  const cliente360 = useCliente360();
  const clientesList = useMemo(() => rawClientes.map(mapToUI), [rawClientes]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterSegmento, setFilterSegmento] = useState("todos");
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClienteUI | null>(null);
  const [saving, setSaving] = useState(false);
  const [view360Tab, setView360Tab] = useState<"projetos" | "auditorias" | "documentos" | "reunioes">("projetos");

  const segmentos = useMemo(() => [...new Set(clientesList.map((c) => c.segmento))].filter(Boolean).sort(), [clientesList]);

  const filtered = useMemo(() => clientesList.filter((c) => {
    if (filterStatus !== "todos" && c.status !== filterStatus) return false;
    if (filterSegmento !== "todos" && c.segmento !== filterSegmento) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return c.razaoSocial.toLowerCase().includes(q) || c.nomeFantasia.toLowerCase().includes(q) || c.cnpj.includes(q) || c.cidade.toLowerCase().includes(q);
    }
    return true;
  }), [clientesList, filterStatus, filterSegmento, searchQuery]);

  const selected = clientesList.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) cliente360.fetch(selected.id);
  }, [selected?.id]);

  /* ── Stats ── */
  const churnAlerts = clientesList.filter((c) => getSaude(c) < 55 || c.status === "inativo").length;
  const avgHealth = clientesList.length > 0 ? Math.round(clientesList.reduce((s, c) => s + getSaude(c), 0) / clientesList.length) : 0;

  /* ── Handlers ── */
  const handleCreateClient = async (payload: Omit<ClienteUI, "id" | "cadastro" | "projetosCount">) => {
    setSaving(true);

    const existingCnpj = clientesList.find((c) => c.cnpj.replace(/\D/g, "") === payload.cnpj.replace(/\D/g, ""));
    if (existingCnpj) {
      setSaving(false);
      return "Cliente com este CNPJ já existe no sistema.";
    }

    const insert: ClienteInsert = {
      cnpj: payload.cnpj,
      razao_social: payload.razaoSocial,
      nome_fantasia: payload.nomeFantasia,
      segmento: payload.segmento,
      porte: payload.porte,
      status: payload.status,
      contato_nome: payload.contatoNome,
      contato_cargo: payload.contatoCargo,
      contato_email: payload.contatoEmail,
      contato_telefone: payload.contatoTelefone,
      endereco: payload.endereco,
      cidade: payload.cidade,
      uf: payload.uf,
      consultor_responsavel: payload.consultorResponsavel,
    };
    const result = await create(insert);
    setSaving(false);
    if (result) {
      setSelectedId(result.id);
      setShowNewModal(false);
      auditLog.log({ tabela: "clientes", registro_id: result.id, acao: "INSERT", dados_depois: result });
      return null;
    }
    return "Erro ao criar cliente. Tente novamente.";
  };

  const handleUpdateClient = async (id: string, patch: ClienteUpdate) => {
    setSaving(true);
    const ok = await update(id, patch);
    if (ok) auditLog.log({ tabela: "clientes", registro_id: id, acao: "UPDATE", dados_depois: patch });
    setSaving(false);
    setEditingClient(null);
    return ok;
  };

  const handleToggleStatus = async (c: ClienteUI) => {
    const newStatus = c.status === "ativo" ? "inativo" : "ativo";
    setSaving(true);
    await update(c.id, { status: newStatus } as ClienteUpdate);
    auditLog.log({ tabela: "clientes", registro_id: c.id, acao: "UPDATE", dados_antes: { status: c.status }, dados_depois: { status: newStatus } });
    setSaving(false);
  };

  /* ── Loading / Error ── */
  if (dbLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-certifica-accent animate-spin" strokeWidth={1.5} />
          <span className="text-[12px] text-certifica-500">Carregando empresas...</span>
        </div>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="p-5">
        <APIFallback error={dbError} onRetry={refetch} message="Falha ao carregar empresas" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:h-full overflow-auto lg:overflow-hidden">
      {/* ── Main list ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-[380px] lg:min-h-0">
        <div className="px-5 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-certifica-900">Empresas</h2>
              <p className="text-[12px] text-certifica-500 mt-0.5">
                {clientesList.length} empresas cadastradas · {clientesList.filter((c) => c.status === "ativo").length} ativas
              </p>
            </div>
            <DSButton variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={() => setShowNewModal(true)}>
              Nova Empresa
            </DSButton>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 pb-3 border-b border-certifica-200">
            <div className="relative flex-1 max-w-[280px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-certifica-500/40" strokeWidth={1.5} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7 pl-8 pr-3 bg-certifica-50 border border-certifica-200 rounded-[3px] text-[11.5px] placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-700/30"
                placeholder="Buscar por razão social, CNPJ, cidade..."
              />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-7 px-2 bg-white border border-certifica-200 rounded-[3px] text-[11.5px] text-certifica-dark cursor-pointer focus:outline-none pr-6">
              <option value="todos">Todos os status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="prospect">Prospect</option>
            </select>
            <select value={filterSegmento} onChange={(e) => setFilterSegmento(e.target.value)} className="h-7 px-2 bg-white border border-certifica-200 rounded-[3px] text-[11.5px] text-certifica-dark cursor-pointer focus:outline-none pr-6">
              <option value="todos">Todos os segmentos</option>
              {segmentos.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="ml-auto text-[11px] text-certifica-500">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-5 pb-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-certifica-200 rounded-[4px] px-3 py-2">
              <div className="text-[10px] text-certifica-500">Alertas de churn</div>
              <div className="text-[15px] text-nao-conformidade" style={{ fontWeight: 600 }}>{churnAlerts}</div>
            </div>
            <div className="bg-white border border-certifica-200 rounded-[4px] px-3 py-2">
              <div className="text-[10px] text-certifica-500">Prospects</div>
              <div className="text-[15px] text-oportunidade" style={{ fontWeight: 600 }}>{clientesList.filter((c) => c.status === "prospect").length}</div>
            </div>
            <div className="bg-white border border-certifica-200 rounded-[4px] px-3 py-2">
              <div className="text-[10px] text-certifica-500">Saúde média</div>
              <div className="text-[15px] text-certifica-900" style={{ fontWeight: 600 }}>{avgHealth}</div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <table className="w-full">
            <thead>
              <tr className="border-b border-certifica-200">
                {["CNPJ", "Razão Social", "Segmento", "Cidade/UF", "Status", "Projetos", "Consultor", ""].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const st = statusMap[c.status];
                return (
                  <tr key={c.id} onClick={() => setSelectedId(c.id)} className={`border-b border-certifica-200/60 cursor-pointer transition-colors ${selectedId === c.id ? "bg-certifica-50" : "hover:bg-certifica-50/50"}`}>
                    <td className="px-3 py-2.5"><span className="text-[11.5px] text-certifica-700 font-mono" style={{ fontWeight: 500 }}>{c.cnpj}</span></td>
                    <td className="px-3 py-2.5">
                      <span className="text-[12.5px] text-certifica-dark block" style={{ fontWeight: 500 }}>{c.nomeFantasia}</span>
                      <span className="text-[10.5px] text-certifica-500 block">{c.razaoSocial}</span>
                    </td>
                    <td className="px-3 py-2.5"><span className="text-[11px] text-certifica-500 bg-certifica-50 border border-certifica-200 rounded-[2px] px-1.5 py-px">{c.segmento}</span></td>
                    <td className="px-3 py-2.5"><span className="text-[11.5px] text-certifica-500">{c.cidade}/{c.uf}</span></td>
                    <td className="px-3 py-2.5"><DSBadge variant={st.variant}>{st.label}</DSBadge></td>
                    <td className="px-3 py-2.5">
                      {c.projetosCount > 0 ? (
                        <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 500 }}>{c.projetosCount}</span>
                      ) : <span className="text-[11.5px] text-certifica-500/50">—</span>}
                    </td>
                    <td className="px-3 py-2.5"><span className="text-[11.5px] text-certifica-500">{c.consultorResponsavel}</span></td>
                    <td className="px-3 py-2.5">
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${c.id}`); }} className="p-1 text-certifica-500/30 hover:text-certifica-700 transition-colors cursor-pointer" title="Ver perfil completo">
                        <Eye className="w-[13px] h-[13px]" strokeWidth={1.5} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-12 text-center text-[12.5px] text-certifica-500">Nenhuma empresa encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail Panel with 360 View ── */}
      {selected && (
        <div className="w-full lg:w-[340px] lg:flex-shrink-0 border-t lg:border-t-0 lg:border-l border-certifica-200 bg-white flex flex-col overflow-y-auto" style={{ animation: "certifica-panel-slide 250ms cubic-bezier(.22,1,.36,1)" }}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-certifica-200">
            <div className="flex items-center justify-between mb-2">
              <DSBadge variant={statusMap[selected.status].variant}>{statusMap[selected.status].label}</DSBadge>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditingClient(selected)} className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer" title="Editar">
                  <Edit3 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
                <button onClick={() => handleToggleStatus(selected)} className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer" title={selected.status === "ativo" ? "Inativar" : "Reativar"} disabled={saving}>
                  {selected.status === "ativo" ? <Ban className="w-3.5 h-3.5" strokeWidth={1.5} /> : <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />}
                </button>
                <button onClick={() => setSelectedId(null)} className="p-1 text-certifica-500/40 hover:text-certifica-dark cursor-pointer">
                  <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <CompanyAvatarSmall
                name={selected.nomeFantasia}
                id={selected.id}
                logoUrl={selected.logoUrl}
                onLogoChange={() => {
                  refetch();
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[14px] text-certifica-900 truncate" style={{ fontWeight: 600 }}>{selected.nomeFantasia}</div>
                <div className="text-[11px] text-certifica-500 truncate" style={{ lineHeight: "1.4" }}>{selected.razaoSocial}</div>
                <div className="flex items-center gap-1.5 text-[11px] text-certifica-700 font-mono mt-0.5" style={{ fontWeight: 500 }}>
                  <Hash className="w-3 h-3 text-certifica-500/50" strokeWidth={1.5} />
                  {selected.cnpj}
                </div>
              </div>
            </div>
          </div>

          {/* Contacts */}
          <ContatosSection empresaId={selected.id} selected={selected} />

          {/* Info + Health */}
          <div className="px-4 py-3 border-b border-certifica-200">
            <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2.5" style={{ fontWeight: 600 }}>Informações</div>
            <div className="space-y-1.5">
              {[
                { label: "Segmento", value: selected.segmento },
                { label: "Porte", value: selected.porte },
                { label: "Consultor", value: selected.consultorResponsavel },
                { label: "Cadastro", value: selected.cadastro },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-certifica-500">{item.label}</span>
                  <span className="text-[11px] text-certifica-dark" style={{ fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
            {/* ── Health Score 360 ── */}
            {(() => {
              const health360 = cliente360.data
                ? computeHealth360(selected, cliente360.data)
                : null;
              const displayScore = health360 ? health360.score : getSaude(selected);
              const label = getSaudeLabel(displayScore);
              const barColor = displayScore >= 75 ? "bg-conformidade" : displayScore >= 55 ? "bg-observacao" : "bg-nao-conformidade";
              const textColor = displayScore >= 75 ? "text-conformidade" : displayScore >= 55 ? "text-observacao" : "text-nao-conformidade";
              return (
                <div className="mt-3 pt-3 border-t border-certifica-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-certifica-500 flex items-center gap-1">
                      <Shield className="w-3 h-3" strokeWidth={1.5} />
                      Saúde da empresa
                      {health360 && <span className="text-[9px] bg-certifica-100 text-certifica-500 rounded px-1 ml-0.5">360°</span>}
                    </span>
                    <span className={`text-[12px] ${textColor}`} style={{ fontWeight: 700 }}>{displayScore} · {label}</span>
                  </div>
                  <div className="h-[5px] bg-certifica-200 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${displayScore}%` }} />
                  </div>
                  {health360 && health360.factors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {health360.factors.map((f, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-[10px] text-certifica-500 flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.impact === "positive" ? "bg-conformidade" : f.impact === "negative" ? "bg-nao-conformidade" : "bg-certifica-300"}`} />
                            {f.label}
                          </span>
                          <span className={`text-[9.5px] ${f.impact === "positive" ? "text-conformidade" : f.impact === "negative" ? "text-nao-conformidade" : "text-certifica-500"}`} style={{ fontWeight: 500 }}>{f.detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!health360 && cliente360.loading && (
                    <div className="mt-1.5 text-[10px] text-certifica-500/60 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} />
                      Calculando score 360°...
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── 360 View ── */}
          <div className="px-4 py-3">
            <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2.5" style={{ fontWeight: 600 }}>Visão 360°</div>
            <div className="flex gap-0 mb-3 border-b border-certifica-200">
              {([
                { key: "projetos" as const, label: "Projetos", icon: FolderOpen, count: cliente360.data?.projetos.length ?? 0 },
                { key: "auditorias" as const, label: "Auditorias", icon: ClipboardCheck, count: cliente360.data?.auditorias.length ?? 0 },
                { key: "documentos" as const, label: "Docs", icon: FileText, count: cliente360.data?.documentos.length ?? 0 },
                { key: "reunioes" as const, label: "Reuniões", icon: Video, count: cliente360.data?.reunioes.length ?? 0 },
              ]).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setView360Tab(t.key)}
                  className={`flex items-center gap-1 px-2 py-2 text-[10px] border-b-2 transition-colors cursor-pointer ${
                    view360Tab === t.key ? "text-certifica-dark border-certifica-accent" : "text-certifica-500/60 border-transparent hover:text-certifica-500"
                  }`}
                  style={{ fontWeight: view360Tab === t.key ? 500 : 400 }}
                >
                  <t.icon className="w-3 h-3" strokeWidth={1.5} />
                  {t.label}
                  <span className="text-[9px] bg-certifica-100 rounded px-1">{t.count}</span>
                </button>
              ))}
            </div>

            {cliente360.loading ? (
              <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 text-certifica-500/40 animate-spin" /></div>
            ) : !cliente360.data ? (
              <div className="py-4 text-center text-[11px] text-certifica-500">Sem dados</div>
            ) : (
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {view360Tab === "projetos" && (
                  cliente360.data.projetos.length === 0 ? (
                    <div className="py-3 text-center text-[11px] text-certifica-500">Nenhum projeto</div>
                  ) : (
                    cliente360.data.projetos.map((p) => (
                      <button key={p.id} onClick={() => navigate("/projetos")} className="w-full text-left p-2 bg-certifica-50 rounded-[3px] hover:bg-certifica-100 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-certifica-dark" style={{ fontWeight: 500 }}>{p.codigo} — {p.titulo}</span>
                          <ExternalLink className="w-3 h-3 text-certifica-500/40" strokeWidth={1.5} />
                        </div>
                        <div className="text-[10px] text-certifica-500 mt-0.5">{p.norma} · {p.fase_label} · {p.status}</div>
                      </button>
                    ))
                  )
                )}
                {view360Tab === "auditorias" && (
                  cliente360.data.auditorias.length === 0 ? (
                    <div className="py-3 text-center text-[11px] text-certifica-500">Nenhuma auditoria</div>
                  ) : (
                    cliente360.data.auditorias.map((a) => (
                      <button key={a.id} onClick={() => navigate("/auditorias")} className="w-full text-left p-2 bg-certifica-50 rounded-[3px] hover:bg-certifica-100 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-certifica-dark" style={{ fontWeight: 500 }}>{a.codigo}</span>
                          <DSBadge variant="outline" className="text-[8px] px-1 py-0">{a.status}</DSBadge>
                        </div>
                        <div className="text-[10px] text-certifica-500 mt-0.5">{a.tipo} · {a.norma} · {a.findings_count} achados</div>
                      </button>
                    ))
                  )
                )}
                {view360Tab === "documentos" && (
                  cliente360.data.documentos.length === 0 ? (
                    <div className="py-3 text-center text-[11px] text-certifica-500">Nenhum documento</div>
                  ) : (
                    cliente360.data.documentos.map((d) => (
                      <button key={d.id} onClick={() => navigate("/documentos")} className="w-full text-left p-2 bg-certifica-50 rounded-[3px] hover:bg-certifica-100 transition-colors cursor-pointer">
                        <div className="text-[11px] text-certifica-dark" style={{ fontWeight: 500 }}>{d.codigo} — {d.titulo}</div>
                        <div className="text-[10px] text-certifica-500 mt-0.5">{d.tipo} · {d.status}</div>
                      </button>
                    ))
                  )
                )}
                {view360Tab === "reunioes" && (
                  cliente360.data.reunioes.length === 0 ? (
                    <div className="py-3 text-center text-[11px] text-certifica-500">Nenhuma reunião</div>
                  ) : (
                    cliente360.data.reunioes.map((m) => (
                      <button key={m.id} onClick={() => navigate("/reunioes")} className="w-full text-left p-2 bg-certifica-50 rounded-[3px] hover:bg-certifica-100 transition-colors cursor-pointer">
                        <div className="text-[11px] text-certifica-dark" style={{ fontWeight: 500 }}>{m.titulo}</div>
                        <div className="text-[10px] text-certifica-500 mt-0.5">{m.tipo} · {m.data ? new Date(m.data).toLocaleDateString("pt-BR") : "—"} · {m.status}</div>
                      </button>
                    ))
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes certifica-panel-slide {
          from { opacity: 0; transform: translateX(16px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ── New Client Modal ── */}
      {showNewModal && (
        <ClientFormModal
          mode="create"
          existingClients={clientesList}
          saving={saving}
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreateClient}
        />
      )}

      {/* ── Edit Client Modal ── */}
      {editingClient && (
        <ClientFormModal
          mode="edit"
          initialData={editingClient}
          existingClients={clientesList}
          saving={saving}
          onClose={() => setEditingClient(null)}
          onUpdate={(patch) => handleUpdateClient(editingClient.id, patch)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Contatos da Empresa (detail panel)
   ═══════════════════════════════════════════════════════════════ */
function ContatosSection({ empresaId, selected }: { empresaId: string; selected: ClienteUI }) {
  const { contatos, loading, create, remove } = useContatos(empresaId);
  const [showAdd, setShowAdd] = useState(false);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!nome.trim()) return;
    setSaving(true);
    const digits = telefone.replace(/\D/g, "");
    const whatsapp = digits.length >= 10 && digits.length <= 11 ? "55" + digits : digits;
    await create({
      empresa_id: empresaId,
      nome: nome.trim(),
      cargo: cargo.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
      whatsapp,
      principal: contatos.length === 0,
    });
    setNome(""); setCargo(""); setEmail(""); setTelefone("");
    setShowAdd(false);
    setSaving(false);
  };

  return (
    <>
      {/* Endereço */}
      <div className="px-4 py-3 border-b border-certifica-200">
        <div className="flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 text-certifica-500/40 flex-shrink-0 mt-px" strokeWidth={1.5} />
          <span className="text-[11px] text-certifica-dark" style={{ lineHeight: "1.4" }}>{selected.endereco}<br />{selected.cidade}/{selected.uf}</span>
        </div>
      </div>

      {/* Contatos */}
      <div className="px-4 py-3 border-b border-certifica-200">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>Contatos</div>
          <button onClick={() => setShowAdd(v => !v)} className="p-0.5 text-certifica-accent hover:text-certifica-700 transition-colors" title="Adicionar contato">
            <UserPlus className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {showAdd && (
          <div className="mb-3 p-2.5 bg-certifica-50 rounded-[4px] border border-certifica-200 space-y-2">
            <input placeholder="Nome *" value={nome} onChange={e => setNome(e.target.value)}
              className="w-full h-7 px-2.5 bg-white border border-certifica-200 rounded-[3px] text-[11px] placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-700/30" />
            <input placeholder="Cargo" value={cargo} onChange={e => setCargo(e.target.value)}
              className="w-full h-7 px-2.5 bg-white border border-certifica-200 rounded-[3px] text-[11px] placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-700/30" />
            <input placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full h-7 px-2.5 bg-white border border-certifica-200 rounded-[3px] text-[11px] placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-700/30" />
            <input placeholder="Telefone / WhatsApp" value={telefone} onChange={e => setTelefone(e.target.value)}
              className="w-full h-7 px-2.5 bg-white border border-certifica-200 rounded-[3px] text-[11px] placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-700/30" />
            <div className="flex gap-1.5">
              <button onClick={handleAdd} disabled={!nome.trim() || saving}
                className="flex-1 h-7 bg-certifica-accent text-white text-[10.5px] rounded-[3px] hover:bg-certifica-700 disabled:opacity-50 transition-colors" style={{ fontWeight: 500 }}>
                {saving ? "Salvando..." : "Adicionar"}
              </button>
              <button onClick={() => { setShowAdd(false); setNome(""); setCargo(""); setEmail(""); setTelefone(""); }}
                className="h-7 px-3 bg-certifica-200 text-certifica-500 text-[10.5px] rounded-[3px] hover:bg-certifica-300 transition-colors" style={{ fontWeight: 500 }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-1.5 py-2 text-[10.5px] text-certifica-500">
            <Loader2 className="w-3 h-3 animate-spin" strokeWidth={1.5} /> Carregando...
          </div>
        )}

        {!loading && contatos.length === 0 && (
          <div className="text-[10.5px] text-certifica-500/60 py-2">Nenhum contato cadastrado.</div>
        )}

        <div className="space-y-1.5">
          {contatos.map(c => (
            <div key={c.id} className="flex items-start gap-2 group">
              <UserCircle className="w-3.5 h-3.5 text-certifica-500/40 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-[11.5px] text-certifica-dark truncate" style={{ fontWeight: 500 }}>{c.nome}</span>
                  {c.principal && <span className="text-[8px] bg-certifica-accent/10 text-certifica-accent px-1 rounded" style={{ fontWeight: 600 }}>PRINCIPAL</span>}
                </div>
                {c.cargo && <span className="text-[10px] text-certifica-500 block">{c.cargo}</span>}
                {c.email && (
                  <span className="text-[10px] text-certifica-accent flex items-center gap-0.5 mt-0.5">
                    <Mail className="w-2.5 h-2.5" strokeWidth={1.5} />{c.email}
                  </span>
                )}
                {c.telefone && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Phone className="w-2.5 h-2.5 text-certifica-500/40" strokeWidth={1.5} />
                    <span className="text-[10px] text-certifica-dark">{c.telefone}</span>
                    {c.whatsapp && (
                      <a href="/chat" className="text-[9px] text-certifica-accent hover:underline flex items-center gap-0.5 ml-1">
                        <MessageSquare className="w-2.5 h-2.5" strokeWidth={1.5} />Chat
                      </a>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => remove(c.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-certifica-500/30 hover:text-nao-conformidade transition-all" title="Remover contato">
                <Trash2 className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Client Form Modal (Create & Edit)
   ═══════════════════════════════════════════════════════════════ */
function ClientFormModal({
  mode,
  initialData,
  onClose,
  onCreate,
  onUpdate,
  existingClients,
  saving,
}: {
  mode: "create" | "edit";
  initialData?: ClienteUI;
  onClose: () => void;
  onCreate?: (payload: Omit<ClienteUI, "id" | "cadastro" | "projetosCount">) => Promise<string | null>;
  onUpdate?: (patch: ClienteUpdate) => Promise<boolean>;
  existingClients: ClienteUI[];
  saving: boolean;
}) {
  useBodyScrollLock(true);
  const [cnpjInput, setCnpjInput] = useState(initialData?.cnpj ?? "");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [looked, setLooked] = useState(mode === "edit");
  const [apiData, setApiData] = useState<BrasilAPIResponse | null>(null);
  const [statusRelacionamento, setStatusRelacionamento] = useState<ClienteUI["status"]>(initialData?.status ?? "prospect");
  const [formError, setFormError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    razaoSocial: initialData?.razaoSocial ?? "",
    nomeFantasia: initialData?.nomeFantasia ?? "",
    segmento: initialData?.segmento ?? "",
    porte: initialData?.porte ?? "",
    contatoNome: initialData?.contatoNome ?? "",
    contatoCargo: initialData?.contatoCargo ?? "",
    contatoEmail: initialData?.contatoEmail ?? "",
    contatoTelefone: initialData?.contatoTelefone ?? "",
    endereco: initialData?.endereco ?? "",
    cidade: initialData?.cidade ?? "",
    uf: initialData?.uf ?? "",
    consultorResponsavel: initialData?.consultorResponsavel ?? "",
  });

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value);
    setCnpjInput(formatted);
    setErrors((p) => ({ ...p, cnpj: "" }));
    if (looked) { setLooked(false); setApiData(null); }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, contatoTelefone: formatPhone(e.target.value) }));
    setErrors((p) => ({ ...p, telefone: "" }));
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, contatoEmail: e.target.value }));
    setErrors((p) => ({ ...p, email: "" }));
  };

  const cnpjDigits = cnpjInput.replace(/\D/g, "");
  const cnpjComplete = cnpjDigits.length === 14;

  const handleLookup = useCallback(async () => {
    if (!cnpjComplete) return;

    if (!validateCNPJ(cnpjDigits)) {
      setErrors((p) => ({ ...p, cnpj: "CNPJ inválido (dígitos verificadores incorretos)" }));
      return;
    }

    const dup = existingClients.find((c) => c.cnpj.replace(/\D/g, "") === cnpjDigits && c.id !== initialData?.id);
    if (dup) {
      setErrors((p) => ({ ...p, cnpj: `CNPJ já cadastrado: ${dup.nomeFantasia}` }));
      return;
    }

    setLookupLoading(true);
    setErrors((p) => ({ ...p, cnpj: "" }));

    const result = await consultarCNPJ(cnpjDigits);
    setApiData(result);
    setLooked(true);
    setLookupLoading(false);

    if (result) {
      setForm((prev) => ({
        ...prev,
        razaoSocial: result.razao_social || prev.razaoSocial,
        nomeFantasia: result.nome_fantasia || prev.nomeFantasia,
        porte: result.porte || prev.porte,
        endereco: result.logradouro ? `${result.logradouro}, ${result.numero} — ${result.bairro}` : prev.endereco,
        cidade: result.municipio || prev.cidade,
        uf: result.uf || prev.uf,
      }));
    }
  }, [cnpjComplete, cnpjDigits, existingClients, initialData?.id]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};

    if (mode === "create" && !cnpjComplete) e.cnpj = "CNPJ deve ter 14 dígitos";
    if (mode === "create" && cnpjComplete && !validateCNPJ(cnpjDigits)) e.cnpj = "CNPJ inválido";
    if (!form.razaoSocial.trim()) e.razaoSocial = "Obrigatório";
    if (!form.nomeFantasia.trim()) e.nomeFantasia = "Obrigatório";
    if (!form.segmento.trim()) e.segmento = "Obrigatório";
    if (!form.porte) e.porte = "Obrigatório";
    if (!form.contatoNome.trim()) e.contatoNome = "Obrigatório";
    if (!form.contatoEmail.trim()) e.email = "Obrigatório";
    else if (!validateEmail(form.contatoEmail)) e.email = "E-mail inválido";
    if (form.contatoTelefone && !validatePhone(form.contatoTelefone)) e.telefone = "Telefone inválido";
    if (!form.cidade.trim()) e.cidade = "Obrigatório";
    if (!form.uf.trim()) e.uf = "Obrigatório";
    if (!form.consultorResponsavel) e.consultor = "Obrigatório";

    if (mode === "create") {
      const dup = existingClients.find((c) => c.cnpj.replace(/\D/g, "") === cnpjDigits);
      if (dup) e.cnpj = `CNPJ já cadastrado: ${dup.nomeFantasia}`;
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setFormError("");

    if (mode === "create" && onCreate) {
      const err = await onCreate({
        cnpj: cnpjInput,
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim(),
        segmento: form.segmento.trim(),
        porte: form.porte as ClienteUI["porte"],
        status: statusRelacionamento,
        contatoNome: form.contatoNome.trim(),
        contatoCargo: form.contatoCargo.trim() || "Não informado",
        contatoEmail: form.contatoEmail.trim(),
        contatoTelefone: form.contatoTelefone.trim() || "Não informado",
        endereco: form.endereco.trim() || "Não informado",
        cidade: form.cidade.trim(),
        uf: form.uf.trim().toUpperCase(),
        consultorResponsavel: form.consultorResponsavel.trim(),
      });
      if (err) setFormError(err);
    }

    if (mode === "edit" && onUpdate) {
      const patch: ClienteUpdate = {
        razao_social: form.razaoSocial.trim(),
        nome_fantasia: form.nomeFantasia.trim(),
        segmento: form.segmento.trim(),
        porte: form.porte as ClienteUI["porte"],
        status: statusRelacionamento,
        contato_nome: form.contatoNome.trim(),
        contato_cargo: form.contatoCargo.trim(),
        contato_email: form.contatoEmail.trim(),
        contato_telefone: form.contatoTelefone.trim(),
        endereco: form.endereco.trim(),
        cidade: form.cidade.trim(),
        uf: form.uf.trim().toUpperCase(),
        consultor_responsavel: form.consultorResponsavel.trim(),
      };
      const ok = await onUpdate(patch);
      if (!ok) setFormError("Erro ao atualizar. Tente novamente.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-certifica-dark/40 certifica-modal-backdrop" onClick={onClose} />
      <div className="relative bg-white rounded-[4px] border border-certifica-200 w-[560px] max-h-[85vh] overflow-y-auto certifica-modal-content">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-certifica-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-certifica-accent" strokeWidth={1.5} />
            <span className="text-[14px] text-certifica-900" style={{ fontWeight: 600 }}>
              {mode === "create" ? "Nova Empresa" : "Editar Empresa"}
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-certifica-500/40 hover:text-certifica-dark transition-colors cursor-pointer">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* CNPJ */}
          <div>
            <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-3" style={{ fontWeight: 600 }}>Identificação</div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <DSInput
                  label="CNPJ *"
                  placeholder="00.000.000/0001-00"
                  value={cnpjInput}
                  onChange={handleCnpjChange}
                  error={errors.cnpj}
                  disabled={mode === "edit"}
                />
              </div>
              {mode === "create" && (
                <DSButton variant="outline" size="md" onClick={handleLookup} disabled={!cnpjComplete || lookupLoading} className={`mb-[2px] ${!cnpjComplete ? "opacity-50" : ""}`}>
                  {lookupLoading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" strokeWidth={1.5} />Buscando...</>
                  ) : (
                    <><Search className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />Consultar</>
                  )}
                </DSButton>
              )}
            </div>
            {looked && !apiData && mode === "create" && (
              <div className="mt-2 px-3 py-2 bg-observacao/5 border border-observacao/20 rounded-[3px]">
                <p className="text-[11px] text-observacao" style={{ fontWeight: 500 }}>CNPJ não encontrado na BrasilAPI. Preencha manualmente.</p>
              </div>
            )}
            {looked && apiData && mode === "create" && (
              <div className="mt-2 px-3 py-2 bg-conformidade/5 border border-conformidade/20 rounded-[3px]">
                <p className="text-[11px] text-conformidade" style={{ fontWeight: 500 }}>
                  <Check className="w-3 h-3 inline mr-1" />Dados preenchidos via BrasilAPI — {apiData.descricao_situacao_cadastral || "ATIVA"}
                </p>
              </div>
            )}
          </div>

          {/* Razão/Fantasia */}
          <div className="grid grid-cols-2 gap-3">
            <DSInput label="Razão Social *" placeholder="Razão social" value={form.razaoSocial} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} error={errors.razaoSocial} />
            <DSInput label="Nome Fantasia *" placeholder="Nome fantasia" value={form.nomeFantasia} onChange={(e) => setForm({ ...form, nomeFantasia: e.target.value })} error={errors.nomeFantasia} />
          </div>

          {/* Segmento/Porte */}
          <div className="grid grid-cols-2 gap-3">
            <DSInput label="Segmento *" placeholder="Ex: Metalurgia" value={form.segmento} onChange={(e) => setForm({ ...form, segmento: e.target.value })} error={errors.segmento} />
            <DSSelect label="Porte *" value={form.porte} onChange={(e) => setForm({ ...form, porte: e.target.value })} error={errors.porte} options={[
              { value: "", label: "Selecione..." },
              { value: "MEI", label: "MEI" },
              { value: "ME", label: "ME" },
              { value: "EPP", label: "EPP" },
              { value: "Medio", label: "Médio porte" },
              { value: "Grande", label: "Grande porte" },
            ]} />
          </div>

          <div className="border-t border-certifica-200" />

          {/* Contact */}
          <div>
            <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-3" style={{ fontWeight: 600 }}>Contato Principal</div>
            <div className="grid grid-cols-2 gap-3">
              <DSInput label="Nome *" placeholder="Nome do contato" value={form.contatoNome} onChange={(e) => setForm({ ...form, contatoNome: e.target.value })} error={errors.contatoNome} />
              <DSInput label="Cargo" placeholder="Cargo na empresa" value={form.contatoCargo} onChange={(e) => setForm({ ...form, contatoCargo: e.target.value })} />
              <DSInput label="E-mail *" placeholder="email@empresa.com.br" type="email" value={form.contatoEmail} onChange={handleEmailChange} error={errors.email} />
              <DSInput label="Telefone" placeholder="(00) 00000-0000" value={form.contatoTelefone} onChange={handlePhoneChange} error={errors.telefone} />
            </div>
          </div>

          <div className="border-t border-certifica-200" />

          {/* Address */}
          <div>
            <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-3" style={{ fontWeight: 600 }}>Endereço</div>
            <div className="space-y-3">
              <DSInput label="Logradouro" placeholder="Rua, avenida, rodovia..." value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <DSInput label="Cidade *" placeholder="Município" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} error={errors.cidade} />
                <DSInput label="UF *" placeholder="XX" maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} error={errors.uf} />
              </div>
            </div>
          </div>

          <div className="border-t border-certifica-200" />

          <DSSelect label="Consultor Responsável *" value={form.consultorResponsavel} onChange={(e) => setForm({ ...form, consultorResponsavel: e.target.value })} error={errors.consultor} options={[
            { value: "", label: "Selecione o consultor..." },
            { value: "Carlos Silva", label: "Carlos Silva" },
            { value: "Ana Costa", label: "Ana Costa" },
            { value: "Pedro Souza", label: "Pedro Souza" },
            { value: "Maria Santos", label: "Maria Santos" },
            { value: "Roberto Lima", label: "Roberto Lima" },
          ]} />

          <DSSelect label="Status" value={statusRelacionamento} onChange={(e) => setStatusRelacionamento(e.target.value as ClienteUI["status"])} options={[
            { value: "prospect", label: "Prospect" },
            { value: "ativo", label: "Ativo" },
            { value: "inativo", label: "Inativo" },
          ]} />

          {formError && (
            <div className="px-3 py-2 bg-nao-conformidade/6 border border-nao-conformidade/20 rounded-[3px]">
              <p className="text-[11px] text-nao-conformidade" style={{ fontWeight: 500 }}>{formError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-certifica-200 flex items-center justify-end gap-2 bg-certifica-50/30">
          <DSButton variant="ghost" size="sm" onClick={onClose}>Cancelar</DSButton>
          <DSButton variant="primary" size="sm" disabled={saving} icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : mode === "create" ? <Plus className="w-3.5 h-3.5" strokeWidth={1.5} /> : <Check className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={handleSubmit}>
            {saving ? "Salvando..." : mode === "create" ? "Cadastrar Empresa" : "Salvar Alterações"}
          </DSButton>
        </div>
      </div>
    </div>
  );
}
