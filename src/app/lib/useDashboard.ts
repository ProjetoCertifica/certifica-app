import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "./supabase";

/* ── Types ── */
export interface DashboardProject {
  id: string;
  codigo: string;
  titulo: string;
  cliente_id: string;
  cliente_nome: string;
  norma: string;
  fase: number;
  fase_label: string;
  status: string;
  consultor: string;
  inicio: string | null;
  previsao: string | null;
  valor: string;
  created_at: string;
}

export interface DashboardAudit {
  id: string;
  codigo: string;
  titulo?: string;
  tipo: string;
  norma: string;
  auditor: string;
  status: string;
  cliente_id: string;
  cliente_nome: string;
  data_inicio: string | null;
  data_fim: string | null;
  findings_count: number;
  ncs_count: number;
}

export interface DashboardDocument {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  norma: string;
  status: string;
  cliente_id: string | null;
  cliente_nome: string;
  created_at: string;
}

export interface DashboardMeeting {
  id: string;
  titulo: string;
  tipo: string;
  data: string | null;
  duracao_min: number;
  status: string;
  cliente_nome: string;
}

export interface DashboardTraining {
  id: string;
  titulo: string;
  norma: string;
  instrutor: string;
  data_inicio: string | null;
  status: string;
  vagas: number;
  inscritos: number;
}

export interface DashboardFilters {
  periodo: "7d" | "30d" | "90d" | "all";
  consultor: string;
  cliente: string;
  norma: string;
}

export interface KPIs {
  ativos: number;
  atrasos: number;
  ncs: number;
  auditorias: number;
  docs: number;
  conformidade: number;
  risco: number;
}

export interface MonthCompare {
  current: number;
  previous: number;
  suffix?: string;
}

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const CACHE_TTL = 60_000;
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T) {
  cache.set(key, { data, ts: Date.now() });
}

