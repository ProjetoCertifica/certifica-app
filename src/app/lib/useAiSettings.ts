import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface AiSettings {
  id: string;
  agent_name: string;
  agent_instructions: string;
  agent_enabled: boolean;
  auto_reply: boolean;
  model: string;
  temperature: number;
  max_tokens: number;
  keywords: string[];
  timeout_minutes: number;
  business_hours_only: boolean;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  outside_hours_message: string;
  max_messages_per_chat: number;
  daily_message_limit: number;
  blacklist_phones: string[];
  split_messages: boolean;
  humanize_delay: boolean;
  understand_audio: boolean;
  analyze_images: boolean;
}

export interface AgentPause {
  phone: string;
  paused_until: string;
  pause_minutes: number;
}

const AI_SETTINGS_CHANGED = "certifica:ai-settings-changed";
function notifyAiSettingsChanged() { window.dispatchEvent(new Event(AI_SETTINGS_CHANGED)); }

export function useAiSettings() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [agents, setAgents] = useState<AiSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("whatsapp_ai_settings")
        .select("*")
        .order("created_at", { ascending: true });
      if (err) throw err;
      const list = (data ?? []) as AiSettings[];
      setAgents(list);
      setSettings(list[0] ?? null);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => { load(); };
    window.addEventListener(AI_SETTINGS_CHANGED, handler);
    return () => window.removeEventListener(AI_SETTINGS_CHANGED, handler);
  }, [load]);

  const selectAgent = useCallback((id: string) => {
    const agent = agents.find((a) => a.id === id);
    if (agent) setSettings(agent);
  }, [agents]);

  const update = useCallback(async (patch: Partial<AiSettings>): Promise<boolean> => {
    if (!settings) return false;
    const { error: err } = await supabase
      .from("whatsapp_ai_settings")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", settings.id);
    if (err) {
      setError(err.message);
      return false;
    }
    setSettings((prev) => prev ? { ...prev, ...patch } : prev);
    setAgents((prev) => prev.map((a) => a.id === settings.id ? { ...a, ...patch } : a));
    notifyAiSettingsChanged();
    return true;
  }, [settings]);

  const createAgent = useCallback(async (name: string): Promise<boolean> => {
    const { error: err } = await supabase.from("whatsapp_ai_settings").insert({
      agent_name: name,
      agent_instructions: "Você é um assistente profissional.",
      agent_enabled: false,
      auto_reply: false,
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1024,
      keywords: [],
      blacklist_phones: [],
      business_days: [1, 2, 3, 4, 5],
      timeout_minutes: 5,
      business_hours_only: false,
      business_hours_start: "08:00",
      business_hours_end: "18:00",
      outside_hours_message: "",
      max_messages_per_chat: 100,
      daily_message_limit: 200,
      split_messages: false,
      humanize_delay: true,
      understand_audio: false,
      analyze_images: false,
    } as any);
    if (err) { setError(err.message); return false; }
    await load();
    notifyAiSettingsChanged();
    return true;
  }, [load]);

  const deleteAgent = useCallback(async (id: string): Promise<boolean> => {
    const { error: err } = await supabase.from("whatsapp_ai_settings").delete().eq("id", id);
    if (err) { setError(err.message); return false; }
    await load();
    notifyAiSettingsChanged();
    return true;
  }, [load]);

  return { settings, agents, loading, error, reload: load, update, selectAgent, createAgent, deleteAgent };
}

export function useAgentPause(phone?: string) {
  const [paused, setPaused] = useState(false);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    if (!phone) return;
    const { data } = await supabase
      .from("agent_pauses")
      .select("*")
      .eq("phone", phone)
      .limit(1)
      .maybeSingle();
    if (data && new Date(data.paused_until) > new Date()) {
      setPaused(true);
      setPausedUntil(data.paused_until);
    } else {
      setPaused(false);
      setPausedUntil(null);
    }
  }, [phone]);

  useEffect(() => { check(); }, [check]);

  const pause = useCallback(async (minutes = 30) => {
    if (!phone) return;
    setLoading(true);
    const paused_until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    await supabase
      .from("agent_pauses")
      .upsert({ phone, paused_until, pause_minutes: minutes }, { onConflict: "phone" });
    setPaused(true);
    setPausedUntil(paused_until);
    setLoading(false);
  }, [phone]);

  const resume = useCallback(async () => {
    if (!phone) return;
    setLoading(true);
    await supabase.from("agent_pauses").delete().eq("phone", phone);
    setPaused(false);
    setPausedUntil(null);
    setLoading(false);
  }, [phone]);

  const toggle = useCallback(async (minutes = 30) => {
    if (paused) await resume();
    else await pause(minutes);
  }, [paused, pause, resume]);

  return { paused, pausedUntil, loading, check, pause, resume, toggle };
}
