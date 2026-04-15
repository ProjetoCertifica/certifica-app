import React, { useEffect, useMemo, useState } from "react";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { DSButton } from "../components/ds/DSButton";
import { toast } from "sonner";
import { useDocuments } from "../lib/useDocuments";
import type { DocumentWithRelations } from "../lib/useDocuments";

import {
  Search,
  Upload,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File,
  Grid3X3,
  List,
  Download,
  Eye,
  History,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Package,
  X,
  Bot,
  Trash2,
} from "lucide-react";

type ViewMode = "list" | "grid";
type VersionType = "major" | "minor";
type DocType = "pdf" | "xlsx" | "docx" | "img";
type DocStatus = "rascunho" | "revisao" | "aprovado" | "obsoleto";
type PermissionLevel = "somente_leitura" | "edicao" | "aprovacao";

interface RevisionEntry {
  version: string;
  date: string;
  author: string;
  note: string;
}

interface AuditTrailEntry {
  date: string;
  action: string;
  actor: string;
}

interface GedDocument {
  id: string;
  name: string;
  type: DocType;
  size: string;
  modified: string;
  version: string;
  category: string;
  client: string;
  project: string;
  status: DocStatus;
  clause: string;
  evidence: string;
  permission: PermissionLevel;
  approver?: string;
  approvedAt?: string;
  expiresAt?: string;
  revisions: RevisionEntry[];
  trail: AuditTrailEntry[];
  arquivo_url?: string | null;
}


const fileIcon = (type: DocType) => {
  switch (type) {
    case "pdf": return <FileText className="w-4 h-4 text-nao-conformidade/60" strokeWidth={1.5} />;
    case "xlsx": return <FileSpreadsheet className="w-4 h-4 text-conformidade/60" strokeWidth={1.5} />;
    case "docx": return <FileText className="w-4 h-4 text-oportunidade/60" strokeWidth={1.5} />;
    case "img": return <ImageIcon className="w-4 h-4 text-observacao/60" strokeWidth={1.5} />;
    default: return <File className="w-4 h-4 text-certifica-500/40" strokeWidth={1.5} />;
  }
};

function statusBadge(status: DocStatus): { label: string; cls: string } {
  if (status === "aprovado") return { label: "Aprovado", cls: "bg-conformidade/10 text-conformidade border-conformidade/20" };
  if (status === "revisao") return { label: "Revisão", cls: "bg-observacao/10 text-observacao border-observacao/20" };
  if (status === "obsoleto") return { label: "Obsoleto", cls: "bg-nao-conformidade/10 text-nao-conformidade border-nao-conformidade/20" };
  return { label: "Rascunho", cls: "bg-certifica-50 text-certifica-500 border-certifica-200" };
}

function permissionLabel(permission: PermissionLevel) {
  if (permission === "aprovacao") return "Aprovação";
  if (permission === "edicao") return "Edição";
  return "Somente leitura";
}

function suggestMetadata(params: { name: string; type?: DocType; project?: string }): { category: string; clause: string } {
  const n = params.name.toLowerCase();
  const project = (params.project || "").toLowerCase();
  if (n.includes("plano de acao") || n.includes("nc")) return { category: "Plano de acao", clause: "10.2" };
  if (n.includes("manual")) return { category: "Manual", clause: "7.5" };
  if (n.includes("ata") || n.includes("reuniao")) return { category: "Registro", clause: "7.5" };
  if (n.includes("checklist")) return { category: "Checklist", clause: "8.1" };
  if (n.includes("appcc") || project.includes("22000")) return { category: "Plano", clause: "8.5" };
  if (project.includes("50001")) return { category: "Relatorio", clause: "9.1" };
  if (params.type === "xlsx") return { category: "Registro", clause: "9.1" };
  if (params.type === "img") return { category: "Evidencia", clause: "8.5" };
  return { category: "Procedimento", clause: "7.5" };
}

function inferDocTypeFromFileName(fileName: string): DocType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return "xlsx";
  if (lower.endsWith(".docx") || lower.endsWith(".doc") || lower.endsWith(".txt")) return "docx";
  if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp")) return "img";
  return "pdf";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseVersionParts(version: string): { major: number; minor: number } {
  const cleaned = version.trim();
  const [majorRaw, minorRaw] = cleaned.split(".");
  const major = Number(majorRaw);
  const minor = Number(minorRaw ?? "0");
  return {
    major: Number.isNaN(major) ? 1 : Math.max(0, major),
    minor: Number.isNaN(minor) ? 0 : Math.max(0, minor),
  };
}

