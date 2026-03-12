/**
 * useSmartNotifications
 *
 * Gera notificações inteligentes a partir dos dados reais da plataforma.
 * Combina notificações do Supabase com alertas derivados de:
 * - Reuniões do Google Calendar nas próximas 2 horas
 * - NCs abertas com prazo crítico
 * - Auditorias agendadas para os próximos dias
 * - Projetos com entregáveis atrasados
 *
 * "Marcar como lida" persiste em localStorage.
 * Notificações somem automaticamente após 30 minutos (TTL).
 */

import { useMemo, useState, useCallback, useEffect } from "react";
import type { Notification } from "./database.types";
import type { CalendarMeeting } from "./useGoogleCalendar";
import { useAudits } from "./useAudits";
import { useProjetos } from "./useProjetos";

const LS_DISMISSED  = "dismissed_smart_notifs";   // { [id]: dismissedAt (ms) }
const LS_FIRST_SEEN = "first_seen_smart_notifs";   // { [id]: firstSeenAt (ms) }
const TTL_MS        = 30 * 60 * 1000;             // 30 min
const CLEANUP_MS    = 24 * 60 * 60 * 1000;        // 24 h

function getStore(key: string): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(key) ?? "{}"); } catch { return {}; }
}
function setStore(key: string, value: Record<string, number>) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

function makeId(prefix: string, suffix: string): string {
  return `smart:${prefix}:${suffix}`;
}

function daysFromNow(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  try { return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000); }
  catch { return null; }
}

function hoursFromNow(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  try { return (new Date(dateStr).getTime() - Date.now()) / 3_600_000; }
  catch { return null; }
}

