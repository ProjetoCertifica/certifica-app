/**
 * useGoogleCalendar — Integração Google Calendar via Google Calendar API
 *
 * Armazena os tokens OAuth no localStorage.
 *
 * Fluxo:
 *   1. connect() → chama /api/google/auth → obtém auth_url → abre popup
 *   2. Usuário autoriza no Google → Google redireciona para /api/google/callback
 *   3. Callback troca code por tokens → redireciona para /calendario?google_tokens=...
 *   4. CalendarioPage lê os tokens da URL e chama saveTokens()
 *   5. fetchMeetingsByRange() → chama /api/google/events com os tokens
 */

import { useState, useCallback, useEffect } from "react";

const LS_ACCESS = "google_access_token";
const LS_REFRESH = "google_refresh_token";
const LS_EXPIRY = "google_token_expiry";
const LS_CONNECTED = "google_calendar_connected";

export interface CalendarMeeting {
  id: string;
  start_time: string;
  end_time: string;
  title?: string;
  meeting_url?: string | null;
  bot_id?: string | null;
  status?: string | null;
  attendees?: { name?: string; email?: string }[];
}

export function useGoogleCalendar() {
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem(LS_ACCESS));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem(LS_REFRESH));
  const [connected, setConnected] = useState<boolean>(() => localStorage.getItem(LS_CONNECTED) === "true");
  const [connecting, setConnecting] = useState(false);
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verifica expiração ao montar
  useEffect(() => {
    const expiry = localStorage.getItem(LS_EXPIRY);
    if (expiry && Date.now() > Number(expiry) && !localStorage.getItem(LS_REFRESH)) {
      disconnect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = useCallback(() => {
    localStorage.removeItem(LS_ACCESS);
    localStorage.removeItem(LS_REFRESH);
    localStorage.removeItem(LS_EXPIRY);
    localStorage.removeItem(LS_CONNECTED);
    setAccessToken(null);
    setRefreshToken(null);
    setConnected(false);
    setMeetings([]);
  }, []);

  /** Salva tokens vindos do callback OAuth (/calendario?google_tokens=...) */
  const saveTokens = useCallback((payload: { access_token: string; refresh_token: string | null; expiry: number }) => {
    localStorage.setItem(LS_ACCESS, payload.access_token);
    localStorage.setItem(LS_EXPIRY, String(payload.expiry));
    localStorage.setItem(LS_CONNECTED, "true");
    if (payload.refresh_token) localStorage.setItem(LS_REFRESH, payload.refresh_token);
    setAccessToken(payload.access_token);
    if (payload.refresh_token) setRefreshToken(payload.refresh_token);
    setConnected(true);
  }, []);

  /** Abre popup OAuth do Google */
  const connect = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/google/auth");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? `Erro ${res.status}`);
      }
      const { auth_url } = await res.json();
      if (!auth_url) throw new Error("URL de autenticação não retornada.");
      // Redireciona na mesma aba — o callback vai trazer de volta para /calendario
      window.location.href = auth_url;
    } catch (err: any) {
      setError(err?.message ?? "Erro ao iniciar conexão com Google Calendar");
      setConnecting(false);
    }
  }, []);

  /** Busca eventos em um intervalo de datas */
  const fetchMeetingsByRange = useCallback(
    async (start: Date, end: Date) => {
      if (!accessToken && !refreshToken) return;
      setMeetingsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/google/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: accessToken,
            refresh_token: refreshToken,
            from: start.toISOString(),
            to: end.toISOString(),
          }),
        });

        if (res.status === 401) {
          disconnect();
          setError("Sessão expirada. Reconecte o Google Calendar.");
          return;
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error ?? `Erro ${res.status}`);
        }

        const data = await res.json();

        // Se o servidor renovou os tokens, salva
        if (data.new_tokens) {
          saveTokens(data.new_tokens);
        }

        setMeetings(data.meetings ?? []);
      } catch (err: any) {
        setError(err?.message ?? "Erro ao buscar eventos do calendário");
      } finally {
        setMeetingsLoading(false);
      }
    },
    [accessToken, refreshToken, disconnect, saveTokens]
  );

  /** Compat: fetchMeetings(days) — busca a partir de hoje */
  const fetchMeetings = useCallback(
    (days = 7) => {
      const start = new Date();
      const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      return fetchMeetingsByRange(start, end);
    },
    [fetchMeetingsByRange]
  );

  return {
    token: accessToken, // compat
    connected,
    connecting,
    meetings,
    meetingsLoading,
    error,
    connect,
    disconnect,
    saveTokens,
    fetchMeetings,
    fetchMeetingsByRange,
  };
}
