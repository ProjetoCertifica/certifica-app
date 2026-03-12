import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DSBadge } from "../components/ds/DSBadge";
import { DSButton } from "../components/ds/DSButton";
import { DSCard } from "../components/ds/DSCard";
import { DSInput } from "../components/ds/DSInput";
import { DSSelect } from "../components/ds/DSSelect";
import { DSTextarea } from "../components/ds/DSTextarea";
import { Bell, CalendarClock, Database, Lock, MessageCircle, Plus, RefreshCw, Save, Shield, Trash2, Wifi, WifiOff, CalendarDays, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { useSettings } from "../lib/useSettings";
import { useWhatsApp } from "../lib/useWhatsApp";
import { useGoogleCalendar } from "../lib/useGoogleCalendar";
import { supabase } from "../lib/supabase";

type SettingsTab =
  | "usuarios"
  | "permissoes"
  | "empresa"
  | "modelos"
  | "workflow"
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

interface TemplateItem {
  id: string;
  name: string;
  category: string;
  active: boolean;
}

interface WorkflowRule {
  id: string;
  name: string;
  stage: string;
  slaHours: number;
  autoAction: boolean;
  active: boolean;
}

interface IntegrationItem {
  id: string;
  name: string;
  connected: boolean;
  account: string;
  lastSync: string;
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
  { id: "modelos", label: "Modelos de documento" },
  { id: "workflow", label: "Regras de workflow" },
  { id: "integracoes", label: "Integrações" },
  { id: "logs", label: "Logs e auditoria" },
];

const localRoleOptions: LocalRole[] = ["admin", "gestor", "consultor", "auditor", "cliente"];
const modules = ["Dashboard", "Empresas", "Projetos", "Auditorias", "RAI", "Documentos", "Relatórios", "Configurações"];

const defaultTemplates: TemplateItem[] = [
  { id: "T-001", name: "RAI padrao Certifica", category: "Auditoria", active: true },
  { id: "T-002", name: "Plano de Acao NC", category: "Nao conformidade", active: true },
  { id: "T-003", name: "Resumo executivo mensal", category: "Relatorios", active: true },
  { id: "T-004", name: "Checklist onboarding cliente", category: "Projetos", active: false },
];

const defaultRules: WorkflowRule[] = [
  { id: "W-001", name: "Aprovacao RAI", stage: "revisao-tecnica", slaHours: 24, autoAction: true, active: true },
  { id: "W-002", name: "Revisao documental", stage: "revisao", slaHours: 48, autoAction: true, active: true },
  { id: "W-003", name: "Escalonamento NC critica", stage: "tratamento", slaHours: 12, autoAction: true, active: true },
];

const defaultIntegrations: IntegrationItem[] = [
  { id: "I-001", name: "Google Drive", connected: true, account: "ops@certifica.com", lastSync: "19/02/2026 09:10" },
  { id: "I-002", name: "Google Meet", connected: true, account: "ops@certifica.com", lastSync: "19/02/2026 08:55" },
  { id: "I-003", name: "WhatsApp / Z-API", connected: false, account: "", lastSync: "Nunca" },
  { id: "I-004", name: "E-mail SMTP", connected: true, account: "no-reply@certifica.com", lastSync: "19/02/2026 09:04" },
  { id: "I-005", name: "Calendario", connected: true, account: "ops@certifica.com", lastSync: "19/02/2026 09:07" },
];

export default function ConfiguracoesPage() {
  const { settings, profiles, roles, loading, error, getSetting, saveAllSettings, load } = useSettings();
  const whatsApp = useWhatsApp();
  const googleCalendar = useGoogleCalendar();

  const [tab, setTab] = useState<SettingsTab>("usuarios");
  const [templates, setTemplates] = useState<TemplateItem[]>(defaultTemplates);
  const [rules, setRules] = useState<WorkflowRule[]>(defaultRules);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>(defaultIntegrations);
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

  const [newUser, setNewUser] = useState({ name: "", email: "", role: "consultor" as LocalRole });
  const [newTemplate, setNewTemplate] = useState({ name: "", category: "" });
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
          actor: l.usuario_id ?? "Sistema",
          action: `${l.acao} em ${l.tabela} (id: ${l.registro_id})`,
          module: l.tabela,
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
          {users.map((u) => (
            <div key={u.id} className="border border-certifica-200 rounded-[4px] px-3 py-2 flex items-center justify-between">
              <div>
                <div className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>{u.name}</div>
                <div className="text-[10.5px] text-certifica-500">{u.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <DSBadge variant={u.status === "ativo" ? "conformidade" : "outline"}>{u.status}</DSBadge>
                <DSSelect
                  label=""
                  value={u.role}
                  onChange={() => {
                    // Role changes would require updating the DB profile; kept read-only for now
                  }}
                  options={roleNames.map((r) => ({ value: r, label: r }))}
                  className="h-7 text-[11px]"
                />
              </div>
            </div>
          ))}
          {users.length === 0 && !loading && (
            <div className="text-[12px] text-certifica-500 py-2">Nenhum usuario encontrado.</div>
          )}
        </div>
      </DSCard>

      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Adicionar usuário</span>}>
        <div className="grid grid-cols-3 gap-2">
          <DSInput label="Nome" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} />
          <DSInput label="E-mail" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
          <DSSelect label="Perfil" value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as LocalRole }))} options={localRoleOptions.map((r) => ({ value: r, label: r }))} />
        </div>
        <div className="flex justify-end mt-3">
          <DSButton
            size="sm"
            icon={<Plus className="w-3 h-3" strokeWidth={1.5} />}
            onClick={() => {
              if (!newUser.name.trim() || !newUser.email.trim()) return;
              toast.info("Criacao de usuarios requer acesso ao painel de autenticacao.");
              setNewUser({ name: "", email: "", role: "consultor" });
            }}
          >
            Criar usuario
          </DSButton>
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

  const renderModelos = () => (
    <div className="space-y-4">
      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Modelos de documento</span>}>
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="border border-certifica-200 rounded-[4px] px-3 py-2 flex items-center justify-between">
              <div>
                <div className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>{t.name}</div>
                <div className="text-[10.5px] text-certifica-500">{t.category}</div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-certifica-500 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={t.active}
                    onChange={(e) => {
                      setTemplates((prev) => prev.map((x) => (x.id === t.id ? { ...x, active: e.target.checked } : x)));
                    }}
                  />
                  Ativo
                </label>
                <button
                  className="p-1 text-certifica-500 hover:text-nao-conformidade"
                  onClick={() => {
                    setTemplates((prev) => prev.filter((x) => x.id !== t.id));
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </DSCard>

      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Novo modelo</span>}>
        <div className="grid grid-cols-2 gap-2">
          <DSInput label="Nome do modelo" value={newTemplate.name} onChange={(e) => setNewTemplate((p) => ({ ...p, name: e.target.value }))} />
          <DSInput label="Categoria" value={newTemplate.category} onChange={(e) => setNewTemplate((p) => ({ ...p, category: e.target.value }))} />
        </div>
        <div className="flex justify-end mt-3">
          <DSButton
            size="sm"
            onClick={() => {
              if (!newTemplate.name.trim() || !newTemplate.category.trim()) return;
              const item: TemplateItem = { id: `T-${Date.now()}`, name: newTemplate.name.trim(), category: newTemplate.category.trim(), active: true };
              setTemplates((prev) => [item, ...prev]);
              setNewTemplate({ name: "", category: "" });
              toast.success(`Modelo "${item.name}" criado.`);
            }}
          >
            Criar modelo
          </DSButton>
        </div>
      </DSCard>
    </div>
  );

  const renderWorkflow = () => (
    <div className="space-y-4">
      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Regras de workflow</span>}>
        <div className="space-y-2">
          {rules.map((r) => (
            <div key={r.id} className="border border-certifica-200 rounded-[4px] px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>{r.name}</div>
                <DSBadge variant={r.active ? "conformidade" : "outline"}>{r.active ? "ativo" : "inativo"}</DSBadge>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <DSInput
                  label="Etapa"
                  value={r.stage}
                  onChange={(e) => setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, stage: e.target.value } : x)))}
                />
                <DSInput
                  label="SLA (horas)"
                  value={String(r.slaHours)}
                  onChange={(e) => setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, slaHours: Number(e.target.value || 0) } : x)))}
                />
                <label className="text-[11px] text-certifica-500 flex items-end pb-2 gap-1.5">
                  <input
                    type="checkbox"
                    checked={r.autoAction}
                    onChange={(e) => setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, autoAction: e.target.checked } : x)))}
                  />
                  Automacao
                </label>
                <label className="text-[11px] text-certifica-500 flex items-end pb-2 gap-1.5">
                  <input
                    type="checkbox"
                    checked={r.active}
                    onChange={(e) => setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: e.target.checked } : x)))}
                  />
                  Regra ativa
                </label>
              </div>
            </div>
          ))}
        </div>
      </DSCard>

      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>SLA e automacoes configuraveis</span>}>
        <div className="text-[12px] text-certifica-500">
          Total de regras ativas: <strong className="text-certifica-900">{rules.filter((r) => r.active).length}</strong> ·
          Automacoes ligadas: <strong className="text-certifica-900">{rules.filter((r) => r.autoAction).length}</strong> ·
          SLA medio: <strong className="text-certifica-900">{rules.length > 0 ? Math.round(rules.reduce((acc, r) => acc + r.slaHours, 0) / rules.length) : 0}h</strong>
        </div>
      </DSCard>
    </div>
  );

  const renderIntegracoes = () => (
    <div className="space-y-4">
      <DSCard header={<span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Integrações</span>}>
        <div className="space-y-2">
          {integrations.map((i) => (
            <div key={i.id} className="border border-certifica-200 rounded-[4px] px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>{i.name}</div>
                  <div className="text-[10.5px] text-certifica-500">Conta: {i.account || "Não configurada"} · Últ. sync: {i.lastSync}</div>
                </div>
                <label className="text-[11px] text-certifica-500 flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={i.connected}
                    onChange={(e) => {
                      const connected = e.target.checked;
                      setIntegrations((prev) => prev.map((x) => (x.id === i.id ? { ...x, connected } : x)));
                      toast.info(`${connected ? "Conectado" : "Desconectado"}: ${i.name}`);
                    }}
                  />
                  Conectado
                </label>
              </div>
            </div>
          ))}
        </div>
      </DSCard>

      {/* ── Z-API / WhatsApp — painel de configuração ── */}
      <DSCard header={
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-green-600" />
          <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>WhatsApp via Z-API</span>
          {whatsApp.status?.connected ? (
            <DSBadge variant="conformidade" className="ml-auto">Conectado</DSBadge>
          ) : whatsApp.statusError ? (
            <DSBadge variant="nao-conformidade" className="ml-auto">Erro</DSBadge>
          ) : (
            <DSBadge variant="outline" className="ml-auto">Não configurado</DSBadge>
          )}
        </div>
      }>
        <div className="space-y-3">
          {/* Status info */}
          {whatsApp.status?.connected && (
            <div className="bg-green-50 border border-green-200 rounded-[4px] px-3 py-2 flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-green-600" />
              <div className="text-[11px] text-green-800">
                <span style={{ fontWeight: 600 }}>Conectado</span> · Número: {whatsApp.status.phone ?? "—"} · {whatsApp.status.name ?? ""}
                {whatsApp.status.battery != null && ` · Bateria: ${whatsApp.status.battery}%`}
              </div>
            </div>
          )}
          {!whatsApp.status?.connected && !whatsApp.statusLoading && (
            <div className="bg-amber-50 border border-amber-200 rounded-[4px] px-3 py-2 flex items-start gap-2">
              <WifiOff className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-800 space-y-1">
                <div style={{ fontWeight: 600 }}>Como configurar o Z-API:</div>
                <ol className="list-decimal list-inside space-y-0.5 text-[10.5px]">
                  <li>Acesse <span className="font-mono bg-amber-100 px-1 rounded">app.z-api.io</span> e crie uma instância</li>
                  <li>Copie o <span className="font-mono bg-amber-100 px-1 rounded">Instance ID</span> e o <span className="font-mono bg-amber-100 px-1 rounded">Token</span></li>
                  <li>Acesse o <span style={{ fontWeight: 600 }}>Vercel</span> → seu projeto → <span className="font-mono bg-amber-100 px-1 rounded">Settings → Environment Variables</span></li>
                  <li>Adicione <span className="font-mono bg-amber-100 px-1 rounded">ZAPI_INSTANCE_ID</span> e <span className="font-mono bg-amber-100 px-1 rounded">ZAPI_TOKEN</span></li>
                  <li>Faça redeploy e clique em <span style={{ fontWeight: 600 }}>Testar conexão</span></li>
                </ol>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <DSButton
              variant="outline"
              size="sm"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${whatsApp.statusLoading ? "animate-spin" : ""}`} />}
              onClick={async () => {
                const s = await whatsApp.checkStatus();
                if (s?.connected) {
                  toast.success("WhatsApp conectado com sucesso!");
                  setIntegrations((prev) =>
                    prev.map((x) =>
                      x.id === "I-003"
                        ? { ...x, connected: true, account: s.phone ?? "WhatsApp", lastSync: new Date().toLocaleString("pt-BR") }
                        : x
                    )
                  );
                } else if (whatsApp.statusError) {
                  toast.error("Erro ao conectar: " + whatsApp.statusError);
                } else {
                  toast.info("Z-API não configurado. Siga as instruções acima.");
                }
              }}
            >
              {whatsApp.statusLoading ? "Verificando..." : "Testar conexão"}
            </DSButton>
            {whatsApp.status?.connected && (
              <span className="text-[10.5px] text-certifica-500">
                Pronto para enviar mensagens, imagens e documentos via WhatsApp
              </span>
            )}
          </div>

          {/* Variables reference */}
          <div className="bg-certifica-50 border border-certifica-200 rounded-[4px] px-3 py-2">
            <div className="text-[10px] text-certifica-500 mb-1.5" style={{ fontWeight: 600 }}>VARIÁVEIS DE AMBIENTE (Vercel)</div>
            <div className="space-y-1">
              {[
                { key: "ZAPI_INSTANCE_ID", desc: "ID da instância Z-API" },
                { key: "ZAPI_TOKEN", desc: "Token de autenticação" },
              ].map(({ key, desc }) => (
                <div key={key} className="flex items-center gap-2">
                  <code className="bg-certifica-dark text-green-400 text-[10px] px-2 py-0.5 rounded font-mono">{key}</code>
                  <span className="text-[10px] text-certifica-500">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DSCard>

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
                    setIntegrations((prev) =>
                      prev.map((x) =>
                        x.id === "I-005"
                          ? { ...x, connected: false, account: "", lastSync: "Nunca" }
                          : x
                      )
                    );
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
            <div className="text-[10px] text-certifica-500 mb-1.5" style={{ fontWeight: 600 }}>VARIÁVEL DE AMBIENTE NECESSÁRIA (Vercel)</div>
            <div className="flex items-center gap-2">
              <code className="bg-certifica-dark text-green-400 text-[10px] px-2 py-0.5 rounded font-mono">RECALL_API_TOKEN</code>
              <span className="text-[10px] text-certifica-500">Token de API do Recall.ai (mesma variável do bot de gravação)</span>
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
            Governança completa: usuários, permissões, workflow, segurança, LGPD e auditoria do sistema.
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

      <div className="grid grid-cols-5 gap-3">
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
            <span className="text-[11px] text-certifica-500">Integrações ativas</span>
            <CalendarClock className="w-3.5 h-3.5 text-observacao" strokeWidth={1.5} />
          </div>
          <div className="text-[22px] text-certifica-900 mt-1" style={{ fontWeight: 600 }}>{integrations.filter((i) => i.connected).length}</div>
        </DSCard>
        <DSCard>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-certifica-500">Regras SLA ativas</span>
            <CalendarClock className="w-3.5 h-3.5 text-certifica-accent" strokeWidth={1.5} />
          </div>
          <div className="text-[22px] text-certifica-900 mt-1" style={{ fontWeight: 600 }}>{rules.filter((r) => r.active).length}</div>
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
            <span className="text-[11px] text-certifica-500">Ultimo save</span>
            <Bell className="w-3.5 h-3.5 text-certifica-500" strokeWidth={1.5} />
          </div>
          <div className="text-[12px] text-certifica-900 mt-2" style={{ fontWeight: 600 }}>{saveStamp || "Nao salvo"}</div>
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
      {tab === "modelos" && renderModelos()}
      {tab === "workflow" && renderWorkflow()}
      {tab === "integracoes" && renderIntegracoes()}
      {tab === "logs" && renderLogs()}
    </div>
  );
}
