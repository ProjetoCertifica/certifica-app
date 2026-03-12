import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabase";
import type { Meeting, MeetingInsert, MeetingUpdate, MeetingAction } from "./database.types";
import * as recall from "./recallai";

export interface MeetingWithClient extends Meeting {
  cliente_nome: string;
  projeto_titulo: string;
}

export type RecallPhase =
  | "idle"
  | "sending"
  | "waiting_room"
  | "in_call"
  | "recording"
  | "call_ended"
  | "processing"
  | "done"
  | "error";

export function useMeetings() {
  const [meetings, setMeetings] = useState<MeetingWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recallPhase, setRecallPhase] = useState<RecallPhase>("idle");
  const [recallMessage, setRecallMessage] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRetries = useRef(0);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("meetings")
        .select("*, clientes(nome_fantasia), projetos(titulo)")
        .order("data", { ascending: false });

      if (err) throw err;

      const mapped: MeetingWithClient[] = (data ?? []).map((m: any) => ({
        ...m,
        cliente_nome: m.clientes?.nome_fantasia ?? "—",
        projeto_titulo: m.projetos?.titulo ?? "—",
        transcricao: Array.isArray(m.transcricao) ? m.transcricao : [],
        acoes: Array.isArray(m.acoes) ? m.acoes : [],
        resumo_historico: Array.isArray(m.resumo_historico) ? m.resumo_historico : [],
        clientes: undefined,
        projetos: undefined,
      }));
      setMeetings(mapped);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar reuniões");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  useEffect(() => {
    return () => { stopPolling(); };
  }, []);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  /* ── CRUD ── */

  const BASE_COLS = new Set(["titulo", "tipo", "projeto_id", "cliente_id", "data", "duracao_min", "local", "pauta", "participantes", "status", "ata"]);

  const create = useCallback(async (input: MeetingInsert) => {
    setError(null);
    try {
      const baseInput: Record<string, unknown> = {
        titulo: input.titulo, tipo: input.tipo,
        cliente_id: input.cliente_id, projeto_id: input.projeto_id,
        data: input.data, duracao_min: input.duracao_min ?? 0,
        local: input.local ?? "", pauta: input.pauta ?? "",
        participantes: input.participantes ?? [], status: "agendada", ata: input.ata ?? "",
      };
      const ext: Record<string, unknown> = {
        meet_link: input.meet_link ?? "", resumo: "", resumo_aprovado: false,
        resumo_historico: [], transcricao: [], acoes: [],
        gravacao_url: "", gravacao_inicio: null, gravacao_fim: null,
      };

      const { data, error: err } = await supabase
        .from("meetings").insert({ ...baseInput, ...ext }).select().single();
      if (!err) { await fetchMeetings(); return data as Meeting; }

      const { data: d2, error: e2 } = await supabase
        .from("meetings").insert(baseInput).select().single();
      if (e2) throw e2;
      await fetchMeetings();
      return d2 as Meeting;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao criar reunião");
      return null;
    }
  }, [fetchMeetings]);

  const update = useCallback(async (id: string, patch: MeetingUpdate) => {
    setError(null);
    try {
      const { error: err } = await supabase.from("meetings").update(patch).eq("id", id);
      if (!err) { await fetchMeetings(); return true; }

      const basePatch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
        if (BASE_COLS.has(k)) basePatch[k] = v;
      }
      if (Object.keys(basePatch).length === 0) { await fetchMeetings(); return true; }
      const { error: e2 } = await supabase.from("meetings").update(basePatch).eq("id", id);
      if (e2) throw e2;
      await fetchMeetings();
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar reunião");
      return false;
    }
  }, [fetchMeetings]);

  const remove = useCallback(async (id: string) => {
    setError(null);
    try {
      const { error: err } = await supabase.from("meetings").delete().eq("id", id);
      if (err) throw err;
      await fetchMeetings();
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao remover reunião");
      return false;
    }
  }, [fetchMeetings]);

  const silentUpdate = useCallback(async (id: string, patch: Record<string, unknown>) => {
    try {
      const { error: err } = await supabase.from("meetings").update(patch).eq("id", id);
      if (!err) { await fetchMeetings(); return true; }
      const basePatch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (BASE_COLS.has(k)) basePatch[k] = v;
      }
      if (Object.keys(basePatch).length > 0) {
        await supabase.from("meetings").update(basePatch).eq("id", id);
      }
      await fetchMeetings();
      return true;
    } catch {
      return false;
    }
  }, [fetchMeetings]);

  /* ════════════════════════════════════════════
     RECALL.AI — START RECORDING
     ════════════════════════════════════════════ */
  const startRecording = useCallback(async (id: string) => {
    const meeting = meetings.find((m) => m.id === id);
    if (!meeting?.meet_link) {
      setError("Adicione um link de reunião antes de gravar.");
      return false;
    }

    const existingBot = recall.getBotId(id);
    if (existingBot) {
      setRecallPhase("recording");
      setRecallMessage("Bot já está na reunião");
      startBotPolling(id, existingBot);
      return true;
    }

    setRecallPhase("sending");
    setRecallMessage("Enviando bot para a reunião...");

    try {
      const bot = await recall.createBot(meeting.meet_link);
      recall.saveBotId(id, bot.id);

      silentUpdate(id, { status: "gravando", gravacao_inicio: new Date().toISOString() });

      setRecallPhase("waiting_room");
      setRecallMessage("Bot enviado! Entrando na reunião...");

      startBotPolling(id, bot.id);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao iniciar gravação";
      setError(msg);
      setRecallPhase("error");
      setRecallMessage(msg);
      return false;
    }
  }, [meetings, silentUpdate]);

  /* ════════════════════════════════════════════
     RECALL.AI — POLL BOT STATUS
     ════════════════════════════════════════════ */
  const startBotPolling = useCallback((meetingId: string, botId: string, keepRetries = false) => {
    stopPolling();
    if (!keepRetries) transcriptRetries.current = 0;

    pollingRef.current = setInterval(async () => {
      try {
        const bot = await recall.getBot(botId);
        const status = recall.getLatestStatus(bot);
        const msg = recall.getStatusMessage(bot);

        if (status === "in_waiting_room") {
          setRecallPhase("waiting_room");
          setRecallMessage(msg);
        } else if (status === "in_call_not_recording") {
          setRecallPhase("in_call");
          setRecallMessage(msg);
        } else if (status === "in_call_recording") {
          setRecallPhase("recording");
          setRecallMessage(msg);
        } else if (recall.isTranscriptReady(bot)) {
          stopPolling();
          setRecallPhase("processing");
          setRecallMessage("Buscando transcrição...");
          await processTranscript(meetingId, bot);
        } else if (recall.isBotDone(bot)) {
          setRecallPhase("processing");
          const tr = bot.recordings?.[0]?.media_shortcuts?.transcript;
          const trStatus = tr?.status?.code ?? "sem transcrição";
          setRecallMessage(`Processando transcrição... (status: ${trStatus})`);
        } else if (recall.isBotCallEnded(bot)) {
          setRecallPhase("processing");
          setRecallMessage("Reunião encerrada. Processando gravação...");
          silentUpdate(meetingId, { status: "processando", gravacao_fim: new Date().toISOString() });
        } else if (recall.isBotFatal(bot)) {
          stopPolling();
          setRecallPhase("error");
          setRecallMessage(msg);
          setError(msg);
          silentUpdate(meetingId, { status: "agendada" });
          recall.removeBotId(meetingId);
        }
      } catch {
        /* keep polling on transient errors */
      }
    }, 4000);
  }, [silentUpdate]);

  /* ════════════════════════════════════════════
     RECALL.AI — PROCESS TRANSCRIPT
     ════════════════════════════════════════════ */
  const processTranscript = useCallback(async (meetingId: string, bot: recall.RecallBot) => {
    try {
      const segments = await recall.getTranscript(bot);

      if (segments.length === 0 && transcriptRetries.current < 8) {
        transcriptRetries.current++;
        setRecallMessage(`Aguardando transcrição... (tentativa ${transcriptRetries.current}/8)`);
        setTimeout(() => startBotPolling(meetingId, bot.id, true), 5000);
        return;
      }

      const transcriptLines = recall.formatTranscript(segments);
      const fullText = transcriptLines.map((l) => `${l.speaker}: ${l.text}`).join("\n");

      const meeting = meetings.find((m) => m.id === meetingId);
      const resumo = generateSummary(fullText, meeting?.titulo ?? "");
      const acoes = extractActions(fullText);
      const durMin = meeting?.gravacao_inicio
        ? Math.round((Date.now() - new Date(meeting.gravacao_inicio).getTime()) / 60_000) || 1
        : 1;

      const { error: dbErr } = await supabase
        .from("meetings")
        .update({
          status: "transcrita",
          transcricao: transcriptLines as any,
          resumo,
          resumo_aprovado: false,
          acoes: acoes as any,
          duracao_min: durMin,
          gravacao_fim: new Date().toISOString(),
        })
        .eq("id", meetingId);

      if (dbErr) {
        console.warn("Erro ao salvar transcrição no DB (constraint?):", dbErr.message);
        await supabase.from("meetings").update({ duracao_min: durMin }).eq("id", meetingId);
      }

      recall.removeBotId(meetingId);
      setRecallPhase("done");
      setRecallMessage(transcriptLines.length > 0
        ? `Transcrição concluída! ${transcriptLines.length} falas capturadas.`
        : "Gravação finalizada (nenhuma fala detectada).");
      await fetchMeetings();

      setTimeout(() => {
        setRecallPhase("idle");
        setRecallMessage("");
      }, 4000);
    } catch (e: unknown) {
      if (transcriptRetries.current < 8) {
        transcriptRetries.current++;
        setRecallMessage(`Aguardando processamento... (tentativa ${transcriptRetries.current}/8)`);
        setTimeout(() => startBotPolling(meetingId, bot.id, true), 6000);
        return;
      }
      setRecallPhase("error");
      setRecallMessage("Erro ao processar transcrição. Verifique o console.");
      setError(e instanceof Error ? e.message : "Erro ao processar transcrição");
      recall.removeBotId(meetingId);
    }
  }, [meetings, fetchMeetings, startBotPolling]);

  /* ════════════════════════════════════════════
     RECALL.AI — STOP RECORDING
     ════════════════════════════════════════════ */
  const stopRecording = useCallback(async (id: string) => {
    const botId = recall.getBotId(id);
    if (!botId) {
      silentUpdate(id, { status: "processando", gravacao_fim: new Date().toISOString() });
      return true;
    }

    setRecallPhase("processing");
    setRecallMessage("Encerrando gravação...");

    try {
      await recall.leaveCall(botId);
      silentUpdate(id, { status: "processando", gravacao_fim: new Date().toISOString() });
      if (!pollingRef.current) {
        startBotPolling(id, botId);
      }
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao encerrar gravação");
      setRecallPhase("error");
      setRecallMessage("Erro ao encerrar");
      return false;
    }
  }, [silentUpdate, startBotPolling]);

  /* ── Resume polling on page load ── */
  useEffect(() => {
    if (meetings.length === 0) return;
    for (const m of meetings) {
      if (m.status === "gravando" || m.status === "processando") {
        const botId = recall.getBotId(m.id);
        if (botId && !pollingRef.current) {
          setRecallPhase(m.status === "gravando" ? "recording" : "processing");
          setRecallMessage(m.status === "gravando" ? "Gravando reunião..." : "Processando...");
          startBotPolling(m.id, botId);
          break;
        }
      }
    }
  }, [meetings, startBotPolling]);

  /* ── Remaining meeting operations ── */
  const approveResume = useCallback(async (id: string) => {
    const meeting = meetings.find((m) => m.id === id);
    if (!meeting) return false;
    const historico = [...(meeting.resumo_historico as any[] ?? []), {
      resumo: meeting.resumo, aprovado_em: new Date().toISOString(), aprovado_por: "Carlos Silva",
    }];
    return update(id, { resumo_aprovado: true, resumo_historico: historico } as any);
  }, [update, meetings]);

  const editResume = useCallback(async (id: string, newResume: string) => {
    const meeting = meetings.find((m) => m.id === id);
    if (!meeting) return false;
    const historico = [...(meeting.resumo_historico as any[] ?? []), {
      resumo: meeting.resumo, editado_em: new Date().toISOString(), editado_por: "Carlos Silva",
    }];
    return update(id, { resumo: newResume, resumo_aprovado: false, resumo_historico: historico } as any);
  }, [update, meetings]);

  const completeMeeting = useCallback(async (id: string) => update(id, { status: "concluida" } as any), [update]);

  const toggleAction = useCallback(async (meetingId: string, actionIdx: number) => {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return false;
    const acoes = [...meeting.acoes];
    if (acoes[actionIdx]) acoes[actionIdx] = { ...acoes[actionIdx], concluida: !acoes[actionIdx].concluida };
    return update(meetingId, { acoes } as any);
  }, [update, meetings]);

  const addAction = useCallback(async (meetingId: string, action: MeetingAction) => {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return false;
    return update(meetingId, { acoes: [...meeting.acoes, action] } as any);
  }, [update, meetings]);

  const updateMeetLink = useCallback(async (id: string, link: string) => update(id, { meet_link: link } as any), [update]);

  return {
    meetings, loading, error,
    recallPhase, recallMessage,
    refetch: fetchMeetings, create, update, remove,
    startRecording, stopRecording,
    approveResume, editResume, completeMeeting,
    toggleAction, addAction, updateMeetLink,
  };
}

