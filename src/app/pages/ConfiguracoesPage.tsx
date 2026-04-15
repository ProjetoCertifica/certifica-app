import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DSBadge } from "../components/ds/DSBadge";
import { DSButton } from "../components/ds/DSButton";
import { DSCard } from "../components/ds/DSCard";
import { DSInput } from "../components/ds/DSInput";
import { DSSelect } from "../components/ds/DSSelect";
import { DSTextarea } from "../components/ds/DSTextarea";
import { Bell, Camera, Database, Loader2, Lock, MessageCircle, RefreshCw, Save, Shield, Wifi, WifiOff, CalendarDays, CheckCircle2, XCircle, ExternalLink, UserCheck, UserX, QrCode, Plug, Trash2 } from "lucide-react";
import { useSettings } from "../lib/useSettings";
import { useWhatsApp } from "../lib/useWhatsApp";
import { useGoogleCalendar } from "../lib/useGoogleCalendar";
import { supabase } from "../lib/supabase";
import {
  getEvolutionConfig,
  clearConfigCache,
  createInstance,
  getQrCode,
  getConnectionState,
  logoutInstance,
  deleteInstance,
  type EvolutionQrCode,
  type EvolutionConnectionState,
  EvolutionNotConfiguredError,
} from "../lib/evolution";

/* ── User Avatar with Upload ── */
function UserAvatar({ id, name, avatarUrl, onAvatarChange }: { id: string; name: string; avatarUrl?: string | null; onAvatarChange: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState(avatarUrl);
  useEffect(() => { setLocalUrl(avatarUrl); }, [avatarUrl]);

  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw new Error(`Upload falhou: ${uploadErr.message}`);
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { data: updated, error: updateErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", id)
        .select();
      if (updateErr) throw new Error(`Erro ao salvar no perfil: ${updateErr.message}`);
      if (!updated || updated.length === 0) throw new Error("Perfil não atualizado — verifique se você está logado.");
      setLocalUrl(publicUrl);
      onAvatarChange(publicUrl);
      toast.success("Foto atualizada!");
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      toast.error(err?.message ?? "Erro ao fazer upload da foto.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="relative group flex-shrink-0 w-9 h-9">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      {localUrl ? (
        <img src={localUrl} alt={name} className="w-9 h-9 rounded-full object-cover" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-certifica-accent-light flex items-center justify-center text-[10px] text-certifica-accent-dark" style={{ fontWeight: 600 }}>
          {initials || "?"}
        </div>
      )}
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
      >
        {uploading ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Camera className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />}
      </button>
    </div>
  );
}

type SettingsTab =
  | "usuarios"
  | "permissoes"
  | "empresa"
  | "integracoes"
  | "logs";

type LocalRole = "admin" | "gestor" | "consultor" | "auditor" | "cliente";
type PermissionLevel = "nenhum" | "leitura" | "edicao" | "admin";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "ativo" | "inativo";
}

interface AuditLogItem {
  id: string;
  date: string;
  actor: string;
  action: string;
  module: string;
}

const tabs: { id: SettingsTab; label: string }[] = [
  { id: "usuarios", label: "Usuários e perfis" },
  { id: "permissoes", label: "Permissões granulares" },
  { id: "empresa", label: "Parâmetros da empresa" },
  { id: "integracoes", label: "Integrações" },
  { id: "logs", label: "Logs e auditoria" },
];

/* ── WhatsApp via Evolution API ── */

type EvolutionStep = "config" | "creating" | "qrcode" | "connected";

