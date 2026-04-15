import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Video,
  Users,
  ExternalLink,
  RefreshCw,
  X,
  CheckCircle2,
  Bot,
  AlertTriangle,
  Briefcase,
  ClipboardCheck,
  GraduationCap,
  Filter,
} from "lucide-react";
import { useGoogleCalendar, type CalendarMeeting } from "../lib/useGoogleCalendar";
import { supabase } from "../lib/supabase";
import { DSButton } from "../components/ds/DSButton";
import { DSBadge } from "../components/ds/DSBadge";

/* ── Types for consolidated agenda ── */
interface ConsultorEvent {
  id: string;
  tipo: "projeto" | "auditoria" | "treinamento";
  titulo: string;
  cliente: string;
  consultor: string;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
}

/* ── Calendar helpers ── */
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function durationMin(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);
}

/* ── Main component ── */
export default function CalendarioPage() {
  const navigate = useNavigate();
  const cal = useGoogleCalendar();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selected, setSelected] = useState<CalendarMeeting | null>(null);
  const [schedulingBot, setSchedulingBot] = useState(false);
  // Track locally-scheduled bot IDs so UI updates immediately without re-fetch
  const [localBots, setLocalBots] = useState<Set<string>>(new Set());

  /* ── Consolidated consultant agenda ── */
  const [agendaMode, setAgendaMode] = useState<"calendario" | "consultores">("calendario");
  const [consultorEvents, setConsultorEvents] = useState<ConsultorEvent[]>([]);
  const [consultorFilter, setConsultorFilter] = useState("todos");
  const [agendaLoading, setAgendaLoading] = useState(false);

  const fetchConsultorAgenda = useCallback(async () => {
    setAgendaLoading(true);
    try {
      const [projRes, auditRes, trainRes] = await Promise.allSettled([
        supabase.from("projetos").select("id, titulo, consultor, equipe, inicio, previsao, status, clientes(nome_fantasia)").in("status", ["em-andamento", "proposta"]),
        supabase.from("audits").select("id, codigo, auditor, data_inicio, data_fim, status, norma, clientes(nome_fantasia)").in("status", ["planejada", "em-andamento"]),
        supabase.from("trainings").select("id, titulo, instrutor, data_inicio, status").in("status", ["agendado", "em-andamento"]),
      ]);

      const events: ConsultorEvent[] = [];

      if (projRes.status === "fulfilled" && projRes.value.data) {
        for (const p of projRes.value.data as any[]) {
          events.push({
            id: p.id,
            tipo: "projeto",
            titulo: p.titulo,
            cliente: p.clientes?.nome_fantasia ?? "—",
            consultor: p.consultor,
            data_inicio: p.inicio,
            data_fim: p.previsao,
            status: p.status,
          });
          // Also add team members as separate entries
          if (Array.isArray(p.equipe)) {
            for (const member of p.equipe) {
              if (member && member !== p.consultor) {
                events.push({
                  id: `${p.id}-${member}`,
                  tipo: "projeto",
                  titulo: p.titulo,
                  cliente: p.clientes?.nome_fantasia ?? "—",
                  consultor: member,
                  data_inicio: p.inicio,
                  data_fim: p.previsao,
                  status: p.status,
                });
              }
            }
          }
        }
      }

      if (auditRes.status === "fulfilled" && auditRes.value.data) {
        for (const a of auditRes.value.data as any[]) {
          events.push({
            id: a.id,
            tipo: "auditoria",
            titulo: `${a.codigo} — ${a.norma}`,
            cliente: a.clientes?.nome_fantasia ?? "—",
            consultor: a.auditor,
            data_inicio: a.data_inicio,
            data_fim: a.data_fim,
            status: a.status,
          });
        }
      }

      if (trainRes.status === "fulfilled" && trainRes.value.data) {
        for (const t of trainRes.value.data as any[]) {
          events.push({
            id: t.id,
            tipo: "treinamento",
            titulo: t.titulo,
            cliente: "—",
            consultor: t.instrutor,
            data_inicio: t.data_inicio,
            data_fim: null,
            status: t.status,
          });
        }
      }

      setConsultorEvents(events);
    } catch {
      toast.error("Erro ao carregar agenda dos consultores");
    } finally {
      setAgendaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (agendaMode === "consultores") fetchConsultorAgenda();
  }, [agendaMode, fetchConsultorAgenda]);

  const allConsultores = useMemo(() => {
    const set = new Set(consultorEvents.map((e) => e.consultor).filter(Boolean));
    return ["todos", ...Array.from(set).sort()];
  }, [consultorEvents]);

  const filteredEvents = useMemo(() => {
    if (consultorFilter === "todos") return consultorEvents;
    return consultorEvents.filter((e) => e.consultor === consultorFilter);
  }, [consultorEvents, consultorFilter]);

  const eventsByConsultor = useMemo(() => {
    const map = new Map<string, ConsultorEvent[]>();
    for (const e of filteredEvents) {
      const key = e.consultor || "Sem consultor";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredEvents]);

  // Lê tokens do URL após callback OAuth (/calendario?google_tokens=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("google_tokens");
    const oauthError = params.get("google_error");

    if (encoded) {
      try {
        const payload = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")));
        cal.saveTokens(payload);
        toast.success("Google Calendar conectado!");
      } catch {
        toast.error("Erro ao processar autenticação do Google.");
      }
      // Limpa os params da URL
      window.history.replaceState({}, "", "/calendario");
    } else if (oauthError) {
      toast.error(`Erro ao conectar Google Calendar: ${oauthError}`);
      window.history.replaceState({}, "", "/calendario");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchForMonth = useCallback(() => {
    const start = new Date(year, month, 1, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    cal.fetchMeetingsByRange(start, end);
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cal.connected) fetchForMonth();
  }, [cal.connected, year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevMonth = () => {
    setSelected(null);
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    setSelected(null);
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const goToToday = () => {
    setSelected(null);
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  /* ── Schedule bot ── */
  const scheduleBot = async (meeting: CalendarMeeting) => {
    if (!meeting.meeting_url) return;
    setSchedulingBot(true);
    try {
      const startMs = new Date(meeting.start_time).getTime();
      const dequeueAt = new Date(startMs - 2 * 60 * 1000).toISOString();
      const durMin = durationMin(meeting.start_time, meeting.end_time);

      // 1. Schedule Recall.ai bot with dequeue_at
      const botRes = await fetch("/api/recall-api/bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_url: meeting.meeting_url,
          bot_name: "Certifica Bot",
          dequeue_at: dequeueAt,
          recording_config: {
            transcript: {
              provider: { recallai_streaming: { language_code: "pt" } },
            },
          },
          automatic_leave: {
            waiting_room_timeout: 600,
            noone_joined_timeout: 600,
            everyone_left_timeout: { timeout: 3 },
          },
        }),
      });

      if (!botRes.ok) {
        const err = await botRes.json().catch(() => ({}));
        throw new Error(err?.detail ?? err?.message ?? `Erro ${botRes.status} ao agendar bot`);
      }

      const bot = await botRes.json();

      // 2. Create meeting record in Supabase
      const participantes = (meeting.attendees ?? [])
        .map((a) => a.email ?? a.name ?? "")
        .filter(Boolean);

      await supabase.from("meetings").insert({
        titulo: meeting.title ?? "Reunião do Google Calendar",
        tipo: "externa",
        data: meeting.start_time,
        duracao_min: durMin,
        participantes,
        meet_link: meeting.meeting_url,
        status: "agendada",
        local: "",
        pauta: "",
        ata: "",
        meet_link_bot_id: bot.id ?? null,
        resumo: "",
        resumo_aprovado: false,
        resumo_historico: [],
        transcricao: [],
        acoes: [],
        gravacao_url: "",
        gravacao_inicio: null,
        gravacao_fim: null,
      } as any);

      setLocalBots(prev => new Set([...prev, meeting.id]));

      toast.success("Bot agendado com sucesso!", {
        description: `Entrará na reunião 2 min antes de ${formatTime(meeting.start_time)}`,
        action: { label: "Ver Reuniões", onClick: () => navigate("/reunioes") },
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao agendar bot");
    } finally {
      setSchedulingBot(false);
    }
  };

  const isBotScheduled = (m: CalendarMeeting) => !!m.bot_id || localBots.has(m.id);

  /* ── Build calendar grid ── */
  const firstDay = getFirstDayOfMonth(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const prevDays = getDaysInMonth(year, month === 0 ? 11 : month - 1);

  interface Cell { day: number; isCurrentMonth: boolean; date: Date }
  const cells: Cell[] = [];

  // Prev month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDays - i;
    cells.push({ day: d, isCurrentMonth: false, date: new Date(year, month - 1, d) });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) });
  }
  // Next month padding
  const trailing = 7 - (cells.length % 7);
  if (trailing < 7) {
    for (let d = 1; d <= trailing; d++) {
      cells.push({ day: d, isCurrentMonth: false, date: new Date(year, month + 1, d) });
    }
  }

  // Group meetings by date
  const byDate = new Map<string, CalendarMeeting[]>();
  for (const m of cal.meetings) {
    const key = new Date(m.start_time).toDateString();
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(m);
  }

  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  /* ── Consultores agenda view ── */
  if (agendaMode === "consultores") {
    return (
      <div className="flex flex-col h-full p-6">
        {/* Tabs */}
        <div className="flex items-center gap-4 mb-5 flex-shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => setAgendaMode("calendario")} className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 transition-colors">
              Calendário
            </button>
            <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-white text-certifica-700 shadow-sm">
              Agenda Consultores
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={consultorFilter}
              onChange={(e) => setConsultorFilter(e.target.value)}
              className="h-8 px-2 border border-slate-200 rounded-lg text-xs"
            >
              {allConsultores.map((c) => (
                <option key={c} value={c}>{c === "todos" ? "Todos consultores" : c}</option>
              ))}
            </select>
            <button
              onClick={fetchConsultorAgenda}
              disabled={agendaLoading}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${agendaLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Consultores grid */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {agendaLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-5 h-5 animate-spin text-slate-400 mr-2" />
              <span className="text-sm text-slate-400">Carregando agenda...</span>
            </div>
          ) : eventsByConsultor.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">Nenhuma atividade encontrada</div>
          ) : (
            eventsByConsultor.map(([consultor, events]) => (
              <div key={consultor} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-certifica-600 flex items-center justify-center text-white text-[10px] font-bold">
                      {consultor.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{consultor}</span>
                  </div>
                  <span className="text-xs text-slate-400">{events.length} atividade{events.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="divide-y divide-slate-100">
                  {events.map((evt) => (
                    <div key={evt.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {evt.tipo === "projeto" && <Briefcase className="w-4 h-4 text-certifica-600" />}
                        {evt.tipo === "auditoria" && <ClipboardCheck className="w-4 h-4 text-amber-600" />}
                        {evt.tipo === "treinamento" && <GraduationCap className="w-4 h-4 text-purple-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-slate-800 truncate">{evt.titulo}</div>
                        <div className="text-[10px] text-slate-400">
                          {evt.cliente !== "—" ? `${evt.cliente} · ` : ""}
                          {evt.data_inicio ? new Date(evt.data_inicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "Sem data"}
                          {evt.data_fim ? ` → ${new Date(evt.data_fim).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}` : ""}
                        </div>
                      </div>
                      <DSBadge variant={evt.status === "em-andamento" ? "oportunidade" : "outline"}>{evt.status}</DSBadge>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  /* ── Not connected ── */
  if (!cal.connected) {
    return (
      <div className="flex-1 flex flex-col items-center p-8">
        {/* Tab to switch to consultant agenda */}
        <div className="w-full max-w-sm mb-6 flex justify-center">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-white text-certifica-700 shadow-sm">
              Calendário
            </button>
            <button onClick={() => setAgendaMode("consultores")} className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 transition-colors">
              Agenda Consultores
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-2xl bg-certifica-50 border border-certifica-100 flex items-center justify-center mx-auto mb-6">
            <CalendarDays className="w-10 h-10 text-certifica-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Integre seu Google Calendar</h1>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            Veja todas as suas reuniões, entre com um clique e grave automaticamente com o bot Recall.ai.
          </p>

          <div className="space-y-3 text-left bg-slate-50 rounded-xl p-4 mb-8 border border-slate-100">
            {[
              "Conecte sua conta Google e autorize o acesso ao Calendar",
              "Visualize todos os eventos no calendário integrado",
              "O bot entra 2 min antes e grava a reunião automaticamente",
            ].map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-5 h-5 rounded-full bg-certifica-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-certifica-700">{i + 1}</span>
                </div>
                <p className="text-sm text-slate-600">{step}</p>
              </div>
            ))}
          </div>

          {cal.error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 mb-4 text-left">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{cal.error}</p>
            </div>
          )}

          <DSButton variant="primary" loading={cal.connecting} onClick={cal.connect}>
            <CalendarDays className="w-4 h-4 mr-2" />
            Conectar Google Calendar
          </DSButton>
        </div>
        </div>
      </div>
    );
  }

  /* ── Connected: full calendar ── */
  return (
    <div className="flex h-full min-h-0 certifica-page-enter">
      {/* ── Calendar panel ── */}
      <div className="flex-1 flex flex-col min-w-0 p-6 overflow-hidden">
        {/* Tabs + Month navigation header */}
        <div className="flex items-center justify-between mb-5 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
              <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-white text-certifica-700 shadow-sm">
                Calendário
              </button>
              <button onClick={() => setAgendaMode("consultores")} className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 transition-colors">
                Agenda Consultores
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-slate-900 min-w-[180px] text-center">
                {MONTH_NAMES[month]} {year}
              </h2>
              <button
                onClick={nextMonth}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Hoje
            </button>
            <button
              onClick={fetchForMonth}
              disabled={cal.meetingsLoading}
              title="Atualizar"
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${cal.meetingsLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={cal.disconnect}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              Desconectar
            </button>
          </div>
        </div>

        {/* Error banner */}
        {cal.error && (
          <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-amber-50 border border-amber-200 flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">{cal.error}</p>
          </div>
        )}

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1 flex-shrink-0">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-slate-400 py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 grid grid-cols-7 auto-rows-fr gap-px bg-slate-200 rounded-xl overflow-hidden border border-slate-200 min-h-0">
          {cells.map((cell, i) => {
            const dayMeetings = byDate.get(cell.date.toDateString()) ?? [];
            const today_ = isToday(cell.date);
            return (
              <div
                key={i}
                className={[
                  "flex flex-col p-1.5 gap-0.5 overflow-hidden",
                  cell.isCurrentMonth ? "bg-white" : "bg-slate-50",
                  today_ ? "bg-certifica-50!" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ml-auto flex-shrink-0",
                    today_
                      ? "bg-certifica-600 text-white"
                      : cell.isCurrentMonth
                      ? "text-slate-700"
                      : "text-slate-300",
                  ].join(" ")}
                >
                  {cell.day}
                </span>

                {dayMeetings.slice(0, 3).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelected(m)}
                    title={`${formatTime(m.start_time)} — ${m.title}`}
                    className={[
                      "w-full text-left text-[10px] font-medium px-1.5 py-0.5 rounded truncate border transition-all hover:opacity-80",
                      isBotScheduled(m)
                        ? "bg-green-50 text-green-700 border-green-200"
                        : m.meeting_url
                        ? "bg-certifica-50 text-certifica-700 border-certifica-200"
                        : "bg-slate-100 text-slate-600 border-slate-200",
                      selected?.id === m.id ? "ring-1 ring-offset-1 ring-certifica-400" : "",
                    ].join(" ")}
                  >
                    {formatTime(m.start_time)} {m.title}
                  </button>
                ))}

                {dayMeetings.length > 3 && (
                  <span className="text-[10px] text-slate-400 pl-1">
                    +{dayMeetings.length - 3} mais
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-certifica-100 border border-certifica-200" />
            <span className="text-[11px] text-slate-400">Com link de reunião</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-green-50 border border-green-200" />
            <span className="text-[11px] text-slate-400">Bot agendado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-2 rounded-sm bg-slate-100 border border-slate-200" />
            <span className="text-[11px] text-slate-400">Sem link</span>
          </div>
        </div>
      </div>

      {/* ── Detail panel ── */}
      <div className="w-80 flex-shrink-0 border-l border-slate-200 flex flex-col bg-white">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <CalendarDays className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">
              Clique em um evento para ver os detalhes e agendar gravação
            </p>
            {cal.meetingsLoading && (
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Carregando eventos…
              </div>
            )}
            {cal.meetings.length > 0 && !cal.meetingsLoading && (
              <p className="mt-4 text-xs text-certifica-600 font-medium">
                {cal.meetings.length} evento{cal.meetings.length !== 1 ? "s" : ""} neste mês
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Event title header */}
            <div className="p-5 border-b border-slate-100">
              <div className="flex items-start justify-between mb-1.5">
                <h3 className="font-semibold text-slate-900 flex-1 pr-3 leading-snug text-sm">
                  {selected.title}
                </h3>
                <button
                  onClick={() => setSelected(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 flex-shrink-0 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-500 capitalize">{formatDateLong(selected.start_time)}</p>
              <p className="text-sm font-semibold text-certifica-600 mt-0.5">
                {formatTime(selected.start_time)} – {formatTime(selected.end_time)}
                <span className="text-xs font-normal text-slate-400 ml-2">
                  ({durationMin(selected.start_time, selected.end_time)} min)
                </span>
              </p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Attendees */}
              {(selected.attendees ?? []).length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Participantes
                  </p>
                  <div className="space-y-1">
                    {(selected.attendees ?? []).map((a, i) => (
                      <p key={i} className="text-xs text-slate-700 truncate">
                        {a.name ? (
                          <>
                            <span className="font-medium">{a.name}</span>
                            {a.email && <span className="text-slate-400 ml-1">· {a.email}</span>}
                          </>
                        ) : (
                          a.email ?? "—"
                        )}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Bot status badge */}
              {isBotScheduled(selected) && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-green-50 border border-green-200">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Bot agendado</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      Entrará 2 min antes · A reunião será gravada automaticamente
                    </p>
                  </div>
                </div>
              )}

              {/* No URL warning */}
              {!selected.meeting_url && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs text-amber-700">
                    Este evento não tem link de videoconferência (Google Meet, Zoom, etc.).
                    O bot não pode ser agendado.
                  </p>
                </div>
              )}

              {/* Meeting URL preview */}
              {selected.meeting_url && (
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5" />
                    Link da reunião
                  </p>
                  <p className="text-xs text-slate-500 truncate font-mono bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100">
                    {selected.meeting_url}
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-100 space-y-2 flex-shrink-0">
              {selected.meeting_url && (
                <a
                  href={selected.meeting_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-sm font-medium transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Entrar na Reunião
                </a>
              )}

              <DSButton
                variant="primary"
                className="w-full"
                disabled={!selected.meeting_url || isBotScheduled(selected)}
                loading={schedulingBot}
                onClick={() => scheduleBot(selected)}
              >
                {isBotScheduled(selected) ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Bot Agendado
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4 mr-2" />
                    Gravar com Bot
                  </>
                )}
              </DSButton>

              {!isBotScheduled(selected) && selected.meeting_url && (
                <p className="text-[11px] text-slate-400 text-center leading-relaxed">
                  O bot entrará 2 min antes e a reunião será adicionada automaticamente à aba Reuniões
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