export function useDashboard(filters: DashboardFilters) {
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [audits, setAudits] = useState<DashboardAudit[]>([]);
  const [documents, setDocuments] = useState<DashboardDocument[]>([]);
  const [meetings, setMeetings] = useState<DashboardMeeting[]>([]);
  const [trainings, setTrainings] = useState<DashboardTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(0);

  const periodDate = useMemo(() => {
    const now = new Date();
    if (filters.periodo === "7d") return new Date(now.getTime() - 7 * 86400_000).toISOString();
    if (filters.periodo === "30d") return new Date(now.getTime() - 30 * 86400_000).toISOString();
    if (filters.periodo === "90d") return new Date(now.getTime() - 90 * 86400_000).toISOString();
    return null;
  }, [filters.periodo]);

  const prevPeriodDate = useMemo(() => {
    const now = new Date();
    if (filters.periodo === "7d") return new Date(now.getTime() - 14 * 86400_000).toISOString();
    if (filters.periodo === "30d") return new Date(now.getTime() - 60 * 86400_000).toISOString();
    if (filters.periodo === "90d") return new Date(now.getTime() - 180 * 86400_000).toISOString();
    return null;
  }, [filters.periodo]);

  const fetch = useCallback(async () => {
    const fetchId = ++abortRef.current;
    setLoading(true);
    setError(null);

    const cacheKey = JSON.stringify(filters);
    const cached = getCached<{
      projects: DashboardProject[];
      audits: DashboardAudit[];
      documents: DashboardDocument[];
      meetings: DashboardMeeting[];
      trainings: DashboardTraining[];
    }>(cacheKey);

    if (cached) {
      setProjects(cached.projects);
      setAudits(cached.audits);
      setDocuments(cached.documents);
      setMeetings(cached.meetings);
      setTrainings(cached.trainings);
      setLoading(false);
      return;
    }

    try {
      const [projRes, auditRes, docRes, meetRes, trainRes] = await Promise.allSettled([
        supabase
          .from("projetos")
          .select("id, codigo, titulo, cliente_id, norma, fase, fase_label, status, consultor, inicio, previsao, valor, created_at, clientes(nome_fantasia)")
          .order("created_at", { ascending: false }),
        supabase
          .from("audits")
          .select("id, codigo, tipo, norma, auditor, status, cliente_id, data_inicio, data_fim, escopo, clientes(nome_fantasia), audit_findings(id, tipo)")
          .order("created_at", { ascending: false }),
        supabase
          .from("documents")
          .select("id, codigo, titulo, tipo, norma, status, cliente_id, created_at, clientes(nome_fantasia)")
          .order("created_at", { ascending: false }),
        supabase
          .from("meetings")
          .select("id, titulo, tipo, data, duracao_min, status, clientes(nome_fantasia)")
          .order("data", { ascending: true }),
        supabase
          .from("trainings")
          .select("id, titulo, norma, instrutor, data_inicio, status, vagas, enrollments(id)")
          .order("data_inicio", { ascending: true }),
      ]);

      if (fetchId !== abortRef.current) return;

      const proj: DashboardProject[] = [];
      if (projRes.status === "fulfilled" && projRes.value.data) {
        for (const p of projRes.value.data as any[]) {
          proj.push({
            id: p.id,
            codigo: p.codigo,
            titulo: p.titulo,
            cliente_id: p.cliente_id,
            cliente_nome: p.clientes?.nome_fantasia ?? "—",
            norma: p.norma,
            fase: p.fase,
            fase_label: p.fase_label,
            status: p.status,
            consultor: p.consultor,
            inicio: p.inicio,
            previsao: p.previsao,
            valor: p.valor,
            created_at: p.created_at,
          });
        }
      }

      const aud: DashboardAudit[] = [];
      if (auditRes.status === "fulfilled" && auditRes.value.data) {
        for (const a of auditRes.value.data as any[]) {
          const findings = Array.isArray(a.audit_findings) ? a.audit_findings : [];
          aud.push({
            id: a.id,
            codigo: a.codigo,
            tipo: a.tipo,
            norma: a.norma,
            auditor: a.auditor,
            status: a.status,
            cliente_id: a.cliente_id,
            cliente_nome: a.clientes?.nome_fantasia ?? "—",
            data_inicio: a.data_inicio,
            data_fim: a.data_fim,
            findings_count: findings.length,
            ncs_count: findings.filter((f: any) => f.tipo === "nc-maior" || f.tipo === "nc-menor").length,
          });
        }
      }

      const docs: DashboardDocument[] = [];
      if (docRes.status === "fulfilled" && docRes.value.data) {
        for (const d of docRes.value.data as any[]) {
          docs.push({
            id: d.id,
            codigo: d.codigo,
            titulo: d.titulo,
            tipo: d.tipo,
            norma: d.norma,
            status: d.status,
            cliente_id: d.cliente_id,
            cliente_nome: d.clientes?.nome_fantasia ?? "—",
            created_at: d.created_at,
          });
        }
      }

      const meet: DashboardMeeting[] = [];
      if (meetRes.status === "fulfilled" && meetRes.value.data) {
        for (const m of meetRes.value.data as any[]) {
          meet.push({
            id: m.id,
            titulo: m.titulo,
            tipo: m.tipo,
            data: m.data,
            duracao_min: m.duracao_min,
            status: m.status,
            cliente_nome: m.clientes?.nome_fantasia ?? "—",
          });
        }
      }

      const train: DashboardTraining[] = [];
      if (trainRes.status === "fulfilled" && trainRes.value.data) {
        for (const t of trainRes.value.data as any[]) {
          train.push({
            id: t.id,
            titulo: t.titulo,
            norma: t.norma,
            instrutor: t.instrutor,
            data_inicio: t.data_inicio,
            status: t.status,
            vagas: t.vagas,
            inscritos: Array.isArray(t.enrollments) ? t.enrollments.length : 0,
          });
        }
      }

      setProjects(proj);
      setAudits(aud);
      setDocuments(docs);
      setMeetings(meet);
      setTrainings(train);

      setCache(cacheKey, { projects: proj, audits: aud, documents: docs, meetings: meet, trainings: train });
    } catch (e: unknown) {
      if (fetchId !== abortRef.current) return;
      setError(e instanceof Error ? e.message : "Erro ao carregar dashboard");
    } finally {
      if (fetchId === abortRef.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  /* ── Filtered data ── */
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (filters.consultor !== "todos" && p.consultor !== filters.consultor) return false;
      if (filters.cliente !== "todos" && p.cliente_id !== filters.cliente) return false;
      if (filters.norma !== "todas" && p.norma !== filters.norma) return false;
      if (periodDate && p.created_at < periodDate) return false;
      return true;
    });
  }, [projects, filters, periodDate]);

  const prevProjects = useMemo(() => {
    if (!prevPeriodDate || !periodDate) return projects;
    return projects.filter((p) => p.created_at >= prevPeriodDate && p.created_at < periodDate);
  }, [projects, prevPeriodDate, periodDate]);

  const filteredAudits = useMemo(() => {
    return audits.filter((a) => {
      if (filters.cliente !== "todos" && a.cliente_id !== filters.cliente) return false;
      if (filters.norma !== "todas" && a.norma !== filters.norma) return false;
      return true;
    });
  }, [audits, filters]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      if (filters.cliente !== "todos" && d.cliente_id !== filters.cliente) return false;
      if (filters.norma !== "todas" && d.norma !== filters.norma) return false;
      return true;
    });
  }, [documents, filters]);

  /* ── KPIs ── */
  const kpis: KPIs = useMemo(() => {
    const now = new Date();
    const ativos = filteredProjects.filter((p) => p.status === "em-andamento" || p.status === "proposta").length;
    const atrasos = filteredProjects.filter((p) => {
      if (!p.previsao) return false;
      return new Date(p.previsao) < now && p.status !== "concluido" && p.status !== "cancelado";
    }).length;
    const ncs = filteredAudits.reduce((s, a) => s + a.ncs_count, 0);
    const auditCount = filteredAudits.filter((a) => a.status !== "cancelada").length;
    const docsPendentes = filteredDocuments.filter((d) => d.status === "rascunho" || d.status === "em-revisao").length;

    const totalFindings = filteredAudits.reduce((s, a) => s + a.findings_count, 0);
    const conformidade = totalFindings > 0 ? Math.round(((totalFindings - ncs) / totalFindings) * 100) : 100;

    const risco = filteredProjects.length > 0
      ? Math.round(
          filteredProjects.reduce((s, p) => {
            if (!p.previsao) return s;
            const daysLeft = (new Date(p.previsao).getTime() - now.getTime()) / 86400_000;
            if (daysLeft < 0) return s + 100;
            if (daysLeft < 15) return s + 70;
            if (daysLeft < 30) return s + 40;
            return s + 10;
          }, 0) / filteredProjects.length
        )
      : 0;

    return { ativos, atrasos, ncs, auditorias: auditCount, docs: docsPendentes, conformidade, risco };
  }, [filteredProjects, filteredAudits, filteredDocuments]);

  /* ── Previous period KPIs for comparison ── */
  const prevKpis: KPIs = useMemo(() => {
    const now = periodDate ? new Date(periodDate) : new Date();
    const ativos = prevProjects.filter((p) => p.status === "em-andamento" || p.status === "proposta").length;
    const atrasos = prevProjects.filter((p) => {
      if (!p.previsao) return false;
      return new Date(p.previsao) < now && p.status !== "concluido" && p.status !== "cancelado";
    }).length;
    const ncs = audits.reduce((s, a) => s + a.ncs_count, 0);
    const auditCount = audits.filter((a) => a.status !== "cancelada").length;
    const docsPendentes = documents.filter((d) => d.status === "rascunho" || d.status === "em-revisao").length;
    const totalFindings = audits.reduce((s, a) => s + a.findings_count, 0);
    const conformidade = totalFindings > 0 ? Math.round(((totalFindings - ncs) / totalFindings) * 100) : 100;
    return { ativos, atrasos, ncs, auditorias: auditCount, docs: docsPendentes, conformidade, risco: 0 };
  }, [prevProjects, audits, documents, periodDate]);

  const monthCompare: Record<keyof KPIs, MonthCompare> = useMemo(() => ({
    ativos: { current: kpis.ativos, previous: prevKpis.ativos },
    atrasos: { current: kpis.atrasos, previous: prevKpis.atrasos },
    ncs: { current: kpis.ncs, previous: prevKpis.ncs },
    auditorias: { current: kpis.auditorias, previous: prevKpis.auditorias },
    docs: { current: kpis.docs, previous: prevKpis.docs },
    conformidade: { current: kpis.conformidade, previous: prevKpis.conformidade, suffix: "%" },
    risco: { current: kpis.risco, previous: prevKpis.risco },
  }), [kpis, prevKpis]);

  /* ── Filter options ── */
  const consultores = useMemo(() => {
    const set = new Set(projects.map((p) => p.consultor).filter(Boolean));
    return ["todos", ...Array.from(set).sort()];
  }, [projects]);

  const clienteOptions = useMemo(() => {
    const map = new Map<string, string>();
    projects.forEach((p) => { if (!map.has(p.cliente_id)) map.set(p.cliente_id, p.cliente_nome); });
    return [{ id: "todos", nome: "Todos clientes" }, ...Array.from(map.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome))];
  }, [projects]);

  const normas = useMemo(() => {
    const set = new Set(projects.map((p) => p.norma).filter(Boolean));
    return ["todas", ...Array.from(set).sort()];
  }, [projects]);

  /* ── Charts data ── */
  const byPhase = useMemo(() => {
    const phases: Record<number, { fase: number; label: string; count: number }> = {};
    filteredProjects.forEach((p) => {
      if (!phases[p.fase]) phases[p.fase] = { fase: p.fase, label: p.fase_label, count: 0 };
      phases[p.fase].count++;
    });
    return Object.values(phases).sort((a, b) => a.fase - b.fase);
  }, [filteredProjects]);

  const byNorma = useMemo(() => {
    const map = new Map<string, number>();
    filteredProjects.forEach((p) => {
      const key = p.norma.replace(/:20\d{2}/, "");
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([norma, projetos]) => ({ norma, projetos }))
      .sort((a, b) => b.projetos - a.projetos);
  }, [filteredProjects]);

  /* ── Agenda from meetings ── */
  const agenda = useMemo(() => {
    const now = new Date();
    return meetings
      .filter((m) => m.data && new Date(m.data) >= now && m.status !== "cancelada")
      .slice(0, 6)
      .map((m) => ({
        id: m.id,
        date: m.data ? new Date(m.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—",
        time: m.data ? new Date(m.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "",
        event: `${m.titulo} — ${m.cliente_nome}`,
        type: m.tipo,
      }));
  }, [meetings]);

  /* ── Executive data ── */
  const executiveByConsultor = useMemo(() => {
    const map = new Map<string, { consultor: string; projetos: number; risco: number; conformidade: number; ncs: number }>();
    filteredProjects.forEach((p) => {
      const c = map.get(p.consultor) ?? { consultor: p.consultor, projetos: 0, risco: 0, conformidade: 0, ncs: 0 };
      c.projetos++;
      const now = new Date();
      if (p.previsao) {
        const daysLeft = (new Date(p.previsao).getTime() - now.getTime()) / 86400_000;
        c.risco += daysLeft < 0 ? 100 : daysLeft < 15 ? 70 : daysLeft < 30 ? 40 : 10;
      }
      map.set(p.consultor, c);
    });
    filteredAudits.forEach((a) => {
      const c = map.get(a.auditor);
      if (c) c.ncs += a.ncs_count;
    });
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        risco: r.projetos > 0 ? Math.round(r.risco / r.projetos) : 0,
      }))
      .sort((a, b) => b.risco - a.risco);
  }, [filteredProjects, filteredAudits]);

  const executiveByNorma = useMemo(() => {
    const map = new Map<string, { norma: string; projetos: number; total: number }>();
    filteredProjects.forEach((p) => {
      const key = p.norma.replace(/:20\d{2}/, "");
      const c = map.get(key) ?? { norma: key, projetos: 0, total: 0 };
      c.projetos++;
      map.set(key, c);
    });
    return Array.from(map.values()).map((r) => ({
      ...r,
      conformidade: kpis.conformidade,
    }));
  }, [filteredProjects, kpis.conformidade]);

  const refetch = useCallback(() => {
    cache.clear();
    return fetch();
  }, [fetch]);

  return {
    projects: filteredProjects,
    allProjects: projects,
    audits: filteredAudits,
    documents: filteredDocuments,
    meetings,
    trainings,
    loading,
    error,
    kpis,
    monthCompare,
    consultores,
    clienteOptions,
    normas,
    byPhase,
    byNorma,
    agenda,
    executiveByConsultor,
    executiveByNorma,
    refetch,
  };
}
