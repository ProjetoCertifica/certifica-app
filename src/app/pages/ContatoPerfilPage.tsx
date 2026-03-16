import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { supabase } from "../lib/supabase";
import { DSButton } from "../components/ds/DSButton";
import { DSBadge } from "../components/ds/DSBadge";
import { DSInput } from "../components/ds/DSInput";
import {
  ArrowLeft, Phone, Mail, MessageSquare, Building2,
  FileText, Image, Video, Mic, Paperclip, Search,
  UserCircle, Briefcase, Calendar, Loader2, ExternalLink,
  ChevronRight, Download, File,
} from "lucide-react";

/* ── Types ── */
interface ContatoRow {
  id: string;
  empresa_id: string;
  nome: string;
  cargo: string;
  email: string;
  telefone: string;
  whatsapp: string;
  principal: boolean;
  created_at: string;
}

interface EmpresaBasic {
  id: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  segmento: string;
  status: string;
  logo_url: string | null;
}

interface WhatsAppMsg {
  id: string;
  message_id: string | null;
  phone: string;
  from_me: boolean;
  timestamp: number | null;
  body: string;
  message_type: string;
  sender_name: string;
  created_at: string;
}

interface DocumentRow {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  status: string;
  created_at: string;
}

type TabKey = "arquivos" | "mensagens" | "documentos";

const msgTypeIcons: Record<string, React.ElementType> = {
  image: Image,
  document: File,
  video: Video,
  audio: Mic,
  text: MessageSquare,
};

const docStatusMap: Record<string, { label: string; variant: "conformidade" | "nao-conformidade" | "observacao" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  "em-revisao": { label: "Em Revisão", variant: "observacao" },
  aprovado: { label: "Aprovado", variant: "conformidade" },
  obsoleto: { label: "Obsoleto", variant: "nao-conformidade" },
};

