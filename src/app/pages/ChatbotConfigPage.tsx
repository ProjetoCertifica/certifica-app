import React, { useState, useEffect } from "react";
import { DSButton } from "../components/ds/DSButton";
import { DSInput } from "../components/ds/DSInput";
import { DSTextarea } from "../components/ds/DSTextarea";
import { DSSelect } from "../components/ds/DSSelect";
import { useAiSettings, type AiSettings } from "../lib/useAiSettings";
import { toast } from "sonner";
import {
  Bot, Save, Loader2, Power, MessageSquare, Clock, Shield,
  Zap, Brain, X, Plus, Send, AlertTriangle, Lock, Trash2,
} from "lucide-react";
import { useRBAC } from "../lib/useRBAC";

const DAYS_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function ChatbotConfigPage() {
  const { profile } = useRBAC();
  const { settings, agents, loading, error, update, reload, selectAgent, createAgent, deleteAgent } = useAiSettings();
  const [local, setLocal] = useState<Partial<AiSettings>>({});
  const [saving, setSaving] = useState(false);
  const [testPrompt, setTestPrompt] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testing, setTesting] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [showNewAgent, setShowNewAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [activeTab, setActiveTab] = useState<"personalidade" | "gatilhos" | "horario" | "limites" | "testar">("personalidade");

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

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    setCreatingAgent(true);
    const ok = await createAgent(newAgentName.trim());
    setCreatingAgent(false);
    if (ok) {
      toast.success("Agente criado!");
      setShowNewAgent(false);
      setNewAgentName("");
    } else {
      toast.error("Erro ao criar agente.");
    }
  };

  const handleDeleteAgent = async (id: string, name: string) => {
    if (!confirm(`Excluir o agente "${name}"?`)) return;
    const ok = await deleteAgent(id);
    if (ok) toast.success("Agente excluído!");
  };

  const addKeyword = () => {
    if (!newKeyword.trim()) return;
    const kw = local.keywords ?? [];
    if (!kw.includes(newKeyword.trim())) set("keywords", [...kw, newKeyword.trim()]);
    setNewKeyword("");
  };
  const removeKeyword = (k: string) => set("keywords", (local.keywords ?? []).filter((x) => x !== k));

  const addBlacklist = () => {
    if (!newPhone.trim()) return;
    const bl = local.blacklist_phones ?? [];
    if (!bl.includes(newPhone.trim())) set("blacklist_phones", [...bl, newPhone.trim()]);
    setNewPhone("");
  };
  const removeBlacklist = (p: string) => set("blacklist_phones", (local.blacklist_phones ?? []).filter((x) => x !== p));

  const toggleDay = (day: number) => {
    const days = local.business_days ?? [1, 2, 3, 4, 5];
    set("business_days", days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort());
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-certifica-accent animate-spin" /></div>;
  }

  if (error && agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertTriangle className="w-6 h-6 text-nao-conformidade" />
        <span className="text-[12px] text-nao-conformidade">{error}</span>
        <DSButton variant="outline" size="sm" onClick={reload}>Tentar novamente</DSButton>
      </div>
    );
  }

  const isAdmin = profile && (profile.role_nome === "Administrador" || profile.role_id === "admin");
  const hasConfigPermission = !profile?.permissoes || Object.keys(profile.permissoes).length === 0 || profile.permissoes?.configuracoes !== false;
  if (profile && !isAdmin && !hasConfigPermission) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Lock className="w-6 h-6 text-certifica-500" />
        <span className="text-[13px] text-certifica-700" style={{ fontWeight: 600 }}>Acesso restrito</span>
      </div>
    );
  }

  const tabs = [
    { key: "personalidade" as const, label: "Personalidade", icon: Brain },
    { key: "gatilhos" as const, label: "Gatilhos", icon: Zap },
    { key: "horario" as const, label: "Horário", icon: Clock },
    { key: "limites" as const, label: "Limites", icon: Shield },
    { key: "testar" as const, label: "Testar", icon: Send },
  ];

  return (
    <div className="flex h-full min-h-0">
      {/* ── Left: Agent List ── */}
      <div className="w-[280px] flex-shrink-0 border-r border-certifica-200 flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
          <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Agentes IA</span>
          <button
            onClick={() => setShowNewAgent(true)}
            className="w-7 h-7 flex items-center justify-center rounded-[4px] bg-certifica-accent text-white hover:bg-certifica-accent/90 cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center">
              <Bot className="w-8 h-8 text-certifica-200 mb-2" />
              <p className="text-[11px] text-certifica-500">Nenhum agente criado</p>
              <button onClick={() => setShowNewAgent(true)} className="text-[11px] text-certifica-accent hover:underline cursor-pointer mt-1">Criar primeiro agente</button>
            </div>
          ) : (
            agents.map((agent) => {
              const isActive = agent.agent_enabled && agent.auto_reply;
              const isSelected = settings?.id === agent.id;
              return (
                <div
                  key={agent.id}
                  onClick={() => { selectAgent(agent.id); setTestResponse(""); setTestPrompt(""); }}
                  className={`px-4 py-3 cursor-pointer transition-colors border-b border-certifica-100 group ${
                    isSelected ? "bg-certifica-50 border-l-2 border-l-certifica-accent" : "hover:bg-certifica-50/50 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-certifica-accent/15" : "bg-certifica-100"}`}>
                        <Bot className={`w-4 h-4 ${isSelected ? "text-certifica-accent" : "text-certifica-400"}`} strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12px] text-certifica-dark truncate" style={{ fontWeight: 600 }}>{agent.agent_name || "Sem nome"}</div>
                        <div className="text-[10px] text-certifica-500 truncate">{agent.model || "gpt-4o-mini"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-500" : "bg-certifica-300"}`} />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteAgent(agent.id, agent.agent_name); }}
                        className="p-1 text-certifica-300 hover:text-nao-conformidade opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: Editor ── */}
      {settings ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor header */}
          <div className="px-5 py-3 border-b border-certifica-200 flex items-center justify-between bg-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-certifica-accent/10 rounded-lg flex items-center justify-center">
                <Bot className="w-5 h-5 text-certifica-accent" strokeWidth={1.5} />
              </div>
              <div>
                <DSInput
                  value={local.agent_name ?? ""}
                  onChange={(e) => set("agent_name", e.target.value)}
                  className="h-7 text-[14px] border-0 bg-transparent px-0 focus:ring-0"
                  style={{ fontWeight: 700 }}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Status toggle */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-[4px] border ${
                local.agent_enabled && local.auto_reply
                  ? "border-green-200 bg-green-50"
                  : "border-certifica-200 bg-certifica-50"
              }`}>
                <div className={`w-2 h-2 rounded-full ${local.agent_enabled && local.auto_reply ? "bg-green-500" : "bg-certifica-300"}`} />
                <button
                  onClick={() => { set("agent_enabled", !(local.agent_enabled && local.auto_reply)); set("auto_reply", !(local.agent_enabled && local.auto_reply)); }}
                  className="text-[11px] cursor-pointer"
                  style={{ fontWeight: 600, color: local.agent_enabled && local.auto_reply ? "#16A34A" : "#6B7280" }}
                >
                  {local.agent_enabled && local.auto_reply ? "Ativo" : "Inativo"}
                </button>
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
          </div>

          {/* Tabs */}
          <div className="px-5 border-b border-certifica-200 bg-white flex-shrink-0">
            <div className="flex gap-0">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-[11px] border-b-2 cursor-pointer transition-colors ${
                    activeTab === tab.key
                      ? "border-certifica-accent text-certifica-accent"
                      : "border-transparent text-certifica-500 hover:text-certifica-700"
                  }`}
                  style={{ fontWeight: activeTab === tab.key ? 600 : 400 }}
                >
                  <tab.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5 bg-certifica-50/30">
            <div className="max-w-2xl space-y-4">

              {activeTab === "personalidade" && (
                <>
                  <Card>
                    <DSTextarea
                      label="Instruções do sistema (system prompt)"
                      value={local.agent_instructions ?? ""}
                      onChange={(e) => set("agent_instructions", e.target.value)}
                      rows={6}
                      placeholder="Descreva como o agente deve se comportar, tom de voz, o que sabe, o que não deve fazer..."
                    />
                  </Card>
                  <Card>
                    <div className="grid grid-cols-3 gap-4">
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
                        <input type="range" min="0" max="1" step="0.1" value={local.temperature ?? 0.7} onChange={(e) => set("temperature", parseFloat(e.target.value))} className="w-full accent-certifica-accent mt-1" />
                        <div className="flex justify-between text-[9px] text-certifica-500 mt-1"><span>Preciso</span><span>Criativo</span></div>
                      </div>
                      <DSInput label="Max tokens" type="number" value={String(local.max_tokens ?? 1024)} onChange={(e) => set("max_tokens", parseInt(e.target.value) || 1024)} />
                    </div>
                  </Card>
                </>
              )}

              {activeTab === "gatilhos" && (
                <>
                  <Card>
                    <label className="text-[11px] text-certifica-500 block mb-2" style={{ fontWeight: 600 }}>Keywords que ativam o agente</label>
                    <p className="text-[10px] text-certifica-400 mb-3">Deixe vazio para responder todas as mensagens</p>
                    <div className="flex items-center gap-2 mb-3">
                      <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addKeyword()} placeholder="Adicionar keyword..." className="flex-1 h-8 px-3 border border-certifica-200 rounded-[4px] text-[11px] text-certifica-dark placeholder:text-certifica-400 focus:outline-none focus:ring-1 focus:ring-certifica-accent/30 bg-white" />
                      <button onClick={addKeyword} className="h-8 px-3 bg-certifica-accent text-white rounded-[4px] text-[11px] cursor-pointer hover:opacity-90" style={{ fontWeight: 600 }}><Plus className="w-3 h-3" strokeWidth={2} /></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(local.keywords ?? []).map((k) => (
                        <span key={k} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-certifica-accent/10 text-certifica-accent rounded-full text-[11px]" style={{ fontWeight: 500 }}>
                          {k}
                          <button onClick={() => removeKeyword(k)} className="text-certifica-accent/40 hover:text-nao-conformidade cursor-pointer"><X className="w-3 h-3" strokeWidth={1.5} /></button>
                        </span>
                      ))}
                      {(local.keywords ?? []).length === 0 && <span className="text-[10px] text-certifica-400 italic">Responde todas as mensagens</span>}
                    </div>
                  </Card>
                  <Card>
                    <DSInput label="Timeout entre mensagens (segundos)" type="number" value={String((local.timeout_minutes ?? 5) * 60)} onChange={(e) => set("timeout_minutes", Math.max(1, Math.round((parseInt(e.target.value) || 60) / 60)))} />
                    <p className="text-[9px] text-certifica-400 mt-1.5">Aguarda {local.timeout_minutes ?? 5} min antes de processar</p>
                  </Card>
                  <Card>
                    <label className="text-[11px] text-certifica-500 block mb-2" style={{ fontWeight: 600 }}>Telefones bloqueados</label>
                    <div className="flex items-center gap-2 mb-3">
                      <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addBlacklist()} placeholder="Ex: 5511999999999" className="flex-1 h-8 px-3 border border-certifica-200 rounded-[4px] text-[11px] text-certifica-dark placeholder:text-certifica-400 focus:outline-none focus:ring-1 focus:ring-certifica-accent/30 bg-white font-mono" />
                      <button onClick={addBlacklist} className="h-8 px-3 bg-certifica-accent text-white rounded-[4px] text-[11px] cursor-pointer hover:opacity-90" style={{ fontWeight: 600 }}><Plus className="w-3 h-3" strokeWidth={2} /></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(local.blacklist_phones ?? []).map((p) => (
                        <span key={p} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-nao-conformidade rounded-full text-[11px] font-mono" style={{ fontWeight: 500 }}>
                          {p}
                          <button onClick={() => removeBlacklist(p)} className="text-nao-conformidade/40 hover:text-nao-conformidade cursor-pointer"><X className="w-3 h-3" strokeWidth={1.5} /></button>
                        </span>
                      ))}
                      {(local.blacklist_phones ?? []).length === 0 && <span className="text-[10px] text-certifica-400 italic">Nenhum bloqueado</span>}
                    </div>
                  </Card>
                </>
              )}

              {activeTab === "horario" && (
                <>
                  <Card>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 600 }}>Restringir ao horário comercial</span>
                        <p className="text-[10px] text-certifica-500 mt-0.5">IA só responde dentro do horário definido</p>
                      </div>
                      <Toggle checked={local.business_hours_only ?? false} onChange={(v) => set("business_hours_only", v)} />
                    </div>
                  </Card>
                  <Card>
                    <div className="grid grid-cols-2 gap-4">
                      <DSInput label="Início" type="time" value={local.business_hours_start ?? "08:00"} onChange={(e) => set("business_hours_start", e.target.value)} />
                      <DSInput label="Fim" type="time" value={local.business_hours_end ?? "18:00"} onChange={(e) => set("business_hours_end", e.target.value)} />
                    </div>
                    <div className="mt-4">
                      <label className="text-[11px] text-certifica-500 block mb-2" style={{ fontWeight: 600 }}>Dias de funcionamento</label>
                      <div className="flex gap-2">
                        {DAYS_LABELS.map((label, i) => {
                          const active = (local.business_days ?? [1, 2, 3, 4, 5]).includes(i);
                          return <button key={i} onClick={() => toggleDay(i)} className={`w-10 h-10 rounded-lg text-[10px] cursor-pointer transition-all ${active ? "bg-certifica-accent text-white" : "bg-certifica-100 text-certifica-500 hover:bg-certifica-200"}`} style={{ fontWeight: 600 }}>{label}</button>;
                        })}
                      </div>
                    </div>
                  </Card>
                  <Card>
                    <DSTextarea label="Mensagem fora do horário" value={local.outside_hours_message ?? ""} onChange={(e) => set("outside_hours_message", e.target.value)} rows={2} placeholder="Mensagem automática quando fora do horário..." />
                  </Card>
                </>
              )}

              {activeTab === "limites" && (
                <>
                  <Card>
                    <div className="grid grid-cols-2 gap-4">
                      <DSInput label="Max mensagens por chat" type="number" value={String(local.max_messages_per_chat ?? 100)} onChange={(e) => set("max_messages_per_chat", parseInt(e.target.value) || 100)} />
                      <DSInput label="Limite diário total" type="number" value={String(local.daily_message_limit ?? 200)} onChange={(e) => set("daily_message_limit", parseInt(e.target.value) || 200)} />
                    </div>
                  </Card>
                  <Card>
                    <Row label="Dividir mensagens longas" desc="Quebra respostas grandes em múltiplas mensagens">
                      <Toggle checked={local.split_messages ?? false} onChange={(v) => set("split_messages", v)} />
                    </Row>
                    <div className="border-t border-certifica-100 my-3" />
                    <Row label="Simular digitação" desc="Delay humanizado antes de enviar">
                      <Toggle checked={local.humanize_delay ?? true} onChange={(v) => set("humanize_delay", v)} />
                    </Row>
                  </Card>
                </>
              )}

              {activeTab === "testar" && (
                <Card>
                  <div className="flex gap-2">
                    <input value={testPrompt} onChange={(e) => setTestPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleTest()} placeholder="Digite uma mensagem de teste..." className="flex-1 h-10 px-3 border border-certifica-200 rounded-[6px] text-[12px] text-certifica-dark placeholder:text-certifica-400 focus:outline-none focus:ring-1 focus:ring-certifica-accent/30 bg-white" />
                    <DSButton variant="primary" size="sm" onClick={handleTest} disabled={testing || !testPrompt.trim()} icon={testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" strokeWidth={1.5} />}>Enviar</DSButton>
                  </div>
                  {testResponse && (
                    <div className="mt-4 p-4 bg-certifica-50 border border-certifica-200 rounded-[6px]">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-4 h-4 text-certifica-accent" strokeWidth={1.5} />
                        <span className="text-[11px] text-certifica-500" style={{ fontWeight: 600 }}>{local.agent_name || "Assistente"}</span>
                      </div>
                      <p className="text-[12px] text-certifica-dark whitespace-pre-wrap" style={{ lineHeight: "1.65" }}>{testResponse}</p>
                    </div>
                  )}
                </Card>
              )}

            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <Bot className="w-12 h-12 text-certifica-200 mb-3" />
          <p className="text-[13px] text-certifica-500">Selecione um agente ou crie um novo</p>
        </div>
      )}

      {/* New Agent Modal */}
      {showNewAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-certifica-dark/45 certifica-modal-backdrop" onClick={() => setShowNewAgent(false)} />
          <div className="relative w-full max-w-[400px] bg-white border border-certifica-200 rounded-[8px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] certifica-modal-content">
            <div className="px-5 py-4 border-b border-certifica-200">
              <h3 className="text-[15px] text-certifica-900" style={{ fontWeight: 600 }}>Novo Agente IA</h3>
            </div>
            <div className="p-5 space-y-4">
              <DSInput label="Nome do agente" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} placeholder="Ex: Assistente ISO, Bot Vendas..." />
              <div className="flex justify-end gap-2">
                <DSButton variant="ghost" size="sm" onClick={() => setShowNewAgent(false)}>Cancelar</DSButton>
                <DSButton variant="primary" size="sm" onClick={handleCreateAgent} disabled={creatingAgent || !newAgentName.trim()}>
                  {creatingAgent ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                  Criar
                </DSButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Helpers ── */

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white border border-certifica-200 rounded-[6px] p-4">{children}</div>;
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 600 }}>{label}</span>
        <p className="text-[10px] text-certifica-500 mt-0.5">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${checked ? "bg-certifica-accent" : "bg-certifica-300"}`}
    >
      <div className="absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform" style={{ left: checked ? 22 : 3 }} />
    </button>
  );
}
