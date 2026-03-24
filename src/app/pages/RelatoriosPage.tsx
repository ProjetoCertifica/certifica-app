import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { exportPdf, buildReportPdf } from "../lib/usePdfExport";
import { DSBadge } from "../components/ds/DSBadge";
import { DSButton } from "../components/ds/DSButton";
import { DSInput } from "../components/ds/DSInput";
import { DSTable } from "../components/ds/DSTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import {
  AlertTriangle, Bot, CalendarClock, FileSpreadsheet, FileText,
  Plus, Send, TrendingUp, TrendingDown, BarChart3, PieChartIcon, Activity,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useDashboard } from "../lib/useDashboard";
import { useProjetos } from "../lib/useProjetos";
import { useClientes } from "../lib/useClientes";
import { useAudits } from "../lib/useAudits";
import { useTrainings } from "../lib/useTrainings";
import { useMeetings } from "../lib/useMeetings";
import { useDocuments } from "../lib/useDocuments";

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateId = "auditoria" | "nc" | "projeto" | "reunioes" | "documentos";

interface ScheduleItem {
  id: string;
  reportName: string;
  recurrence: string;
  nextRun: string;
  destination: string;
}

interface AuditLogRow {
  id: string;
  tabela: string;
  acao: string;
  created_at: string;
  [key: string]: unknown;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = ["#0E9AA7", "#3DC1D3", "#F6D55C", "#ED553B", "#20639B", "#173F5F", "#F07D00"];
const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const templates = [
  { id: "auditoria" as TemplateId, name: "Auditorias", desc: "Consolidado de auditorias por ciclo e status." },
  { id: "nc" as TemplateId, name: "Não conformidades", desc: "NCs abertas, tratadas e reincidentes." },
  { id: "projeto" as TemplateId, name: "Status de projeto", desc: "Progresso, prazos e risco de projetos." },
  { id: "reunioes" as TemplateId, name: "Reuniões", desc: "Cadência de reuniões e execução de ações." },
  { id: "documentos" as TemplateId, name: "Documentos", desc: "Versionamento, revisão e conformidade." },
];

const DASHBOARD_FILTERS = {
  periodo: "all" as const,
  consultor: "todos",
  cliente: "todos",
  norma: "todas",
};

// ── Helper ────────────────────────────────────────────────────────────────────

function getLast6Months(): { label: string; monthNum: number; year: number }[] {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({ label: `${MONTH_LABELS[d.getMonth()]}/${d.getFullYear()}`, monthNum: d.getMonth() + 1, year: d.getFullYear() });
  }
  return result;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  // ── Real data hooks ──────────────────────────────────────────────────────────
  const { kpis: dashKpis, loading: dashLoading } = useDashboard(DASHBOARD_FILTERS);
  const { projetos } = useProjetos();
  const { clientes } = useClientes();
  const { audits } = useAudits();
  const { trainings } = useTrainings();
  const { meetings } = useMeetings();
  const { documents } = useDocuments();

  // ── Audit log trail ──────────────────────────────────────────────────────────
  const [trail, setTrail] = useState<AuditLogRow[]>([]);
  useEffect(() => {
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(10)
      .then(({ data }) => setTrail(data ?? []));
  }, []);

