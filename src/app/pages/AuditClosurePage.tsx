import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Presentation,
  Save,
} from "lucide-react";
import { DSButton } from "../components/ds/DSButton";
import { useAudits } from "../lib/useAudits";
import { generateAuditClosure } from "../lib/openai";
import type { AuditClosureData } from "../lib/openai";

/* ── Helpers ── */
function fmtDate(d?: string | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return d; }
}

function prioColor(p: string) {
  const u = p.toUpperCase();
  if (u === "ALTA") return { bg: "#FEE2E2", color: "#991B1B" };
  if (u === "MÉDIA" || u === "MEDIA") return { bg: "#FEF3C7", color: "#92400E" };
  return { bg: "#DBEAFE", color: "#1E40AF" };
}

/* ── Slide renderer ── */
interface SlideProps { children: React.ReactNode; bg?: string; }
function Slide({ children, bg }: SlideProps) {
  return (
    <div
      className="w-full aspect-[16/9] rounded-lg overflow-hidden flex flex-col"
      style={{ background: bg ?? "#fff", boxShadow: "0 4px 24px rgba(14,42,71,0.10)", border: "1px solid #E5E7EB" }}
    >
      {children}
    </div>
  );
}

/* ── Main page ── */
export default function AuditClosurePage() {
  const [searchParams] = useSearchParams();
  const auditIdFromUrl = searchParams.get("auditId") ?? "";
  const { audits, createRai, updateRai } = useAudits();
  const [closureData, setClosureData] = useState<AuditClosureData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  const matchedAudit = useMemo(() => {
    if (!auditIdFromUrl) return audits[0] ?? null;
    return audits.find((a) => a.id === auditIdFromUrl) ?? null;
  }, [audits, auditIdFromUrl]);

  const auditInfo = useMemo(() => {
    if (!matchedAudit) return { empresa: "—", unidade: "", norma: "—", auditor: "—", data: "—", codigo: "—" };
    return {
      empresa: matchedAudit.cliente_nome ?? "—",
      unidade: "",
      norma: matchedAudit.norma ?? "—",
      auditor: matchedAudit.auditor ?? "—",
      data: matchedAudit.data_inicio ?? "",
      codigo: matchedAudit.codigo ?? "—",
    };
  }, [matchedAudit]);

  const findings = useMemo(() => matchedAudit?.findings ?? [], [matchedAudit]);
  const conformes = findings.filter((f) => f.tipo === "conformidade");
  const ncs = findings.filter((f) => f.tipo === "nc-maior" || f.tipo === "nc-menor");
  const obs = findings.filter((f) => f.tipo === "observacao");
  const oport = findings.filter((f) => f.tipo === "oportunidade");
  const total = findings.length;
  const pct = total > 0 ? Math.round((conformes.length / total) * 1000) / 10 : 0;

  /* ── Load saved closure data from Supabase on mount ── */
  useEffect(() => {
    if (!matchedAudit?.rai_report) return;
    const conteudo = matchedAudit.rai_report.conteudo as Record<string, unknown> | null;
    if (conteudo && typeof conteudo === "object" && "fechamento" in conteudo) {
      setClosureData(conteudo.fechamento as AuditClosureData);
    }
  }, [matchedAudit?.rai_report]);

  /* ── Save closure data to Supabase ── */
  const handleSave = useCallback(async () => {
    if (!closureData || !matchedAudit) return;
    setSaving(true);
    try {
      const existingRai = matchedAudit.rai_report;
      const conteudoBase = (existingRai?.conteudo && typeof existingRai.conteudo === "object")
        ? (existingRai.conteudo as Record<string, unknown>)
        : {};
      const conteudo = { ...conteudoBase, fechamento: closureData };

      if (existingRai) {
        const ok = await updateRai(existingRai.id, { conteudo });
        if (ok) toast.success("Fechamento salvo com sucesso!");
        else toast.error("Erro ao salvar fechamento.");
      } else {
        const result = await createRai({
          audit_id: matchedAudit.id,
          codigo: `RAI-${matchedAudit.codigo}`,
          titulo: `Relatório de Auditoria — ${matchedAudit.norma}`,
          conteudo,
          status: "rascunho",
          elaborado_por: matchedAudit.auditor ?? "",
          revisado_por: "",
          aprovado_por: "",
        });
        if (result) toast.success("Fechamento salvo com sucesso!");
        else toast.error("Erro ao salvar fechamento.");
      }
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message ?? "tente novamente"));
    } finally {
      setSaving(false);
    }
  }, [closureData, matchedAudit, createRai, updateRai]);

  const handleGenerate = useCallback(async () => {
    if (!matchedAudit) {
      toast.warning("Selecione uma auditoria com constatações para gerar o fechamento.");
      return;
    }
    if (findings.length === 0) {
      toast.warning("A auditoria não possui constatações cadastradas.");
      return;
    }
    setGenerating(true);
    try {
      const data = await generateAuditClosure({
        empresa: auditInfo.empresa,
        unidade: auditInfo.unidade,
        norma: auditInfo.norma,
        auditorLider: auditInfo.auditor,
        dataAuditoria: auditInfo.data,
        totalAvaliados: total,
        conformes: conformes.length,
        ncs: ncs.length,
        observacoes: obs.length,
        oportunidades: oport.length,
        pctConformidade: pct,
        findings: findings.map((f) => ({
          tipo: f.tipo,
          clausula: f.clausula,
          descricao: f.descricao,
          evidencia: f.evidencia,
          responsavel: f.responsavel,
          acao_corretiva: f.acao_corretiva,
        })),
      });
      setClosureData(data);
      setCurrentSlide(0);
      toast.success("Fechamento gerado com sucesso!");

      // Auto-save to Supabase
      try {
        const existingRai = matchedAudit!.rai_report;
        const conteudoBase = (existingRai?.conteudo && typeof existingRai.conteudo === "object")
          ? (existingRai.conteudo as Record<string, unknown>)
          : {};
        const conteudo = { ...conteudoBase, fechamento: data };

        if (existingRai) {
          await updateRai(existingRai.id, { conteudo });
        } else {
          await createRai({
            audit_id: matchedAudit!.id,
            codigo: `RAI-${matchedAudit!.codigo}`,
            titulo: `Relatório de Auditoria — ${matchedAudit!.norma}`,
            conteudo,
            status: "rascunho",
            elaborado_por: matchedAudit!.auditor ?? "",
            revisado_por: "",
            aprovado_por: "",
          });
        }
      } catch {
        // Silently fail auto-save; user can manually save
      }
    } catch (err: any) {
      toast.error("Erro ao gerar: " + (err?.message ?? "tente novamente"));
    } finally {
      setGenerating(false);
    }
  }, [matchedAudit, findings, auditInfo, total, conformes, ncs, obs, oport, pct, createRai, updateRai]);

  /* ── Build slides ── */
  const slides = useMemo(() => {
    if (!closureData) return [];
    const s: React.ReactNode[] = [];

    /* SLIDE 1 — Capa */
    s.push(
      <Slide key="capa" bg="linear-gradient(135deg, #0E2A47 0%, #2B8EAD 100%)">
        <div className="flex-1 flex flex-col items-center justify-center text-white px-12 text-center">
          <img src="/logo-certifica-oficial.png" alt="Certifica" className="h-[48px] object-contain mb-6 drop-shadow-lg" />
          <div className="text-[13px] tracking-[0.15em] uppercase opacity-70 mb-3">Fechamento de Auditoria</div>
          <div className="text-[32px] font-bold leading-tight mb-2">{auditInfo.norma}</div>
          <div className="text-[18px] font-light opacity-90 mb-8">{auditInfo.empresa}</div>
          <div className="flex gap-12 text-[12px] opacity-80">
            <div><div className="text-[9px] uppercase tracking-widest opacity-60 mb-1">Local</div>{auditInfo.unidade || auditInfo.empresa}</div>
            <div><div className="text-[9px] uppercase tracking-widest opacity-60 mb-1">Data</div>{fmtDate(auditInfo.data)}</div>
            <div><div className="text-[9px] uppercase tracking-widest opacity-60 mb-1">Auditor Líder</div>{auditInfo.auditor}</div>
          </div>
        </div>
      </Slide>
    );

    /* SLIDE 2 — Resultado Geral */
    s.push(
      <Slide key="resultado">
        <div className="px-10 pt-8 pb-4">
          <div className="text-[20px] font-bold text-[#0E2A47] mb-1">Resultado Geral da Auditoria</div>
          <div className="text-[12px] text-[#6B7280] mb-5">Sistema de Gestão com {pct}% de Conformidade</div>
          <div className="flex gap-8 items-start">
            <table className="flex-1 text-[11px] border-collapse">
              <thead><tr className="bg-[#0E2A47] text-white"><th className="px-3 py-2 text-left rounded-tl">Classificação</th><th className="px-3 py-2 text-center">Quantidade</th><th className="px-3 py-2 text-center rounded-tr">Percentual</th></tr></thead>
              <tbody>
                <tr className="border-b border-[#E5E7EB]"><td className="px-3 py-2">Conformes</td><td className="px-3 py-2 text-center font-semibold">{conformes.length}</td><td className="px-3 py-2 text-center">{total > 0 ? Math.round(conformes.length / total * 100) : 0}%</td></tr>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]"><td className="px-3 py-2">Não Conformidades</td><td className="px-3 py-2 text-center font-semibold text-[#DC2626]">{ncs.length}</td><td className="px-3 py-2 text-center">{total > 0 ? Math.round(ncs.length / total * 100) : 0}%</td></tr>
                <tr className="border-b border-[#E5E7EB]"><td className="px-3 py-2">Observações</td><td className="px-3 py-2 text-center font-semibold text-[#D97706]">{obs.length}</td><td className="px-3 py-2 text-center">{total > 0 ? Math.round(obs.length / total * 100) : 0}%</td></tr>
                <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB]"><td className="px-3 py-2">Melhorias</td><td className="px-3 py-2 text-center font-semibold text-[#2563EB]">{oport.length}</td><td className="px-3 py-2 text-center">{total > 0 ? Math.round(oport.length / total * 100) : 0}%</td></tr>
                <tr className="bg-[#F0F7FA]"><td className="px-3 py-2 font-bold">Total</td><td className="px-3 py-2 text-center font-bold">{total}</td><td className="px-3 py-2 text-center font-bold">100%</td></tr>
              </tbody>
            </table>
            <div className="w-[160px] h-[160px] rounded-full flex items-center justify-center flex-col" style={{ border: `8px solid ${pct >= 85 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444"}` }}>
              <div className="text-[32px] font-extrabold" style={{ color: pct >= 85 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444" }}>{pct}%</div>
              <div className="text-[9px] uppercase tracking-widest text-[#6B7280]">Conformidade</div>
            </div>
          </div>
          {ncs.length > 0 && (
            <div className="mt-4 text-[10px] text-[#6B7280] bg-[#F9FAFB] px-3 py-2 rounded border border-[#E5E7EB]">
              <strong>Nota:</strong> {ncs.filter(n => n.tipo === "nc-maior").length > 0
                ? `${ncs.filter(n => n.tipo === "nc-maior").length} NC(s) Maior(es) identificada(s) — tratamento prioritário necessário.`
                : "Não conformidades classificadas como menores — sem impacto crítico imediato."}
            </div>
          )}
        </div>
      </Slide>
    );

    /* SLIDES 3+ — Pontos Fortes */
    closureData.pontosFortes.forEach((pf, idx) => {
      s.push(
        <Slide key={`pf-${idx}`}>
          <div className="px-10 pt-8 pb-4 flex-1 flex flex-col">
            <div className="text-[10px] uppercase tracking-[0.12em] text-[#2B8EAD] font-semibold mb-1">Pontos Fortes</div>
            <div className="text-[18px] font-bold text-[#0E2A47] mb-1">{pf.categoria}</div>
            <div className="text-[11px] text-[#6B7280] mb-5">{pf.titulo}</div>
            <div className="grid grid-cols-2 gap-3 flex-1">
              {pf.itens.map((item, j) => (
                <div key={j} className="bg-[#F0F7FA] rounded-lg px-4 py-3 border border-[#D1E9F2]">
                  <div className="text-[11px] font-bold text-[#0E2A47] mb-1">{item.titulo}</div>
                  <div className="text-[10px] text-[#374151] leading-relaxed">{item.descricao}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-[10px] text-[#6B7280] italic">{pf.conclusao}</div>
          </div>
        </Slide>
      );
    });

    /* SLIDE — Visão Geral das NCs */
    if (closureData.ncsDetalhadas.length > 0) {
      s.push(
        <Slide key="ncs-overview">
          <div className="px-10 pt-8 pb-4">
            <div className="text-[20px] font-bold text-[#0E2A47] mb-1">Não Conformidades — Visão Geral</div>
            <div className="text-[12px] text-[#6B7280] mb-5">{closureData.ncsDetalhadas.length} Não Conformidade(s) Identificada(s)</div>
            <table className="w-full text-[10px] border-collapse">
              <thead><tr className="bg-[#0E2A47] text-white"><th className="px-3 py-2 text-left">Área</th><th className="px-3 py-2 text-left">Cláusula</th><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-left">Responsável</th></tr></thead>
              <tbody>
                {closureData.ncsDetalhadas.map((nc, i) => (
                  <tr key={i} className={i % 2 === 0 ? "" : "bg-[#F9FAFB]"} style={{ borderBottom: "1px solid #E5E7EB" }}>
                    <td className="px-3 py-2 font-semibold">{nc.area}</td>
                    <td className="px-3 py-2">{nc.clausula}</td>
                    <td className="px-3 py-2">{nc.situacaoAtual.substring(0, 100)}{nc.situacaoAtual.length > 100 ? "..." : ""}</td>
                    <td className="px-3 py-2">{nc.responsavel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Slide>
      );

      /* SLIDES — 1 por NC detalhada */
      closureData.ncsDetalhadas.forEach((nc, idx) => {
        s.push(
          <Slide key={`nc-${idx}`}>
            <div className="px-10 pt-7 pb-4 flex-1 flex flex-col">
              <div className="text-[16px] font-bold text-[#0E2A47] mb-1">{nc.area} — Cláusula {nc.clausula}</div>
              <div className="text-[11px] text-[#6B7280] mb-4">Detalhamento da Não Conformidade</div>

              <div className="grid grid-cols-2 gap-4 flex-1">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-[#DC2626] font-bold mb-1">Situação Atual</div>
                  <div className="text-[10px] text-[#374151] leading-relaxed bg-[#FEF2F2] rounded px-3 py-2 border border-[#FECACA] mb-3">{nc.situacaoAtual}</div>

                  <div className="text-[9px] uppercase tracking-[0.1em] text-[#D97706] font-bold mb-1">Impacto Potencial</div>
                  <div className="space-y-1">
                    {nc.impactoPotencial.map((imp, j) => (
                      <div key={j} className="flex items-start gap-2 text-[10px] text-[#374151]">
                        <span className="text-[#D97706] mt-0.5">•</span>{imp}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-[#2B8EAD] font-bold mb-1">Recomendação</div>
                  <div className="space-y-1.5">
                    {nc.recomendacoes.map((rec, j) => (
                      <div key={j} className="flex items-start gap-2 text-[10px] text-[#374151] bg-[#F0F7FA] rounded px-3 py-1.5 border border-[#D1E9F2]">
                        <span className="text-[#2B8EAD] font-bold">{j + 1}.</span>{rec}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[10px] font-semibold text-[#0E2A47]">Responsável: {nc.responsavel}</div>
                </div>
              </div>
            </div>
          </Slide>
        );
      });
    }

    /* SLIDE — Oportunidades de Melhoria: Visão Geral */
    if (closureData.oportunidades.length > 0) {
      s.push(
        <Slide key="oport-overview">
          <div className="px-10 pt-8 pb-4">
            <div className="text-[20px] font-bold text-[#0E2A47] mb-1">Oportunidades de Melhoria — Visão Geral</div>
            <div className="text-[12px] text-[#6B7280] mb-5">{closureData.oportunidades.length} Oportunidade(s) de Melhoria Identificada(s)</div>
            <table className="w-full text-[10px] border-collapse">
              <thead><tr className="bg-[#0E2A47] text-white"><th className="px-3 py-2 text-left">Área</th><th className="px-3 py-2 text-left">Título</th><th className="px-3 py-2 text-left">Descrição</th><th className="px-3 py-2 text-left">Responsável</th></tr></thead>
              <tbody>
                {closureData.oportunidades.map((op, i) => {
                  const desc = op.situacaoAtual || (op as any).descricao || "";
                  return (
                    <tr key={i} className={i % 2 === 0 ? "" : "bg-[#F9FAFB]"} style={{ borderBottom: "1px solid #E5E7EB" }}>
                      <td className="px-3 py-2 font-semibold">{op.area}</td>
                      <td className="px-3 py-2">{op.titulo || "—"}</td>
                      <td className="px-3 py-2">{desc.substring(0, 100)}{desc.length > 100 ? "..." : ""}</td>
                      <td className="px-3 py-2">{op.responsavel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Slide>
      );

      /* SLIDES — 1 por Oportunidade detalhada */
      closureData.oportunidades.forEach((op, idx) => {
        const situacao = op.situacaoAtual || (op as any).descricao || "";
        const beneficios = op.beneficiosEsperados ?? [];
        s.push(
          <Slide key={`oport-${idx}`}>
            <div className="px-10 pt-7 pb-4 flex-1 flex flex-col">
              <div className="text-[16px] font-bold text-[#0E2A47] mb-1">{op.area} — {op.titulo || "Oportunidade de Melhoria"}</div>
              <div className="text-[11px] text-[#6B7280] mb-4">Detalhamento da Oportunidade de Melhoria</div>

              <div className="grid grid-cols-2 gap-4 flex-1">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-[#2563EB] font-bold mb-1">Situação Atual</div>
                  <div className="text-[10px] text-[#374151] leading-relaxed bg-[#EFF6FF] rounded px-3 py-2 border border-[#BFDBFE] mb-3">{situacao}</div>

                  <div className="text-[9px] uppercase tracking-[0.1em] text-[#0D9488] font-bold mb-1">Benefícios Esperados</div>
                  <div className="space-y-1">
                    {beneficios.map((b, j) => (
                      <div key={j} className="flex items-start gap-2 text-[10px] text-[#374151]">
                        <span className="text-[#0D9488] mt-0.5">•</span>{b}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase tracking-[0.1em] text-[#2B8EAD] font-bold mb-1">Recomendação</div>
                  <div className="space-y-1.5">
                    {op.recomendacoes.map((rec, j) => (
                      <div key={j} className="flex items-start gap-2 text-[10px] text-[#374151] bg-[#F0F7FA] rounded px-3 py-1.5 border border-[#D1E9F2]">
                        <span className="text-[#2B8EAD] font-bold">{j + 1}.</span>{rec}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[10px] font-semibold text-[#0E2A47]">Responsável: {op.responsavel}</div>
                </div>
              </div>
            </div>
          </Slide>
        );
      });
    }

    /* SLIDE — Cronograma */
    if (closureData.cronograma.length > 0) {
      s.push(
        <Slide key="cronograma">
          <div className="px-10 pt-8 pb-4">
            <div className="text-[20px] font-bold text-[#0E2A47] mb-1">Próximos Passos e Cronograma</div>
            <div className="text-[12px] text-[#6B7280] mb-5">Plano de Ação para Resolução de Não Conformidades e Melhorias</div>
            <table className="w-full text-[10px] border-collapse">
              <thead><tr className="bg-[#0E2A47] text-white"><th className="px-3 py-2 text-left">Prioridade</th><th className="px-3 py-2 text-left">Ação Recomendada</th><th className="px-3 py-2 text-left">Responsável</th><th className="px-3 py-2 text-left">Prazo</th></tr></thead>
              <tbody>
                {closureData.cronograma.map((item, i) => {
                  const pc = prioColor(item.prioridade);
                  return (
                    <tr key={i} className={i % 2 === 0 ? "" : "bg-[#F9FAFB]"} style={{ borderBottom: "1px solid #E5E7EB" }}>
                      <td className="px-3 py-2"><span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase" style={{ background: pc.bg, color: pc.color }}>{item.prioridade}</span></td>
                      <td className="px-3 py-2">{item.acao}</td>
                      <td className="px-3 py-2 font-semibold">{item.responsavel}</td>
                      <td className="px-3 py-2">{item.prazo}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-4 text-[10px] text-[#6B7280] italic">Recomenda-se acompanhamento mensal do progresso das ações através de reuniões de análise crítica com os responsáveis.</div>
          </div>
        </Slide>
      );
    }

    /* SLIDE — Síntese Executiva */
    s.push(
      <Slide key="sintese">
        <div className="px-10 pt-7 pb-4 flex-1 flex flex-col">
          <div className="text-[10px] uppercase tracking-[0.12em] text-[#2B8EAD] font-semibold mb-1">Síntese Executiva</div>
          <div className="text-[18px] font-bold text-[#0E2A47] mb-4">Sistema de Gestão — Diagnóstico e Recomendações</div>
          <div className="text-[10.5px] text-[#374151] leading-relaxed mb-5 bg-[#F9FAFB] rounded-lg px-4 py-3 border border-[#E5E7EB]">
            {closureData.sinteseExecutiva.diagnostico}
          </div>
          <div className="grid grid-cols-2 gap-3 flex-1">
            {closureData.sinteseExecutiva.recomendacoes.map((rec, i) => (
              <div key={i} className="bg-[#F0F7FA] rounded-lg px-4 py-3 border border-[#D1E9F2]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full bg-[#2B8EAD] text-white text-[10px] font-bold flex items-center justify-center">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[11px] font-bold text-[#0E2A47]">{rec.titulo}</span>
                </div>
                <div className="text-[10px] text-[#374151] leading-relaxed">{rec.descricao}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-[10px] text-[#6B7280]">
            <strong>Próxima Auditoria:</strong> {closureData.sinteseExecutiva.proximaAuditoria}
          </div>
        </div>
      </Slide>
    );

    /* SLIDE — Encerramento */
    s.push(
      <Slide key="encerramento" bg="linear-gradient(135deg, #0E2A47 0%, #2B8EAD 100%)">
        <div className="flex-1 flex flex-col items-center justify-center text-white px-12 text-center">
          <div className="text-[22px] font-bold mb-3">Dúvidas e Esclarecimentos</div>
          <div className="text-[13px] opacity-80 mb-8 max-w-md">
            Agradecemos a colaboração de toda a equipe durante o processo de auditoria.
          </div>
          <div className="text-[14px] font-semibold mb-1">{auditInfo.auditor}</div>
          <div className="text-[10px] uppercase tracking-[0.12em] opacity-60 mb-1">Auditor Líder</div>
          <div className="text-[11px] opacity-70 mb-6">{fmtDate(auditInfo.data)}</div>
          <div className="text-[10px] opacity-50">{auditInfo.empresa}</div>
        </div>
      </Slide>
    );

    return s;
  }, [closureData, auditInfo, conformes, ncs, obs, oport, total, pct]);

  const totalSlides = slides.length;
  const prev = () => setCurrentSlide((c) => Math.max(0, c - 1));
  const next = () => setCurrentSlide((c) => Math.min(totalSlides - 1, c + 1));

  /* ── Download PDF (all slides) ── */
  const handleDownloadPdf = useCallback(() => {
    if (!closureData) return;
    const logoUrl = window.location.origin + "/logo-certifica-oficial.png";
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const buildSlideHtml = (): string[] => {
      const pages: string[] = [];

      /* Capa */
      pages.push(`<div class="slide" style="background:linear-gradient(135deg,#0E2A47 0%,#2B8EAD 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:48px;">
        <img src="${logoUrl}" style="height:48px;object-fit:contain;margin-bottom:24px;filter:drop-shadow(0 2px 8px rgba(0,0,0,.3));" />
        <div style="font-size:13px;letter-spacing:.15em;text-transform:uppercase;opacity:.7;margin-bottom:12px;">Fechamento de Auditoria</div>
        <div style="font-size:32px;font-weight:700;margin-bottom:8px;">${esc(auditInfo.norma)}</div>
        <div style="font-size:18px;font-weight:300;opacity:.9;margin-bottom:32px;">${esc(auditInfo.empresa)}</div>
        <div style="display:flex;gap:48px;font-size:12px;opacity:.8;">
          <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;opacity:.6;margin-bottom:4px;">Local</div>${esc(auditInfo.unidade || auditInfo.empresa)}</div>
          <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;opacity:.6;margin-bottom:4px;">Data</div>${esc(fmtDate(auditInfo.data))}</div>
          <div><div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;opacity:.6;margin-bottom:4px;">Auditor Líder</div>${esc(auditInfo.auditor)}</div>
        </div>
      </div>`);

      /* Resultado Geral */
      const pctColor = pct >= 85 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444";
      pages.push(`<div class="slide" style="background:#fff;padding:32px 40px;">
        <div style="font-size:20px;font-weight:700;color:#0E2A47;margin-bottom:4px;">Resultado Geral da Auditoria</div>
        <div style="font-size:12px;color:#6B7280;margin-bottom:20px;">Sistema de Gestão com ${pct}% de Conformidade</div>
        <div style="display:flex;gap:32px;align-items:flex-start;">
          <table style="flex:1;font-size:11px;border-collapse:collapse;">
            <thead><tr style="background:#0E2A47;color:#fff;"><th style="padding:8px 12px;text-align:left;">Classificação</th><th style="padding:8px 12px;text-align:center;">Qtd</th><th style="padding:8px 12px;text-align:center;">%</th></tr></thead>
            <tbody>
              <tr style="border-bottom:1px solid #E5E7EB;"><td style="padding:8px 12px;">Conformes</td><td style="padding:8px 12px;text-align:center;font-weight:600;">${conformes.length}</td><td style="padding:8px 12px;text-align:center;">${total > 0 ? Math.round(conformes.length / total * 100) : 0}%</td></tr>
              <tr style="border-bottom:1px solid #E5E7EB;background:#F9FAFB;"><td style="padding:8px 12px;">Não Conformidades</td><td style="padding:8px 12px;text-align:center;font-weight:600;color:#DC2626;">${ncs.length}</td><td style="padding:8px 12px;text-align:center;">${total > 0 ? Math.round(ncs.length / total * 100) : 0}%</td></tr>
              <tr style="border-bottom:1px solid #E5E7EB;"><td style="padding:8px 12px;">Observações</td><td style="padding:8px 12px;text-align:center;font-weight:600;color:#D97706;">${obs.length}</td><td style="padding:8px 12px;text-align:center;">${total > 0 ? Math.round(obs.length / total * 100) : 0}%</td></tr>
              <tr style="border-bottom:1px solid #E5E7EB;background:#F9FAFB;"><td style="padding:8px 12px;">Melhorias</td><td style="padding:8px 12px;text-align:center;font-weight:600;color:#2563EB;">${oport.length}</td><td style="padding:8px 12px;text-align:center;">${total > 0 ? Math.round(oport.length / total * 100) : 0}%</td></tr>
              <tr style="background:#F0F7FA;"><td style="padding:8px 12px;font-weight:700;">Total</td><td style="padding:8px 12px;text-align:center;font-weight:700;">${total}</td><td style="padding:8px 12px;text-align:center;font-weight:700;">100%</td></tr>
            </tbody>
          </table>
          <div style="width:140px;height:140px;border-radius:50%;border:8px solid ${pctColor};display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <div style="font-size:32px;font-weight:800;color:${pctColor};">${pct}%</div>
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#6B7280;">Conformidade</div>
          </div>
        </div>
      </div>`);

      /* Pontos Fortes */
      closureData.pontosFortes.forEach((pf) => {
        pages.push(`<div class="slide" style="background:#fff;padding:32px 40px;">
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#2B8EAD;font-weight:600;margin-bottom:4px;">Pontos Fortes</div>
          <div style="font-size:18px;font-weight:700;color:#0E2A47;margin-bottom:4px;">${esc(pf.categoria)}</div>
          <div style="font-size:11px;color:#6B7280;margin-bottom:20px;">${esc(pf.titulo)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            ${pf.itens.map((item) => `<div style="background:#F0F7FA;border-radius:8px;padding:12px 16px;border:1px solid #D1E9F2;">
              <div style="font-size:11px;font-weight:700;color:#0E2A47;margin-bottom:4px;">${esc(item.titulo)}</div>
              <div style="font-size:10px;color:#374151;line-height:1.5;">${esc(item.descricao)}</div>
            </div>`).join("")}
          </div>
          <div style="margin-top:16px;font-size:10px;color:#6B7280;font-style:italic;">${esc(pf.conclusao)}</div>
        </div>`);
      });

      /* NCs Overview */
      if (closureData.ncsDetalhadas.length > 0) {
        pages.push(`<div class="slide" style="background:#fff;padding:32px 40px;">
          <div style="font-size:20px;font-weight:700;color:#0E2A47;margin-bottom:4px;">Não Conformidades — Visão Geral</div>
          <div style="font-size:12px;color:#6B7280;margin-bottom:20px;">${closureData.ncsDetalhadas.length} NC(s) Identificada(s)</div>
          <table style="width:100%;font-size:10px;border-collapse:collapse;">
            <thead><tr style="background:#0E2A47;color:#fff;"><th style="padding:8px 12px;text-align:left;">Área</th><th style="padding:8px 12px;text-align:left;">Cláusula</th><th style="padding:8px 12px;text-align:left;">Descrição</th><th style="padding:8px 12px;text-align:left;">Responsável</th></tr></thead>
            <tbody>${closureData.ncsDetalhadas.map((nc, i) => `<tr style="border-bottom:1px solid #E5E7EB;${i % 2 ? "background:#F9FAFB;" : ""}"><td style="padding:8px 12px;font-weight:600;">${esc(nc.area)}</td><td style="padding:8px 12px;">${esc(nc.clausula)}</td><td style="padding:8px 12px;">${esc(nc.situacaoAtual.substring(0, 100))}${nc.situacaoAtual.length > 100 ? "..." : ""}</td><td style="padding:8px 12px;">${esc(nc.responsavel)}</td></tr>`).join("")}</tbody>
          </table>
        </div>`);

        /* NC detail slides */
        closureData.ncsDetalhadas.forEach((nc) => {
          pages.push(`<div class="slide" style="background:#fff;padding:28px 40px;">
            <div style="font-size:16px;font-weight:700;color:#0E2A47;margin-bottom:4px;">${esc(nc.area)} — Cláusula ${esc(nc.clausula)}</div>
            <div style="font-size:11px;color:#6B7280;margin-bottom:16px;">Detalhamento da Não Conformidade</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div>
                <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#DC2626;font-weight:700;margin-bottom:4px;">Situação Atual</div>
                <div style="font-size:10px;color:#374151;background:#FEF2F2;border:1px solid #FECACA;border-radius:4px;padding:8px 12px;margin-bottom:12px;">${esc(nc.situacaoAtual)}</div>
                <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#D97706;font-weight:700;margin-bottom:4px;">Impacto Potencial</div>
                ${nc.impactoPotencial.map((imp) => `<div style="font-size:10px;color:#374151;margin-bottom:4px;">• ${esc(imp)}</div>`).join("")}
              </div>
              <div>
                <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#2B8EAD;font-weight:700;margin-bottom:4px;">Recomendação</div>
                ${nc.recomendacoes.map((rec, j) => `<div style="font-size:10px;color:#374151;background:#F0F7FA;border:1px solid #D1E9F2;border-radius:4px;padding:6px 12px;margin-bottom:6px;"><strong style="color:#2B8EAD;">${j + 1}.</strong> ${esc(rec)}</div>`).join("")}
                <div style="margin-top:12px;font-size:10px;font-weight:600;color:#0E2A47;">Responsável: ${esc(nc.responsavel)}</div>
              </div>
            </div>
          </div>`);
        });
      }

      /* Oportunidades Overview */
      if (closureData.oportunidades.length > 0) {
        pages.push(`<div class="slide" style="background:#fff;padding:32px 40px;">
          <div style="font-size:20px;font-weight:700;color:#0E2A47;margin-bottom:4px;">Oportunidades de Melhoria — Visão Geral</div>
          <div style="font-size:12px;color:#6B7280;margin-bottom:20px;">${closureData.oportunidades.length} Oportunidade(s) Identificada(s)</div>
          <table style="width:100%;font-size:10px;border-collapse:collapse;">
            <thead><tr style="background:#0E2A47;color:#fff;"><th style="padding:8px 12px;text-align:left;">Área</th><th style="padding:8px 12px;text-align:left;">Título</th><th style="padding:8px 12px;text-align:left;">Descrição</th><th style="padding:8px 12px;text-align:left;">Responsável</th></tr></thead>
            <tbody>${closureData.oportunidades.map((op, i) => { const d = op.situacaoAtual || (op as any).descricao || ""; return `<tr style="border-bottom:1px solid #E5E7EB;${i % 2 ? "background:#F9FAFB;" : ""}"><td style="padding:8px 12px;font-weight:600;">${esc(op.area)}</td><td style="padding:8px 12px;">${esc(op.titulo || "—")}</td><td style="padding:8px 12px;">${esc(d.substring(0, 100))}${d.length > 100 ? "..." : ""}</td><td style="padding:8px 12px;">${esc(op.responsavel)}</td></tr>`; }).join("")}</tbody>
          </table>
        </div>`);

        /* Oportunidade detail slides */
        closureData.oportunidades.forEach((op) => {
          const sit = op.situacaoAtual || (op as any).descricao || "";
          const bens = op.beneficiosEsperados ?? [];
          pages.push(`<div class="slide" style="background:#fff;padding:28px 40px;">
            <div style="font-size:16px;font-weight:700;color:#0E2A47;margin-bottom:4px;">${esc(op.area)} — ${esc(op.titulo || "Oportunidade de Melhoria")}</div>
            <div style="font-size:11px;color:#6B7280;margin-bottom:16px;">Detalhamento da Oportunidade de Melhoria</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div>
                <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#2563EB;font-weight:700;margin-bottom:4px;">Situação Atual</div>
                <div style="font-size:10px;color:#374151;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:4px;padding:8px 12px;margin-bottom:12px;">${esc(sit)}</div>
                <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#0D9488;font-weight:700;margin-bottom:4px;">Benefícios Esperados</div>
                ${bens.map((b) => `<div style="font-size:10px;color:#374151;margin-bottom:4px;"><span style="color:#0D9488;">•</span> ${esc(b)}</div>`).join("")}
              </div>
              <div>
                <div style="font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#2B8EAD;font-weight:700;margin-bottom:4px;">Recomendação</div>
                ${op.recomendacoes.map((rec, j) => `<div style="font-size:10px;color:#374151;background:#F0F7FA;border:1px solid #D1E9F2;border-radius:4px;padding:6px 12px;margin-bottom:6px;"><strong style="color:#2B8EAD;">${j + 1}.</strong> ${esc(rec)}</div>`).join("")}
                <div style="margin-top:12px;font-size:10px;font-weight:600;color:#0E2A47;">Responsável: ${esc(op.responsavel)}</div>
              </div>
            </div>
          </div>`);
        });
      }

      /* Cronograma */
      if (closureData.cronograma.length > 0) {
        pages.push(`<div class="slide" style="background:#fff;padding:32px 40px;">
          <div style="font-size:20px;font-weight:700;color:#0E2A47;margin-bottom:4px;">Próximos Passos e Cronograma</div>
          <div style="font-size:12px;color:#6B7280;margin-bottom:20px;">Plano de Ação para Resolução</div>
          <table style="width:100%;font-size:10px;border-collapse:collapse;">
            <thead><tr style="background:#0E2A47;color:#fff;"><th style="padding:8px 12px;text-align:left;">Prioridade</th><th style="padding:8px 12px;text-align:left;">Ação</th><th style="padding:8px 12px;text-align:left;">Responsável</th><th style="padding:8px 12px;text-align:left;">Prazo</th></tr></thead>
            <tbody>${closureData.cronograma.map((item, i) => { const pc = prioColor(item.prioridade); return `<tr style="border-bottom:1px solid #E5E7EB;${i % 2 ? "background:#F9FAFB;" : ""}"><td style="padding:8px 12px;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:9px;font-weight:700;text-transform:uppercase;background:${pc.bg};color:${pc.color};">${esc(item.prioridade)}</span></td><td style="padding:8px 12px;">${esc(item.acao)}</td><td style="padding:8px 12px;font-weight:600;">${esc(item.responsavel)}</td><td style="padding:8px 12px;">${esc(item.prazo)}</td></tr>`; }).join("")}</tbody>
          </table>
        </div>`);
      }

      /* Síntese Executiva */
      pages.push(`<div class="slide" style="background:#fff;padding:28px 40px;">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#2B8EAD;font-weight:600;margin-bottom:4px;">Síntese Executiva</div>
        <div style="font-size:18px;font-weight:700;color:#0E2A47;margin-bottom:16px;">Diagnóstico e Recomendações</div>
        <div style="font-size:10.5px;color:#374151;line-height:1.6;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:12px 16px;margin-bottom:20px;">${esc(closureData.sinteseExecutiva.diagnostico)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          ${closureData.sinteseExecutiva.recomendacoes.map((rec, i) => `<div style="background:#F0F7FA;border:1px solid #D1E9F2;border-radius:8px;padding:12px 16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
              <span style="width:20px;height:20px;border-radius:50%;background:#2B8EAD;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;">${String(i + 1).padStart(2, "0")}</span>
              <span style="font-size:11px;font-weight:700;color:#0E2A47;">${esc(rec.titulo)}</span>
            </div>
            <div style="font-size:10px;color:#374151;line-height:1.5;">${esc(rec.descricao)}</div>
          </div>`).join("")}
        </div>
        <div style="margin-top:16px;font-size:10px;color:#6B7280;"><strong>Próxima Auditoria:</strong> ${esc(closureData.sinteseExecutiva.proximaAuditoria)}</div>
      </div>`);

      /* Encerramento */
      pages.push(`<div class="slide" style="background:linear-gradient(135deg,#0E2A47 0%,#2B8EAD 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;padding:48px;">
        <img src="${logoUrl}" style="height:36px;object-fit:contain;margin-bottom:24px;opacity:.7;" />
        <div style="font-size:22px;font-weight:700;margin-bottom:12px;">Dúvidas e Esclarecimentos</div>
        <div style="font-size:13px;opacity:.8;margin-bottom:32px;max-width:400px;">Agradecemos a colaboração de toda a equipe durante o processo de auditoria.</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:4px;">${esc(auditInfo.auditor)}</div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.12em;opacity:.6;margin-bottom:4px;">Auditor Líder</div>
        <div style="font-size:11px;opacity:.7;margin-bottom:24px;">${esc(fmtDate(auditInfo.data))}</div>
        <div style="font-size:10px;opacity:.5;">${esc(auditInfo.empresa)}</div>
      </div>`);

      return pages;
    };

    /* Convert logo to base64 so it renders reliably in the print view */
    const toBase64 = (url: string): Promise<string> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d")!.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve(url); // fallback to original URL
        img.src = url;
      });

    toBase64(logoUrl).then((logoDataUrl) => {
      /* Replace logo URL with base64 data URL in all slide HTML */
      const escapedLogoUrl = logoUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pages = buildSlideHtml().map((p) => p.replace(new RegExp(escapedLogoUrl, "g"), logoDataUrl));

      const printWin = window.open("", "_blank");
      if (!printWin) { toast.warning("Habilite pop-ups para salvar o PDF."); return; }

      printWin.document.write(`<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8">
<title>Fechamento de Auditoria — ${esc(auditInfo.empresa)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',-apple-system,sans-serif;background:#fff;}
  .slide{width:100%;aspect-ratio:16/9;overflow:hidden;page-break-after:always;position:relative;}
  .slide:last-child{page-break-after:auto;}
  .print-hint{text-align:center;padding:12px;background:#FFFBEB;border-bottom:1px solid #FDE68A;font-size:13px;color:#92400E;font-family:'Inter',sans-serif;}
  @media print{
    body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    @page{size:landscape;margin:0;}
    .slide{width:100vw;height:100vh;}
    .print-hint{display:none;}
  }
</style></head>
<body>
<div class="print-hint">Salve como PDF: use <strong>Ctrl+P</strong> (ou <strong>Cmd+P</strong> no Mac) e selecione <strong>"Salvar como PDF"</strong> no destino da impressora.</div>
${pages.join("\n")}</body></html>`);
      printWin.document.close();

      /* Wait for fonts/images to load, then trigger print */
      printWin.onload = () => {
        setTimeout(() => {
          printWin.focus();
          printWin.print();
        }, 300);
      };

      /* Auto-close the window after printing (or cancelling) */
      printWin.onafterprint = () => {
        printWin.close();
      };

      /* Fallback: if onload doesn't fire (some browsers), trigger after a delay */
      setTimeout(() => {
        if (!printWin.closed) {
          printWin.focus();
          printWin.print();
        }
      }, 2000);

      toast.info("Use 'Salvar como PDF' na janela de impressão que será aberta.");
    });
  }, [closureData, auditInfo, conformes, ncs, obs, oport, total, pct]);

  /* ── Keyboard navigation ── */
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [totalSlides]);

  /* ── Render ── */
  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F3F4F6]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-certifica-200">
        <div>
          <h3 className="text-certifica-900 text-[15px]" style={{ fontWeight: 600 }}>Fechamento de Auditoria</h3>
          <p className="text-[12px] text-certifica-500">
            {auditInfo.codigo} · {auditInfo.norma} · {auditInfo.empresa}
          </p>
        </div>
        <div className="flex gap-2">
          <DSButton
            variant="primary"
            size="sm"
            icon={generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? "Gerando..." : closureData ? "Regenerar" : "Gerar Fechamento"}
          </DSButton>
          {closureData && (
            <>
              <DSButton
                variant="outline"
                size="sm"
                icon={saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar"}
              </DSButton>
              <DSButton
                variant="outline"
                size="sm"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={handleDownloadPdf}
              >
                Salvar como PDF
              </DSButton>
              <DSButton
                variant="outline"
                size="sm"
                icon={<Presentation className="w-3.5 h-3.5" />}
                onClick={() => {
                  const el = document.getElementById("closure-slide-container");
                  if (el?.requestFullscreen) el.requestFullscreen();
                }}
              >
                Apresentar
              </DSButton>
            </>
          )}
        </div>
      </div>

      {/* Slide area */}
      {!closureData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Presentation className="w-12 h-12 text-certifica-400 mx-auto mb-4" strokeWidth={1} />
            <h4 className="text-[16px] text-certifica-700 mb-2" style={{ fontWeight: 600 }}>Fechamento Executivo de Auditoria</h4>
            <p className="text-[12px] text-certifica-500 mb-4 leading-relaxed">
              Gere automaticamente uma apresentação executiva completa a partir dos dados da auditoria.
              Inclui pontos fortes, análise detalhada de NCs, cronograma e síntese executiva.
            </p>
            <p className="text-[11px] text-certifica-400">
              {matchedAudit
                ? `Auditoria ${auditInfo.codigo} com ${total} constatação(ões) — pronto para gerar.`
                : "Acesse via Auditorias para selecionar uma auditoria."}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-hidden" id="closure-slide-container">
          {/* Slide */}
          <div className="w-full max-w-[860px]">
            {slides[currentSlide]}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={prev}
              disabled={currentSlide === 0}
              className="w-8 h-8 rounded-full border border-[#D1D5DB] flex items-center justify-center text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-[12px] text-[#6B7280] font-mono">
              {currentSlide + 1} / {totalSlides}
            </div>
            <button
              onClick={next}
              disabled={currentSlide === totalSlides - 1}
              className="w-8 h-8 rounded-full border border-[#D1D5DB] flex items-center justify-center text-[#6B7280] hover:bg-[#F9FAFB] disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Slide dots */}
            <div className="flex gap-1 ml-4">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    background: i === currentSlide ? "#2B8EAD" : "#D1D5DB",
                    width: i === currentSlide ? 16 : 8,
                  }}
                />
              ))}
            </div>

            <div className="text-[10px] text-[#9CA3AF] ml-4">
              ← → ou espaço para navegar
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
