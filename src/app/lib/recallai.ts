// Em produção (Vercel) as chamadas vão para /api/recall-api/[...path]
// que faz proxy seguro para https://us-west-2.recall.ai/api/v1
// O token fica no servidor — nunca exposto no bundle do cliente.
const BASE = "/api/recall-api";

interface TranscriptArtifact {
  id: string;
  status: { code: string };
  data: {
    download_url: string | null;
  };
}

interface RecordingMediaShortcuts {
  transcript: TranscriptArtifact | null;
  video_mixed: { data: { download_url: string } } | null;
}

interface Recording {
  id: string;
  status: { code: string };
  media_shortcuts: RecordingMediaShortcuts;
}

export interface RecallBot {
  id: string;
  meeting_url: unknown;
  bot_name: string;
  status_changes: { code: string; message: string | null; sub_code: string | null; created_at: string }[];
  recordings: Recording[];
}

export interface TranscriptEntry {
  participant: {
    id: number;
    name: string;
    is_host: boolean;
    platform: string;
  };
  words: {
    text: string;
    start_timestamp: { relative: number; absolute: string };
    end_timestamp: { relative: number; absolute: string };
  }[];
}

export type BotStatus =
  | "ready"
  | "joining_call"
  | "in_waiting_room"
  | "in_call_not_recording"
  | "in_call_recording"
  | "recording_done"
  | "call_ended"
  | "done"
  | "fatal"
  | "analysis_done";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Erro na gravação (${res.status}): ${body}`);
  }
  return res.json();
}

export async function createBot(meetingUrl: string): Promise<RecallBot> {
  return request<RecallBot>("/bot", {
    method: "POST",
    body: JSON.stringify({
      meeting_url: meetingUrl,
      bot_name: "Certifica Bot",
      recording_config: {
        transcript: {
          provider: {
            recallai_streaming: {
              language_code: "pt",
            },
          },
        },
      },
      automatic_leave: {
        waiting_room_timeout: 600,
        noone_joined_timeout: 600,
        everyone_left_timeout: { timeout: 3 },
      },
    }),
  });
}

export async function getBot(botId: string): Promise<RecallBot> {
  return request<RecallBot>(`/bot/${botId}/`);
}

export async function getTranscript(bot: RecallBot): Promise<TranscriptEntry[]> {
  const transcript = bot.recordings?.[0]?.media_shortcuts?.transcript;
  if (!transcript) return [];
  if (transcript.status.code !== "done") return [];
  if (!transcript.data?.download_url) return [];

  const res = await fetch(transcript.data.download_url);
  if (!res.ok) throw new Error(`Erro ao baixar transcrição: ${res.status}`);
  return res.json();
}

export async function leaveCall(botId: string): Promise<void> {
  await request(`/bot/${botId}/leave_call/`, { method: "POST" });
}

export function getLatestStatus(bot: RecallBot): BotStatus {
  if (!bot.status_changes?.length) return "ready";
  return bot.status_changes[bot.status_changes.length - 1].code as BotStatus;
}

export function getStatusMessage(bot: RecallBot): string {
  const s = getLatestStatus(bot);
  switch (s) {
    case "ready": return "Preparando bot...";
    case "joining_call": return "Entrando na reunião...";
    case "in_waiting_room": return "Na sala de espera...";
    case "in_call_not_recording": return "Na call, aguardando permissão...";
    case "in_call_recording": return "Gravando reunião...";
    case "recording_done":
    case "call_ended": return "Call encerrada, processando gravação...";
    case "done":
    case "analysis_done": return "Transcrição pronta!";
    case "fatal": {
      const last = bot.status_changes[bot.status_changes.length - 1];
      return last.message || "Erro fatal no bot";
    }
    default: return `Status: ${s}`;
  }
}

export function isBotInCall(bot: RecallBot): boolean {
  const s = getLatestStatus(bot);
  return s === "in_call_not_recording" || s === "in_call_recording" || s === "in_waiting_room";
}

export function isBotRecording(bot: RecallBot): boolean {
  return getLatestStatus(bot) === "in_call_recording";
}

export function isTranscriptReady(bot: RecallBot): boolean {
  const s = getLatestStatus(bot);
  if (s !== "done" && s !== "analysis_done") return false;
  const transcript = bot.recordings?.[0]?.media_shortcuts?.transcript;
  return transcript?.status?.code === "done" && !!transcript?.data?.download_url;
}

export function isBotCallEnded(bot: RecallBot): boolean {
  const s = getLatestStatus(bot);
  return s === "call_ended" || s === "recording_done";
}

export function isBotDone(bot: RecallBot): boolean {
  const s = getLatestStatus(bot);
  return s === "done" || s === "analysis_done";
}

export function isBotFatal(bot: RecallBot): boolean {
  return getLatestStatus(bot) === "fatal";
}

export function formatTranscript(
  segments: TranscriptEntry[]
): { time: string; speaker: string; text: string }[] {
  return segments.map((seg) => {
    const startSec = seg.words[0]?.start_timestamp?.relative ?? 0;
    const mins = Math.floor(startSec / 60);
    const secs = Math.floor(startSec % 60);
    const time = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    const text = seg.words.map((w) => w.text).join(" ");
    const speaker = seg.participant?.name || `Participante ${seg.participant?.id ?? ""}`;
    return { time, speaker, text };
  });
}

const BOT_MAP_KEY = "certifica_recall_bots";

export function saveBotId(meetingId: string, botId: string) {
  try {
    const map = JSON.parse(localStorage.getItem(BOT_MAP_KEY) || "{}");
    map[meetingId] = botId;
    localStorage.setItem(BOT_MAP_KEY, JSON.stringify(map));
  } catch { /* silent */ }
}

export function getBotId(meetingId: string): string | null {
  try {
    const map = JSON.parse(localStorage.getItem(BOT_MAP_KEY) || "{}");
    return map[meetingId] || null;
  } catch {
    return null;
  }
}

export function removeBotId(meetingId: string) {
  try {
    const map = JSON.parse(localStorage.getItem(BOT_MAP_KEY) || "{}");
    delete map[meetingId];
    localStorage.setItem(BOT_MAP_KEY, JSON.stringify(map));
  } catch { /* silent */ }
}