function mapDocToGed(doc: DocumentWithRelations): GedDocument {
  const dbStatusMap: Record<string, DocStatus> = {
    "rascunho": "rascunho",
    "em-revisao": "revisao",
    "aprovado": "aprovado",
    "obsoleto": "obsoleto",
  };

  return {
    id: doc.id,
    name: doc.titulo,
    type: inferDocTypeFromFileName(doc.arquivo_nome),
    size: formatFileSize(doc.tamanho_bytes),
    modified: doc.updated_at.split("T")[0].split("-").reverse().join("/"),
    version: String(doc.versao) + ".0",
    category: doc.tipo.charAt(0).toUpperCase() + doc.tipo.slice(1),
    client: doc.cliente_nome ?? "",
    project: doc.projeto_titulo ?? doc.norma ?? "",
    status: dbStatusMap[doc.status] ?? "rascunho",
    clause: doc.tags?.[0] ?? "",
    evidence: doc.tags?.[1] ?? "",
    permission: "edicao",
    approver: doc.aprovado_por || undefined,
    revisions: [],
    trail: [],
    arquivo_url: doc.arquivo_url,
  };
}

function parseSizeToBytes(sizeStr: string): number {
  const str = sizeStr.trim().toUpperCase();
  const num = parseFloat(str);
  if (Number.isNaN(num)) return 0;
  if (str.includes("GB")) return Math.round(num * 1024 * 1024 * 1024);
  if (str.includes("MB")) return Math.round(num * 1024 * 1024);
  if (str.includes("KB")) return Math.round(num * 1024);
  return Math.round(num);
}