  // ── Schedules — persisted in Supabase settings table ─────────────────────────
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [schedulesLoaded, setSchedulesLoaded] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("valor").eq("chave", "report_schedules").single()
      .then(({ data }) => {
        if (data?.valor && Array.isArray(data.valor)) setSchedules(data.valor as ScheduleItem[]);
        setSchedulesLoaded(true);
      })
      .catch(() => setSchedulesLoaded(true));
  }, []);

  const persistSchedules = async (items: ScheduleItem[]) => {
    await supabase.from("settings").upsert(
      { chave: "report_schedules", valor: items as any, categoria: "geral", descricao: "Agendamentos de relatórios" },
      { onConflict: "chave" }
    );
  };

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>("auditoria");
  const [filterYear, setFilterYear] = useState("todos");
  const [filterMonth, setFilterMonth] = useState("todos");
  const [showSchedule, setShowSchedule] = useState(false);
  useBodyScrollLock(showSchedule);
  const [scheduleForm, setScheduleForm] = useState({ recurrence: "Semanal · Seg 08:00", nextRun: "", destination: "" });
  const [chartView, setChartView] = useState<"bar" | "line" | "pie">("bar");

  // ── Last 6 months buckets ────────────────────────────────────────────────────
  const last6Months = useMemo(() => getLast6Months(), []);

  const projetosPerMonth = useMemo(() => last6Months.map(({ label, monthNum, year }) => {
    const count = projetos.filter((p) => {
      if (!p.created_at) return false;
      const d = new Date(p.created_at);
      return d.getMonth() + 1 === monthNum && d.getFullYear() === year;
    }).length;
    return { label, projetos: count };
  }), [last6Months, projetos]);

  const auditsPerMonth = useMemo(() => last6Months.map(({ label, monthNum, year }) => {
    const count = audits.filter((a) => {
      const dateStr = a.data_inicio;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() + 1 === monthNum && d.getFullYear() === year;
    }).length;
    return { label, auditorias: count };
  }), [last6Months, audits]);

  // Real meetings per month
  const meetingsPerMonth = useMemo(() => last6Months.map(({ label, monthNum, year }) => {
    const count = meetings.filter((m) => {
      if (!m.data) return false;
      const d = new Date(m.data);
      return d.getMonth() + 1 === monthNum && d.getFullYear() === year;
    }).length;
    return { label, reunioes: count };
  }), [last6Months, meetings]);

  // Real documents per month
  const documentsPerMonth = useMemo(() => last6Months.map(({ label, monthNum, year }) => {
    const count = documents.filter((doc) => {
      if (!doc.created_at) return false;
      const d = new Date(doc.created_at);
      return d.getMonth() + 1 === monthNum && d.getFullYear() === year;
    }).length;
    return { label, documentos: count };
  }), [last6Months, documents]);

  const conformidadePerMonth = useMemo(() => last6Months.map(({ label, monthNum, year }) => {
    const monthAudits = audits.filter((a) => {
      const dateStr = a.data_inicio;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() + 1 === monthNum && d.getFullYear() === year;
    });
    const totalFindings = monthAudits.reduce((s, a) => s + (a.findings?.length ?? 0), 0);
    const ncFindings = monthAudits.reduce(
      (s, a) => s + (a.findings?.filter((f: { tipo?: string }) => f.tipo === "nc-maior" || f.tipo === "nc-menor").length ?? 0), 0
    );
    const rate = totalFindings > 0 ? Math.round(((totalFindings - ncFindings) / totalFindings) * 100) : 100;
    return { label, conformidade: rate };
  }), [last6Months, audits]);

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const totalProjetos = projetos.length;
  const projetosAtivos = projetos.filter((p) => p.status === "em-andamento").length;
  const totalClientes = clientes.length;
  const totalAuditorias = audits.length;
  const totalMeetings = meetings.length;
  const totalDocuments = documents.length;

  // ── Chart data ───────────────────────────────────────────────────────────────
  const mainChartData = useMemo(() => {
    switch (selectedTemplate) {
      case "auditoria": return auditsPerMonth.map((d) => ({ label: d.label, Auditorias: d.auditorias }));
      case "nc": return conformidadePerMonth.map((d) => ({ label: d.label, "Conf. %": d.conformidade }));
      case "projeto": return projetosPerMonth.map((d) => ({ label: d.label, Projetos: d.projetos }));
      case "reunioes": return meetingsPerMonth.map((d) => ({ label: d.label, Reuniões: d.reunioes }));
      case "documentos": return documentsPerMonth.map((d) => ({ label: d.label, Documentos: d.documentos }));
      default: return projetosPerMonth.map((d) => ({ label: d.label, Projetos: d.projetos }));
    }
  }, [selectedTemplate, auditsPerMonth, conformidadePerMonth, projetosPerMonth, meetingsPerMonth, documentsPerMonth]);

  const mainChartKey = useMemo(() => {
    const keys = Object.keys(mainChartData[0] ?? {}).filter((k) => k !== "label");
    return keys[0] ?? "value";
  }, [mainChartData]);

  const trendChartData = useMemo(
    () => mainChartData.map((d) => ({ label: d.label, media: d[mainChartKey] as number })),
    [mainChartData, mainChartKey]
  );

  const pieData = useMemo(() => {
    if (selectedTemplate === "documentos") {
      const map = new Map<string, number>();
      documents.forEach((doc) => { const k = doc.status ?? "rascunho"; map.set(k, (map.get(k) ?? 0) + 1); });
      return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    }
    if (selectedTemplate === "reunioes") {
      const map = new Map<string, number>();
      meetings.forEach((m) => { const k = m.status ?? "agendada"; map.set(k, (map.get(k) ?? 0) + 1); });
      return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    }
    const map = new Map<string, number>();
    audits.forEach((a) => { const k = a.status ?? "indefinido"; map.set(k, (map.get(k) ?? 0) + 1); });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [selectedTemplate, audits, meetings, documents]);

  // ── Filtered chart data ───────────────────────────────────────────────────────
  const filteredChartData = useMemo(() => mainChartData.filter((d) => {
    const [monthLabel, yearStr] = d.label.split("/");
    if (filterYear !== "todos" && yearStr !== filterYear) return false;
    if (filterMonth !== "todos") {
      const monthIdx = MONTH_LABELS.indexOf(monthLabel);
      if (String(monthIdx + 1) !== filterMonth) return false;
    }
    return true;
  }), [mainChartData, filterYear, filterMonth]);

  const filteredTrendData = useMemo(() => trendChartData.filter((d) => {
    const [monthLabel, yearStr] = d.label.split("/");
    if (filterYear !== "todos" && yearStr !== filterYear) return false;
    if (filterMonth !== "todos") {
      const monthIdx = MONTH_LABELS.indexOf(monthLabel);
      if (String(monthIdx + 1) !== filterMonth) return false;
    }
    return true;
  }), [trendChartData, filterYear, filterMonth]);

  // ── Company table ─────────────────────────────────────────────────────────────
  const companyTableData = useMemo(() => {
    const map = new Map<string, { empresa: string; projetos: number; ativos: number; auditorias: number; ncs: number }>();
    projetos.forEach((p) => {
      const key = p.cliente_nome ?? p.cliente_id ?? "—";
      const prev = map.get(key) ?? { empresa: key, projetos: 0, ativos: 0, auditorias: 0, ncs: 0 };
      prev.projetos++;
      if (p.status === "em-andamento") prev.ativos++;
      map.set(key, prev);
    });
    audits.forEach((a) => {
      const key = a.cliente_nome ?? "—";
      if (!map.has(key)) map.set(key, { empresa: key, projetos: 0, ativos: 0, auditorias: 0, ncs: 0 });
      const row = map.get(key)!;
      row.auditorias++;
      row.ncs += a.findings?.filter((f: { tipo?: string }) => f.tipo === "nc-maior" || f.tipo === "nc-menor").length ?? 0;
    });
    return Array.from(map.values());
  }, [projetos, audits]);

  // ── Executive summary ─────────────────────────────────────────────────────────
  const executiveSummary = useMemo(() => {
    const tplName = templates.find((t) => t.id === selectedTemplate)?.name ?? "Relatório";
    const pl = (n: number, s: string, p: string) => n === 1 ? s : p;
    return `${tplName}: ${totalProjetos} ${pl(totalProjetos, "projeto cadastrado", "projetos cadastrados")}, ${projetosAtivos} em andamento. Taxa de conformidade: ${dashKpis.conformidade}%. Total de ${dashKpis.ncs} ${pl(dashKpis.ncs, "NC", "NCs")} em ${totalAuditorias} ${pl(totalAuditorias, "auditoria", "auditorias")}. ${totalMeetings} ${pl(totalMeetings, "reunião", "reuniões")} e ${totalDocuments} ${pl(totalDocuments, "documento", "documentos")} na base. ${totalClientes} ${pl(totalClientes, "cliente ativo", "clientes ativos")}.`;
  }, [selectedTemplate, totalProjetos, projetosAtivos, totalClientes, totalAuditorias, totalMeetings, totalDocuments, dashKpis]);

  const alertCompanies = useMemo(() => companyTableData.filter((c) => c.ncs >= 3), [companyTableData]);

  // ── Excel export ──────────────────────────────────────────────────────────────
  const handleExcelExport = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: KPIs
    const kpiData = [
      ["Indicador", "Valor"],
      ["Total de Projetos", totalProjetos],
      ["Projetos Ativos", projetosAtivos],
      ["Clientes", totalClientes],
      ["Auditorias", totalAuditorias],
      ["Reuniões", totalMeetings],
      ["Documentos", totalDocuments],
      ["Conformidade (%)", dashKpis.conformidade],
      ["Não Conformidades", dashKpis.ncs],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kpiData), "KPIs");

    // Sheet 2: Consolidado por empresa
    const tableHeaders = ["Empresa", "Projetos", "Ativos", "Auditorias", "NCs"];
    const tableRows = companyTableData.map((r) => [r.empresa, r.projetos, r.ativos, r.auditorias, r.ncs]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([tableHeaders, ...tableRows]), "Empresas");

    // Sheet 3: Dados do gráfico (últimos 6 meses)
    const chartHeaders = ["Mês", mainChartKey];
    const chartRows = mainChartData.map((d) => [d.label, d[mainChartKey]]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([chartHeaders, ...chartRows]), "Gráfico");

    // Sheet 4: Reuniões
    if (meetings.length > 0) {
      const meetHeaders = ["Título", "Cliente", "Data", "Status", "Duração (min)"];
      const meetRows = meetings.map((m) => [m.titulo, m.cliente_nome, m.data ? new Date(m.data).toLocaleDateString("pt-BR") : "—", m.status, m.duracao_min ?? 0]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([meetHeaders, ...meetRows]), "Reuniões");
    }

    // Sheet 5: Documentos
    if (documents.length > 0) {
      const docHeaders = ["Título", "Tipo", "Status", "Versão", "Atualizado em"];
      const docRows = documents.map((d) => [d.titulo, d.tipo, d.status, d.versao, d.updated_at ? new Date(d.updated_at).toLocaleDateString("pt-BR") : "—"]);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([docHeaders, ...docRows]), "Documentos");
    }

    const tplName = templates.find((t) => t.id === selectedTemplate)?.name ?? "Relatorio";
    XLSX.writeFile(wb, `Certifica_${tplName}_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel exportado com sucesso!");
  };

  // ── Schedule actions ──────────────────────────────────────────────────────────
  const createSchedule = async () => {
    if (!scheduleForm.nextRun.trim() || !scheduleForm.destination.trim()) return;
    const reportName = templates.find((t) => t.id === selectedTemplate)?.name ?? "Relatório";
    const newItem: ScheduleItem = {
      id: `S-${Date.now()}`,
      reportName: `Relatório ${reportName}`,
      recurrence: scheduleForm.recurrence,
      nextRun: scheduleForm.nextRun,
      destination: scheduleForm.destination,
    };
    const updated = [newItem, ...schedules];
    setSchedules(updated);
    await persistSchedules(updated);
    setShowSchedule(false);
    setScheduleForm({ recurrence: "Semanal · Seg 08:00", nextRun: "", destination: "" });
    toast.success("Agendamento salvo!");
  };

  const removeSchedule = async (id: string) => {
    const updated = schedules.filter((s) => s.id !== id);
    setSchedules(updated);
    await persistSchedules(updated);
    toast.success("Agendamento removido.");
  };

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (dashLoading) {
    return (
      <div className="p-5 flex items-center justify-center h-64">
        <div className="text-certifica-500 text-sm">Carregando dados...</div>
      </div>
    );
  }

  const availableYears = Array.from(
    new Set(projetos.map((p) => p.created_at ? new Date(p.created_at).getFullYear() : null).filter(Boolean))
  ).sort((a, b) => (b as number) - (a as number)) as number[];

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-certifica-900 text-lg" style={{ fontWeight: 700 }}>Relatórios</h2>
          <p className="text-[11px] text-certifica-500">Visualização completa com gráficos, filtros por período e empresa, análise e exportação.</p>
        </div>
        <div className="flex items-center gap-2">
          <DSButton variant="outline" size="sm" icon={<CalendarClock className="w-3.5 h-3.5" />} onClick={() => setShowSchedule(true)}>Agendar envio</DSButton>
          <DSButton
            variant="outline" size="sm" icon={<FileText className="w-3.5 h-3.5" />}
            onClick={() => {
              const doc = buildReportPdf({
                template: templates.find((t) => t.id === selectedTemplate)?.name ?? "Relatório",
                periodo: filterYear !== "todos" ? filterYear : "Todos os períodos",
                kpis: {
                  "Total de projetos": totalProjetos,
                  "Projetos ativos": projetosAtivos,
                  "Clientes": totalClientes,
                  "Auditorias": totalAuditorias,
                  "Reuniões": totalMeetings,
                  "Documentos": totalDocuments,
                  "Conformidade (%)": dashKpis.conformidade,
                },
                tableData: companyTableData,
                tableColumns: ["Empresa", "Projetos", "Ativos", "Auditorias", "NCs"],
                tableKeys: ["empresa", "projetos", "ativos", "auditorias", "ncs"],
                summary: executiveSummary,
              });
              exportPdf(doc);
              toast.success("PDF gerado! Use Ctrl+P para salvar.");
            }}
          >PDF</DSButton>
          <DSButton size="sm" icon={<FileSpreadsheet className="w-3.5 h-3.5" />} onClick={handleExcelExport}>Excel</DSButton>
        </div>
      </div>

      {/* Templates */}
      <div className="grid grid-cols-6 gap-2">
        {templates.map((tpl) => (
          <button key={tpl.id} onClick={() => setSelectedTemplate(tpl.id)}
            className={`text-left border rounded-[4px] p-2.5 transition-colors ${selectedTemplate === tpl.id ? "bg-certifica-accent-light border-certifica-accent/40" : "bg-white border-certifica-200 hover:bg-certifica-50"}`}
          >
            <div className="text-[11px] text-certifica-900" style={{ fontWeight: 600 }}>{tpl.name}</div>
            <div className="text-[9.5px] text-certifica-500 mt-0.5">{tpl.desc}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-certifica-200 rounded-[4px] p-3 flex items-end gap-3">
        <div className="flex-1 grid grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Ano</label>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[11px]">
              <option value="todos">Todos</option>
              {availableYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Mês</label>
            <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[11px]">
              <option value="todos">Todos</option>
              {MONTH_LABELS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Tipo de gráfico</label>
            <div className="flex gap-1">
              {([["bar", <BarChart3 className="w-3.5 h-3.5" />], ["line", <Activity className="w-3.5 h-3.5" />], ["pie", <PieChartIcon className="w-3.5 h-3.5" />]] as [string, React.ReactNode][]).map(([type, icon]) => (
                <button key={type} onClick={() => setChartView(type as "bar" | "line" | "pie")}
                  className={`h-8 w-10 rounded-[4px] border flex items-center justify-center ${chartView === type ? "border-certifica-accent bg-certifica-accent-light text-certifica-accent" : "border-certifica-200 text-certifica-500 hover:text-certifica-dark"}`}
                >{icon}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total projetos", value: totalProjetos, color: "text-certifica-accent" },
          { label: "Projetos ativos", value: projetosAtivos, color: "text-certifica-accent" },
          { label: "Clientes", value: totalClientes, color: "text-oportunidade" },
          { label: "Auditorias", value: totalAuditorias, color: "text-certifica-dark" },
          { label: "Conformidade", value: `${dashKpis.conformidade}%`, color: dashKpis.conformidade >= 70 ? "text-conformidade" : "text-nao-conformidade", icon: dashKpis.conformidade >= 70 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" /> },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-certifica-200 rounded-[4px] p-3">
            <div className="text-[10px] uppercase tracking-wider text-certifica-500 mb-1" style={{ fontWeight: 600 }}>{k.label}</div>
            <div className={`text-xl ${k.color} flex items-center gap-1.5`} style={{ fontWeight: 700 }}>
              {"icon" in k && k.icon}{k.value}
            </div>
          </div>
        ))}
      </div>

      {/* Sub-KPIs for reuniões/documentos */}
      {(selectedTemplate === "reunioes" || selectedTemplate === "documentos") && (
        <div className="grid grid-cols-4 gap-3">
          {selectedTemplate === "reunioes" && [
            { label: "Total reuniões", value: totalMeetings },
            { label: "Transcritas", value: meetings.filter((m) => m.status === "transcrita").length },
            { label: "Concluídas", value: meetings.filter((m) => m.status === "concluida").length },
            { label: "Ações abertas", value: meetings.reduce((s, m) => s + (m.acoes?.filter((a: any) => !a.concluida).length ?? 0), 0) },
          ].map((k) => (
            <div key={k.label} className="bg-white border border-certifica-200 rounded-[4px] p-3">
              <div className="text-[10px] uppercase tracking-wider text-certifica-500 mb-1" style={{ fontWeight: 600 }}>{k.label}</div>
              <div className="text-xl text-certifica-accent" style={{ fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
          {selectedTemplate === "documentos" && [
            { label: "Total documentos", value: totalDocuments },
            { label: "Aprovados", value: documents.filter((d) => d.status === "aprovado").length },
            { label: "Em revisão", value: documents.filter((d) => d.status === "em-revisao").length },
            { label: "Rascunhos", value: documents.filter((d) => d.status === "rascunho").length },
          ].map((k) => (
            <div key={k.label} className="bg-white border border-certifica-200 rounded-[4px] p-3">
              <div className="text-[10px] uppercase tracking-wider text-certifica-500 mb-1" style={{ fontWeight: 600 }}>{k.label}</div>
              <div className="text-xl text-certifica-accent" style={{ fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="bg-white border border-certifica-200 rounded-[4px] p-4">
          <div className="text-[12px] text-certifica-900 mb-3" style={{ fontWeight: 600 }}>
            {templates.find((t) => t.id === selectedTemplate)?.name} — últimos 6 meses
          </div>

          {chartView === "bar" && (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={filteredChartData.length > 0 ? filteredChartData : mainChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} tickFormatter={(v: number) => Number.isInteger(v) ? String(v) : ""} domain={[0, "auto"]} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(v: number) => [v, mainChartKey]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey={mainChartKey} fill={COLORS[0]} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {chartView === "line" && (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={filteredTrendData.length > 0 ? filteredTrendData : trendChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} tickFormatter={(v: number) => Number.isInteger(v) ? String(v) : ""} domain={[0, "auto"]} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} formatter={(v: number) => [v, "Total"]} />
                <Line type="monotone" dataKey="media" stroke="#0E9AA7" strokeWidth={2} dot={{ r: 3 }} name="Total" />
              </LineChart>
            </ResponsiveContainer>
          )}

          {chartView === "pie" && (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value"
                  label={({ name, percent }) => `${String(name).split(" ")[0]} ${(percent * 100).toFixed(0)}%`} labelLine={false}
                >
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 4 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="space-y-3">
          <div className="bg-white border border-certifica-200 rounded-[4px] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Bot className="w-3.5 h-3.5 text-certifica-accent" />
              <span className="text-[11px] text-certifica-900" style={{ fontWeight: 600 }}>Resumo — {templates.find((t) => t.id === selectedTemplate)?.name ?? "Analítico"}</span>
            </div>
            <p className="text-[10.5px] text-certifica-dark leading-relaxed">{executiveSummary}</p>
          </div>

          <div className="bg-white border border-certifica-200 rounded-[4px] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-nao-conformidade" />
              <span className="text-[11px] text-certifica-900" style={{ fontWeight: 600 }}>Alertas</span>
            </div>
            <div className="space-y-1">
              {alertCompanies.length === 0 ? (
                <p className="text-[10px] text-certifica-500">Nenhuma anomalia relevante.</p>
              ) : (
                alertCompanies.map((c) => (
                  <div key={c.empresa} className="text-[10px] text-nao-conformidade border border-nao-conformidade/20 rounded-[3px] px-2 py-1">
                    {c.empresa}: {c.ncs} {c.ncs === 1 ? "NC registrada" : "NCs registradas"}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Company table */}
      <div className="bg-white border border-certifica-200 rounded-[4px] p-4">
        <div className="text-[12px] text-certifica-900 mb-3" style={{ fontWeight: 600 }}>Consolidado por empresa</div>
        <DSTable
          columns={[
            { key: "empresa", header: "Empresa" },
            { key: "projetos", header: "Projetos", render: (row) => <span>{row.projetos}</span> },
            {
              key: "ativos", header: "Ativos", render: (row) => {
                const pct = Number(row.projetos) > 0 ? Math.round((Number(row.ativos) / Number(row.projetos)) * 100) : 0;
                return <DSBadge variant={pct >= 50 ? "conformidade" : "observacao"}>{row.ativos}</DSBadge>;
              }
            },
            { key: "auditorias", header: "Auditorias" },
            {
              key: "ncs", header: "NCs", render: (row) => {
                const v = Number(row.ncs);
                return <DSBadge variant={v === 0 ? "conformidade" : v < 3 ? "observacao" : "nao-conformidade"}>{v}</DSBadge>;
              }
            },
          ]}
          data={companyTableData}
        />
      </div>

      {/* Meetings table (when reunioes template) */}
      {selectedTemplate === "reunioes" && meetings.length > 0 && (
        <div className="bg-white border border-certifica-200 rounded-[4px] p-4">
          <div className="text-[12px] text-certifica-900 mb-3" style={{ fontWeight: 600 }}>Reuniões cadastradas</div>
          <DSTable
            columns={[
              { key: "titulo", header: "Título" },
              { key: "cliente_nome", header: "Cliente" },
              { key: "data", header: "Data", render: (row) => <span>{row.data ? new Date(String(row.data)).toLocaleDateString("pt-BR") : "—"}</span> },
              { key: "status", header: "Status", render: (row) => <DSBadge variant={row.status === "transcrita" || row.status === "concluida" ? "conformidade" : "observacao"}>{String(row.status)}</DSBadge> },
              { key: "duracao_min", header: "Duração", render: (row) => <span>{row.duracao_min ? `${row.duracao_min} min` : "—"}</span> },
            ]}
            data={meetings.slice(0, 10)}
          />
        </div>
      )}

      {/* Documents table (when documentos template) */}
      {selectedTemplate === "documentos" && documents.length > 0 && (
        <div className="bg-white border border-certifica-200 rounded-[4px] p-4">
          <div className="text-[12px] text-certifica-900 mb-3" style={{ fontWeight: 600 }}>Documentos cadastrados</div>
          <DSTable
            columns={[
              { key: "titulo", header: "Título" },
              { key: "tipo", header: "Tipo" },
              { key: "status", header: "Status", render: (row) => <DSBadge variant={row.status === "aprovado" ? "conformidade" : row.status === "em-revisao" ? "observacao" : "default"}>{String(row.status)}</DSBadge> },
              { key: "versao", header: "Versão", render: (row) => <span className="font-mono text-[11px]">v{row.versao}</span> },
              { key: "updated_at", header: "Atualizado", render: (row) => <span>{row.updated_at ? new Date(String(row.updated_at)).toLocaleDateString("pt-BR") : "—"}</span> },
            ]}
            data={documents.slice(0, 10)}
          />
        </div>
      )}

      {/* Schedule + Trail */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-certifica-200 rounded-[4px] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-certifica-900" style={{ fontWeight: 600 }}>
              Agendamentos {!schedulesLoaded && <span className="text-certifica-500">(carregando...)</span>}
            </span>
            <button onClick={() => setShowSchedule(true)} className="text-[10px] text-certifica-accent hover:underline flex items-center gap-0.5 cursor-pointer">
              <Plus className="w-3 h-3" /> Novo
            </button>
          </div>
          <div className="space-y-1.5">
            {schedules.length === 0 && schedulesLoaded && (
              <p className="text-[10px] text-certifica-500">Nenhum agendamento configurado.</p>
            )}
            {schedules.map((s) => (
              <div key={s.id} className="border border-certifica-200 rounded-[3px] px-2.5 py-1.5 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[11px] text-certifica-dark" style={{ fontWeight: 500 }}>{s.reportName}</div>
                  <div className="text-[9.5px] text-certifica-500">{s.recurrence} · Próxima: {s.nextRun} · {s.destination}</div>
                </div>
                <button onClick={() => removeSchedule(s.id)} className="text-certifica-500 hover:text-nao-conformidade transition-colors mt-0.5 cursor-pointer flex-shrink-0">
                  <span className="text-[10px]">✕</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-certifica-200 rounded-[4px] p-3">
          <span className="text-[11px] text-certifica-900 block mb-2" style={{ fontWeight: 600 }}>Trilha de emissão</span>
          <div className="space-y-1">
            {trail.length === 0 && <p className="text-[10px] text-certifica-500">Nenhum registro encontrado.</p>}
            {trail.slice(0, 8).map((t) => (
              <div key={t.id} className="text-[10px] text-certifica-500 border border-certifica-200 rounded-[3px] px-2 py-1">
                {t.created_at ? new Date(t.created_at).toLocaleString("pt-BR") : "—"} · {t.acao ?? "—"} · {t.tabela ?? "—"}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule modal */}
      {showSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-certifica-dark/45 certifica-modal-backdrop" onClick={() => setShowSchedule(false)} />
          <div className="relative w-full max-w-[480px] bg-white border border-certifica-200 rounded-[6px] shadow-lg certifica-modal-content">
            <div className="px-4 py-3 border-b border-certifica-200">
              <h3 className="text-[14px] text-certifica-900" style={{ fontWeight: 600 }}>Agendar envio de relatório</h3>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <DSInput label="Recorrência" value={scheduleForm.recurrence} onChange={(e) => setScheduleForm((p) => ({ ...p, recurrence: e.target.value }))} />
              <DSInput label="Próxima execução" value={scheduleForm.nextRun} onChange={(e) => setScheduleForm((p) => ({ ...p, nextRun: e.target.value }))} placeholder="DD/MM/AAAA HH:MM" />
              <DSInput label="Destino (email)" className="col-span-2" value={scheduleForm.destination} onChange={(e) => setScheduleForm((p) => ({ ...p, destination: e.target.value }))} placeholder="diretoria@certifica.com" />
              <div className="col-span-2 flex justify-end gap-2">
                <DSButton variant="outline" size="sm" onClick={() => setShowSchedule(false)}>Cancelar</DSButton>
                <DSButton size="sm" icon={<Send className="w-3 h-3" />} onClick={createSchedule}>Salvar</DSButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