/* ══════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════ */

function generateSummary(fullText: string, title: string): string {
  const lines = fullText.split("\n").filter(Boolean);
  const speakerSet = new Set<string>();
  for (const l of lines) {
    const match = l.match(/^(.+?):/);
    if (match) speakerSet.add(match[1].trim());
  }
  const speakers = Array.from(speakerSet);
  const wordCount = fullText.split(/\s+/).length;
  const durationEstimate = Math.ceil(wordCount / 150);
  const topicsRaw = lines
    .filter((_, i) => i % Math.max(1, Math.floor(lines.length / 5)) === 0)
    .map((l) => l.replace(/^.+?:\s*/, "").slice(0, 100))
    .slice(0, 5);

  return [
    `Reunião "${title}" com ${speakers.length} participante(s): ${speakers.join(", ")}.`,
    `Duração estimada: ~${durationEstimate} minutos. Total de ${lines.length} falas.`,
    topicsRaw.length > 0
      ? `Principais tópicos: ${topicsRaw.map((t) => `"${t.slice(0, 60)}..."`).join("; ")}.`
      : "",
    "Resumo gerado automaticamente pelo Certifica.",
  ].filter(Boolean).join(" ");
}

function extractActions(fullText: string): MeetingAction[] {
  const patterns = [
    /(?:precis(?:amos|a)|dev(?:emos|e)|necessário|importante|urgente)\s+(.{10,100})/gi,
    /(?:ação|tarefa|próximo passo|encaminhar|providenciar)\s*:?\s*(.{10,100})/gi,
    /(?:ficou combinado|ficou definido|ficou acordado)\s+(?:que\s+)?(.{10,100})/gi,
  ];
  const found: string[] = [];
  for (const pat of patterns) {
    let match;
    while ((match = pat.exec(fullText)) !== null) {
      if (match[1] && !found.includes(match[1].trim())) found.push(match[1].trim());
      if (found.length >= 8) break;
    }
  }
  if (found.length === 0) {
    return [
      { descricao: "Revisar pontos discutidos na reunião", responsavel: "A definir", prazo: new Date(Date.now() + 7 * 86400_000).toISOString().split("T")[0], concluida: false },
      { descricao: "Agendar próxima reunião de acompanhamento", responsavel: "A definir", prazo: new Date(Date.now() + 14 * 86400_000).toISOString().split("T")[0], concluida: false },
    ];
  }
  return found.map((desc) => ({
    descricao: desc, responsavel: "A definir",
    prazo: new Date(Date.now() + 7 * 86400_000).toISOString().split("T")[0], concluida: false,
  }));
}