export default function DocumentosPage() {
  const { documents: rawDocs, loading, error, create, approve, remove, uploadFile } = useDocuments();
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterClient, setFilterClient] = useState("todos");
  const [filterProject, setFilterProject] = useState("todos");
  const [filterCategory, setFilterCategory] = useState("todos");
  const [filterType, setFilterType] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [showUpload, setShowUpload] = useState(false);
  const [localTrails, setLocalTrails] = useState<Record<string, AuditTrailEntry[]>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const gedDocuments = useMemo(() => rawDocs.map(mapDocToGed), [rawDocs]);

  useEffect(() => {
    if (selectedDoc === null && gedDocuments.length > 0) {
      setSelectedDoc(gedDocuments[0].id);
    }
    setConfirmDelete(false);
  }, [gedDocuments, selectedDoc]);

  const clients = [...new Set(gedDocuments.map((d) => d.client))];
  const projects = [...new Set(gedDocuments.map((d) => d.project))];
  const categories = [...new Set(gedDocuments.map((d) => d.category))];
  const types = [...new Set(gedDocuments.map((d) => d.type))];

  const filtered = useMemo(() => {
    return gedDocuments.filter((d) => {
      if (filterClient !== "todos" && d.client !== filterClient) return false;
      if (filterProject !== "todos" && d.project !== filterProject) return false;
      if (filterCategory !== "todos" && d.category !== filterCategory) return false;
      if (filterType !== "todos" && d.type !== filterType) return false;
      if (filterStatus !== "todos" && d.status !== filterStatus) return false;
      if (searchQuery && !`${d.name} ${d.client} ${d.project} ${d.clause}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [gedDocuments, filterClient, filterProject, filterCategory, filterType, filterStatus, searchQuery]);

  const selected = gedDocuments.find((d) => d.id === selectedDoc);
  const selectedWithTrail: GedDocument | undefined = selected
    ? { ...selected, trail: [...(localTrails[selected.id] ?? []), ...selected.trail] }
    : undefined;

  const vencidos = gedDocuments.filter((d) => d.expiresAt && new Date(d.expiresAt.split("/").reverse().join("-")) < new Date()).length;

  const addTrail = (docId: string, action: string) => {
    const now = new Date().toLocaleString("pt-BR");
    setLocalTrails((prev) => ({
      ...prev,
      [docId]: [{ date: now, action, actor: "Carlos Silva" }, ...(prev[docId] ?? [])],
    }));
  };

  const approveSelected = async () => {
    if (!selected) return;
    const ok = await approve(selected.id, "Carlos Silva");
    if (ok) {
      addTrail(selected.id, "Documento aprovado com assinatura");
      toast.success("Documento aprovado!");
    }
  };

  const exportAuditPackage = () => {
    const pkgCount = filtered.length;
    toast.info(`Pacote documental para auditoria externa gerado com ${pkgCount} documento(s).`);
  };


  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-certifica-500">
        Carregando documentos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-nao-conformidade">
        Erro ao carregar documentos: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:h-full overflow-auto lg:overflow-hidden certifica-page-enter">
      <div className="flex-1 flex flex-col overflow-hidden min-h-[380px] lg:min-h-0">
        <div className="px-5 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-certifica-900">Documentos (GED)</h2>
              <p className="text-[12px] text-certifica-500 mt-0.5">
                {gedDocuments.length} documentos · {clients.length} clientes · {vencidos} vencido(s)/obsoleto(s)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DSButton variant="outline" size="sm" icon={<Package className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={exportAuditPackage}>
                Pacote auditoria externa
              </DSButton>
              <DSButton variant="primary" size="sm" icon={<Upload className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={() => setShowUpload(true)}>
                Upload + versionamento
              </DSButton>
            </div>
          </div>

          <div className="flex items-center gap-2 pb-3 border-b border-certifica-200 flex-wrap">
            <div className="relative w-[250px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-certifica-500/40" strokeWidth={1.5} />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full h-7 pl-8 pr-3 bg-certifica-50 border border-certifica-200 rounded-[3px] text-[11.5px]" placeholder="Buscar por nome, cliente, cláusula..." />
            </div>
            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="h-7 px-2 border border-certifica-200 rounded-[3px] text-[11.5px]">
              <option value="todos">Cliente</option>
              {clients.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="h-7 px-2 border border-certifica-200 rounded-[3px] text-[11.5px]">
              <option value="todos">Projeto</option>
              {projects.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="h-7 px-2 border border-certifica-200 rounded-[3px] text-[11.5px]">
              <option value="todos">Categoria</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="h-7 px-2 border border-certifica-200 rounded-[3px] text-[11.5px]">
              <option value="todos">Tipo</option>
              {types.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-7 px-2 border border-certifica-200 rounded-[3px] text-[11.5px]">
              <option value="todos">Status</option>
              <option value="rascunho">Rascunho</option>
              <option value="revisao">Revisão</option>
              <option value="aprovado">Aprovado</option>
              <option value="obsoleto">Obsoleto</option>
            </select>
            <div className="flex items-center border border-certifica-200 rounded-[3px] overflow-hidden ml-auto">
              <button onClick={() => setViewMode("list")} className={`p-1.5 ${viewMode === "list" ? "bg-certifica-900 text-white" : "bg-white text-certifica-500"}`}><List className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
              <button onClick={() => setViewMode("grid")} className={`p-1.5 ${viewMode === "grid" ? "bg-certifica-900 text-white" : "bg-white text-certifica-500"}`}><Grid3X3 className="w-3.5 h-3.5" strokeWidth={1.5} /></button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {viewMode === "list" ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-certifica-200">
                  {["Nome", "Cliente", "Projeto", "Categoria", "Cláusula", "Versão", "Status", "Permissão", ""].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] tracking-[0.06em] uppercase text-certifica-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const st = statusBadge(doc.status);
                  return (
                    <tr key={doc.id} onClick={() => setSelectedDoc(doc.id)} className={`border-b border-certifica-200/60 cursor-pointer ${selectedDoc === doc.id ? "bg-certifica-50" : "hover:bg-certifica-50/50"}`}>
                      <td className="px-3 py-2.5"><div className="flex items-center gap-2">{fileIcon(doc.type)}<span className="text-[12.5px] text-certifica-dark" style={{ fontWeight: 500 }}>{doc.name}</span></div></td>
                      <td className="px-3 py-2.5 text-[11.5px] text-certifica-500">{doc.client}</td>
                      <td className="px-3 py-2.5 text-[11.5px] text-certifica-500">{doc.project}</td>
                      <td className="px-3 py-2.5 text-[11px] text-certifica-500">{doc.category}</td>
                      <td className="px-3 py-2.5 text-[11px] text-certifica-700 font-mono">{doc.clause}</td>
                      <td className="px-3 py-2.5 text-[11px] text-certifica-700 font-mono">{doc.version}</td>
                      <td className="px-3 py-2.5"><span className={`inline-flex border rounded-[3px] px-1.5 py-px text-[10px] ${st.cls}`}>{st.label}</span></td>
                      <td className="px-3 py-2.5 text-[11px] text-certifica-500">{permissionLabel(doc.permission)}</td>
                      <td className="px-3 py-2.5"><button className="p-1 text-certifica-500/30 hover:text-certifica-700 cursor-pointer" title="Ver documento" onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc.id); }}><Eye className="w-3.5 h-3.5" strokeWidth={1.5} /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map((doc) => {
                const st = statusBadge(doc.status);
                return (
                  <div key={doc.id} onClick={() => setSelectedDoc(doc.id)} className={`border rounded-[4px] px-4 py-3 cursor-pointer ${selectedDoc === doc.id ? "border-certifica-700/30 bg-certifica-50" : "border-certifica-200 bg-white hover:bg-certifica-50/50"}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">{fileIcon(doc.type)}<span className="text-[11px] font-mono">{doc.version}</span></div>
                      <span className={`inline-flex border rounded-[3px] px-1.5 py-px text-[10px] ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="text-[12.5px] text-certifica-dark mb-1" style={{ fontWeight: 500 }}>{doc.name}</div>
                    <div className="text-[10.5px] text-certifica-500">{doc.client} · {doc.project}</div>
                    <div className="text-[10px] text-certifica-500/60 mt-1">Cláusula {doc.clause} · Evidência {doc.evidence}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedWithTrail && (
        <div className="w-full lg:w-[320px] lg:flex-shrink-0 border-t lg:border-t-0 lg:border-l border-certifica-200 bg-white flex flex-col overflow-y-auto">
          <div className="px-4 py-3 border-b border-certifica-200">
            <div className="flex items-center gap-2 mb-2">{fileIcon(selectedWithTrail.type)}<span className="text-[12px] font-mono">{selectedWithTrail.version}</span></div>
            <div className="text-[13px] text-certifica-900 mb-1" style={{ fontWeight: 600 }}>{selectedWithTrail.name}</div>
            <div className="text-[11px] text-certifica-500 mb-3">{selectedWithTrail.category} · {selectedWithTrail.size}</div>
            <div className="flex gap-1.5">
              <DSButton variant="outline" size="sm" className="flex-1" icon={<Download className="w-3 h-3" strokeWidth={1.5} />} onClick={async () => {
                addTrail(selectedWithTrail.id, "Download");
                const url = selectedWithTrail.arquivo_url;
                if (!url) { toast.info("Este documento não possui arquivo anexado."); return; }
                try {
                  const res = await fetch(url);
                  const blob = await res.blob();
                  const blobUrl = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = blobUrl;
                  a.download = selectedWithTrail.name;
                  a.click();
                  URL.revokeObjectURL(blobUrl);
                } catch {
                  window.open(url, "_blank");
                }
              }}>Baixar</DSButton>
              <DSButton variant="outline" size="sm" className="flex-1" icon={<Eye className="w-3 h-3" strokeWidth={1.5} />} onClick={() => {
                addTrail(selectedWithTrail.id, "Abertura de documento");
                const url = selectedWithTrail.arquivo_url;
                if (!url) { toast.info("Este documento não possui arquivo anexado."); return; }
                window.open(encodeURI(url), "_blank");
              }}>Abrir</DSButton>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-certifica-200">
            <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2">Compliance</div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between"><span className="text-certifica-500">Cláusula</span><span className="text-certifica-dark font-mono">{selectedWithTrail.clause}</span></div>
              <div className="flex justify-between"><span className="text-certifica-500">Evidência</span><span className="text-certifica-dark font-mono">{selectedWithTrail.evidence}</span></div>
              <div className="flex justify-between"><span className="text-certifica-500">Permissão</span><span className="text-certifica-dark">{permissionLabel(selectedWithTrail.permission)}</span></div>
              <div className="flex justify-between"><span className="text-certifica-500">Aprovador</span><span className="text-certifica-dark">{selectedWithTrail.approver ?? "—"}</span></div>
              <div className="flex justify-between"><span className="text-certifica-500">Validação</span><span className="text-certifica-dark">{selectedWithTrail.approvedAt ?? "Pendente"}</span></div>
            </div>
            <div className="mt-2 flex gap-1.5">
              <DSButton size="sm" variant="outline" className="flex-1" icon={<Shield className="w-3 h-3" strokeWidth={1.5} />} onClick={approveSelected}>
                Aprovar
              </DSButton>
              <DSButton size="sm" variant="outline" className="flex-1" icon={<CheckCircle2 className="w-3 h-3" strokeWidth={1.5} />} onClick={() => addTrail(selectedWithTrail.id, "Assinatura digital registrada")}>
                Assinar
              </DSButton>
            </div>
            {!confirmDelete ? (
              <div className="mt-2">
                <DSButton size="sm" variant="outline" className="w-full text-red-500 border-red-200 hover:bg-red-50" icon={<Trash2 className="w-3 h-3" strokeWidth={1.5} />} onClick={() => setConfirmDelete(true)}>
                  Apagar documento
                </DSButton>
              </div>
            ) : (
              <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-[5px]">
                <p className="text-[11px] text-red-700 mb-2">Tem certeza? Esta ação não pode ser desfeita.</p>
                <div className="flex gap-1.5">
                  <DSButton size="sm" variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancelar</DSButton>
                  <DSButton size="sm" className="flex-1 bg-red-500 hover:bg-red-600 text-white border-0" onClick={async () => {
                    const id = selectedWithTrail.id;
                    setConfirmDelete(false);
                    setSelectedDoc(null);
                    const ok = await remove(id);
                    if (ok) toast.success("Documento apagado.");
                    else toast.error("Erro ao apagar documento.");
                  }}>Apagar</DSButton>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-b border-certifica-200">
            <div className="flex items-center gap-1.5 mb-2"><AlertTriangle className="w-3 h-3 text-observacao" strokeWidth={1.5} /><span className="text-[10px] tracking-[0.06em] uppercase text-certifica-500">Validade</span></div>
            <div className="text-[11px] text-certifica-500">Vencimento: {selectedWithTrail.expiresAt ?? "Não definido"}</div>
            {selectedWithTrail.status === "obsoleto" && <div className="text-[11px] text-nao-conformidade mt-1">Documento obsoleto detectado.</div>}
          </div>

          <div className="px-4 py-3 border-b border-certifica-200">
            <div className="flex items-center gap-1.5 mb-2"><History className="w-3 h-3 text-certifica-500" strokeWidth={1.5} /><span className="text-[10px] tracking-[0.06em] uppercase text-certifica-500">Histórico de revisão</span></div>
            <div className="space-y-2">
              {selectedWithTrail.revisions.map((rev) => (
                <div key={`${selectedWithTrail.id}-${rev.version}-${rev.date}`} className="text-[11px]">
                  <div className="flex justify-between"><span className="font-mono text-certifica-700">{rev.version}</span><span className="text-certifica-500">{rev.date.split(" ")[0]}</span></div>
                  <p className="text-certifica-dark">{rev.note}</p>
                  <span className="text-certifica-500/70">por {rev.author}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5 mb-2"><Calendar className="w-3 h-3 text-certifica-500" strokeWidth={1.5} /><span className="text-[10px] tracking-[0.06em] uppercase text-certifica-500">Trilha de acesso/download</span></div>
            <div className="space-y-1.5">
              {selectedWithTrail.trail.map((tr) => (
                <div key={`${selectedWithTrail.id}-${tr.date}-${tr.action}`} className="text-[11px] text-certifica-500">
                  {tr.date} · {tr.action} · {tr.actor}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <UploadModal
          existingDocuments={gedDocuments}
          onClose={() => setShowUpload(false)}
          onUpload={async (payload) => {
            const categoryMap: Record<string, string> = {
              "Manual": "manual",
              "Procedimento": "procedimento",
              "Instrucao": "instrucao",
              "Formulario": "formulario",
              "Registro": "registro",
            };
            const tipoRaw = payload.category || suggestMetadata({ name: payload.name, type: payload.type, project: payload.project }).category;
            const tipo = (categoryMap[tipoRaw] ?? "evidencia") as "manual" | "procedimento" | "instrucao" | "formulario" | "registro" | "evidencia";

            const versao = parseInt(
              payload.versionType === "major"
                ? String(payload.baseVersion + 1)
                : String(payload.baseVersion)
            ) || 1;

            const tags = [payload.clause, payload.evidence].filter(Boolean);

            // Upload real do arquivo se existir
            let arquivoUrl: string | null = null;
            if (payload.file) {
              toast.info("Enviando arquivo...");
              const ext = payload.file.name.split(".").pop() || "bin";
              const safeName = payload.name.replace(/[^a-zA-Z0-9._-]/g, "_");
              const storagePath = `${Date.now()}_${safeName}.${ext}`;
              const { url, errorMsg } = await uploadFile(payload.file, storagePath);
              arquivoUrl = url;
              if (!arquivoUrl) {
                toast.error(`Erro no upload: ${errorMsg ?? "verifique as permissões do bucket"}`);
                return;
              }
            }

            const result = await create({
              titulo: payload.name,
              tipo,
              norma: payload.project,
              versao,
              status: "rascunho",
              arquivo_nome: payload.name,
              arquivo_url: arquivoUrl,
              tamanho_bytes: parseSizeToBytes(payload.size),
              uploaded_by: "Carlos Silva",
              aprovado_por: "",
              tags,
              codigo: (payload.category || "DOC") + "-" + Date.now(),
            });

            if (result) {
              toast.success("Documento enviado!");
              setSelectedDoc(result.id);
              setShowUpload(false);
            } else {
              toast.error("Erro ao salvar");
            }
          }}
        />
      )}
    </div>
  );
}

function UploadModal({
  existingDocuments,
  onClose,
  onUpload,
}: {
  existingDocuments: GedDocument[];
  onClose: () => void;
  onUpload: (payload: {
    name: string;
    type: DocType;
    size: string;
    client: string;
    project: string;
    category: string;
    clause: string;
    evidence: string;
    permission: PermissionLevel;
    versionType: VersionType;
    baseVersion: number;
    minor: number;
    justification: string;
    expiresAt: string;
    file?: File;
  }) => void;
}) {
  useBodyScrollLock(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<DocType>("pdf");
  const [size, setSize] = useState("1.0 MB");
  const [client, setClient] = useState("Metalurgica Acoforte");
  const [project, setProject] = useState("ISO 9001:2015");
  const [category, setCategory] = useState("");
  const [clause, setClause] = useState("");
  const [evidence, setEvidence] = useState("");
  const [permission, setPermission] = useState<PermissionLevel>("edicao");
  const [versionType, setVersionType] = useState<VersionType>("minor");
  const [baseVersion, setBaseVersion] = useState(1);
  const [minor, setMinor] = useState(0);
  const [justification, setJustification] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [formError, setFormError] = useState("");
  const [fileSelected, setFileSelected] = useState(false);
  const [fileObj, setFileObj] = useState<File | undefined>(undefined);
  const [autoInheritBase, setAutoInheritBase] = useState(true);
  const [inheritedFields, setInheritedFields] = useState<string[]>([]);

  const suggestion = useMemo(() => suggestMetadata({ name, type, project }), [name, type, project]);

  const duplicateName = useMemo(() => {
    if (!name.trim()) return null;
    const normalized = normalizeName(name);
    return existingDocuments.find(
      (doc) => normalizeName(doc.name) === normalized && doc.client === client && doc.project === project
    );
  }, [existingDocuments, name, client, project]);

  const sameContextDocs = useMemo(() => {
    if (!name.trim()) return [];
    const normalized = normalizeName(name);
    return existingDocuments
      .filter((doc) => normalizeName(doc.name) === normalized && doc.client === client && doc.project === project)
      .sort((a, b) => {
        const av = parseVersionParts(a.version);
        const bv = parseVersionParts(b.version);
        if (av.major !== bv.major) return bv.major - av.major;
        return bv.minor - av.minor;
      });
  }, [existingDocuments, name, client, project]);

  const suggestedVersion = useMemo(() => {
    const latest = sameContextDocs[0];
    if (!latest) {
      return versionType === "major" ? "1.0" : "1.1";
    }
    const current = parseVersionParts(latest.version);
    if (versionType === "major") {
      return `${current.major + 1}.0`;
    }
    return `${current.major}.${current.minor + 1}`;
  }, [sameContextDocs, versionType]);

  React.useEffect(() => {
    const [sMajorRaw, sMinorRaw] = suggestedVersion.split(".");
    const sMajor = Number(sMajorRaw);
    const sMinor = Number(sMinorRaw ?? "0");
    if (!Number.isNaN(sMajor)) {
      if (versionType === "major") {
        setBaseVersion(Math.max(0, sMajor - 1));
        setMinor(0);
      } else {
        setBaseVersion(Math.max(0, sMajor));
        setMinor(Math.max(0, sMinor - 1));
      }
    }
  }, [suggestedVersion, versionType]);

  React.useEffect(() => {
    if (!autoInheritBase) return;
    const baseDoc = sameContextDocs[0];
    if (!baseDoc) return;
    const inherited: string[] = [];
    setCategory(baseDoc.category);
    inherited.push("categoria");
    setClause(baseDoc.clause);
    inherited.push("clausula");
    setPermission(baseDoc.permission);
    inherited.push("permissao");
    setClient(baseDoc.client);
    inherited.push("cliente");
    setProject(baseDoc.project);
    inherited.push("projeto");
    setEvidence((prev) => {
      if (prev.trim()) return prev;
      inherited.push("evidencia");
      return baseDoc.evidence;
    });
    setInheritedFields(inherited);
  }, [autoInheritBase, sameContextDocs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-certifica-dark/45 certifica-modal-backdrop" onClick={onClose} />
      <div className="relative w-full max-w-[720px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] certifica-modal-content">
        <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
          <div>
            <h3 className="text-certifica-900 text-[15px]" style={{ fontWeight: 600 }}>Upload e versionamento</h3>
            <p className="text-[11px] text-certifica-500">Major/minor, justificativa e metadados de compliance.</p>
          </div>
          <button onClick={onClose} className="p-1 text-certifica-500/40 hover:text-certifica-700"><X className="w-4 h-4" strokeWidth={1.5} /></button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <label className="col-span-2 text-[11px] text-certifica-500">
            Arquivo
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setName(file.name);
                setType(inferDocTypeFromFileName(file.name));
                setSize(formatFileSize(file.size));
                setFileSelected(true);
                setFileObj(file);
                setFormError("");
              }}
              className="mt-1 w-full h-9 px-2 py-1 border border-certifica-200 rounded-[4px] text-[12px] bg-white"
            />
          </label>
          <label className="col-span-2 text-[11px] text-certifica-500">Nome<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px]" /></label>
          <label className="text-[11px] text-certifica-500">Tipo<select value={type} onChange={(e) => setType(e.target.value as DocType)} className="mt-1 w-full h-9 px-2 border border-certifica-200 rounded-[4px] text-[12px]"><option value="pdf">PDF</option><option value="xlsx">XLSX</option><option value="docx">DOCX</option><option value="img">Imagem</option></select></label>
          <label className="text-[11px] text-certifica-500">Tamanho<input value={size} onChange={(e) => setSize(e.target.value)} className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px]" /></label>
          <label className="text-[11px] text-certifica-500">Cliente<input value={client} onChange={(e) => setClient(e.target.value)} className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px]" /></label>
          <label className="text-[11px] text-certifica-500">Projeto<input value={project} onChange={(e) => setProject(e.target.value)} className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px]" /></label>
          <label className="text-[11px] text-certifica-500">Categoria<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={suggestion.category} className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px]" /></label>
          <label className="text-[11px] text-certifica-500">Cláusula<input value={clause} onChange={(e) => setClause(e.target.value)} placeholder={suggestion.clause} className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px]" /></label>
          <label className="text-[11px] text-certifica-500">Evidência<input value={evidence} onChange={(e) => setEvidence(e.target.value)} className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px]" /></label>
          <label className="text-[11px] text-certifica-500">Permissão<select value={permission} onChange={(e) => setPermission(e.target.value as PermissionLevel)} className="mt-1 w-full h-9 px-2 border border-certifica-200 rounded-[4px] text-[12px]"><option value="somente_leitura">Somente leitura</option><option value="edicao">Edição</option><option value="aprovacao">Aprovação</option></select></label>
          <label className="text-[11px] text-certifica-500">Versionamento<select value={versionType} onChange={(e) => setVersionType(e.target.value as VersionType)} className="mt-1 w-full h-9 px-2 border border-certifica-200 rounded-[4px] text-[12px]"><option value="minor">Minor</option><option value="major">Major</option></select></label>
          <label className="text-[11px] text-certifica-500">Versão base<input type="number" value={baseVersion} onChange={(e) => setBaseVersion(Number(e.target.value || 1))} className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px]" /></label>
          <label className="text-[11px] text-certifica-500">Minor atual<input type="number" value={minor} onChange={(e) => setMinor(Number(e.target.value || 0))} className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px]" /></label>
          <label className="col-span-2 text-[11px] text-certifica-500">Justificativa da revisão<input value={justification} onChange={(e) => setJustification(e.target.value)} className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px]" /></label>
          <label className="col-span-2 text-[11px] text-certifica-500">Vencimento / revisão obrigatória<input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] text-[12px]" /></label>
          {duplicateName && (
            <div className="col-span-2 text-[11px] text-observacao bg-observacao/10 border border-observacao/20 rounded-[4px] px-3 py-2">
              Documento com mesmo nome ja existe para este cliente/projeto: ultima versao {sameContextDocs[0]?.version ?? duplicateName.version}.
            </div>
          )}
          {sameContextDocs.length > 0 && (
            <div className="col-span-2 text-[11px] text-certifica-500 bg-certifica-50 border border-certifica-200 rounded-[4px] px-3 py-2">
              Versionamento inteligente: proxima versao sugerida automaticamente <strong>{suggestedVersion}</strong>.
            </div>
          )}
          <div className="col-span-2 flex items-center justify-between border border-certifica-200 rounded-[4px] px-3 py-2 bg-white">
            <span className="text-[11px] text-certifica-500">Herdar campos da ultima versao automaticamente</span>
            <label className="text-[11px] text-certifica-dark flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={autoInheritBase}
                onChange={(e) => {
                  setAutoInheritBase(e.target.checked);
                  if (!e.target.checked) setInheritedFields([]);
                }}
              />
              Ativo
            </label>
          </div>
          {inheritedFields.length > 0 && (
            <div className="col-span-2 text-[11px] text-conformidade bg-conformidade/10 border border-conformidade/20 rounded-[4px] px-3 py-2">
              Campos herdados automaticamente: <strong>{inheritedFields.join(", ")}</strong>.
            </div>
          )}
          {sameContextDocs.length > 0 && (
            <div className="col-span-2 border border-certifica-200 rounded-[4px] px-3 py-2 bg-white">
              <div className="text-[11px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>
                Historico rapido do documento
              </div>
              <div className="space-y-1.5">
                {sameContextDocs.slice(0, 3).map((doc) => {
                  const latestRevision = doc.revisions[0];
                  return (
                    <div key={`hist-${doc.id}-${doc.version}`} className="text-[11px] text-certifica-500 border border-certifica-200 rounded-[3px] px-2 py-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-certifica-dark" style={{ fontWeight: 600 }}>{doc.version}</span>
                        <span>{doc.modified}</span>
                      </div>
                      <div className="mt-0.5">
                        {latestRevision ? `${latestRevision.author} · ${latestRevision.note}` : "Sem detalhe de revisao"}
                      </div>
                      <div className="mt-1.5 flex justify-end">
                        <DSButton
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => {
                            setCategory(doc.category);
                            setClause(doc.clause);
                            setPermission(doc.permission);
                            setClient(doc.client);
                            setProject(doc.project);
                            const inherited = ["categoria", "clausula", "permissao", "cliente", "projeto"];
                            if (!evidence.trim()) {
                              setEvidence(doc.evidence);
                              inherited.push("evidencia");
                            }
                            setInheritedFields(inherited);
                            setFormError("");
                          }}
                        >
                          Usar como base
                        </DSButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="col-span-2 px-3 py-2 border border-certifica-accent/20 bg-certifica-accent-light rounded-[4px] text-[11px] text-certifica-dark">
            <div className="flex items-center gap-1.5 mb-1"><Bot className="w-3.5 h-3.5 text-certifica-accent" />Sugestão automática de metadata</div>
            Categoria: <strong>{suggestion.category}</strong> · Cláusula: <strong>{suggestion.clause}</strong>
          </div>
          {formError && (
            <div className="col-span-2 text-[11px] text-nao-conformidade bg-nao-conformidade/10 border border-nao-conformidade/20 rounded-[4px] px-3 py-2">
              {formError}
            </div>
          )}
          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <DSButton variant="outline" size="sm" onClick={onClose}>Cancelar</DSButton>
            <DSButton
              size="sm"
              onClick={() => {
                if (!fileSelected) {
                  setFormError("Selecione um arquivo antes de salvar.");
                  return;
                }
                if (!name.trim() || !client.trim() || !project.trim()) {
                  setFormError("Nome, cliente e projeto sao obrigatorios.");
                  return;
                }
                setFormError("");
                onUpload({
                  name: name || "Documento sem nome",
                  type,
                  size,
                  client,
                  project,
                  category,
                  clause,
                  evidence,
                  permission,
                  versionType,
                  baseVersion,
                  minor,
                  justification: justification || "Upload sem justificativa",
                  expiresAt,
                  file: fileObj,
                });
              }}
            >
              Salvar documento
            </DSButton>
          </div>
        </div>
      </div>
    </div>
  );
}