function WhatsAppEvolutionCard() {
  const [step, setStep] = useState<EvolutionStep>("config");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("certifica");
  const [qrData, setQrData] = useState<EvolutionQrCode | null>(null);
  const [connState, setConnState] = useState<string>("close");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved config on mount
  useEffect(() => {
    (async () => {
      clearConfigCache();
      const cfg = await getEvolutionConfig();
      if (cfg.url) setApiUrl(cfg.url);
      if (cfg.apiKey) setApiKey(cfg.apiKey);
      if (cfg.instance) setInstanceName(cfg.instance);
      // If already configured, check connection
      if (cfg.url && cfg.apiKey) {
        try {
          const state = await getConnectionState(cfg.instance);
          setConnState(state.instance?.state ?? "close");
          if (state.instance?.state === "open") setStep("connected");
          else setStep("config");
        } catch {
          setStep("config");
        }
      }
    })();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Save config to Supabase
  const saveConfig = async () => {
    if (!apiUrl || !apiKey) {
      toast.error("Preencha a URL e API Key da Evolution API.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      for (const [key, value] of [
        ["EVOLUTION_API_URL", apiUrl.replace(/\/$/, "")],
        ["EVOLUTION_API_KEY", apiKey],
        ["EVOLUTION_INSTANCE", instanceName || "certifica"],
      ]) {
        await supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" });
      }
      clearConfigCache();
      toast.success("Configuração salva!");
    } catch (err: any) {
      setError(err.message);
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create instance + get QR code
  const handleConnect = async () => {
    setStep("creating");
    setLoading(true);
    setError(null);
    try {
      await saveConfig();
      // Try to create instance (might already exist)
      try {
        await createInstance(instanceName);
      } catch (err: any) {
        // Instance may already exist — ignore 400/409
        if (!err.message?.includes("400") && !err.message?.includes("409") && !err.message?.includes("already")) {
          throw err;
        }
      }
      // Fetch QR code
      const qr = await getQrCode(instanceName);
      setQrData(qr);
      setStep("qrcode");
      // Start polling connection state
      startPolling();
    } catch (err: any) {
      setError(err.message);
      setStep("config");
      toast.error("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const state = await getConnectionState(instanceName);
        const s = state.instance?.state ?? "close";
        setConnState(s);
        if (s === "open") {
          if (pollRef.current) clearInterval(pollRef.current);
          setStep("connected");
          toast.success("WhatsApp conectado!");
        }
      } catch { /* ignore polling errors */ }
    }, 3000);
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await logoutInstance(instanceName);
      setStep("config");
      setConnState("close");
      setQrData(null);
      toast.info("WhatsApp desconectado.");
    } catch (err: any) {
      toast.error("Erro ao desconectar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshQr = async () => {
    setLoading(true);
    try {
      const qr = await getQrCode(instanceName);
      setQrData(qr);
      startPolling();
    } catch (err: any) {
      setError(err.message);
      toast.error("Erro ao gerar QR: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DSCard header={
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-green-600" />
        <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>WhatsApp via Evolution API</span>
        {step === "connected" ? (
          <DSBadge variant="conformidade" className="ml-auto">Conectado</DSBadge>
        ) : step === "qrcode" ? (
          <DSBadge variant="observacao" className="ml-auto">Aguardando QR Code</DSBadge>
        ) : (
          <DSBadge variant="outline" className="ml-auto">Não conectado</DSBadge>
        )}
      </div>
    }>
      <div className="space-y-3">
        {/* ── CONNECTED STATE ── */}
        {step === "connected" && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-[4px] px-3 py-2 flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-green-600" />
              <div className="text-[11px] text-green-800">
                <span style={{ fontWeight: 600 }}>WhatsApp conectado</span> · Instância: {instanceName}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DSButton variant="outline" size="sm" icon={<RefreshCw className="w-3.5 h-3.5" />} onClick={async () => {
                const state = await getConnectionState(instanceName);
                setConnState(state.instance?.state ?? "close");
                if (state.instance?.state === "open") toast.success("Ainda conectado!");
                else { setStep("config"); toast.info("Conexão perdida."); }
              }}>
                Verificar status
              </DSButton>
              <DSButton variant="ghost" size="sm" icon={<WifiOff className="w-3.5 h-3.5" />} onClick={handleDisconnect} disabled={loading}>
                Desconectar
              </DSButton>
              <span className="text-[10.5px] text-certifica-500">
                Pronto para enviar mensagens, imagens e documentos
              </span>
            </div>
          </>
        )}

        {/* ── QR CODE STATE ── */}
        {step === "qrcode" && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-[4px] px-3 py-2 flex items-start gap-2">
              <QrCode className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-800">
                <span style={{ fontWeight: 600 }}>Escaneie o QR Code com seu WhatsApp</span>
                <div className="text-[10px] mt-0.5">Abra o WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar aparelho</div>
              </div>
            </div>
            {qrData?.base64 && (
              <div className="flex justify-center py-4">
                <div className="bg-white border-2 border-certifica-200 rounded-lg p-3 shadow-sm">
                  <img src={qrData.base64} alt="QR Code WhatsApp" className="w-[240px] h-[240px]" />
                </div>
              </div>
            )}
            <div className="flex items-center justify-center gap-2">
              <DSButton variant="outline" size="sm" icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />} onClick={handleRefreshQr} disabled={loading}>
                {loading ? "Gerando..." : "Novo QR Code"}
              </DSButton>
              <DSButton variant="ghost" size="sm" onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setStep("config"); }}>
                Cancelar
              </DSButton>
            </div>
            <div className="text-center text-[10px] text-certifica-400">
              Verificando conexão automaticamente a cada 3s...
            </div>
          </>
        )}

        {/* ── CONFIG / SETUP STATE ── */}
        {(step === "config" || step === "creating") && (
          <>
            <div className="bg-certifica-50 border border-certifica-200 rounded-[4px] px-3 py-2 text-[11px] text-certifica-600 space-y-1">
              <p style={{ fontWeight: 600 }}>Como configurar:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-[10.5px]">
                <li>Faça deploy da Evolution API no <a href="https://railway.com/new/template/evolution-api-whatsapp-automation" target="_blank" rel="noopener noreferrer" className="text-certifica-accent underline">Railway (1 clique)</a></li>
                <li>Copie a <span style={{ fontWeight: 600 }}>URL pública</span> do serviço e a <span style={{ fontWeight: 600 }}>API Key</span> configurada</li>
                <li>Cole nos campos abaixo e clique em <span style={{ fontWeight: 600 }}>Conectar WhatsApp</span></li>
                <li>Escaneie o QR Code com seu celular</li>
              </ol>
            </div>

            <div className="space-y-2">
              <DSInput
                label="URL da Evolution API (Railway)"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://evolution-api-production-xxxx.up.railway.app"
              />
              <div className="grid grid-cols-2 gap-2">
                <DSInput
                  label="API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sua-api-key"
                />
                <DSInput
                  label="Nome da instância"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  placeholder="certifica"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-[4px] px-3 py-2 flex items-center gap-2">
                <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                <span className="text-[11px] text-red-700">{error}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <DSButton
                variant="primary"
                size="sm"
                icon={step === "creating" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                onClick={handleConnect}
                disabled={loading || !apiUrl || !apiKey}
              >
                {step === "creating" ? "Conectando..." : "Conectar WhatsApp"}
              </DSButton>
              <DSButton variant="outline" size="sm" icon={<Save className="w-3.5 h-3.5" />} onClick={saveConfig} disabled={loading}>
                Salvar config
              </DSButton>
            </div>
          </>
        )}
      </div>
    </DSCard>
  );
}

