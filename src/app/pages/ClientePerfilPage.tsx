import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { useCliente360 } from "../lib/useCliente360";
import { useContatos } from "../lib/useContatos";
import { DSButton } from "../components/ds/DSButton";
import { DSBadge } from "../components/ds/DSBadge";
import { DSInput } from "../components/ds/DSInput";
import { DSSelect } from "../components/ds/DSSelect";
import { formatCNPJ } from "../lib/validators";
import {
  ArrowLeft, Building2, MapPin, Phone, Mail, MessageSquare, Shield,
  FileText, FolderOpen, ClipboardCheck, Video, Download, ExternalLink,
  Search, UserCircle, Briefcase, Calendar, Hash, Loader2, Users,
  ChevronRight, Camera,
} from "lucide-react";

/* ── Types ── */
interface ClienteRow {
  id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  segmento: string;
  porte: string;
  status: string;
  contato_nome: string;
  contato_cargo: string;
  contato_email: string;
  contato_telefone: string;
  endereco: string;
  cidade: string;
  uf: string;
  consultor_responsavel: string;
  created_at: string;
  logo_url: string | null;
}

type TabKey = "documentos" | "projetos" | "auditorias" | "reunioes";

const statusMap: Record<string, { label: string; variant: "conformidade" | "nao-conformidade" | "oportunidade" }> = {
  ativo: { label: "Ativo", variant: "conformidade" },
  inativo: { label: "Inativo", variant: "nao-conformidade" },
  prospect: { label: "Prospect", variant: "oportunidade" },
};

const docTypeLabels: Record<string, string> = {
  manual: "Manual", procedimento: "Procedimento", instrucao: "Instrução",
  formulario: "Formulário", registro: "Registro", evidencia: "Evidência",
};

const docStatusMap: Record<string, { label: string; variant: "conformidade" | "nao-conformidade" | "observacao" | "oportunidade" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  "em-revisao": { label: "Em Revisão", variant: "observacao" },
  aprovado: { label: "Aprovado", variant: "conformidade" },
  obsoleto: { label: "Obsoleto", variant: "nao-conformidade" },
};

/* ── Avatar Component with Upload ── */
function CompanyAvatar({ name, id, logoUrl, onLogoChange }: { name: string; id: string; logoUrl?: string | null; onLogoChange?: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState(logoUrl);
  useEffect(() => { setLocalUrl(logoUrl); }, [logoUrl]);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const hue = Math.abs(id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 360;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onLogoChange) return;
    setUploading(true);
    try {
      const path = `logos/${id}`;
      const { error: uploadErr } = await supabase.storage
        .from("Certifica Arquivos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from("Certifica Arquivos").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      await supabase.from("clientes").update({ logo_url: publicUrl }).eq("id", id);
      setLocalUrl(publicUrl);
      onLogoChange(publicUrl);
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="relative group flex-shrink-0 w-16 h-16">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      {localUrl ? (
        <img src={localUrl} alt={name} className="w-16 h-16 rounded-xl object-cover shadow-lg block" />
      ) : (
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl shadow-lg"
          style={{ fontWeight: 700, background: `linear-gradient(135deg, hsl(${hue}, 65%, 50%), hsl(${(hue + 40) % 360}, 55%, 40%))` }}
        >
          {initials || "?"}
        </div>
      )}
      {onLogoChange && (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-white" strokeWidth={1.5} />
          )}
        </button>
      )}
    </div>
  );
}

/* ── Health Score ── */
function computeHealth(status: string, data: { projetos: any[]; auditorias: any[]; documentos: any[]; reunioes: any[] }): number {
  let score = 60;
  if (status === "inativo") score -= 25;
  else if (status === "ativo") score += 5;
  const activePrj = data.projetos.filter((p) => p.status === "em-andamento").length;
  score += Math.min(activePrj * 5, 20);
  if (data.projetos.length === 0) score -= 5;
  const totalFindings = data.auditorias.reduce((acc, a) => acc + (a.findings_count || 0), 0);
  score -= Math.min(totalFindings * 4, 20);
  const obsoleteDocs = data.documentos.filter((d) => d.status === "obsoleto").length;
  score -= Math.min(obsoleteDocs * 3, 9);
  return Math.max(0, Math.min(100, score));
}

