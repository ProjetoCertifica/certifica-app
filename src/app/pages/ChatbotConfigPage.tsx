import React, { useState, useEffect } from "react";
import { DSButton } from "../components/ds/DSButton";
import { DSInput } from "../components/ds/DSInput";
import { DSTextarea } from "../components/ds/DSTextarea";
import { DSSelect } from "../components/ds/DSSelect";
import { useAiSettings, type AiSettings } from "../lib/useAiSettings";
import { toast } from "sonner";
import {
  Bot, Save, Loader2, Power, MessageSquare, Clock, Shield,
  Zap, Volume2, Brain, X, Plus, Send, AlertTriangle, Settings2, Lock,
} from "lucide-react";
import { useRBAC } from "../lib/useRBAC";

const DAYS_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function ChatbotConfigPage() {
  const { profile } = useRBAC();
  const { settings, loading, error, update, reload } = useAiSettings();
  const [local, setLocal] = useState<Partial<AiSettings>>({});
  const [saving, setSaving] = useState(false);
  const [testPrompt, setTestPrompt] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  const set = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await update(local);
    setSaving(false);
    if (ok) toast.success("Configurações salvas!");
    else toast.error("Erro ao salvar.");
  };

  const handleTest = async () => {
    if (!testPrompt.trim()) return;
    setTesting(true);
    setTestResponse("");
    try {
      const res = await fetch("/api/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: local.model || "gpt-4o-mini",
          messages: [
            { role: "system", content: local.agent_instructions || "Você é um assistente." },
            { role: "user", content: testPrompt },
          ],
          temperature: local.temperature ?? 0.7,
          max_tokens: local.max_tokens ?? 1024,
        }),
      });
      const data = await res.json();
      setTestResponse(data.choices?.[0]?.message?.content ?? data.error ?? "Sem resposta");
    } catch (err: any) {
      setTestResponse(`Erro: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    const kw = local.keywords ?? [];
    if (!kw.includes(newKeyword.trim())) {
      set("keywords", [...kw, newKeyword.trim()]);
    }
    setNewKeyword("");
  };

  const removeKeyword = (k: string) => {
    set("keywords", (local.keywords ?? []).filter((x) => x !== k));
  };

  const addBlacklist = () => {
    if (!newPhone.trim()) return;
    const bl = local.blacklist_phones ?? [];
    if (!bl.includes(newPhone.trim())) {
      set("blacklist_phones", [...bl, newPhone.trim()]);
    }
    setNewPhone("");
  };

  const removeBlacklist = (p: string) => {
    set("blacklist_phones", (local.blacklist_phones ?? []).filter((x) => x !== p));
  };

  const toggleDay = (day: number) => {
    const days = local.business_days ?? [1, 2, 3, 4, 5];
    set("business_days", days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-certifica-accent animate-spin" />
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertTriangle className="w-6 h-6 text-nao-conformidade" />
        <span className="text-[12px] text-nao-conformidade">{error || "Configurações não encontradas"}</span>
        <DSButton variant="outline" size="sm" onClick={reload}>Tentar novamente</DSButton>
      </div>
    );
  }

  // M19: Restrict chatbot config to users without configuracoes permission
  const isAdmin = profile && (profile.role_nome === "Administrador" || profile.role_id === "admin");
  const hasConfigPermission = !profile?.permissoes || Object.keys(profile.permissoes).length === 0 || profile.permissoes?.configuracoes !== false;
  if (profile && !isAdmin && !hasConfigPermission) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Lock className="w-6 h-6 text-certifica-500" />
        <span className="text-[13px] text-certifica-700" style={{ fontWeight: 600 }}>Acesso restrito</span>
        <span className="text-[12px] text-certifica-500 text-center max-w-xs">
          Você não tem permissão para configurar o Chatbot IA.
        </span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-certifica-accent/10 rounded-lg flex items-center justify-center">
              <Bot className="w-5 h-5 text-certifica-accent" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-[16px] text-certifica-900" style={{ fontWeight: 700 }}>Chatbot IA</h2>
              <p className="text-[11px] text-certifica-500">Configure o assistente inteligente do WhatsApp</p>
            </div>
          </div>
          <DSButton
            variant="primary"
            size="sm"
            icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" strokeWidth={1.5} />}
            onClick={handleSave}
            disabled={saving}
          >
            Salvar
          </DSButton>
        </div>

        {/* ── Geral ── */}
        <Section icon={Power} title="Geral">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 600 }}>Agente ativo</span>
              <p className="text-[10px] text-certifica-500">Liga/desliga o chatbot completamente</p>
            </div>
            <Toggle checked={local.agent_enabled ?? false} onChange={(v) => set("agent_enabled", v)} />
          </div>
          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 600 }}>Auto-reply</span>
              <p className="text-[10px] text-certifica-500">Responde automaticamente novas mensagens</p>
            </div>
            <Toggle checked={local.auto_reply ?? false} onChange={(v) => set("auto_reply", v)} />
          </div>
          {/* Pause/Resume global */}
          <div className="flex items-center justify-between mt-3 p-3 rounded-[4px] border border-certifica-200 bg-certifica-50/50">
            <div className="flex items-center gap-2">
              <Bot className={`w-4 h-4 ${local.agent_enabled && local.auto_reply ? "text-conformidade" : "text-certifica-400"}`} strokeWidth={1.5} />
              <div>
                <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 600 }}>
                  {local.agent_enabled && local.auto_reply ? "IA respondendo" : "IA desativada"}
                </span>
                <p className="text-[10px] text-certifica-500">
                  {local.agent_enabled && local.auto_reply
                    ? "O agente está ativo e respondendo mensagens automaticamente"
                    : "Ative o agente e auto-reply acima para começar"
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (local.agent_enabled && local.auto_reply) {
                  set("agent_enabled", false);
                  set("auto_reply", false);
                } else {
                  set("agent_enabled", true);
                  set("auto_reply", true);
                }
              }}
              className={`px-3 py-1.5 rounded-[4px] text-[11px] cursor-pointer transition-all ${
                local.agent_enabled && local.auto_reply
                  ? "bg-nao-conformidade text-white hover:bg-nao-conformidade/90"
                  : "bg-conformidade text-white hover:bg-conformidade/90"
              }`}
              style={{ fontWeight: 600 }}
            >
              {local.agent_enabled && local.auto_reply ? "Pausar IA" : "Ativar IA"}
            </button>
          </div>
          <DSInput
            label="Nome do agente"
            value={local.agent_name ?? ""}
            onChange={(e) => set("agent_name", e.target.value)}
            className="mt-3"
          />
        </Section>

        {/* ── Personalidade ── */}
        <Section icon={Brain} title="Personalidade">
          <DSTextarea
            label="Instruções do sistema (system prompt)"
            value={local.agent_instructions ?? ""}
            onChange={(e) => set("agent_instructions", e.target.value)}
            rows={5}
            placeholder="Descreva como o agente deve se comportar, tom de voz, o que sabe, o que não deve fazer..."
          />
          <div className="grid grid-cols-3 gap-3 mt-3">
            <DSSelect
              label="Modelo"
              value={local.model ?? "gpt-4o-mini"}
              onChange={(e) => set("model", e.target.value)}
              options={[
                { value: "gpt-4o-mini", label: "GPT-4o Mini" },
                { value: "gpt-4o", label: "GPT-4o" },
                { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
                { value: "gpt-4.1", label: "GPT-4.1" },
              ]}
            />
            <div>
              <label className="text-[11px] text-certifica-500 block mb-1.5" style={{ fontWeight: 600 }}>
                Temperatura: {(local.temperature ?? 0.7).toFixed(1)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={local.temperature ?? 0.7}
                onChange={(e) => set("temperature", parseFloat(e.target.value))}
                className="w-full accent-certifica-accent"
              />
              <div className="flex justify-between text-[9px] text-certifica-500 mt-0.5">
                <span>Preciso</span>
                <span>Criativo</span>
              </div>
            </div>
            <DSInput
              label="Max tokens"
              type="number"
              value={String(local.max_tokens ?? 1024)}
              onChange={(e) => set("max_tokens", parseInt(e.target.value) || 1024)}
            />
          </div>
        </Section>

        {/* ── Gatilhos ── */}
        <Section icon={Zap} title="Gatilhos (Keywords)">
          <p className="text-[10px] text-certifica-500 mb-2">Palavras-chave que ativam o agente (vazio = responde tudo)</p>
          <div className="flex items-center gap-2 mb-2">
            <input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addKeyword()}
              placeholder="Adicionar keyword..."
              className="flex-1 h-8 px-3 border border-certifica-200 rounded-[3px] text-[11px] text-certifica-dark placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-accent/30 bg-white"
            />
            <button onClick={addKeyword} className="h-8 px-3 bg-certifica-accent text-white rounded-[3px] text-[11px] cursor-pointer hover:opacity-90" style={{ fontWeight: 600 }}>
              <Plus className="w-3 h-3" strokeWidth={2} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(local.keywords ?? []).map((k) => (
              <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 bg-certifica-100 text-certifica-700 rounded-[3px] text-[11px]" style={{ fontWeight: 500 }}>
                {k}
                <button onClick={() => removeKeyword(k)} className="text-certifica-500/40 hover:text-nao-conformidade cursor-pointer">
                  <X className="w-3 h-3" strokeWidth={1.5} />
                </button>
              </span>
            ))}
            {(local.keywords ?? []).length === 0 && (
              <span className="text-[10px] text-certifica-500 italic">Nenhuma keyword — agente responde todas as mensagens</span>
            )}
          </div>
          <DSInput
            label="Timeout (segundos entre mensagens)"
            type="number"
            value={String((local.timeout_minutes ?? 5) * 60)}
            onChange={(e) => set("timeout_minutes", Math.max(1, Math.round((parseInt(e.target.value) || 60) / 60)))}
            className="mt-3"
          />
          <p className="text-[9px] text-certifica-500 mt-1">Tempo de espera antes de processar a resposta ({local.timeout_minutes ?? 5} min)</p>
        </Section>

        {/* ── Horário Comercial ── */}
        <Section icon={Clock} title="Horário Comercial">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 600 }}>Restringir ao horário comercial</span>
              <p className="text-[10px] text-certifica-500">IA só responde dentro do horário definido</p>
            </div>
            <Toggle checked={local.business_hours_only ?? false} onChange={(v) => set("business_hours_only", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <DSInput
              label="Início"
              type="time"
              value={local.business_hours_start ?? "08:00"}
              onChange={(e) => set("business_hours_start", e.target.value)}
            />
            <DSInput
              label="Fim"
              type="time"
              value={local.business_hours_end ?? "18:00"}
              onChange={(e) => set("business_hours_end", e.target.value)}
            />
          </div>
          <div className="mt-3">
            <label className="text-[11px] text-certifica-500 block mb-1.5" style={{ fontWeight: 600 }}>Dias de funcionamento</label>
            <div className="flex gap-1.5">
              {DAYS_LABELS.map((label, i) => {
                const active = (local.business_days ?? [1, 2, 3, 4, 5]).includes(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleDay(i)}
                    className={`w-9 h-9 rounded-[4px] text-[10px] cursor-pointer transition-all ${
                      active
                        ? "bg-certifica-accent text-white"
                        : "bg-certifica-100 text-certifica-500 hover:bg-certifica-200"
                    }`}
                    style={{ fontWeight: 600 }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        {/* ── Mensagem fora do horário ── */}
        <Section icon={MessageSquare} title="Mensagem fora do horário">
          <DSTextarea
            label="Mensagem automática quando fora do horário"
            value={local.outside_hours_message ?? ""}
            onChange={(e) => set("outside_hours_message", e.target.value)}
            rows={2}
          />
        </Section>

        {/* ── Limites ── */}
        <Section icon={Shield} title="Limites e Comportamento">
          <div className="grid grid-cols-2 gap-3">
            <DSInput
              label="Max mensagens por chat"
              type="number"
              value={String(local.max_messages_per_chat ?? 100)}
              onChange={(e) => set("max_messages_per_chat", parseInt(e.target.value) || 100)}
            />
            <DSInput
              label="Limite diário total"
              type="number"
              value={String(local.daily_message_limit ?? 200)}
              onChange={(e) => set("daily_message_limit", parseInt(e.target.value) || 200)}
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 600 }}>Dividir mensagens longas</span>
              <p className="text-[10px] text-certifica-500">Quebra respostas grandes em múltiplas mensagens</p>
            </div>
            <Toggle checked={local.split_messages ?? false} onChange={(v) => set("split_messages", v)} />
          </div>
          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 600 }}>Simular digitação</span>
              <p className="text-[10px] text-certifica-500">Delay humanizado antes de enviar a resposta</p>
            </div>
            <Toggle checked={local.humanize_delay ?? true} onChange={(v) => set("humanize_delay", v)} />
          </div>
        </Section>

        {/* ── Blacklist ── */}
        <Section icon={Shield} title="Blacklist (Telefones bloqueados)">
          <div className="flex items-center gap-2 mb-2">
            <input
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addBlacklist()}
              placeholder="Ex: 5511999999999"
              className="flex-1 h-8 px-3 border border-certifica-200 rounded-[3px] text-[11px] text-certifica-dark placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-accent/30 bg-white font-mono"
            />
            <button onClick={addBlacklist} className="h-8 px-3 bg-certifica-accent text-white rounded-[3px] text-[11px] cursor-pointer hover:opacity-90" style={{ fontWeight: 600 }}>
              <Plus className="w-3 h-3" strokeWidth={2} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(local.blacklist_phones ?? []).map((p) => (
              <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 bg-nao-conformidade/10 text-nao-conformidade rounded-[3px] text-[11px] font-mono" style={{ fontWeight: 500 }}>
                {p}
                <button onClick={() => removeBlacklist(p)} className="text-nao-conformidade/40 hover:text-nao-conformidade cursor-pointer">
                  <X className="w-3 h-3" strokeWidth={1.5} />
                </button>
              </span>
            ))}
            {(local.blacklist_phones ?? []).length === 0 && (
              <span className="text-[10px] text-certifica-500 italic">Nenhum telefone bloqueado</span>
            )}
          </div>
        </Section>

        {/* ── Testar ── */}
        <Section icon={Send} title="Testar Agente">
          <div className="flex gap-2">
            <input
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTest()}
              placeholder="Digite uma mensagem de teste..."
              className="flex-1 h-9 px-3 border border-certifica-200 rounded-[3px] text-[12px] text-certifica-dark placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-accent/30 bg-white"
            />
            <DSButton
              variant="primary"
              size="sm"
              onClick={handleTest}
              disabled={testing || !testPrompt.trim()}
              icon={testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={1.5} />}
            >
              Enviar
            </DSButton>
          </div>
          {testResponse && (
            <div className="mt-3 p-3 bg-certifica-50 border border-certifica-200 rounded-[4px]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Bot className="w-3.5 h-3.5 text-certifica-accent" strokeWidth={1.5} />
                <span className="text-[10px] text-certifica-500" style={{ fontWeight: 600 }}>{local.agent_name || "Assistente"}</span>
              </div>
              <p className="text-[12px] text-certifica-dark whitespace-pre-wrap" style={{ lineHeight: "1.5" }}>{testResponse}</p>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-certifica-200 rounded-[6px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-certifica-accent" strokeWidth={1.5} />
        <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-[22px] rounded-full transition-colors cursor-pointer flex-shrink-0 ${
        checked ? "bg-certifica-accent" : "bg-certifica-300"
      }`}
    >
      <div
        className="absolute top-[2px] w-[18px] h-[18px] bg-white rounded-full shadow transition-transform"
        style={{ left: checked ? 20 : 2 }}
      />
    </button>
  );
}
