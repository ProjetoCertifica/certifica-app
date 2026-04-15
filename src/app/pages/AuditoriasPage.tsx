import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { toast } from "sonner";

import { DSCard } from "../components/ds/DSCard";
import { DSBadge } from "../components/ds/DSBadge";
import { DSButton } from "../components/ds/DSButton";
import {
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  AlertTriangle,
  FileText,
  Eye,
  X,
  ClipboardList,
  Save,
  Sparkles,
  Loader2,
  Trash2,
} from "lucide-react";
import { useAudits, fetchClientesSimple } from "../lib/useAudits";
import type { AuditInsert } from "../lib/useAudits";
import { generate5W2H } from "../lib/openai";

type AuditStatus = "planejada" | "em-andamento" | "concluida" | "cancelada";
type BadgeVariant = "conformidade" | "nao-conformidade" | "observacao" | "oportunidade" | "outline";
type RaiClassification = "conformidade" | "nao-conformidade" | "observacao" | "oportunidade";

const statusConfig: Record<AuditStatus, { label: string; variant: BadgeVariant }> = {
  planejada: { label: "Planejada", variant: "oportunidade" },
  "em-andamento": { label: "Em andamento", variant: "observacao" },
  concluida: { label: "Concluida", variant: "conformidade" },
  cancelada: { label: "Cancelada", variant: "outline" },
};

const raiClassificationConfig: Record<RaiClassification, { label: string; variant: BadgeVariant }> = {
  conformidade: { label: "Conformidade", variant: "conformidade" },
  "nao-conformidade": { label: "Nao conformidade", variant: "nao-conformidade" },
  observacao: { label: "Observacao", variant: "observacao" },
  oportunidade: { label: "Oportunidade de melhoria", variant: "oportunidade" },
};