/* ── Avatar ── */
function PersonAvatar({ name, phone }: { name: string; phone?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const seed = (phone || name).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hue = Math.abs(seed) % 360;

  return (
    <div
      className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl flex-shrink-0 shadow-lg"
      style={{ fontWeight: 700, background: `linear-gradient(135deg, hsl(${hue}, 60%, 50%), hsl(${(hue + 35) % 360}, 50%, 40%))` }}
    >
      {initials || "?"}
    </div>
  );
}

/* ── Main Page ── */
export default function ContatoPerfilPage() {
  const { id, phone: phoneParam } = useParams<{ id?: string; phone?: string }>();
  const navigate = useNavigate();

  // Chat name passed via URL search params (from ChatPage)
  const chatName = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("name") || null;
  }, []);

  const [contato, setContato] = useState<ContatoRow | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [displayPhone, setDisplayPhone] = useState<string>("");
  const [empresa, setEmpresa] = useState<EmpresaBasic | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("arquivos");
  const [search, setSearch] = useState("");

  const [whatsappFiles, setWhatsappFiles] = useState<WhatsAppMsg[]>([]);
  const [allMessages, setAllMessages] = useState<WhatsAppMsg[]>([]);
  const [empresaDocs, setEmpresaDocs] = useState<DocumentRow[]>([]);

  useEffect(() => {
    setLoading(true);

    (async () => {
      let phoneDigits = "";
      let contatoRow: ContatoRow | null = null;

      if (id) {
        // Route: /contatos/:id — fetch by contato ID
        const { data } = await supabase.from("contatos").select("*").eq("id", id).single();
        contatoRow = data as ContatoRow | null;
        if (contatoRow) {
          phoneDigits = (contatoRow.whatsapp || contatoRow.telefone || "").replace(/\D/g, "");
          setDisplayName(contatoRow.nome);
          setDisplayPhone(phoneDigits);
        }
      } else if (phoneParam) {
        // Route: /perfil/:phone — lookup by phone number
        phoneDigits = phoneParam.replace(/\D/g, "");
        setDisplayPhone(phoneDigits);
        setDisplayName(chatName || phoneDigits);

        // Try to find a matching contato
        const variants = [phoneDigits];
        if (phoneDigits.startsWith("55") && phoneDigits.length >= 12) variants.push(phoneDigits.slice(2));
        if (!phoneDigits.startsWith("55") && phoneDigits.length >= 10) variants.push("55" + phoneDigits);

        const { data } = await supabase.from("contatos").select("*").in("whatsapp", variants).limit(1);
        contatoRow = (data?.[0] as ContatoRow) ?? null;

        // If no contato found, try to get name from whatsapp_messages
        if (!contatoRow && !chatName) {
          const { data: msgs } = await supabase
            .from("whatsapp_messages")
            .select("sender_name, chat_name")
            .in("phone", variants)
            .eq("from_me", false)
            .limit(1);
          const senderName = msgs?.[0]?.sender_name || msgs?.[0]?.chat_name;
          if (senderName) setDisplayName(senderName);
        }
      }

      setContato(contatoRow);

      // Fetch empresa if contato is linked
      if (contatoRow?.empresa_id) {
        const { data: empData } = await supabase
          .from("clientes")
          .select("id, nome_fantasia, razao_social, cnpj, segmento, status, logo_url")
          .eq("id", contatoRow.empresa_id)
          .single();
        setEmpresa(empData as EmpresaBasic | null);

        const { data: docs } = await supabase
          .from("documents")
          .select("id, codigo, titulo, tipo, status, created_at")
          .eq("cliente_id", contatoRow.empresa_id)
          .order("created_at", { ascending: false });
        setEmpresaDocs((docs as DocumentRow[]) || []);
      }

      // Fetch WhatsApp messages
      if (phoneDigits) {
        const variants = [phoneDigits];
        if (phoneDigits.startsWith("55") && phoneDigits.length >= 12) variants.push(phoneDigits.slice(2));
        if (!phoneDigits.startsWith("55") && phoneDigits.length >= 10) variants.push("55" + phoneDigits);

        const { data: msgs } = await supabase
          .from("whatsapp_messages")
          .select("id, message_id, phone, from_me, timestamp, body, message_type, sender_name, created_at")
          .in("phone", variants)
          .order("timestamp", { ascending: false })
          .limit(200);

        const allMsgs = (msgs as WhatsAppMsg[]) || [];
        setAllMessages(allMsgs);
        setWhatsappFiles(allMsgs.filter((m) => ["image", "document", "video", "audio"].includes(m.message_type)));
      }

      setLoading(false);
    })();
  }, [id, phoneParam]);

  // Filtered content based on search
  const filteredFiles = useMemo(() => {
    if (!search) return whatsappFiles;
    const q = search.toLowerCase();
    return whatsappFiles.filter((m) => m.body.toLowerCase().includes(q) || m.message_type.includes(q));
  }, [whatsappFiles, search]);

  const filteredMessages = useMemo(() => {
    if (!search) return allMessages.slice(0, 50);
    const q = search.toLowerCase();
    return allMessages.filter((m) => m.body.toLowerCase().includes(q)).slice(0, 50);
  }, [allMessages, search]);

  const filteredDocs = useMemo(() => {
    if (!search) return empresaDocs;
    const q = search.toLowerCase();
    return empresaDocs.filter((d) => d.codigo.toLowerCase().includes(q) || d.titulo.toLowerCase().includes(q));
  }, [empresaDocs, search]);

  const tabs: { key: TabKey; label: string; icon: React.ElementType; count: number }[] = [
    { key: "arquivos", label: "Arquivos Enviados", icon: Paperclip, count: whatsappFiles.length },
    { key: "mensagens", label: "Mensagens", icon: MessageSquare, count: Math.min(allMessages.length, 50) },
    { key: "documentos", label: "Docs da Empresa", icon: FileText, count: empresaDocs.length },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-certifica-accent" />
      </div>
    );
  }

  if (!displayName && !contato) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-certifica-500 text-sm">Contato não encontrado</p>
        <DSButton variant="outline" size="sm" onClick={() => navigate(-1 as any)}>Voltar</DSButton>
      </div>
    );
  }

  const profileName = displayName || displayPhone;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1000px] mx-auto px-5 py-6">

        {/* ── Back ── */}
        <button
          onClick={() => navigate(-1 as any)}
          className="flex items-center gap-1.5 text-[12px] text-certifica-500 hover:text-certifica-dark transition-colors mb-5 cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
          Voltar
        </button>

        {/* ── Profile Header ── */}
        <div className="bg-white border border-certifica-200 rounded-lg p-6 mb-5">
          <div className="flex flex-col sm:flex-row gap-5">
            <PersonAvatar name={profileName} phone={displayPhone || contato?.whatsapp || contato?.telefone} />

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-[22px] text-certifica-dark leading-tight" style={{ fontWeight: 600 }}>
                  {profileName}
                </h1>
                {contato?.principal && (
                  <span className="text-[9px] bg-certifica-accent/10 text-certifica-accent px-2 py-0.5 rounded" style={{ fontWeight: 600 }}>
                    PRINCIPAL
                  </span>
                )}
              </div>

              {contato?.cargo && (
                <p className="text-[13px] text-certifica-500 flex items-center gap-1.5 mb-2">
                  <Briefcase className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {contato.cargo}
                </p>
              )}

              {/* Contact info */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-certifica-500 mb-3">
                {contato?.email && (
                  <a href={`mailto:${contato.email}`} className="flex items-center gap-1 hover:text-certifica-accent transition-colors">
                    <Mail className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {contato.email}
                  </a>
                )}
                {(contato?.telefone || displayPhone) && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" strokeWidth={1.5} />
                    {contato?.telefone || displayPhone}
                  </span>
                )}
                {displayPhone && (
                  <button
                    onClick={() => navigate("/chat")}
                    className="flex items-center gap-1 text-certifica-accent hover:underline cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
                    WhatsApp
                  </button>
                )}
                {contato?.created_at && (
                  <span className="flex items-center gap-1 text-certifica-400">
                    <Calendar className="w-3.5 h-3.5" strokeWidth={1.5} />
                    Desde {new Date(contato.created_at).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}
                  </span>
                )}
              </div>

              {/* Empresa link */}
              {empresa && (
                <button
                  onClick={() => navigate(`/clientes/${empresa.id}`)}
                  className="flex items-center gap-2.5 px-3 py-2 bg-certifica-50 border border-certifica-200 rounded-md hover:bg-certifica-100 transition-colors cursor-pointer group"
                >
                  {empresa.logo_url ? (
                    <img src={empresa.logo_url} alt="" className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded bg-certifica-200 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-certifica-500" strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-left">
                    <span className="text-[12px] text-certifica-dark block truncate" style={{ fontWeight: 500 }}>
                      {empresa.nome_fantasia}
                    </span>
                    <span className="text-[10px] text-certifica-400">{empresa.segmento}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-certifica-300 group-hover:text-certifica-500 transition-colors" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex sm:flex-col gap-2 flex-shrink-0">
              {(contato?.telefone || displayPhone) && (
                <a href={`tel:${contato?.telefone || displayPhone}`}>
                  <DSButton variant="outline" size="sm" icon={<Phone className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                    Ligar
                  </DSButton>
                </a>
              )}
              {contato?.email && (
                <a href={`mailto:${contato.email}`}>
                  <DSButton variant="outline" size="sm" icon={<Mail className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                    Email
                  </DSButton>
                </a>
              )}
              {displayPhone && (
                <DSButton variant="outline" size="sm" icon={<MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={() => navigate("/chat")}>
                  Chat
                </DSButton>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: "Arquivos Enviados", value: whatsappFiles.filter((m) => !m.from_me).length, sub: "recebidos via WhatsApp" },
            { label: "Mensagens Trocadas", value: allMessages.length, sub: "total no histórico" },
            { label: "Docs da Empresa", value: empresaDocs.length, sub: empresa?.nome_fantasia ?? "—" },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-certifica-200 rounded-lg px-4 py-3">
              <p className="text-[22px] text-certifica-dark" style={{ fontWeight: 600 }}>{s.value}</p>
              <p className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>{s.label}</p>
              <p className="text-[10px] text-certifica-400">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="bg-white border border-certifica-200 rounded-lg overflow-hidden">
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

          <div className="p-5">
            {/* Search */}
            <div className="mb-4 max-w-xs">
              <DSInput
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-3.5 h-3.5" />}
              />
            </div>

            {/* ── Arquivos Enviados Tab ── */}
            {activeTab === "arquivos" && (
              <div>
                {filteredFiles.length === 0 ? (
                  <div className="text-center py-10">
                    <Paperclip className="w-10 h-10 text-certifica-200 mx-auto mb-2" strokeWidth={1} />
                    <p className="text-[12px] text-certifica-400">Nenhum arquivo enviado por este contato</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredFiles.map((msg) => {
                      const Icon = msgTypeIcons[msg.message_type] || Paperclip;
                      const iconColor = msg.message_type === "image" ? "text-oportunidade" : msg.message_type === "document" ? "text-certifica-accent" : "text-conformidade";
                      const bgColor = msg.message_type === "image" ? "bg-oportunidade/10" : msg.message_type === "document" ? "bg-certifica-accent/8" : "bg-conformidade/10";
                      return (
                        <div key={msg.id} className="flex items-center gap-4 p-3.5 rounded-md border border-certifica-100 hover:border-certifica-200 hover:bg-certifica-50/30 transition-colors">
                          <div className={`w-9 h-9 rounded-md ${bgColor} flex items-center justify-center flex-shrink-0`}>
                            <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={1.5} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[12px] text-certifica-dark truncate" style={{ fontWeight: 500 }}>
                                {msg.body || `[${msg.message_type}]`}
                              </span>
                              <DSBadge variant={msg.from_me ? "outline" : "conformidade"} className="flex-shrink-0">
                                {msg.from_me ? "Enviado" : "Recebido"}
                              </DSBadge>
                            </div>
                            <span className="text-[10px] text-certifica-400">
                              {msg.message_type} · {msg.timestamp ? new Date(msg.timestamp).toLocaleDateString("pt-BR") : new Date(msg.created_at).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Mensagens Tab ── */}
            {activeTab === "mensagens" && (
              <div>
                {filteredMessages.length === 0 ? (
                  <div className="text-center py-10">
                    <MessageSquare className="w-10 h-10 text-certifica-200 mx-auto mb-2" strokeWidth={1} />
                    <p className="text-[12px] text-certifica-400">Nenhuma mensagem encontrada</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-3 p-3 rounded-md ${msg.from_me ? "bg-certifica-accent/5" : "bg-certifica-50"}`}
                      >
                        <div className={`w-1 rounded-full flex-shrink-0 ${msg.from_me ? "bg-certifica-accent" : "bg-conformidade"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[11px] text-certifica-dark" style={{ fontWeight: 600 }}>
                              {msg.from_me ? "Você" : profileName}
                            </span>
                            <span className="text-[9px] text-certifica-400">
                              {msg.timestamp ? new Date(msg.timestamp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                          <p className="text-[12px] text-certifica-600 break-words">
                            {msg.body || `[${msg.message_type}]`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Documentos da Empresa Tab ── */}
            {activeTab === "documentos" && (
              <div>
                {filteredDocs.length === 0 ? (
                  <div className="text-center py-10">
                    <FileText className="w-10 h-10 text-certifica-200 mx-auto mb-2" strokeWidth={1} />
                    <p className="text-[12px] text-certifica-400">
                      {empresa ? `Nenhum documento em ${empresa.nome_fantasia}` : "Contato sem empresa vinculada"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredDocs.map((doc) => {
                      const ds = docStatusMap[doc.status] ?? { label: doc.status, variant: "outline" as const };
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
                            <span className="text-[10px] text-certifica-400">
                              {doc.tipo} · {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <button
                            onClick={() => navigate("/documentos")}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-certifica-accent hover:text-certifica-accent-dark cursor-pointer"
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
          </div>
        </div>

      </div>
    </div>
  );
}