/* ── Main Page ── */
export default function ClientePerfilPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<ClienteRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("documentos");
  const [docSearch, setDocSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [docStatusFilter, setDocStatusFilter] = useState("");

  const cliente360 = useCliente360();
  const { contatos } = useContatos(id);

  // Fetch client
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    supabase
      .from("clientes")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setCliente(data as ClienteRow | null);
        setLoading(false);
      });
    cliente360.fetch(id);
  }, [id]);

  // Health score
  const healthScore = useMemo(() => {
    if (!cliente || !cliente360.data) return 0;
    return computeHealth(cliente.status, cliente360.data);
  }, [cliente, cliente360.data]);

  const healthColor = healthScore >= 75 ? "text-conformidade" : healthScore >= 55 ? "text-observacao" : "text-nao-conformidade";
  const healthBarColor = healthScore >= 75 ? "bg-conformidade" : healthScore >= 55 ? "bg-observacao" : "bg-nao-conformidade";
  const healthLabel = healthScore >= 75 ? "Boa" : healthScore >= 55 ? "Atenção" : "Crítica";

  // Filtered docs
  const filteredDocs = useMemo(() => {
    if (!cliente360.data) return [];
    let docs = cliente360.data.documentos;
    if (docSearch) {
      const q = docSearch.toLowerCase();
      docs = docs.filter((d) => d.codigo.toLowerCase().includes(q) || d.titulo.toLowerCase().includes(q));
    }
    if (docTypeFilter) docs = docs.filter((d) => d.tipo === docTypeFilter);
    if (docStatusFilter) docs = docs.filter((d) => d.status === docStatusFilter);
    return docs;
  }, [cliente360.data, docSearch, docTypeFilter, docStatusFilter]);

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count: number }[] = [
    { key: "documentos", label: "Documentos", icon: FileText, count: cliente360.data?.documentos.length ?? 0 },
    { key: "projetos", label: "Projetos", icon: FolderOpen, count: cliente360.data?.projetos.length ?? 0 },
    { key: "auditorias", label: "Auditorias", icon: ClipboardCheck, count: cliente360.data?.auditorias.length ?? 0 },
    { key: "reunioes", label: "Reuniões", icon: Video, count: cliente360.data?.reunioes.length ?? 0 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-certifica-accent" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-certifica-500 text-sm">Cliente não encontrado</p>
        <DSButton variant="outline" size="sm" onClick={() => navigate("/clientes")}>Voltar</DSButton>
      </div>
    );
  }

  const st = statusMap[cliente.status] ?? statusMap.prospect;
  const primaryContact = contatos.find((c) => c.principal) ?? contatos[0];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1100px] mx-auto px-5 py-6">

        {/* ── Back ── */}
        <button
          onClick={() => navigate("/clientes")}
          className="flex items-center gap-1.5 text-[12px] text-certifica-500 hover:text-certifica-dark transition-colors mb-5 cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Voltar para Empresas
        </button>

        {/* ── Header Card ── */}
        <div className="bg-white border border-certifica-200 rounded-lg p-6 mb-5">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Avatar + Info */}
            <CompanyAvatar
              name={cliente.nome_fantasia}
              id={cliente.id}
              logoUrl={cliente.logo_url}
              onLogoChange={(url) => setCliente((prev) => prev ? { ...prev, logo_url: url } : prev)}
            />

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-start gap-2 mb-1">
                <h1 className="text-[20px] text-certifica-dark leading-tight" style={{ fontWeight: 600 }}>
                  {cliente.nome_fantasia}
                </h1>
                <DSBadge variant={st.variant}>{st.label}</DSBadge>
              </div>

              <p className="text-[12px] text-certifica-500 mb-2" style={{ fontWeight: 400 }}>
                {cliente.razao_social}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-certifica-500">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" strokeWidth={1.5} />
                  {formatCNPJ(cliente.cnpj)}
                </span>
                {cliente.cidade && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" strokeWidth={1.5} />
                    {cliente.cidade}/{cliente.uf}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" strokeWidth={1.5} />
                  {cliente.segmento} · {cliente.porte}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" strokeWidth={1.5} />
                  Desde {new Date(cliente.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                </span>
              </div>

              {/* Health bar */}
              <div className="mt-3 max-w-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-certifica-500 flex items-center gap-1" style={{ fontWeight: 500 }}>
                    <Shield className="w-3 h-3" strokeWidth={1.5} />
                    Saúde
                  </span>
                  <span className={`text-[11px] ${healthColor}`} style={{ fontWeight: 600 }}>
                    {healthScore}% · {healthLabel}
                  </span>
                </div>
                <div className="h-[5px] bg-certifica-200 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${healthBarColor}`} style={{ width: `${healthScore}%` }} />
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex sm:flex-col gap-2 flex-shrink-0">
              {primaryContact?.telefone && (
                <a href={`tel:${primaryContact.telefone}`}>
                  <DSButton variant="outline" size="sm" icon={<Phone className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                    Ligar
                  </DSButton>
                </a>
              )}
              {primaryContact?.email && (
                <a href={`mailto:${primaryContact.email}`}>
                  <DSButton variant="outline" size="sm" icon={<Mail className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                    Email
                  </DSButton>
                </a>
              )}
              {primaryContact?.whatsapp && (
                <DSButton variant="outline" size="sm" icon={<MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={() => navigate("/chat")}>
                  Chat
                </DSButton>
              )}
            </div>
          </div>
        </div>

        {/* ── Info Cards (2 columns) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">

          {/* Contatos Card */}
          <div className="bg-white border border-certifica-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-certifica-accent" strokeWidth={1.5} />
              <span className="text-[11px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
                Contatos ({contatos.length})
              </span>
            </div>
            {contatos.length === 0 ? (
              <p className="text-[11px] text-certifica-400">Nenhum contato cadastrado</p>
            ) : (
              <div className="space-y-3">
                {contatos.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-certifica-100 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-4 h-4 text-certifica-400" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] text-certifica-dark truncate" style={{ fontWeight: 500 }}>{c.nome}</span>
                        {c.principal && (
                          <span className="text-[8px] bg-certifica-accent/10 text-certifica-accent px-1 py-px rounded" style={{ fontWeight: 600 }}>
                            PRINCIPAL
                          </span>
                        )}
                      </div>
                      {c.cargo && <p className="text-[10px] text-certifica-400">{c.cargo}</p>}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="text-[10px] text-certifica-accent hover:underline flex items-center gap-0.5">
                            <Mail className="w-2.5 h-2.5" strokeWidth={1.5} />{c.email}
                          </a>
                        )}
                        {c.telefone && (
                          <span className="text-[10px] text-certifica-500 flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5" strokeWidth={1.5} />{c.telefone}
                          </span>
                        )}
                        {c.whatsapp && (
                          <button onClick={() => navigate("/chat")} className="text-[10px] text-certifica-accent hover:underline flex items-center gap-0.5 cursor-pointer">
                            <MessageSquare className="w-2.5 h-2.5" strokeWidth={1.5} />WhatsApp
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="bg-white border border-certifica-200 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-certifica-accent" strokeWidth={1.5} />
              <span className="text-[11px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
                Informações
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-4">
              {[
                { label: "Consultor", value: cliente.consultor_responsavel || "—" },
                { label: "Segmento", value: cliente.segmento || "—" },
                { label: "Porte", value: cliente.porte || "—" },
                { label: "Cadastro", value: new Date(cliente.created_at).toLocaleDateString("pt-BR") },
                { label: "Projetos", value: String(cliente360.data?.projetos.length ?? 0) },
                { label: "Documentos", value: String(cliente360.data?.documentos.length ?? 0) },
                { label: "Auditorias", value: String(cliente360.data?.auditorias.length ?? 0) },
                { label: "Reuniões", value: String(cliente360.data?.reunioes.length ?? 0) },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-[9.5px] tracking-[0.06em] uppercase text-certifica-400 mb-0.5" style={{ fontWeight: 600 }}>{item.label}</p>
                  <p className="text-[12px] text-certifica-dark" style={{ fontWeight: 500 }}>{item.value}</p>
                </div>
              ))}
            </div>
            {cliente.endereco && (
              <div className="mt-3 pt-3 border-t border-certifica-100">
                <p className="text-[10px] text-certifica-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" strokeWidth={1.5} />
                  {cliente.endereco}, {cliente.cidade}/{cliente.uf}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white border border-certifica-200 rounded-lg overflow-hidden">
          {/* Tab headers */}
          <div className="flex border-b border-certifica-200">
            {tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1.5 px-5 py-3 text-[12px] transition-colors border-b-2 cursor-pointer ${
                    isActive
                      ? "border-certifica-accent text-certifica-accent"
                      : "border-transparent text-certifica-500 hover:text-certifica-dark hover:bg-certifica-50/50"
                  }`}
                  style={{ fontWeight: isActive ? 600 : 500 }}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {t.label}
                  {t.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-px rounded-full ${isActive ? "bg-certifica-accent/10 text-certifica-accent" : "bg-certifica-100 text-certifica-500"}`} style={{ fontWeight: 600 }}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {cliente360.loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-certifica-accent" />
              </div>
            ) : (
              <>
                {/* ── Documentos Tab ── */}
                {activeTab === "documentos" && (
                  <div>
                    {/* Filters */}
                    <div className="flex flex-wrap gap-3 mb-4">
                      <div className="flex-1 min-w-[180px] max-w-xs">
                        <DSInput
                          placeholder="Buscar por código ou título..."
                          value={docSearch}
                          onChange={(e) => setDocSearch(e.target.value)}
                          icon={<Search className="w-3.5 h-3.5" />}
                        />
                      </div>
                      <div className="w-[150px]">
                        <DSSelect
                          value={docTypeFilter}
                          onChange={(e) => setDocTypeFilter(e.target.value)}
                          options={[
                            { value: "", label: "Todos os tipos" },
                            ...Object.entries(docTypeLabels).map(([v, l]) => ({ value: v, label: l })),
                          ]}
                        />
                      </div>
                      <div className="w-[150px]">
                        <DSSelect
                          value={docStatusFilter}
                          onChange={(e) => setDocStatusFilter(e.target.value)}
                          options={[
                            { value: "", label: "Todos os status" },
                            { value: "rascunho", label: "Rascunho" },
                            { value: "em-revisao", label: "Em Revisão" },
                            { value: "aprovado", label: "Aprovado" },
                            { value: "obsoleto", label: "Obsoleto" },
                          ]}
                        />
                      </div>
                    </div>

                    {/* Doc list */}
                    {filteredDocs.length === 0 ? (
                      <div className="text-center py-10">
                        <FileText className="w-10 h-10 text-certifica-200 mx-auto mb-2" strokeWidth={1} />
                        <p className="text-[12px] text-certifica-400">Nenhum documento encontrado</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredDocs.map((doc) => {
                          const ds = docStatusMap[doc.status] ?? docStatusMap.rascunho;
                          return (
                            <div
                              key={doc.id}
                              className="flex items-center gap-4 p-3.5 rounded-md border border-certifica-100 hover:border-certifica-200 hover:bg-certifica-50/30 transition-colors group"
                            >
                              <div className="w-9 h-9 rounded-md bg-certifica-accent/8 flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-certifica-accent" strokeWidth={1.5} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[12.5px] text-certifica-dark truncate" style={{ fontWeight: 500 }}>
                                    {doc.codigo} — {doc.titulo}
                                  </span>
                                  <DSBadge variant={ds.variant} className="flex-shrink-0">{ds.label}</DSBadge>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-certifica-400">
                                    {docTypeLabels[doc.tipo] ?? doc.tipo}
                                  </span>
                                  <span className="text-[10px] text-certifica-300">·</span>
                                  <span className="text-[10px] text-certifica-400">
                                    {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => navigate("/documentos")}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-certifica-accent hover:text-certifica-accent-dark cursor-pointer"
                                title="Ver documento"
                              >
                                <ExternalLink className="w-4 h-4" strokeWidth={1.5} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Projetos Tab ── */}
                {activeTab === "projetos" && (
                  <div>
                    {!cliente360.data?.projetos.length ? (
                      <div className="text-center py-10">
                        <FolderOpen className="w-10 h-10 text-certifica-200 mx-auto mb-2" strokeWidth={1} />
                        <p className="text-[12px] text-certifica-400">Nenhum projeto vinculado</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cliente360.data.projetos.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => navigate("/projetos")}
                            className="w-full text-left flex items-center gap-4 p-3.5 rounded-md border border-certifica-100 hover:border-certifica-200 hover:bg-certifica-50/30 transition-colors cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-md bg-oportunidade/10 flex items-center justify-center flex-shrink-0">
                              <FolderOpen className="w-4 h-4 text-oportunidade" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[12.5px] text-certifica-dark block truncate" style={{ fontWeight: 500 }}>
                                {p.codigo} — {p.titulo}
                              </span>
                              <span className="text-[10px] text-certifica-400">
                                {p.norma} · {p.fase_label} · {p.status}
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-certifica-300 flex-shrink-0" strokeWidth={1.5} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Auditorias Tab ── */}
                {activeTab === "auditorias" && (
                  <div>
                    {!cliente360.data?.auditorias.length ? (
                      <div className="text-center py-10">
                        <ClipboardCheck className="w-10 h-10 text-certifica-200 mx-auto mb-2" strokeWidth={1} />
                        <p className="text-[12px] text-certifica-400">Nenhuma auditoria registrada</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cliente360.data.auditorias.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => navigate("/auditorias")}
                            className="w-full text-left flex items-center gap-4 p-3.5 rounded-md border border-certifica-100 hover:border-certifica-200 hover:bg-certifica-50/30 transition-colors cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-md bg-conformidade/10 flex items-center justify-center flex-shrink-0">
                              <ClipboardCheck className="w-4 h-4 text-conformidade" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[12.5px] text-certifica-dark block truncate" style={{ fontWeight: 500 }}>
                                {a.codigo}
                              </span>
                              <span className="text-[10px] text-certifica-400">
                                {a.tipo} · {a.norma} · {a.status} · {a.findings_count} achado(s)
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-certifica-300 flex-shrink-0" strokeWidth={1.5} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Reunioes Tab ── */}
                {activeTab === "reunioes" && (
                  <div>
                    {!cliente360.data?.reunioes.length ? (
                      <div className="text-center py-10">
                        <Video className="w-10 h-10 text-certifica-200 mx-auto mb-2" strokeWidth={1} />
                        <p className="text-[12px] text-certifica-400">Nenhuma reunião registrada</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cliente360.data.reunioes.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => navigate("/reunioes")}
                            className="w-full text-left flex items-center gap-4 p-3.5 rounded-md border border-certifica-100 hover:border-certifica-200 hover:bg-certifica-50/30 transition-colors cursor-pointer"
                          >
                            <div className="w-9 h-9 rounded-md bg-certifica-accent/8 flex items-center justify-center flex-shrink-0">
                              <Video className="w-4 h-4 text-certifica-accent" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[12.5px] text-certifica-dark block truncate" style={{ fontWeight: 500 }}>
                                {m.titulo}
                              </span>
                              <span className="text-[10px] text-certifica-400">
                                {m.tipo} · {m.data ? new Date(m.data).toLocaleDateString("pt-BR") : "Sem data"} · {m.status}
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-certifica-300 flex-shrink-0" strokeWidth={1.5} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