export function useSmartNotifications(
  supabaseNotifications: Notification[],
  meetings: CalendarMeeting[] = []
): {
  notifications: Notification[];
  markSmartRead: (id: string) => void;
  markAllSmartRead: (ids: string[]) => void;
} {
  const { audits }   = useAudits();
  const { projetos } = useProjetos();
  const [tick, setTick] = useState(0); // forces re-render after dismiss

  /** Mark one smart notification as read */
  const markSmartRead = useCallback((id: string) => {
    const dismissed = getStore(LS_DISMISSED);
    dismissed[id] = Date.now();
    setStore(LS_DISMISSED, dismissed);
    setTick((t) => t + 1);
  }, []);

  /** Mark multiple smart notifications as read */
  const markAllSmartRead = useCallback((ids: string[]) => {
    const dismissed = getStore(LS_DISMISSED);
    const now = Date.now();
    for (const id of ids) dismissed[id] = now;
    setStore(LS_DISMISSED, dismissed);
    setTick((t) => t + 1);
  }, []);

  /** Build smart notification list */
  const smartNotifications = useMemo<Notification[]>(() => {
    const now       = Date.now();
    const dismissed = getStore(LS_DISMISSED);
    const firstSeen = getStore(LS_FIRST_SEEN);
    const nowIso    = new Date(now).toISOString();
    const items: Notification[] = [];

    // Returns true if the notification should be shown (not dismissed, not expired)
    const visible = (id: string): boolean => {
      if (dismissed[id]) return false;                            // explicitly dismissed
      const seen = firstSeen[id];
      if (seen && now - seen > TTL_MS) return false;             // auto-expired after 30 min
      return true;
    };

    // ── Reuniões do Google Calendar nas próximas 2 horas ─────────────────
    const upcomingMeetings = meetings.filter((m) => {
      const h = hoursFromNow(m.start_time);
      return h !== null && h >= 0 && h <= 2;
    });
    for (const m of upcomingMeetings.slice(0, 3)) {
      const id = makeId("meeting", m.id);
      if (!visible(id)) continue;
      const h = hoursFromNow(m.start_time)!;
      const label = h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)}h`;
      items.push({
        id,
        user_id: null,
        titulo: `Reunião em ${label}`,
        mensagem: (m.title ?? "Reunião") + (m.meeting_url ? " · Link disponível" : ""),
        tipo: h < 0.5 ? "urgente" : "alerta",
        lida: false,
        link: "/calendario",
        created_at: nowIso,
      });
    }

    // ── Auditorias próximas (próximos 7 dias) ─────────────────────────────
    const upcomingAudits = audits.filter((a) => {
      if (a.status !== "planejada") return false;
      const days = daysFromNow(a.data_inicio);
      return days !== null && days >= 0 && days <= 7;
    });
    for (const audit of upcomingAudits.slice(0, 3)) {
      const id = makeId("audit", audit.id);
      if (!visible(id)) continue;
      const days = daysFromNow(audit.data_inicio)!;
      items.push({
        id,
        user_id: null,
        titulo: `Auditoria em ${days === 0 ? "hoje" : `${days} dia(s)`}`,
        mensagem: `${audit.norma} · ${audit.cliente_nome ?? audit.escopo ?? "Cliente"} — ${audit.auditor}`,
        tipo: days <= 2 ? "urgente" : "alerta",
        lida: false,
        link: "/auditorias",
        created_at: nowIso,
      });
    }

    // ── NCs abertas com prazo crítico (< 3 dias) ──────────────────────────
    const criticalNCs = audits
      .flatMap((a) => a.findings.map((f) => ({ ...f })))
      .filter((f) => {
        if (f.tipo !== "nc-maior" && f.tipo !== "nc-menor") return false;
        if (f.status !== "aberta") return false;
        const days = daysFromNow(f.prazo);
        return days !== null && days < 3;
      });
    if (criticalNCs.length > 0) {
      const id = makeId("ncs", String(criticalNCs.length));
      if (visible(id)) {
        items.push({
          id,
          user_id: null,
          titulo: `${criticalNCs.length} NC(s) com prazo crítico`,
          mensagem: `Não conformidades com prazo vencido ou < 3 dias. Acesse Auditorias.`,
          tipo: "urgente",
          lida: false,
          link: "/auditorias",
          created_at: nowIso,
        });
      }
    }

    // ── Projetos atrasados ────────────────────────────────────────────────
    const atrasados = projetos.filter((p) => {
      if (p.status !== "em-andamento") return false;
      const days = daysFromNow(p.data_fim);
      return days !== null && days < 0;
    });
    if (atrasados.length > 0) {
      const id = makeId("projetos-atrasados", String(atrasados.length));
      if (visible(id)) {
        items.push({
          id,
          user_id: null,
          titulo: `${atrasados.length} projeto(s) atrasado(s)`,
          mensagem:
            atrasados.slice(0, 2).map((p) => p.titulo ?? p.codigo).join(", ") +
            (atrasados.length > 2 ? ` e mais ${atrasados.length - 2}` : ""),
          tipo: "alerta",
          lida: false,
          link: "/projetos",
          created_at: nowIso,
        });
      }
    }

    // ── Projetos próximos do prazo (7 dias) ───────────────────────────────
    const projetosProximos = projetos.filter((p) => {
      if (p.status !== "em-andamento") return false;
      const days = daysFromNow(p.data_fim);
      return days !== null && days >= 0 && days <= 7;
    });
    if (projetosProximos.length > 0) {
      const id = makeId("projetos-proximos", String(projetosProximos.length));
      if (visible(id)) {
        items.push({
          id,
          user_id: null,
          titulo: `${projetosProximos.length} projeto(s) vencem em breve`,
          mensagem: projetosProximos
            .slice(0, 2)
            .map((p) => `${p.titulo ?? p.codigo} (${daysFromNow(p.data_fim)}d)`)
            .join(", "),
          tipo: "info",
          lida: false,
          link: "/projetos",
          created_at: nowIso,
        });
      }
    }

    // Deduplicate: remove smart items already in Supabase
    const supabaseIds = new Set(supabaseNotifications.map((n) => n.id));
    return items.filter((n) => !supabaseIds.has(n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audits, projetos, supabaseNotifications, meetings, tick, Math.floor(Date.now() / 60_000)]);

  // Record firstSeen for newly visible items (clean side effect after render)
  useEffect(() => {
    if (smartNotifications.length === 0) return;
    const firstSeen = getStore(LS_FIRST_SEEN);
    let changed = false;
    for (const n of smartNotifications) {
      if (!firstSeen[n.id]) {
        firstSeen[n.id] = Date.now();
        changed = true;
      }
    }
    if (changed) setStore(LS_FIRST_SEEN, firstSeen);
  }, [smartNotifications]);

  // Cleanup stale entries on mount (older than 24h can reappear next day)
  useEffect(() => {
    const cutoff = Date.now() - CLEANUP_MS;
    const firstSeen  = getStore(LS_FIRST_SEEN);
    const dismissed  = getStore(LS_DISMISSED);
    setStore(LS_FIRST_SEEN, Object.fromEntries(Object.entries(firstSeen).filter(([, t]) => t > cutoff)));
    setStore(LS_DISMISSED,  Object.fromEntries(Object.entries(dismissed).filter(([, t]) => t > cutoff)));
  }, []);

  const notifications = useMemo(
    () => [...smartNotifications, ...supabaseNotifications],
    [smartNotifications, supabaseNotifications]
  );

  return { notifications, markSmartRead, markAllSmartRead };
}