export default function AuditoriasPage() {
  const navigate = useNavigate();
  const { audits, loading, error, create, update, remove, updateFinding } = useAudits();

  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRaiModalOpen, setIsRaiModalOpen] = useState(false);
  const [is5W2HOpen, setIs5W2HOpen] = useState(false);
  const [selected5W2HNcId, setSelected5W2HNcId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; codigo: string; cliente: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  useBodyScrollLock(isCreateModalOpen || isRaiModalOpen || is5W2HOpen || !!deleteTarget);

  // 5W2H plan state — persisted per NC in localStorage
  const [plano5W2H, setPlano5W2H] = useState({
    oQue: "",      // What
    porQue: "",    // Why
    quem: "",      // Who
    quando: "",    // When
    onde: "",      // Where
    como: "",      // How
    quantoCusta: "", // How much
  });

  const PLANS_KEY = "certifica_5w2h_plans";
  const PLAN_JSON_MARKER = "<!-- 5W2H_JSON:";

  const loadPlanFromLocalStorage = (ncId: string) => {
    try {
      const stored = JSON.parse(localStorage.getItem(PLANS_KEY) || "{}");
      return stored[ncId] ?? null;
    } catch { return null; }
  };

  /** Try to parse structured 5W2H JSON embedded in acao_corretiva field */
  const loadPlanFromFinding = (ncId: string): typeof plano5W2H | null => {
    try {
      const finding = audits.flatMap((a) => a.findings).find((f) => f.id === ncId);
      if (!finding?.acao_corretiva) return null;
      const raw = finding.acao_corretiva;
      const markerIdx = raw.indexOf(PLAN_JSON_MARKER);
      if (markerIdx === -1) return null;
      const jsonStart = markerIdx + PLAN_JSON_MARKER.length;
      const jsonEnd = raw.indexOf("-->", jsonStart);
      if (jsonEnd === -1) return null;
      const parsed = JSON.parse(raw.substring(jsonStart, jsonEnd));
      if (parsed && typeof parsed.oQue === "string") return parsed;
      return null;
    } catch { return null; }
  };

  /** Load plan: localStorage first (fast), then Supabase finding fallback */
  const loadPlan = (ncId: string) => {
    return loadPlanFromLocalStorage(ncId) ?? loadPlanFromFinding(ncId);
  };

  const savePlan = (ncId: string, plan: typeof plano5W2H) => {
    try {
      const stored = JSON.parse(localStorage.getItem(PLANS_KEY) || "{}");
      stored[ncId] = plan;
      localStorage.setItem(PLANS_KEY, JSON.stringify(stored));
    } catch { /* silent */ }
  };

  const [aiLoading5W2H, setAiLoading5W2H] = useState(false);

  const open5W2H = (ncId: string) => {
    const existing = loadPlan(ncId);
    setPlano5W2H(existing ?? { oQue: "", porQue: "", quem: "", quando: "", onde: "", como: "", quantoCusta: "" });
    setSelected5W2HNcId(ncId);
    setIs5W2HOpen(true);
  };

  const handleAI5W2H = async (nc: typeof openNCs[number], auditNorma?: string) => {
    setAiLoading5W2H(true);
    try {
      const result = await generate5W2H({
        descricao: nc.descricao,
        evidencia: nc.evidencia,
        clausula: nc.clausula,
        norma: auditNorma,
        tipo: nc.tipo === "nc-maior" ? "NC Maior" : "NC Menor",
      });
      setPlano5W2H(result);
      toast.success("Plano 5W2H gerado com IA! Revise e ajuste os campos.");
    } catch (err: any) {
      toast.error("Erro ao gerar sugestão: " + (err?.message ?? "Tente novamente."));
    } finally {
      setAiLoading5W2H(false);
    }
  };
  const [copiedRai, setCopiedRai] = useState(false);
  const [clienteOptions, setClienteOptions] = useState<{ id: string; razao_social: string }[]>([]);
  const [newAudit, setNewAudit] = useState({
    cliente_id: "",
    standard: "",
    type: "interna" as "interna" | "externa" | "certificacao",
    auditor: "",
    dateStart: "",
    dateEnd: "",
    status: "planejada" as AuditStatus,
  });
  const [raiDraft, setRaiDraft] = useState({
    auditId: "",
    evidencia: "",
    requisito: "",
    classificacao: "observacao" as RaiClassification,
    recomendacao: "",
  });

  useEffect(() => {
    fetchClientesSimple().then(setClienteOptions);
  }, []);

  useEffect(() => {
    if (audits.length > 0 && !raiDraft.auditId) {
      const preferred = audits.find((a) => a.status === "em-andamento") ?? audits[0];
      setRaiDraft((prev) => ({
        ...prev,
        auditId: preferred?.id ?? "",
        requisito: preferred?.norma ?? "",
      }));
    }
  }, [audits]);

  const filtered = statusFilter === "todos"
    ? audits
    : audits.filter((a) => a.status === statusFilter);

  const counts = {
    total: audits.length,
    planejada: audits.filter((a) => a.status === "planejada").length,
    andamento: audits.filter((a) => a.status === "em-andamento").length,
    concluida: audits.filter((a) => a.status === "concluida").length,
  };

  const openNCs = audits
    .flatMap((a) => a.findings)
    .filter((f) => (f.tipo === "nc-maior" || f.tipo === "nc-menor") && f.status === "aberta");

  const totalFindings = audits.reduce(
    (acc, a) => {
      const f = a.findings;
      return {
        c: acc.c + f.filter((x) => x.tipo === "conformidade").length,
        nc: acc.nc + f.filter((x) => x.tipo.includes("nc")).length,
        obs: acc.obs + f.filter((x) => x.tipo === "observacao").length,
        opm: acc.opm + f.filter((x) => x.tipo === "oportunidade").length,
      };
    },
    { c: 0, nc: 0, obs: 0, opm: 0 }
  );

  const toBrDate = (isoDate: string) => {
    if (!isoDate || !isoDate.includes("-")) return isoDate ?? "";
    const [yyyy, mm, dd] = isoDate.split("-");
    return `${dd}/${mm}/${yyyy}`;
  };

  const cycleStatus = async (auditId: string, currentStatus: string) => {
    const cycle: Record<string, AuditStatus> = {
      planejada: "em-andamento",
      "em-andamento": "concluida",
      concluida: "planejada",
    };
    const next = cycle[currentStatus];
    if (!next) return;
    const result = await update(auditId, { status: next });
    if (result) {
      toast.success(`Status atualizado para "${statusConfig[next].label}"`);
    } else {
      toast.error("Erro ao atualizar status.");
    }
  };

  const generateCodigo = () => {
    const year = new Date().getFullYear();
    return `AUD-${year}-${String(audits.length + 1).padStart(4, "0")}`;
  };

  const selectedRaiAudit = audits.find((a) => a.id === raiDraft.auditId) ?? null;

  const getSuggestedRecommendation = (classification: RaiClassification) => {
    switch (classification) {
      case "conformidade":
        return "Manter o controle implementado e registrar evidencia no historico da auditoria.";
      case "nao-conformidade":
        return "Abrir plano de acao corretiva com responsavel definido e prazo maximo de 15 dias.";
      case "observacao":
        return "Registrar observacao e acompanhar no proximo ciclo para evitar evolucao para NC.";
      case "oportunidade":
        return "Avaliar melhoria de processo e incluir acao de otimizacao no plano de auditoria.";
      default:
        return "";
    }
  };

  const buildRaiText = () => {
    if (!selectedRaiAudit) return "";
    const classificacaoLabel = raiClassificationConfig[raiDraft.classificacao].label;
    const clienteNome = selectedRaiAudit.cliente_nome ?? selectedRaiAudit.escopo ?? "";
    const descricao = `Durante a auditoria ${selectedRaiAudit.tipo} em ${clienteNome}, referente a ${selectedRaiAudit.norma}, foi analisado o requisito "${raiDraft.requisito || selectedRaiAudit.norma}".`;
    const evidencia = raiDraft.evidencia || "Evidencia ainda nao informada.";
    const recomendacao = raiDraft.recomendacao || getSuggestedRecommendation(raiDraft.classificacao);

    return [
      `RAI - ${selectedRaiAudit.codigo}`,
      `Cliente: ${clienteNome}`,
      `Norma: ${selectedRaiAudit.norma}`,
      `Auditor: ${selectedRaiAudit.auditor}`,
      `Periodo: ${toBrDate(selectedRaiAudit.data_inicio ?? "")} a ${toBrDate(selectedRaiAudit.data_fim ?? "")}`,
      "",
      "1. Descricao",
      descricao,
      "",
      "2. Evidencia objetiva",
      evidencia,
      "",
      "3. Requisito tecnico",
      raiDraft.requisito || selectedRaiAudit.norma,
      "",
      "4. Classificacao",
      classificacaoLabel,
      "",
      "5. Recomendacao / Acao sugerida",
      recomendacao,
    ].join("\n");
  };

  const handleCopyRai = async () => {
    const raiText = buildRaiText();
    if (!raiText) return;
    try {
      await navigator.clipboard.writeText(raiText);
      setCopiedRai(true);
      setTimeout(() => setCopiedRai(false), 1500);
    } catch {
      setCopiedRai(false);
    }
  };

  const handleCreateAudit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const selectedCliente = clienteOptions.find((c) => c.id === newAudit.cliente_id);
    const clienteNome = selectedCliente?.razao_social ?? "";

    const payload: AuditInsert = {
      codigo: generateCodigo(),
      tipo: newAudit.type,
      cliente_id: newAudit.cliente_id,
      auditor: newAudit.auditor.trim(),
      data_inicio: newAudit.dateStart || undefined,
      data_fim: newAudit.dateEnd || undefined,
      status: newAudit.status,
      escopo: clienteNome,
      norma: newAudit.standard.trim(),
      observacoes: "",
    };

    const result = await create(payload);
    if (!result) {
      toast.error("Erro ao criar auditoria.");
      return;
    }

    setIsCreateModalOpen(false);
    setNewAudit({
      cliente_id: "",
      standard: "",
      type: "interna",
      auditor: "",
      dateStart: "",
      dateEnd: "",
      status: "planejada",
    });
    setStatusFilter("todos");
    toast.success("Auditoria criada com sucesso.");
  };

  const openRaiEditor = () => {
    if (!selectedRaiAudit) return;
    const clienteNome = selectedRaiAudit.cliente_nome ?? selectedRaiAudit.escopo ?? "";
    const payload = {
      auditId: selectedRaiAudit.id,
      client: clienteNome,
      standard: selectedRaiAudit.norma,
      auditor: selectedRaiAudit.auditor,
      classificacao: raiDraft.classificacao,
      requisito: raiDraft.requisito,
      evidencia: raiDraft.evidencia,
      recomendacao: raiDraft.recomendacao || getSuggestedRecommendation(raiDraft.classificacao),
      source: "auditorias-modal",
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem("certifica:rai-context", JSON.stringify(payload));
    setIsRaiModalOpen(false);
    navigate(`/auditorias/rai?auditId=${encodeURIComponent(selectedRaiAudit.id)}`);
  };

  return (
    <div className="p-5 space-y-4 certifica-page-enter">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-[4px] px-3 py-2 text-[12px]">
          {error}
        </div>
      )}

      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-certifica-900">Auditorias</h2>
          <p className="text-[12px] text-certifica-500 mt-0.5" style={{ fontWeight: 400 }}>
            {counts.andamento} em andamento &middot; {counts.planejada} planejadas &middot; {counts.concluida} concluidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DSButton
            variant="outline"
            size="sm"
            icon={<FileText className="w-3.5 h-3.5" strokeWidth={1.5} />}
            onClick={() => {
              const preferredAudit = audits.find((a) => a.status === "em-andamento") ?? audits[0];
              setRaiDraft({
                auditId: preferredAudit?.id ?? "",
                evidencia: "",
                requisito: preferredAudit?.norma ?? "",
                classificacao: "observacao",
                recomendacao: "",
              });
              setIsRaiModalOpen(true);
            }}
          >
            Gerar RAI
          </DSButton>
          <DSButton
            variant="primary"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Nova auditoria
          </DSButton>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {[
          { label: "Nao conformidades abertas", value: String(openNCs.length), color: "text-nao-conformidade" },
          { label: "Conformidades registradas", value: String(totalFindings.c), color: "text-conformidade" },
          { label: "Observacoes", value: String(totalFindings.obs), color: "text-observacao" },
          { label: "Oportunidades", value: String(totalFindings.opm), color: "text-oportunidade" },
        ].map((item) => (
          <div key={item.label} className="flex items-baseline gap-1.5">
            <span className={`text-[20px] ${item.color}`} style={{ fontWeight: 600, lineHeight: "1" }}>{item.value}</span>
            <span className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>{item.label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[13px] text-certifica-500">
          Carregando...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0 border border-certifica-200 rounded-[3px] overflow-hidden">
                {[
                  { key: "todos", label: "Todas" },
                  { key: "planejada", label: "Planejadas" },
                  { key: "em-andamento", label: "Em andamento" },
                  { key: "concluida", label: "Concluidas" },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`px-3 py-1.5 text-[11px] cursor-pointer transition-colors border-r border-certifica-200 last:border-r-0 ${
                      statusFilter === f.key
                        ? "bg-certifica-900 text-white"
                        : "bg-white text-certifica-500 hover:bg-certifica-50"
                    }`}
                    style={{ fontWeight: statusFilter === f.key ? 500 : 400 }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {filtered.map((audit) => {
                const sc = statusConfig[audit.status as AuditStatus] ?? statusConfig.planejada;
                const f = audit.findings;
                const fc = {
                  c: f.filter((x) => x.tipo === "conformidade").length,
                  nc: f.filter((x) => x.tipo.includes("nc")).length,
                  obs: f.filter((x) => x.tipo === "observacao").length,
                  opm: f.filter((x) => x.tipo === "oportunidade").length,
                };
                const hasFindings = fc.c + fc.nc + fc.obs + fc.opm > 0;
                const clienteNome = audit.cliente_nome ?? audit.escopo ?? "";
                const mappedClassification: RaiClassification =
                  fc.nc > 0
                    ? "nao-conformidade"
                    : fc.obs > 0
                      ? "observacao"
                      : fc.opm > 0
                        ? "oportunidade"
                        : "conformidade";
                return (
                  <div key={audit.id} className="bg-white border border-certifica-200 rounded-[4px] px-4 py-3 hover:bg-certifica-50/30 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[12px] text-certifica-700 font-mono" style={{ fontWeight: 600 }}>{audit.codigo}</span>
                          <button
                            className="flex items-center gap-0 group cursor-pointer"
                            title={`Avançar status para ${statusConfig[({ planejada: "em-andamento", "em-andamento": "concluida", concluida: "planejada" } as Record<string, AuditStatus>)[audit.status as string] ?? "planejada"]?.label ?? ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              cycleStatus(audit.id, audit.status);
                            }}
                          >
                            <DSBadge variant={sc.variant} className="text-[9px] px-1.5 py-0 group-hover:opacity-80 transition-opacity">{sc.label}</DSBadge>
                          </button>
                          {audit.tipo !== "interna" && (
                            <span className="text-[9px] bg-certifica-900/8 text-certifica-900 rounded-[2px] px-1.5 py-px" style={{ fontWeight: 500 }}>
                              {audit.tipo}
                            </span>
                          )}
                        </div>
                        <div className="text-[13px] text-certifica-dark" style={{ fontWeight: 500 }}>
                          {clienteNome}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          className="p-1 text-certifica-500/30 hover:text-certifica-700 transition-colors cursor-pointer"
                          title="Ver detalhes da auditoria"
                          onClick={(e) => {
                            e.stopPropagation();
                            const payload = {
                              auditId: audit.id,
                              client: clienteNome,
                              standard: audit.norma,
                              auditor: audit.auditor,
                              classificacao: mappedClassification,
                              requisito: audit.norma,
                              evidencia: "",
                              recomendacao: getSuggestedRecommendation(mappedClassification),
                              source: "auditorias-eye",
                              createdAt: new Date().toISOString(),
                            };
                            localStorage.setItem("certifica:rai-context", JSON.stringify(payload));
                            navigate(`/auditorias/rai?auditId=${encodeURIComponent(audit.id)}`);
                          }}
                        >
                          <Eye className="w-[14px] h-[14px]" strokeWidth={1.5} />
                        </button>
                        <button
                          className="p-1 text-certifica-500/30 hover:text-red-500 transition-colors cursor-pointer"
                          title="Apagar auditoria"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: audit.id, codigo: audit.codigo, cliente: clienteNome });
                          }}
                        >
                          <Trash2 className="w-[14px] h-[14px]" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>
                      <span className="font-mono">{audit.norma}</span>
                      <span>&middot;</span>
                      <span>{toBrDate(audit.data_inicio ?? "")} — {toBrDate(audit.data_fim ?? "")}</span>
                      <span>&middot;</span>
                      <span>{audit.auditor}</span>
                    </div>

                    {hasFindings && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-certifica-200/60">
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-conformidade" strokeWidth={1.5} />
                          <span className="text-[10.5px] text-certifica-dark" style={{ fontWeight: 500 }}>{fc.c}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-nao-conformidade" strokeWidth={1.5} />
                          <span className="text-[10.5px] text-certifica-dark" style={{ fontWeight: 500 }}>{fc.nc}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-observacao" strokeWidth={1.5} />
                          <span className="text-[10.5px] text-certifica-dark" style={{ fontWeight: 500 }}>{fc.obs}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3 text-oportunidade" strokeWidth={1.5} />
                          <span className="text-[10.5px] text-certifica-dark" style={{ fontWeight: 500 }}>{fc.opm}</span>
                        </div>
                      </div>
                    )}
                    <div className="mt-2 flex justify-end">
                      <DSButton
                        variant="outline"
                        size="sm"
                        icon={<FileText className="w-3 h-3" strokeWidth={1.5} />}
                        onClick={() => {
                          const payload = {
                            auditId: audit.id,
                            client: clienteNome,
                            standard: audit.norma,
                            auditor: audit.auditor,
                            classificacao: mappedClassification,
                            requisito: audit.norma,
                            evidencia: "",
                            recomendacao: getSuggestedRecommendation(mappedClassification),
                            source: "auditorias-card",
                            createdAt: new Date().toISOString(),
                          };
                          localStorage.setItem("certifica:rai-context", JSON.stringify(payload));
                          navigate(`/auditorias/rai?auditId=${encodeURIComponent(audit.id)}`);
                        }}
                      >
                        Abrir RAI
                      </DSButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <DSCard
              header={
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>NCs abertas</span>
                    <span className="text-[10px] bg-nao-conformidade/10 text-nao-conformidade rounded-[2px] px-1.5 py-px" style={{ fontWeight: 600 }}>
                      {openNCs.length}
                    </span>
                  </div>
                </div>
              }
            >
              <div className="space-y-0">
                {openNCs.map((nc, idx) => {
                  const prazoDate = nc.prazo ? new Date(nc.prazo) : null;
                  const days = prazoDate
                    ? Math.ceil((prazoDate.getTime() - Date.now()) / 86400000)
                    : null;
                  const auditForNc = audits.find((a) => a.id === nc.audit_id);
                  const clienteNc = auditForNc?.cliente_nome ?? auditForNc?.escopo ?? "";
                  const severity = nc.tipo === "nc-maior" ? "maior" : "menor";
                  return (
                    <div key={nc.id} className={`py-2.5 ${idx > 0 ? "border-t border-certifica-200" : ""}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-certifica-700 font-mono" style={{ fontWeight: 600 }}>{nc.clausula}</span>
                          <span className={`text-[9px] rounded-[2px] px-1 py-px ${
                            severity === "maior"
                              ? "bg-nao-conformidade/10 text-nao-conformidade"
                              : "bg-observacao/10 text-observacao"
                          }`} style={{ fontWeight: 600 }}>
                            {severity === "maior" ? "MAIOR" : "MENOR"}
                          </span>
                        </div>
                        {days !== null && (
                          <span className="text-[10px] text-certifica-500/60" style={{ fontWeight: 400 }}>
                            {days}d
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-certifica-dark mb-0.5" style={{ fontWeight: 400, lineHeight: "1.4" }}>
                        {nc.descricao}
                      </p>
                      <div className="text-[10.5px] text-certifica-500" style={{ fontWeight: 400 }}>
                        {clienteNc} &middot; {nc.clausula}
                      </div>
                      <div className="mt-1.5">
                        <button
                          onClick={() => open5W2H(nc.id)}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-[3px] border border-certifica-accent/40 text-certifica-accent hover:bg-certifica-accent-light transition-colors cursor-pointer"
                        >
                          <ClipboardList className="w-3 h-3" strokeWidth={1.5} />
                          {loadPlan(nc.id) ? "Ver Plano 5W2H" : "Criar Plano 5W2H"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {openNCs.length === 0 && (
                  <p className="text-[12px] text-certifica-500 py-2">Nenhuma NC aberta.</p>
                )}
              </div>
            </DSCard>

            <DSCard
              header={
                <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Proximas auditorias</span>
              }
            >
              <div className="space-y-0">
                {audits
                  .filter((a) => a.status === "planejada" || a.status === "em-andamento")
                  .map((a, idx) => {
                    const sc = statusConfig[a.status as AuditStatus] ?? statusConfig.planejada;
                    const dateDisplay = toBrDate(a.data_inicio ?? "");
                    const clienteNome = a.cliente_nome ?? a.escopo ?? "";
                    return (
                      <div key={a.id} className={`flex gap-3 py-2.5 ${idx > 0 ? "border-t border-certifica-200" : ""}`}>
                        <div className="w-[50px] flex-shrink-0">
                          <div className="text-[11px] text-certifica-700 font-mono" style={{ fontWeight: 500 }}>
                            {dateDisplay.substring(0, 5)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] text-certifica-dark mb-0.5" style={{ fontWeight: 500 }}>
                            {clienteNome}
                          </div>
                          <div className="text-[10.5px] text-certifica-500" style={{ fontWeight: 400 }}>
                            {a.norma} &middot; {a.tipo} &middot; {a.auditor}
                          </div>
                        </div>
                        <DSBadge variant={sc.variant} className="text-[8px] px-1.5 py-0 flex-shrink-0">
                          {sc.label}
                        </DSBadge>
                      </div>
                    );
                  })}
              </div>
            </DSCard>

            <div className="bg-white border border-certifica-200 rounded-[4px] px-4 py-3">
              <div className="text-[10px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
                Resumo do ciclo
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Auditorias realizadas", value: String(counts.concluida) },
                  { label: "Taxa de conformidade", value: "78%" },
                  { label: "Tempo medio (dias)", value: "1.8" },
                  { label: "NCs encerradas / total", value: "12/16" },
                ].map((s) => (
                  <div key={s.label}>
                    <div className="text-[15px] text-certifica-900" style={{ fontWeight: 600, lineHeight: "1.3" }}>{s.value}</div>
                    <div className="text-[10px] text-certifica-500" style={{ fontWeight: 400 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-certifica-dark/45 certifica-modal-backdrop"
            onClick={() => setIsCreateModalOpen(false)}
          />
          <div className="relative w-full max-w-[560px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] certifica-modal-content">
            <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
              <div>
                <h3 className="text-certifica-900 text-[15px]" style={{ fontWeight: 600 }}>
                  Nova auditoria
                </h3>
                <p className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>
                  Cadastre uma nova auditoria para o painel.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 text-certifica-500/40 hover:text-certifica-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleCreateAudit} className="p-4 grid grid-cols-2 gap-3">
              <label className="col-span-2 text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                Cliente
                <select
                  required
                  value={newAudit.cliente_id}
                  onChange={(e) => setNewAudit((prev) => ({ ...prev, cliente_id: e.target.value }))}
                  className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                >
                  <option value="">Selecione um cliente</option>
                  {clienteOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.razao_social}</option>
                  ))}
                </select>
              </label>

              <label className="col-span-2 text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                Norma
                <input
                  required
                  value={newAudit.standard}
                  onChange={(e) => setNewAudit((prev) => ({ ...prev, standard: e.target.value }))}
                  className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                  placeholder="Ex.: ISO 9001:2015"
                />
              </label>

              <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                Tipo
                <select
                  value={newAudit.type}
                  onChange={(e) => setNewAudit((prev) => ({ ...prev, type: e.target.value as "interna" | "externa" | "certificacao" }))}
                  className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                >
                  <option value="interna">Interna</option>
                  <option value="externa">Externa</option>
                  <option value="certificacao">Certificacao</option>
                </select>
              </label>

              <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                Status
                <select
                  value={newAudit.status}
                  onChange={(e) => setNewAudit((prev) => ({ ...prev, status: e.target.value as AuditStatus }))}
                  className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                >
                  <option value="planejada">Planejada</option>
                  <option value="em-andamento">Em andamento</option>
                  <option value="concluida">Concluida</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </label>

              <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                Inicio
                <input
                  type="date"
                  value={newAudit.dateStart}
                  onChange={(e) => setNewAudit((prev) => ({ ...prev, dateStart: e.target.value }))}
                  className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                />
              </label>

              <label className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                Fim
                <input
                  type="date"
                  value={newAudit.dateEnd}
                  onChange={(e) => setNewAudit((prev) => ({ ...prev, dateEnd: e.target.value }))}
                  className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                />
              </label>

              <label className="col-span-2 text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                Auditor responsavel
                <input
                  required
                  value={newAudit.auditor}
                  onChange={(e) => setNewAudit((prev) => ({ ...prev, auditor: e.target.value }))}
                  className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                  placeholder="Ex.: Carlos Silva"
                />
              </label>

              <div className="col-span-2 flex items-center justify-end gap-2 pt-1">
                <DSButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancelar
                </DSButton>
                <DSButton type="submit" variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                  Criar auditoria
                </DSButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRaiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-certifica-dark/45 certifica-modal-backdrop"
            onClick={() => setIsRaiModalOpen(false)}
          />
          <div className="relative w-full max-w-[920px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] certifica-modal-content">
            <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
              <div>
                <h3 className="text-certifica-900 text-[15px]" style={{ fontWeight: 600 }}>
                  Gerar RAI
                </h3>
                <p className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>
                  Relatório estruturado conforme o briefing: descrição, evidência objetiva, requisito técnico, classificação e recomendação.
                </p>
              </div>
              <button
                onClick={() => setIsRaiModalOpen(false)}
                className="p-1 text-certifica-500/40 hover:text-certifica-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="grid grid-cols-[1fr_1fr] gap-0 max-h-[78vh]">
              <div className="p-4 border-r border-certifica-200 overflow-y-auto space-y-3">
                <label className="block text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Auditoria base
                  <select
                    value={raiDraft.auditId}
                    onChange={(e) => {
                      const selected = audits.find((a) => a.id === e.target.value);
                      setRaiDraft((prev) => ({
                        ...prev,
                        auditId: e.target.value,
                        requisito: selected?.norma ?? prev.requisito,
                      }));
                    }}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                  >
                    {audits.map((audit) => (
                      <option key={audit.id} value={audit.id}>
                        {audit.codigo} - {audit.cliente_nome ?? audit.escopo ?? ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Evidencia objetiva
                  <textarea
                    rows={4}
                    value={raiDraft.evidencia}
                    onChange={(e) => setRaiDraft((prev) => ({ ...prev, evidencia: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30 resize-y"
                    placeholder="Ex.: Foram observados registros de calibracao vencidos no setor de metrologia."
                  />
                </label>
                {raiDraft.evidencia.trim().length < 20 && (
                  <div className="text-[11px] text-nao-conformidade bg-nao-conformidade/5 border border-nao-conformidade/20 rounded-[4px] px-2.5 py-2">
                    Regra anti-vies: faltam dados objetivos de evidencia para gerar recomendacao robusta.
                  </div>
                )}

                <label className="block text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Requisito tecnico
                  <input
                    value={raiDraft.requisito}
                    onChange={(e) => setRaiDraft((prev) => ({ ...prev, requisito: e.target.value }))}
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                    placeholder="Ex.: ISO 9001:2015 - 7.1.5"
                  />
                </label>

                <label className="block text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Classificacao
                  <select
                    value={raiDraft.classificacao}
                    onChange={(e) =>
                      setRaiDraft((prev) => ({
                        ...prev,
                        classificacao: e.target.value as RaiClassification,
                        recomendacao: prev.recomendacao || getSuggestedRecommendation(e.target.value as RaiClassification),
                      }))
                    }
                    className="mt-1 w-full h-9 px-3 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30"
                  >
                    <option value="conformidade">Conformidade</option>
                    <option value="nao-conformidade">Nao conformidade</option>
                    <option value="observacao">Observacao</option>
                    <option value="oportunidade">Oportunidade de melhoria</option>
                  </select>
                </label>

                <label className="block text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>
                  Recomendacao / acao sugerida
                  <textarea
                    rows={3}
                    value={raiDraft.recomendacao}
                    onChange={(e) => setRaiDraft((prev) => ({ ...prev, recomendacao: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-certifica-200 rounded-[4px] bg-white text-[12px] text-certifica-dark focus:outline-none focus:ring-1 focus:ring-certifica-accent/30 resize-y"
                    placeholder={getSuggestedRecommendation(raiDraft.classificacao)}
                  />
                </label>
              </div>

              <div className="p-4 overflow-y-auto">
                <div className="bg-certifica-50 border border-certifica-200 rounded-[4px] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>
                      Preview do RAI
                    </span>
                    <DSBadge variant={raiClassificationConfig[raiDraft.classificacao].variant} className="text-[9px] px-1.5 py-0">
                      {raiClassificationConfig[raiDraft.classificacao].label}
                    </DSBadge>
                  </div>

                  <div className="space-y-2 text-[11.5px] text-certifica-dark" style={{ fontWeight: 400, lineHeight: "1.55" }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>Descricao: </span>
                      {selectedRaiAudit
                        ? `Durante a auditoria ${selectedRaiAudit.tipo} em ${selectedRaiAudit.cliente_nome ?? selectedRaiAudit.escopo ?? ""}, referente a ${selectedRaiAudit.norma}, foi analisado o requisito "${raiDraft.requisito || selectedRaiAudit.norma}".`
                        : "Selecione uma auditoria para iniciar."}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600 }}>Evidencia objetiva: </span>
                      {raiDraft.evidencia || "Nao informada."}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600 }}>Requisito tecnico: </span>
                      {raiDraft.requisito || (selectedRaiAudit?.norma ?? "Nao informado.")}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600 }}>Classificacao: </span>
                      {raiClassificationConfig[raiDraft.classificacao].label}
                    </div>
                    <div>
                      <span style={{ fontWeight: 600 }}>Recomendacao: </span>
                      {raiDraft.recomendacao || getSuggestedRecommendation(raiDraft.classificacao)}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <DSButton
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRaiModalOpen(false)}
                  >
                    Fechar
                  </DSButton>
                  <DSButton
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyRai}
                  >
                    {copiedRai ? "RAI copiado" : "Copiar RAI"}
                  </DSButton>
                  <DSButton
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={openRaiEditor}
                  >
                    Abrir editor RAI
                  </DSButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-certifica-dark/45 backdrop-blur-sm certifica-modal-backdrop"
            onClick={() => { if (!isDeleting) { setDeleteTarget(null); } }}
          />
          <div className="relative w-full max-w-[400px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] certifica-modal-content p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-full bg-red-50 flex items-center justify-center mb-3">
                <Trash2 className="w-5 h-5 text-red-500" strokeWidth={1.5} />
              </div>
              <h3 className="text-[15px] text-certifica-900 mb-1" style={{ fontWeight: 600 }}>
                Apagar auditoria
              </h3>
              <p className="text-[12px] text-certifica-500 mb-3" style={{ fontWeight: 400 }}>
                Essa ação não pode ser desfeita.
              </p>
              <div className="bg-certifica-50 border border-certifica-200 rounded-[4px] px-3 py-2 w-full mb-4">
                <span className="text-[11px] text-certifica-700 font-mono" style={{ fontWeight: 600 }}>
                  {deleteTarget.codigo}
                </span>
                <span className="text-[11px] text-certifica-500 ml-2" style={{ fontWeight: 400 }}>
                  {deleteTarget.cliente}
                </span>
              </div>
              <div className="flex items-center gap-2 w-full">
                <DSButton
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={isDeleting}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancelar
                </DSButton>
                <button
                  disabled={isDeleting}
                  className="flex-1 h-8 px-3 rounded-[4px] bg-red-500 hover:bg-red-600 text-white text-[12px] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  style={{ fontWeight: 500 }}
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await remove(deleteTarget.id);
                      toast.success("Auditoria apagada com sucesso.");
                      setDeleteTarget(null);
                    } catch {
                      toast.error("Erro ao apagar auditoria.");
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                >
                  {isDeleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  )}
                  {isDeleting ? "Apagando..." : "Apagar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 5W2H Modal ── */}
      {is5W2HOpen && selected5W2HNcId && (() => {
        const nc = openNCs.find((n) => n.id === selected5W2HNcId);
        const auditForNc = audits.find((a) => a.id === nc?.audit_id);
        const clienteNc = auditForNc?.cliente_nome ?? auditForNc?.escopo ?? "";
        const fields5W2H = [
          { key: "oQue",       label: "O quê?",         placeholder: "Descreva a ação corretiva a ser executada", emoji: "🎯" },
          { key: "porQue",     label: "Por quê?",        placeholder: "Causa raiz identificada e justificativa da ação", emoji: "❓" },
          { key: "quem",       label: "Quem?",           placeholder: "Responsável pela execução", emoji: "👤" },
          { key: "quando",     label: "Quando?",         placeholder: "Prazo para conclusão (ex: 30/04/2026)", emoji: "📅" },
          { key: "onde",       label: "Onde?",           placeholder: "Local / área / processo afetado", emoji: "📍" },
          { key: "como",       label: "Como?",           placeholder: "Método, etapas e recursos necessários", emoji: "⚙️" },
          { key: "quantoCusta", label: "Quanto custa?", placeholder: "Custo estimado (ex: R$ 1.500,00)", emoji: "💰" },
        ] as { key: keyof typeof plano5W2H; label: string; placeholder: string; emoji: string }[];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-certifica-dark/45 certifica-modal-backdrop" onClick={() => setIs5W2HOpen(false)} />
            <div className="relative w-full max-w-[640px] bg-white border border-certifica-200 rounded-[6px] shadow-xl max-h-[90vh] overflow-y-auto certifica-modal-content">
              <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-certifica-accent" />
                    <h3 className="text-[14px] text-certifica-900" style={{ fontWeight: 600 }}>Plano de Ação 5W2H</h3>
                  </div>
                  {nc && (
                    <p className="text-[11px] text-certifica-500 mt-0.5">
                      NC {nc.tipo === "nc-maior" ? "Maior" : "Menor"} · {nc.clausula} · {clienteNc}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {nc && (
                    <button
                      onClick={() => handleAI5W2H(nc, auditForNc?.norma)}
                      disabled={aiLoading5W2H}
                      title="Sugerir plano com Inteligência Artificial"
                      className="flex items-center gap-1.5 h-7 px-2.5 rounded-[4px] border border-purple-200 bg-purple-50 text-purple-700 text-[11px] hover:bg-purple-100 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ fontWeight: 500 }}
                    >
                      {aiLoading5W2H ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" strokeWidth={1.5} />
                      )}
                      {aiLoading5W2H ? "Gerando..." : "Sugerir com IA"}
                    </button>
                  )}
                  <button onClick={() => setIs5W2HOpen(false)} className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {nc && (
                <div className="mx-4 mt-4 bg-nao-conformidade/5 border border-nao-conformidade/20 rounded-[4px] px-3 py-2">
                  <div className="text-[10px] text-nao-conformidade mb-0.5" style={{ fontWeight: 600 }}>NÃO CONFORMIDADE</div>
                  <p className="text-[12px] text-certifica-dark">{nc.descricao}</p>
                </div>
              )}

              <div className="p-4 grid grid-cols-2 gap-3">
                {fields5W2H.map(({ key, label, placeholder, emoji }) => (
                  <div key={key} className={key === "como" || key === "oQue" || key === "porQue" ? "col-span-2" : ""}>
                    <label className="block text-[11px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>
                      {emoji} {label}
                    </label>
                    {key === "como" || key === "oQue" || key === "porQue" ? (
                      <textarea
                        rows={key === "como" ? 3 : 2}
                        value={plano5W2H[key]}
                        onChange={(e) => setPlano5W2H((p) => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full px-2.5 py-1.5 rounded-[4px] border border-certifica-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-certifica-accent/40 resize-none"
                      />
                    ) : (
                      <input
                        value={plano5W2H[key]}
                        onChange={(e) => setPlano5W2H((p) => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full h-8 px-2.5 rounded-[4px] border border-certifica-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-certifica-accent/40"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="px-4 pb-4 flex items-center justify-between">
                <span className="text-[10px] text-certifica-500/50 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-certifica-accent/60" />
                  Salvo no Supabase + localStorage
                </span>
                <div className="flex items-center gap-2">
                  <DSButton variant="outline" size="sm" onClick={() => setIs5W2HOpen(false)}>Fechar</DSButton>
                  <DSButton
                    size="sm"
                    icon={<Save className="w-3.5 h-3.5" />}
                    onClick={async () => {
                      // 1. Persist to localStorage (fast, offline-safe)
                      savePlan(selected5W2HNcId, plano5W2H);
                      // 2. Persist acao_corretiva to Supabase audit_findings
                      //    Embed structured JSON (for reload) + human-readable text
                      const humanText = [
                        plano5W2H.oQue && `O quê: ${plano5W2H.oQue}`,
                        plano5W2H.porQue && `Por quê: ${plano5W2H.porQue}`,
                        plano5W2H.quem && `Quem: ${plano5W2H.quem}`,
                        plano5W2H.quando && `Quando: ${plano5W2H.quando}`,
                        plano5W2H.onde && `Onde: ${plano5W2H.onde}`,
                        plano5W2H.como && `Como: ${plano5W2H.como}`,
                        plano5W2H.quantoCusta && `Custo: ${plano5W2H.quantoCusta}`,
                      ].filter(Boolean).join("\n");
                      const jsonTag = `${PLAN_JSON_MARKER}${JSON.stringify(plano5W2H)}-->`;
                      const acaoText = humanText ? `${humanText}\n${jsonTag}` : jsonTag;
                      await updateFinding(selected5W2HNcId, { acao_corretiva: acaoText });
                      toast.success("Plano 5W2H salvo com sucesso!");
                      setIs5W2HOpen(false);
                    }}
                  >
                    Salvar plano
                  </DSButton>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