const localRoleOptions: LocalRole[] = ["admin", "gestor", "consultor", "auditor", "cliente"];
const modules = [
  "Dashboard", "Reuniões", "Calendário", "Chat", "Chatbot",
  "Empresas", "Consultores", "Projetos", "Documentos", "Auditorias",
  "Normas", "Treinamentos", "Financeiro", "Propostas", "Relatórios", "Configurações",
];


export default function ConfiguracoesPage() {
  const { settings, profiles, roles, loading, error, getSetting, saveAllSettings, load, updateProfile, deactivateProfile } = useSettings();
  const whatsApp = useWhatsApp();
  const googleCalendar = useGoogleCalendar();

  const [tab, setTab] = useState<SettingsTab>("usuarios");
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [logSearch, setLogSearch] = useState("");
  const [logsLoading, setLogsLoading] = useState(false);

  const [security, setSecurity] = useState({
    minLength: "10",
    force2fa: true,
    rotationDays: "90",
    sessionTimeout: "30",
  });
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    whatsappAlerts: false,
    digestDaily: true,
    dueReminderDays: "3",
  });
  const [lgpd, setLgpd] = useState({
    retentionMonths: "24",
    anonymizeAfter: "12",
    consentVersion: "v2.1",
    consentText: "Consentimento para tratamento de dados conforme finalidade contratual e obrigacoes legais.",
  });
  const [company, setCompany] = useState({
    legalName: "Certifica Consultoria Ltda",
    cnpj: "12.345.678/0001-90",
    timezone: "America/Sao_Paulo",
    language: "pt-BR",
    defaultNorm: "ISO 9001:2015",
  });

  // Build matrix from roles fetched from DB. Falls back to default permission levels.
  const [matrix, setMatrix] = useState<Record<string, Record<string, PermissionLevel>>>({});

  const [saveStamp, setSaveStamp] = useState("");

  // Map DB profiles to local UserItem format
  const users: UserItem[] = profiles.map((p) => ({
    id: p.id,
    name: p.full_name,
    email: p.email,
    role: p.role?.name ?? "consultor",
    status: p.active ? "ativo" : "inativo",
  }));

  // Build permission matrix from DB roles whenever they change
  useEffect(() => {
    if (roles.length === 0) return;
    const built: Record<string, Record<string, PermissionLevel>> = {};
    for (const role of roles) {
      const perms = (role.permissions as Record<string, PermissionLevel> | null) ?? {};
      built[role.name] = {};
      for (const m of modules) {
        built[role.name][m] = perms[m] ?? "leitura";
      }
    }
    setMatrix(built);
  }, [roles]);

  // Load settings values into local form state after settings are fetched
  useEffect(() => {
    if (settings.length === 0) return;

    const empresa_nome = getSetting("empresa_nome");
    const empresa_cnpj = getSetting("empresa_cnpj");
    const empresa_timezone = getSetting("empresa_timezone");
    const empresa_idioma = getSetting("empresa_idioma");
    const empresa_norma = getSetting("empresa_norma");

    setCompany((prev) => ({
      legalName: (empresa_nome as string) ?? prev.legalName,
      cnpj: (empresa_cnpj as string) ?? prev.cnpj,
      timezone: (empresa_timezone as string) ?? prev.timezone,
      language: (empresa_idioma as string) ?? prev.language,
      defaultNorm: (empresa_norma as string) ?? prev.defaultNorm,
    }));

    const seg_min_length = getSetting("seg_min_senha");
    const seg_force2fa = getSetting("seg_force2fa");
    const seg_rotation = getSetting("seg_rotacao_dias");
    const seg_timeout = getSetting("seg_session_timeout");

    setSecurity((prev) => ({
      minLength: (seg_min_length as string) ?? prev.minLength,
      force2fa: seg_force2fa != null ? Boolean(seg_force2fa) : prev.force2fa,
      rotationDays: (seg_rotation as string) ?? prev.rotationDays,
      sessionTimeout: (seg_timeout as string) ?? prev.sessionTimeout,
    }));

    const notif_email = getSetting("notif_email_alerts");
    const notif_whatsapp = getSetting("notif_whatsapp_alerts");
    const notif_digest = getSetting("notif_digest_daily");
    const notif_reminder = getSetting("notif_due_reminder_days");

    setNotifications((prev) => ({
      emailAlerts: notif_email != null ? Boolean(notif_email) : prev.emailAlerts,
      whatsappAlerts: notif_whatsapp != null ? Boolean(notif_whatsapp) : prev.whatsappAlerts,
      digestDaily: notif_digest != null ? Boolean(notif_digest) : prev.digestDaily,
      dueReminderDays: (notif_reminder as string) ?? prev.dueReminderDays,
    }));

    const lgpd_retention = getSetting("lgpd_retencao_meses");
    const lgpd_anon = getSetting("lgpd_anonimizar_apos");
    const lgpd_version = getSetting("lgpd_consent_versao");
    const lgpd_text = getSetting("lgpd_consent_texto");

    setLgpd((prev) => ({
      retentionMonths: (lgpd_retention as string) ?? prev.retentionMonths,
      anonymizeAfter: (lgpd_anon as string) ?? prev.anonymizeAfter,
      consentVersion: (lgpd_version as string) ?? prev.consentVersion,
      consentText: (lgpd_text as string) ?? prev.consentText,
    }));
  }, [settings, getSetting]);

  // Friendly names for raw table names
  const tableNameMap: Record<string, string> = {
    clientes: "Empresas",
    projetos: "Projetos",
    pipeline_columns: "Colunas do Pipeline",
    pipeline_cards: "Cards do Pipeline",
    audits: "Auditorias",
    documentos: "Documentos",
    contatos: "Contatos",
    entregaveis: "Entregáveis",
    pipelines: "Pipelines",
    documents: "Documentos",
    meetings: "Reuniões",
    trainings: "Treinamentos",
    audit_findings: "Constatações",
    audit_logs: "Logs",
    settings: "Configurações",
    profiles: "Perfis",
    roles: "Papéis",
  };

  const humanizeTable = (table: string): string => tableNameMap[table] ?? table;
  const humanizeId = (id: string): string => {
    if (!id) return "—";
    // UUID pattern: 8-4-4-4-12 hex chars
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return `${id.slice(0, 8)}...`;
    }
    return id;
  };

  // Fetch audit_logs from Supabase
  useEffect(() => {
    const fetchLogs = async () => {
      setLogsLoading(true);
      try {
        const { data, error: err } = await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (err) throw err;

        const mapped: AuditLogItem[] = (data ?? []).map((l: any) => ({
          id: l.id,
          date: new Date(l.created_at).toLocaleString("pt-BR"),
          actor: l.usuario_id ? humanizeId(l.usuario_id) : "Sistema",
          action: `${l.acao} em ${humanizeTable(l.tabela)} (id: ${humanizeId(l.registro_id)})`,
          module: humanizeTable(l.tabela),
        }));

        setLogs(mapped);
      } catch {
        // If audit_logs table is unavailable, leave empty
      } finally {
        setLogsLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    if (!logSearch.trim()) return logs;
    const term = logSearch.toLowerCase();
    return logs.filter((l) => `${l.actor} ${l.action} ${l.module}`.toLowerCase().includes(term));
  }, [logs, logSearch]);

  const saveAll = async () => {
    const settingMap: Record<string, unknown> = {
      empresa_nome: company.legalName,
      empresa_cnpj: company.cnpj,
      empresa_timezone: company.timezone,
      empresa_idioma: company.language,
      empresa_norma: company.defaultNorm,
      seg_min_senha: security.minLength,
      seg_force2fa: security.force2fa,
      seg_rotacao_dias: security.rotationDays,
      seg_session_timeout: security.sessionTimeout,
      notif_email_alerts: notifications.emailAlerts,
      notif_whatsapp_alerts: notifications.whatsappAlerts,
      notif_digest_daily: notifications.digestDaily,
      notif_due_reminder_days: notifications.dueReminderDays,
      lgpd_retencao_meses: lgpd.retentionMonths,
      lgpd_anonimizar_apos: lgpd.anonymizeAfter,
      lgpd_consent_versao: lgpd.consentVersion,
      lgpd_consent_texto: lgpd.consentText,
    };

    const ok = await saveAllSettings(settingMap);
    if (ok) {
      const now = new Date().toLocaleString("pt-BR");
      setSaveStamp(now);
      toast.success("Configurações salvas com sucesso.");
    } else {
      toast.error("Erro ao salvar configurações. Tente novamente.");
    }
  };

  const loadAll = async () => {
    await load();
    toast.info("Configurações recarregadas do banco de dados.");
  };

  // Roles list for the permission matrix columns: from DB or fallback to localRoleOptions names
  const roleNames: string[] = roles.length > 0 ? roles.map((r) => r.name) : localRoleOptions;

  const renderUsuarios = () => (
    <div className="space-y-4">
      {loading && (
        <div className="text-[12px] text-certifica-500 px-1">Carregando usuarios...</div>
      )}
      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Usuários e perfis</span>}>
        <div className="space-y-2">
          {users.map((u) => {
            // Find the matching DB profile to get the role_id for updates
            const dbProfile = profiles.find((p) => p.id === u.id);
            return (
            <div key={u.id} className="border border-certifica-200 rounded-[4px] px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <UserAvatar
                  id={u.id}
                  name={u.name}
                  avatarUrl={dbProfile?.avatar_url}
                  onAvatarChange={(url) => {
                    // Refresh profiles to reflect new avatar
                    load();
                  }}
                />
                <div>
                  <div className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>{u.name}</div>
                  <div className="text-[10.5px] text-certifica-500">{u.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DSBadge variant={u.status === "ativo" ? "conformidade" : "outline"}>{u.status}</DSBadge>
                <DSSelect
                  label=""
                  value={u.role}
                  onChange={async (e) => {
                    const newRoleName = e.target.value;
                    const matchedRole = roles.find((r) => r.name === newRoleName);
                    if (!matchedRole) return;
                    const ok = await updateProfile(u.id, { role_id: matchedRole.id });
                    if (ok) toast.success(`Papel de ${u.name} alterado para ${newRoleName}.`);
                    else toast.error(`Erro ao alterar papel de ${u.name}.`);
                  }}
                  options={roleNames.map((r) => ({ value: r, label: r }))}
                  className="h-7 text-[11px]"
                />
                <button
                  title={u.status === "ativo" ? "Desativar usuário" : "Reativar usuário"}
                  className={`p-1.5 rounded-[4px] transition-colors ${
                    u.status === "ativo"
                      ? "text-certifica-500 hover:text-nao-conformidade hover:bg-red-50"
                      : "text-certifica-500 hover:text-conformidade hover:bg-green-50"
                  }`}
                  onClick={async () => {
                    const newActive = u.status !== "ativo";
                    const ok = await updateProfile(u.id, { active: newActive });
                    if (ok) toast.success(`${u.name} ${newActive ? "reativado" : "desativado"} com sucesso.`);
                    else toast.error(`Erro ao ${newActive ? "reativar" : "desativar"} ${u.name}.`);
                  }}
                >
                  {u.status === "ativo"
                    ? <UserX className="w-3.5 h-3.5" strokeWidth={1.5} />
                    : <UserCheck className="w-3.5 h-3.5" strokeWidth={1.5} />
                  }
                </button>
              </div>
            </div>
            );
          })}
          {users.length === 0 && !loading && (
            <div className="text-[12px] text-certifica-500 py-2">Nenhum usuário encontrado.</div>
          )}
        </div>
      </DSCard>

      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Notificações e preferências</span>}>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.emailAlerts} onChange={(e) => setNotifications((p) => ({ ...p, emailAlerts: e.target.checked }))} /> Alertas por e-mail</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.whatsappAlerts} onChange={(e) => setNotifications((p) => ({ ...p, whatsappAlerts: e.target.checked }))} /> Alertas por WhatsApp</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={notifications.digestDaily} onChange={(e) => setNotifications((p) => ({ ...p, digestDaily: e.target.checked }))} /> Digest diario</label>
          <DSInput label="Lembrete antes do prazo (dias)" value={notifications.dueReminderDays} onChange={(e) => setNotifications((p) => ({ ...p, dueReminderDays: e.target.value }))} />
        </div>
      </DSCard>
    </div>
  );

  const renderPermissoes = () => (
    <div className="space-y-4">
      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Matriz de permissão por papel</span>}>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-certifica-200">
                <th className="text-left text-[11px] text-certifica-500 py-2">Modulo</th>
                {roleNames.map((r) => (
                  <th key={r} className="text-left text-[11px] text-certifica-500 py-2 capitalize">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m} className="border-b border-certifica-200/70">
                  <td className="py-2 text-[12px] text-certifica-900">{m}</td>
                  {roleNames.map((r) => (
                    <td key={`${m}-${r}`} className="py-2 pr-2">
                      <select
                        value={matrix[r]?.[m] ?? "leitura"}
                        onChange={(e) => {
                          const level = e.target.value as PermissionLevel;
                          setMatrix((prev) => ({
                            ...prev,
                            [r]: { ...(prev[r] ?? {}), [m]: level },
                          }));
                        }}
                        className="h-7 w-full px-2 border border-certifica-200 rounded-[4px] text-[11px]"
                      >
                        <option value="nenhum">Nenhum</option>
                        <option value="leitura">Leitura</option>
                        <option value="edicao">Edicao</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DSCard>

      <div className="flex justify-end">
        <DSButton
          size="sm"
          icon={<Save className="w-3 h-3" strokeWidth={1.5} />}
          onClick={async () => {
            try {
              const promises = Object.entries(matrix).map(([roleName, perms]) =>
                supabase.from("roles").update({ permissions: perms }).eq("name", roleName)
              );
              const results = await Promise.all(promises);
              const hasError = results.some((r) => r.error);
              if (hasError) {
                toast.error("Erro ao salvar algumas permissões. Verifique o console.");
              } else {
                toast.success("Permissões salvas com sucesso.");
              }
            } catch {
              toast.error("Erro ao salvar permissões.");
            }
          }}
        >
          Salvar Permissões
        </DSButton>
      </div>

      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Políticas de senha e segurança</span>}>
        <div className="grid grid-cols-2 gap-2">
          <DSInput label="Tamanho minimo da senha" value={security.minLength} onChange={(e) => setSecurity((p) => ({ ...p, minLength: e.target.value }))} />
          <DSInput label="Rotacao de senha (dias)" value={security.rotationDays} onChange={(e) => setSecurity((p) => ({ ...p, rotationDays: e.target.value }))} />
          <DSInput label="Timeout de sessao (min)" value={security.sessionTimeout} onChange={(e) => setSecurity((p) => ({ ...p, sessionTimeout: e.target.value }))} />
          <label className="text-[12px] text-certifica-dark flex items-end pb-2 gap-2">
            <input type="checkbox" checked={security.force2fa} onChange={(e) => setSecurity((p) => ({ ...p, force2fa: e.target.checked }))} />
            Exigir 2FA para perfis criticos
          </label>
        </div>
      </DSCard>
    </div>
  );

  const renderEmpresa = () => (
    <div className="space-y-4">
      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Parâmetros da empresa</span>}>
        <div className="grid grid-cols-2 gap-2">
          <DSInput label="Razao social" value={company.legalName} onChange={(e) => setCompany((p) => ({ ...p, legalName: e.target.value }))} />
          <DSInput label="CNPJ" value={company.cnpj} onChange={(e) => setCompany((p) => ({ ...p, cnpj: e.target.value }))} />
          <DSInput label="Timezone" value={company.timezone} onChange={(e) => setCompany((p) => ({ ...p, timezone: e.target.value }))} />
          <DSInput label="Idioma padrao" value={company.language} onChange={(e) => setCompany((p) => ({ ...p, language: e.target.value }))} />
          <DSInput label="Norma padrao" value={company.defaultNorm} onChange={(e) => setCompany((p) => ({ ...p, defaultNorm: e.target.value }))} className="col-span-2" />
        </div>
      </DSCard>

      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>LGPD</span>}>
        <div className="grid grid-cols-2 gap-2">
          <DSInput label="Retencao de dados (meses)" value={lgpd.retentionMonths} onChange={(e) => setLgpd((p) => ({ ...p, retentionMonths: e.target.value }))} />
          <DSInput label="Anonimizacao apos (meses)" value={lgpd.anonymizeAfter} onChange={(e) => setLgpd((p) => ({ ...p, anonymizeAfter: e.target.value }))} />
          <DSInput label="Versao termo de consentimento" value={lgpd.consentVersion} onChange={(e) => setLgpd((p) => ({ ...p, consentVersion: e.target.value }))} className="col-span-2" />
          <DSTextarea label="Texto de consentimento" value={lgpd.consentText} onChange={(e) => setLgpd((p) => ({ ...p, consentText: e.target.value }))} className="col-span-2" />
        </div>
      </DSCard>
    </div>
  );

  const renderIntegracoes = () => (
    <div className="space-y-4">
      {/* ── Evolution API / WhatsApp — QR Code connection ── */}
      <WhatsAppEvolutionCard />

      {/* ── Google Calendar via Recall.ai ── */}
      <DSCard header={
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-certifica-accent" />
          <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Google Calendar</span>
          {googleCalendar.connected ? (
            <DSBadge variant="conformidade" className="ml-auto">Conectado</DSBadge>
          ) : (
            <DSBadge variant="outline" className="ml-auto">Não conectado</DSBadge>
          )}
        </div>
      }>
        <div className="space-y-3">
          {googleCalendar.connected ? (
            <div className="bg-green-50 border border-green-200 rounded-[4px] px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              <div className="text-[11px] text-green-800">
                <span style={{ fontWeight: 600 }}>Google Calendar conectado</span> · Reuniões visíveis na aba Reuniões
              </div>
            </div>
          ) : (
            <div className="bg-certifica-50 border border-certifica-200 rounded-[4px] px-3 py-2 text-[11px] text-certifica-600 space-y-1">
              <p style={{ fontWeight: 600 }}>Como funciona:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-[10.5px]">
                <li>Clique em <span style={{ fontWeight: 600 }}>Conectar Google Calendar</span></li>
                <li>Uma janela do Google abrirá — autorize o acesso</li>
                <li>Feche a janela após autorizar e clique em <span style={{ fontWeight: 600 }}>Confirmar conexão</span></li>
                <li>Suas reuniões futuras aparecerão na aba <span style={{ fontWeight: 600 }}>Reuniões</span></li>
              </ol>
            </div>
          )}

          {googleCalendar.error && (
            <div className="bg-red-50 border border-red-200 rounded-[4px] px-3 py-2 flex items-center gap-2">
              <XCircle className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
              <span className="text-[11px] text-red-700">{googleCalendar.error}</span>
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {!googleCalendar.connected ? (
              <DSButton
                variant="primary"
                size="sm"
                icon={<CalendarDays className="w-3.5 h-3.5" />}
                loading={googleCalendar.connecting}
                onClick={async () => {
                  await googleCalendar.connect();
                }}
              >
                {googleCalendar.connecting ? "Abrindo Google..." : "Conectar Google Calendar"}
              </DSButton>
            ) : (
              <>
                <DSButton
                  variant="outline"
                  size="sm"
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={async () => {
                    await googleCalendar.fetchMeetings(7);
                    if (!googleCalendar.error) {
                      toast.success(`${googleCalendar.meetings.length} reuniões carregadas.`);
                    }
                  }}
                >
                  Sincronizar reuniões
                </DSButton>
                <DSButton
                  variant="outline"
                  size="sm"
                  icon={<XCircle className="w-3.5 h-3.5" />}
                  onClick={() => {
                    googleCalendar.disconnect();
                    toast.info("Google Calendar desconectado.");
                  }}
                >
                  Desconectar
                </DSButton>
              </>
            )}
            {googleCalendar.connected && (
              <DSButton
                variant="outline"
                size="sm"
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() => window.open("https://calendar.google.com", "_blank")}
              >
                Abrir Google Calendar
              </DSButton>
            )}
          </div>

          <div className="bg-certifica-50 border border-certifica-200 rounded-[4px] px-3 py-2">
            <div className="text-[10px] text-certifica-500" style={{ fontWeight: 600 }}>Configuração do Google Calendar</div>
            <div className="text-[10px] text-certifica-500 mt-1">
              A integração com o Google Calendar deve ser configurada pelo administrador do sistema.
            </div>
          </div>
        </div>
      </DSCard>
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-4">
      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Logs / auditoria do sistema</span>}>
        <DSInput label="Buscar log" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} placeholder="ator, acao, modulo..." />
        {logsLoading && (
          <div className="text-[12px] text-certifica-500 mt-3">Carregando logs...</div>
        )}
        <div className="space-y-1.5 mt-3">
          {filteredLogs.length === 0 && !logsLoading && (
            <div className="text-[12px] text-certifica-500">Nenhum log encontrado.</div>
          )}
          {filteredLogs.map((l) => (
            <div key={l.id} className="border border-certifica-200 rounded-[3px] px-2.5 py-1.5 text-[11px] text-certifica-500">
              {l.date} · <span className="text-certifica-dark">{l.actor}</span> · {l.action} · {l.module}
            </div>
          ))}
        </div>
      </DSCard>
    </div>
  );

  return (
    <div className="p-5 space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-[4px] px-3 py-2 text-[12px] text-red-700">
          Erro ao carregar dados: {error}
        </div>
      )}

      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-certifica-900">Configurações</h2>
          <p className="text-[12px] text-certifica-500 mt-0.5">
            Usuários, permissões, empresa, integrações e auditoria do sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DSButton variant="outline" size="sm" icon={<Database className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={loadAll}>
            Carregar
          </DSButton>
          <DSButton variant="primary" size="sm" icon={<Save className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={saveAll}>
            Salvar configuracoes
          </DSButton>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <DSCard>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-certifica-500">Usuarios ativos</span>
            <Shield className="w-3.5 h-3.5 text-conformidade" strokeWidth={1.5} />
          </div>
          <div className="text-[22px] text-certifica-900 mt-1" style={{ fontWeight: 600 }}>
            {loading ? "..." : users.filter((u) => u.status === "ativo").length}
          </div>
        </DSCard>
        <DSCard>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-certifica-500">Politica 2FA</span>
            <Lock className="w-3.5 h-3.5 text-conformidade" strokeWidth={1.5} />
          </div>
          <div className="text-[22px] text-certifica-900 mt-1" style={{ fontWeight: 600 }}>{security.force2fa ? "ON" : "OFF"}</div>
        </DSCard>
        <DSCard>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-certifica-500">Último save</span>
            <Bell className="w-3.5 h-3.5 text-certifica-500" strokeWidth={1.5} />
          </div>
          <div className="text-[12px] text-certifica-900 mt-2" style={{ fontWeight: 600 }}>{saveStamp || "Não salvo"}</div>
        </DSCard>
      </div>

      <div className="bg-white border border-certifica-200 rounded-[4px] p-2 flex flex-wrap gap-1.5">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`h-8 px-3 rounded-[4px] text-[11px] border ${tab === item.id ? "bg-certifica-accent text-white border-certifica-accent" : "border-certifica-200 text-certifica-500 hover:bg-certifica-50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "usuarios" && renderUsuarios()}
      {tab === "permissoes" && renderPermissoes()}
      {tab === "empresa" && renderEmpresa()}
      {tab === "integracoes" && renderIntegracoes()}
      {tab === "logs" && renderLogs()}
    </div>
  );
}
