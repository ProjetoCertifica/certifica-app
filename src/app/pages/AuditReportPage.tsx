import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

import { DSBadge } from "../components/ds/DSBadge";
import { DSButton } from "../components/ds/DSButton";
import { DSTextarea } from "../components/ds/DSTextarea";
import { FindingForm, type FindingFormData } from "../components/FindingForm";
import {
  Bot,
  Building2,
  ChevronRight,
  Download,
  FileText,
  History,
  Lightbulb,
  Loader2,
  Plus,
  Printer,
  Save,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { useAudits } from "../lib/useAudits";
import { supabase } from "../lib/supabase";
import { generateRAI } from "../lib/openai";
import { exportPdf as exportCertificaPdf, buildRaiPdf, exportFullAuditReport } from "../lib/usePdfExport";
import type { FullAuditReportData } from "../lib/usePdfExport";

type EvidenceStatus = "conforme" | "nao-conformidade" | "observacao" | "oportunidade" | "pendente";
type Severity = "baixa" | "media" | "alta" | "critica";
type WorkflowStatus = "rascunho" | "revisao-tecnica" | "aprovado" | "enviado-cliente";
type NormCode = "iso9001" | "iso14001" | "iso45001" | "iso50001" | "iso22000" | "fsc";

interface Evidence {
  id: string;
  titulo: string;
  processo: string;
  status: EvidenceStatus;
  initialNorm: NormCode;
  initialClause: string;
  initialEvidence: string;
}

interface ClauseOption {
  clause: string;
  title: string;
  text: string;
}

interface Revision {
  version: string;
  date: string;
  author: string;
  action: string;
}

interface RaiContextPayload {
  auditId?: string;
  client?: string;
  standard?: string;
  auditor?: string;
  classificacao?: string;
  requisito?: string;
  evidencia?: string;
  recomendacao?: string;
}

const evidenceList: Evidence[] = [
  {
    id: "EV-001",
    titulo: "Calibracao vencida de paquimetro digital",
    processo: "Producao",
    status: "nao-conformidade",
    initialNorm: "iso9001",
    initialClause: "7.1.5",
    initialEvidence:
      "Foi constatado em 18/02/2026 que o paquimetro patrimonio #1247 estava com certificado vencido desde 15/01/2026, contrariando o procedimento PQ-MC-003.",
  },
  {
    id: "EV-002",
    titulo: "Matriz de riscos sem revisao no ultimo ciclo",
    processo: "Qualidade",
    status: "nao-conformidade",
    initialNorm: "iso9001",
    initialClause: "6.1.1",
    initialEvidence:
      "Na entrevista com o gestor e na analise do registro RSK-02, a ultima revisao formal da matriz foi em setembro/2025, sem evidencia de atualizacao em mudancas recentes.",
  },
  {
    id: "EV-003",
    titulo: "Checklist de manutencao preventiva atualizado",
    processo: "Manutencao",
    status: "conforme",
    initialNorm: "iso14001",
    initialClause: "8.1",
    initialEvidence:
      "Foram verificados os registros de manutencao PM-11 e PM-12 com periodicidade cumprida e assinatura do responsavel tecnico.",
  },
  {
    id: "EV-004",
    titulo: "Oportunidade de padronizar onboarding de terceiros",
    processo: "SSO",
    status: "oportunidade",
    initialNorm: "iso45001",
    initialClause: "7.3",
    initialEvidence:
      "",
  },
];

const normOptions: { value: NormCode; label: string }[] = [
  { value: "iso9001", label: "ISO 9001:2015 - Qualidade" },
  { value: "iso14001", label: "ISO 14001:2015 - Ambiental" },
  { value: "iso45001", label: "ISO 45001:2018 - SSO" },
  { value: "iso50001", label: "ISO 50001:2018 - Energia" },
  { value: "iso22000", label: "ISO 22000:2018 - Alimentos" },
  { value: "fsc", label: "FSC COC - Cadeia de Custódia" },
];

const clauseLibrary: Record<NormCode, ClauseOption[]> = {
  iso9001: [
    {
      clause: "6.1.1",
      title: "Riscos e oportunidades",
      text: "A organização deve determinar riscos e oportunidades que precisam ser abordados para assegurar que o sistema alcance os resultados pretendidos.",
    },
    {
      clause: "7.1.5",
      title: "Recursos de monitoramento e medição",
      text: "A organização deve assegurar recursos adequados e calibrados quando monitoramento e medição forem usados para verificar conformidade.",
    },
    {
      clause: "10.2",
      title: "Não conformidade e ação corretiva",
      text: "Quando ocorrer uma não conformidade, a organização deve reagir, controlar e corrigir, avaliar causa e implementar ação corretiva.",
    },
  ],
  iso14001: [
    {
      clause: "6.1.2",
      title: "Aspectos ambientais",
      text: "A organização deve determinar aspectos ambientais e impactos associados considerando perspectiva de ciclo de vida.",
    },
    {
      clause: "8.1",
      title: "Planejamento e controle operacional",
      text: "A organização deve estabelecer, implementar e manter processos necessários para atender requisitos do SGA.",
    },
  ],
  iso45001: [
    {
      clause: "7.3",
      title: "Conscientização",
      text: "Trabalhadores devem estar conscientes da política de SSO, riscos, perigos e consequências de não conformidade.",
    },
    {
      clause: "8.1.2",
      title: "Eliminação de perigos",
      text: "A organização deve estabelecer processo para eliminação de perigos e redução de riscos de SSO.",
    },
  ],
  iso50001: [
    {
      clause: "6.3",
      title: "Indicadores de desempenho energético",
      text: "A organização deve determinar EnPI apropriados para monitorar e demonstrar melhoria de desempenho energético.",
    },
  ],
  iso22000: [
    {
      clause: "8.5.2",
      title: "Programa de pré-requisitos operacionais",
      text: "A organização deve estabelecer e manter programas para prevenir contaminação e assegurar segurança dos alimentos.",
    },
  ],
  fsc: [
    {
      clause: "COC 2.1",
      title: "Controle de material",
      text: "A organização deve implementar controles para rastreabilidade e segregação de material certificado em toda a cadeia interna.",
    },
  ],
};

const workflowFlow: WorkflowStatus[] = ["rascunho", "revisao-tecnica", "aprovado", "enviado-cliente"];

const workflowLabel: Record<WorkflowStatus, string> = {
  rascunho: "Rascunho",
  "revisao-tecnica": "Revisão técnica",
  aprovado: "Aprovado",
  "enviado-cliente": "Enviado ao cliente",
};

const qualityBannedTerms = /(talvez|acho|coisa|etc\.?|mais ou menos)/i;

function nowBr() {
  return new Date().toLocaleString("pt-BR");
}

function statusBadge(status: EvidenceStatus): { label: string; variant: "conformidade" | "nao-conformidade" | "observacao" | "oportunidade" | "outline" } {
  const map = {
    conforme: { label: "Conforme", variant: "conformidade" as const },
    "nao-conformidade": { label: "Não conformidade", variant: "nao-conformidade" as const },
    observacao: { label: "Observação", variant: "observacao" as const },
    oportunidade: { label: "Oportunidade", variant: "oportunidade" as const },
    pendente: { label: "Pendente", variant: "outline" as const },
  };
  return map[status];
}

function expectedSeverities(classification: EvidenceStatus): Severity[] {
  if (classification === "conforme") return ["baixa"];
  if (classification === "nao-conformidade") return ["alta", "critica"];
  if (classification === "observacao") return ["media"];
  if (classification === "oportunidade") return ["baixa", "media"];
  return ["media"];
}

function mapStandardToNormCode(standard?: string): NormCode {
  const normalized = (standard ?? "").toLowerCase();
  if (normalized.includes("14001")) return "iso14001";
  if (normalized.includes("45001")) return "iso45001";
  if (normalized.includes("50001")) return "iso50001";
  if (normalized.includes("22000")) return "iso22000";
  if (normalized.includes("fsc")) return "fsc";
  return "iso9001";
}

function mapIncomingClassification(value?: string): EvidenceStatus | null {
  if (!value) return null;
  if (value === "conformidade") return "conforme";
  if (value === "nao-conformidade") return "nao-conformidade";
  if (value === "observacao") return "observacao";
  if (value === "oportunidade") return "oportunidade";
  return null;
}

function mapFindingTipoToStatus(tipo: string): EvidenceStatus {
  if (tipo === "nc-maior" || tipo === "nc-menor") return "nao-conformidade";
  if (tipo === "conformidade") return "conforme";
  if (tipo === "observacao") return "observacao";
  if (tipo === "oportunidade") return "oportunidade";
  return "pendente";
}

function mapStatusToFindingTipo(status: EvidenceStatus): string {
  if (status === "conforme") return "conformidade";
  if (status === "nao-conformidade") return "nc-menor";
  if (status === "observacao") return "observacao";
  if (status === "oportunidade") return "oportunidade";
  return "observacao";
}

const emptyFindingForm: FindingFormData = {
  norma: "", clausula: "", subclausula: "", titulo_clausula: "",
  area_auditada: "", processo_auditado: "", setor: "", local_evidencia: "",
  tipo: "", severidade: "", prioridade: "",
  descricao: "", criterio_requisito: "", evidencia: "", tipo_evidencia: "",
  documento_avaliado: "", codigo_documento: "", revisao_documento: "",
  registro_analisado: "", amostra_qtd: "", criterio_amostragem: "",
  entrevistados: "", condicao_encontrada: "", desvio_identificado: "",
  impacto_potencial: "", risco_associado: "", abrangencia: "",
  qtd_itens_afetados: "", periodo_afetado: "", recorrencia: false,
  contencao_imediata: "", data_contencao: "", responsavel_contencao: "",
  causa_imediata: "", causa_raiz: "", metodo_analise: "",
  correcao_imediata: "", acao_corretiva: "", acao_preventiva: "",
  recomendacao_auditor: "", responsavel: "Joao Ferreira", prazo: "15/03/2026",
  custo_estimado: "", status: "",
  verificacao_eficacia: "", responsavel_verificacao: "", data_verificacao: "",
  status_eficacia: "", observacao_anexo: "",
};

export default function AuditReportPage() {
  const [searchParams] = useSearchParams();
  const auditIdFromUrl = searchParams.get("auditId") ?? "";
  const { audits, addFinding, removeFinding, updateRai, createRai } = useAudits();
  const [generatingRai, setGeneratingRai] = useState(false);

  // Find the matching audit from real data. If no auditId in URL, use the most recent audit with findings.
  const matchedAudit = useMemo(() => {
    if (auditIdFromUrl) {
      return audits.find((a) => a.id === auditIdFromUrl) ?? null;
    }
    // Fallback: pick the first (most recent) audit that has findings
    return audits.find((a) => a.findings.length > 0) ?? null;
  }, [audits, auditIdFromUrl]);

  // Build the live evidence list from real findings, falling back to hardcoded
  const liveEvidenceList: Evidence[] = useMemo(() => {
    if (!matchedAudit || matchedAudit.findings.length === 0) return evidenceList;
    const normCode = mapStandardToNormCode(matchedAudit.norma);
    return matchedAudit.findings.map((f) => ({
      id: f.id,
      titulo: f.descricao,
      processo: f.clausula,
      status: mapFindingTipoToStatus(f.tipo),
      initialNorm: normCode,
      initialClause: f.clausula,
      initialEvidence: f.evidencia,
    }));
  }, [matchedAudit]);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>(() => {
    // Will be set properly once liveEvidenceList is known; use first fallback for initial render
    return evidenceList[0]?.id ?? "";
  });
  const [workflow, setWorkflow] = useState<WorkflowStatus>("rascunho");
  const [revisionList, setRevisionList] = useState<Revision[]>([
    { version: "Rev. 02", date: "18/02/2026 14:30", author: "Carlos M. Silva", action: "Ajuste de classificacao para EV-002" },
    { version: "Rev. 01", date: "17/02/2026 09:05", author: "Ana R. Costa", action: "Criacao inicial do RAI" },
  ]);

  // Sync selectedId to the first item in liveEvidenceList when it becomes available
  React.useEffect(() => {
    if (liveEvidenceList.length > 0) {
      setSelectedId(liveEvidenceList[0].id);
    }
  }, [liveEvidenceList]);

  const selected = useMemo(
    () => liveEvidenceList.length > 0
      ? (liveEvidenceList.find((item) => item.id === selectedId) ?? liveEvidenceList[0])
      : undefined,
    [selectedId, liveEvidenceList]
  );

  const [norma, setNorma] = useState<NormCode>(selected?.initialNorm ?? "iso9001");
  const [clausula, setClausula] = useState(selected?.initialClause ?? "");
  const [descricao, setDescricao] = useState(selected?.titulo ?? "");
  const [evidencia, setEvidencia] = useState(selected?.initialEvidence ?? "");
  const [requisito, setRequisito] = useState("");
  const [classificacao, setClassificacao] = useState<EvidenceStatus>(selected?.status ?? "observacao");
  const [severidade, setSeveridade] = useState<Severity>("media");
  const [recomendacao, setRecomendacao] = useState("");
  const [responsavel, setResponsavel] = useState("Joao Ferreira");
  const [prazo, setPrazo] = useState("15/03/2026");
  const [findingForm, setFindingForm] = useState<FindingFormData>({ ...emptyFindingForm });
  const [lastExport, setLastExport] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [contextApplied, setContextApplied] = useState(false);
  const [conclusaoAuditoria, setConclusaoAuditoria] = useState({
    planoCumprido: true,
    acoesAuditadas: true,
    analiseCriticaAuditada: true,
    documentacaoAtende: true,
    obstaculoEncontrado: false,
    objetivosAtendidos: true,
    sistemaEstabelecido: true,
  });
  const [parecerFinal, setParecerFinal] = useState("");
  const [auditInfo, setAuditInfo] = useState({
    id: auditIdFromUrl || "AUD-2026-0051",
    client: "Metalurgica Acoforte",
    standard: "ISO 9001:2015",
    auditor: "Carlos M. Silva",
  });

  // When the matched audit loads, populate auditInfo from real data
  React.useEffect(() => {
    if (!matchedAudit) return;
    setAuditInfo({
      id: matchedAudit.codigo,
      client: matchedAudit.cliente_nome ?? "",
      standard: matchedAudit.norma,
      auditor: matchedAudit.auditor,
    });
  }, [matchedAudit]);

  const clauses = clauseLibrary[norma] ?? [];

  React.useEffect(() => {
    if (!selected) return;
    setNorma(selected.initialNorm);
    setClausula(selected.initialClause);
    setDescricao(selected.titulo);
    setEvidencia(selected.initialEvidence);
    setClassificacao(selected.status);
    const sev = selected.status === "nao-conformidade" ? "alta" : selected.status === "conforme" ? "baixa" : "media";
    setSeveridade(sev);
    setRecomendacao("");
    const initialClause = (clauseLibrary[selected.initialNorm] ?? []).find((it) => it.clause === selected.initialClause);
    setRequisito(initialClause?.text ?? "");

    // Sync to FindingForm state — look up the FULL finding record from matchedAudit
    const fullFinding = matchedAudit?.findings.find((f) => f.id === selectedId);
    if (fullFinding) {
      // Populate ALL fields from the database record
      setFindingForm({
        norma: fullFinding.norma || selected.initialNorm,
        clausula: fullFinding.clausula || selected.initialClause,
        subclausula: fullFinding.subclausula || "",
        titulo_clausula: fullFinding.titulo_clausula || "",
        area_auditada: fullFinding.area_auditada || "",
        processo_auditado: fullFinding.processo_auditado || "",
        setor: fullFinding.setor || "",
        local_evidencia: fullFinding.local_evidencia || "",
        tipo: fullFinding.tipo || mapStatusToFindingTipo(selected.status),
        severidade: fullFinding.severidade || sev,
        prioridade: fullFinding.prioridade || "",
        descricao: fullFinding.descricao || selected.titulo,
        criterio_requisito: fullFinding.criterio_requisito || initialClause?.text || "",
        evidencia: fullFinding.evidencia || selected.initialEvidence,
        tipo_evidencia: fullFinding.tipo_evidencia || "",
        documento_avaliado: fullFinding.documento_avaliado || "",
        codigo_documento: fullFinding.codigo_documento || "",
        revisao_documento: fullFinding.revisao_documento || "",
        registro_analisado: fullFinding.registro_analisado || "",
        amostra_qtd: fullFinding.amostra_qtd || "",
        criterio_amostragem: fullFinding.criterio_amostragem || "",
        entrevistados: fullFinding.entrevistados || "",
        condicao_encontrada: fullFinding.condicao_encontrada || "",
        desvio_identificado: fullFinding.desvio_identificado || "",
        impacto_potencial: fullFinding.impacto_potencial || "",
        risco_associado: fullFinding.risco_associado || "",
        abrangencia: fullFinding.abrangencia || "",
        qtd_itens_afetados: fullFinding.qtd_itens_afetados || "",
        periodo_afetado: fullFinding.periodo_afetado || "",
        recorrencia: fullFinding.recorrencia ?? false,
        contencao_imediata: fullFinding.contencao_imediata || "",
        data_contencao: fullFinding.data_contencao || "",
        responsavel_contencao: fullFinding.responsavel_contencao || "",
        causa_imediata: fullFinding.causa_imediata || "",
        causa_raiz: fullFinding.causa_raiz || "",
        metodo_analise: fullFinding.metodo_analise || "",
        correcao_imediata: fullFinding.correcao_imediata || "",
        acao_corretiva: fullFinding.acao_corretiva || "",
        acao_preventiva: fullFinding.acao_preventiva || "",
        recomendacao_auditor: fullFinding.recomendacao_auditor || "",
        responsavel: fullFinding.responsavel || "Joao Ferreira",
        prazo: fullFinding.prazo || "15/03/2026",
        custo_estimado: fullFinding.custo_estimado || "",
        status: fullFinding.status || "",
        verificacao_eficacia: fullFinding.verificacao_eficacia || "",
        responsavel_verificacao: fullFinding.responsavel_verificacao || "",
        data_verificacao: fullFinding.data_verificacao || "",
        status_eficacia: fullFinding.status_eficacia || "",
        observacao_anexo: fullFinding.observacao_anexo || "",
      });
    } else {
      // Fallback for hardcoded evidence items (no matchedAudit)
      setFindingForm((prev) => ({
        ...prev,
        norma: selected.initialNorm,
        clausula: selected.initialClause,
        descricao: selected.titulo,
        evidencia: selected.initialEvidence,
        tipo: mapStatusToFindingTipo(selected.status),
        severidade: sev,
        criterio_requisito: initialClause?.text ?? "",
        recomendacao_auditor: "",
      }));
    }
  }, [selectedId, selected, matchedAudit]);

  // Sync findingForm changes back to individual state variables for backward compatibility
  React.useEffect(() => {
    setDescricao(findingForm.descricao);
    setEvidencia(findingForm.evidencia);
    setClausula(findingForm.clausula);
    setRequisito(findingForm.criterio_requisito);
    setClassificacao(mapFindingTipoToStatus(findingForm.tipo));
    setSeveridade(findingForm.severidade as Severity);
    setResponsavel(findingForm.responsavel);
    setPrazo(findingForm.prazo);
    setRecomendacao(findingForm.recomendacao_auditor);
  }, [findingForm]);

  React.useEffect(() => {
    if (contextApplied) return;
    let parsed: RaiContextPayload | null = null;
    try {
      const raw = localStorage.getItem("certifica:rai-context");
      parsed = raw ? (JSON.parse(raw) as RaiContextPayload) : null;
    } catch {
      parsed = null;
    }

    if (!parsed && auditIdFromUrl) {
      setAuditInfo((prev) => ({ ...prev, id: auditIdFromUrl }));
      setContextApplied(true);
      return;
    }

    if (!parsed) return;
    if (auditIdFromUrl && parsed.auditId && parsed.auditId !== auditIdFromUrl) return;

    if (parsed.auditId) setAuditInfo((prev) => ({ ...prev, id: parsed!.auditId ?? prev.id }));
    if (parsed.client) setAuditInfo((prev) => ({ ...prev, client: parsed!.client ?? prev.client }));
    if (parsed.standard) setAuditInfo((prev) => ({ ...prev, standard: parsed!.standard ?? prev.standard }));
    if (parsed.auditor) setAuditInfo((prev) => ({ ...prev, auditor: parsed!.auditor ?? prev.auditor }));
    if (parsed.requisito) setRequisito(parsed.requisito);
    if (parsed.evidencia) setEvidencia(parsed.evidencia);
    if (parsed.recomendacao) setRecomendacao(parsed.recomendacao);

    const incomingClass = mapIncomingClassification(parsed.classificacao);
    if (incomingClass) {
      setClassificacao(incomingClass);
      setSeveridade(incomingClass === "nao-conformidade" ? "alta" : incomingClass === "conforme" ? "baixa" : "media");
    }

    const mappedNorm = mapStandardToNormCode(parsed.standard);
    setNorma(mappedNorm);
    const firstClause = clauseLibrary[mappedNorm]?.[0];
    if (firstClause) {
      setClausula(firstClause.clause);
      if (!parsed.requisito) setRequisito(firstClause.text);
    }
    // Sync context to findingForm
    setFindingForm((prev) => ({
      ...prev,
      norma: mappedNorm,
      clausula: firstClause?.clause ?? prev.clausula,
      criterio_requisito: parsed!.requisito || firstClause?.text || prev.criterio_requisito,
      evidencia: parsed!.evidencia || prev.evidencia,
      recomendacao_auditor: parsed!.recomendacao || prev.recomendacao_auditor,
      tipo: incomingClass ? mapStatusToFindingTipo(incomingClass) : prev.tipo,
      severidade: incomingClass ? (incomingClass === "nao-conformidade" ? "alta" : incomingClass === "conforme" ? "baixa" : "media") : prev.severidade,
    }));

    addRevision(`Contexto importado de Auditorias para ${parsed.auditId ?? "RAI"}`);
    setContextApplied(true);
  }, [auditIdFromUrl, contextApplied]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return liveEvidenceList;
    return liveEvidenceList.filter(
      (item) =>
        item.id.toLowerCase().includes(term) ||
        item.titulo.toLowerCase().includes(term) ||
        item.processo.toLowerCase().includes(term) ||
        item.initialClause.toLowerCase().includes(term)
    );
  }, [search, liveEvidenceList]);

  const qualityChecks = useMemo(() => {
    const clarity = descricao.trim().length >= 40;
    const objective = !qualityBannedTerms.test(descricao) && !qualityBannedTerms.test(recomendacao);
    const criteria = requisito.trim().length >= 40 && /\d+(\.\d+)?/.test(clausula);
    const score = [clarity, objective, criteria].filter(Boolean).length;
    return { clarity, objective, criteria, score };
  }, [descricao, recomendacao, requisito, clausula]);

  const evidenceMissing = evidencia.trim().length < 40;
  const severityConsistency = expectedSeverities(classificacao).includes(severidade);
  const canMoveForward =
    !evidenceMissing &&
    qualityChecks.score === 3 &&
    severityConsistency &&
    descricao.trim().length > 0 &&
    recomendacao.trim().length > 0 &&
    requisito.trim().length > 0;

  const progress = Math.round((workflowFlow.indexOf(workflow) / (workflowFlow.length - 1)) * 100);

  const addRevision = (action: string) => {
    setRevisionList((prev) => [
      {
        version: `Rev. ${String(prev.length + 1).padStart(2, "0")}`,
        date: nowBr(),
        author: "Carlos M. Silva",
        action,
      },
      ...prev,
    ]);
  };

  const applyClause = (clauseValue: string) => {
    setClausula(clauseValue);
    const entry = clauses.find((item) => item.clause === clauseValue);
    if (entry) {
      setRequisito(entry.text);
      if (!descricao.trim()) setDescricao(entry.title);
    }
  };

  const suggestDescriptionByAi = () => {
    if (evidenceMissing) {
      toast.warning("Análise bloqueada por anti-viés: faltam dados objetivos de evidência. Complete a evidência antes da sugestão.");
      return;
    }
    const clauseMeta = clauses.find((item) => item.clause === clausula);
    const phrase = clauseMeta?.title ?? `clausula ${clausula}`;
    const newDesc = `Durante a verificacao do processo ${selected.processo}, foi constatado desvio relacionado a ${phrase}. A evidencia objetiva demonstra impacto direto no atendimento ao requisito, exigindo tratamento formal e rastreavel.`;
    setDescricao(newDesc);
    setFindingForm((prev) => ({ ...prev, descricao: newDesc }));
  };

  const suggestRecommendationByAi = () => {
    if (evidenceMissing) {
      toast.warning("Análise bloqueada por anti-viés: sem evidência suficiente para recomendar ação. Informe fatos verificáveis.");
      return;
    }
    const base =
      classificacao === "nao-conformidade"
        ? "Abrir ação corretiva imediata com análise de causa, plano 5W2H e verificação de eficácia."
        : classificacao === "observacao"
          ? "Registrar ação preventiva com responsável e checkpoint no próximo ciclo de auditoria."
          : classificacao === "oportunidade"
            ? "Planejar melhoria gradual com piloto e medição de resultado para padronização."
            : "Manter controle atual e reforçar evidência em auditorias subsequentes.";
    const newRec = `${base} Prazo sugerido: ${prazo}. Responsável: ${responsavel || "a definir"}.`;
    setRecomendacao(newRec);
    setFindingForm((prev) => ({ ...prev, recomendacao_auditor: newRec }));
  };

  const handleGenerateRAI = async () => {
    if (!matchedAudit) {
      toast.warning("Acesse via Auditorias > Abrir RAI para gerar o relatório.");
      return;
    }
    setGeneratingRai(true);
    try {
      const text = await generateRAI({
        auditoria: matchedAudit.codigo,
        cliente: matchedAudit.cliente_nome ?? "N/A",
        norma: matchedAudit.norma,
        auditor: matchedAudit.auditor_lider ?? matchedAudit.auditor ?? "N/A",
        dataInicio: matchedAudit.data_inicio ?? "",
        dataFim: matchedAudit.data_fim ?? "",
        findings: (matchedAudit.findings ?? []).map((f) => ({
          tipo: f.tipo,
          clausula: f.clausula,
          descricao: f.descricao,
        })),
      });
      setRecomendacao(text);
      setFindingForm((prev) => ({ ...prev, recomendacao_auditor: text }));
      toast.success("RAI gerado! Revise e salve o rascunho.");
    } catch (err: any) {
      toast.error("Erro ao gerar RAI: " + (err?.message ?? "tente novamente"));
    } finally {
      setGeneratingRai(false);
    }
  };

  const handleDeleteFinding = () => {
    if (!matchedAudit || !selected) return;
    if (selected.id.startsWith("EV-")) {
      toast.warning("Essa evidência é de exemplo e não pode ser apagada.");
      return;
    }
    setConfirmDelete(true);
  };

  const executeDeleteFinding = async () => {
    if (!matchedAudit || !selected) return;
    setDeleting(true);
    const ok = await removeFinding(selected.id, matchedAudit.id);
    setDeleting(false);
    setConfirmDelete(false);
    if (ok) {
      toast.success("Constatação apagada.");
    } else {
      toast.error("Erro ao apagar constatação.");
    }
  };

  const saveDraft = async () => {
    const payload = {
      auditId: auditInfo.id,
      client: auditInfo.client,
      standard: auditInfo.standard,
      auditor: auditInfo.auditor,
      classificacao,
      requisito,
      evidencia,
      recomendacao,
    };

    // Always persist to localStorage
    localStorage.setItem("certifica:rai-context", JSON.stringify(payload));
    addRevision(`Rascunho salvo para ${selected.id}`);

    // Persist to Supabase when a real audit is matched
    if (matchedAudit) {
      const conteudo = {
        classificacao, requisito, evidencia, recomendacao, descricao,
        // Extended fields from FindingForm
        tipo: findingForm.tipo,
        severidade: findingForm.severidade,
        prioridade: findingForm.prioridade,
        area_auditada: findingForm.area_auditada,
        processo_auditado: findingForm.processo_auditado,
        setor: findingForm.setor,
        local_evidencia: findingForm.local_evidencia,
        tipo_evidencia: findingForm.tipo_evidencia,
        documento_avaliado: findingForm.documento_avaliado,
        codigo_documento: findingForm.codigo_documento,
        revisao_documento: findingForm.revisao_documento,
        registro_analisado: findingForm.registro_analisado,
        amostra_qtd: findingForm.amostra_qtd,
        criterio_amostragem: findingForm.criterio_amostragem,
        entrevistados: findingForm.entrevistados,
        condicao_encontrada: findingForm.condicao_encontrada,
        desvio_identificado: findingForm.desvio_identificado,
        impacto_potencial: findingForm.impacto_potencial,
        risco_associado: findingForm.risco_associado,
        abrangencia: findingForm.abrangencia,
        recorrencia: findingForm.recorrencia,
        contencao_imediata: findingForm.contencao_imediata,
        causa_imediata: findingForm.causa_imediata,
        causa_raiz: findingForm.causa_raiz,
        metodo_analise: findingForm.metodo_analise,
        correcao_imediata: findingForm.correcao_imediata,
        acao_corretiva: findingForm.acao_corretiva,
        acao_preventiva: findingForm.acao_preventiva,
        recomendacao_auditor: findingForm.recomendacao_auditor,
        responsavel: findingForm.responsavel,
        prazo: findingForm.prazo,
        custo_estimado: findingForm.custo_estimado,
        status_finding: findingForm.status,
        verificacao_eficacia: findingForm.verificacao_eficacia,
        status_eficacia: findingForm.status_eficacia,
      };
      if (matchedAudit.rai_report) {
        await updateRai(matchedAudit.rai_report.id, { conteudo });
      } else {
        await createRai({
          audit_id: matchedAudit.id,
          codigo: `RAI-${matchedAudit.codigo}`,
          titulo: `Relatorio de Auditoria - ${auditInfo.client}`,
          conteudo,
          status: "rascunho",
          elaborado_por: auditInfo.auditor,
          revisado_por: "",
          aprovado_por: "",
        });
      }
    }

    toast.success("Rascunho salvo!");
  };

  const nextWorkflow = () => {
    const idx = workflowFlow.indexOf(workflow);
    if (idx >= workflowFlow.length - 1) return;
    if (!canMoveForward) {
      toast.error("Não foi possível avançar: revise qualidade textual, consistência severidade/classificação e evidência objetiva.");
      return;
    }
    const next = workflowFlow[idx + 1];
    setWorkflow(next);
    addRevision(`Workflow atualizado para ${workflowLabel[next]}`);
  };

  const handleExportFullReport = () => {
    const reportData: FullAuditReportData = {
      codigo: matchedAudit?.codigo ?? auditInfo.id,
      empresa: auditInfo.client,
      unidade: auditInfo.client,
      dataAuditoria: matchedAudit?.data_inicio ?? new Date().toISOString(),
      auditorLider: auditInfo.auditor,
      tipo: matchedAudit?.tipo ?? "interna",
      norma: auditInfo.standard,
      escopo: matchedAudit?.escopo ?? "",
      findings: (matchedAudit?.findings ?? liveEvidenceList.map((ev) => ({
        tipo: ev.status === "conforme" ? "conformidade"
          : ev.status === "nao-conformidade" ? "nc-menor"
          : ev.status === "observacao" ? "observacao"
          : ev.status === "oportunidade" ? "oportunidade"
          : "conformidade",
        clausula: ev.initialClause,
        descricao: ev.titulo,
        evidencia: ev.initialEvidence,
      }))).map((f) => ({
        tipo: f.tipo,
        clausula: f.clausula,
        descricao: f.descricao,
        evidencia: f.evidencia,
        acao_corretiva: (f as any).acao_corretiva ?? "",
        responsavel: (f as any).responsavel ?? "",
        prazo: (f as any).prazo ?? "",
        status: (f as any).status ?? "",
      })),
      elaboradoPor: matchedAudit?.rai_report?.elaborado_por ?? auditInfo.auditor,
      revisadoPor: matchedAudit?.rai_report?.revisado_por ?? "",
      aprovadoPor: matchedAudit?.rai_report?.aprovado_por ?? "",
      conclusao: conclusaoAuditoria,
      parecerFinal: parecerFinal || undefined,
      revisaoForm: "07",
    };
    exportFullAuditReport(reportData);
    addRevision("Relatório completo exportado (FORM 9.2-01)");
    setLastExport(nowBr());
    toast.success("Relatório completo gerado! Use Ctrl+P para salvar como PDF.");
  };

  const exportPdf = () => {
    const content = [
      `RAI - ${auditInfo.id} / ${selected.id}`,
      `Cliente: ${auditInfo.client}`,
      `Norma: ${auditInfo.standard}`,
      `Auditor: ${auditInfo.auditor}`,
      `Status workflow: ${workflowLabel[workflow]}`,
      `1) Descricao da constatacao: ${descricao}`,
      `2) Evidência objetiva: ${evidencia || "[DADO AUSENTE - COMPLEMENTAR]"}`,
      `3) Requisito técnico: ${requisito}`,
      `4) Classificação: ${classificacao} / Severidade: ${severidade}`,
      `5) Recomendação: ${recomendacao}`,
      "",
      "Assinatura tecnica digital: Carlos M. Silva",
      "Rodape tecnico: Certifica Consultoria | Rastreabilidade RAI | Versao controlada",
    ].join("\n");
    navigator.clipboard.writeText(content).catch(() => null);
    setLastExport(nowBr());
    addRevision("Exportacao PDF tecnica gerada");
    toast.success("Conteudo copiado para area de transferencia");
  };

  return (
    <>
    <div className="flex flex-col lg:flex-row lg:h-full overflow-auto lg:overflow-hidden">
      <aside className="w-full lg:w-[300px] lg:flex-shrink-0 border-b lg:border-b-0 lg:border-r border-certifica-200 bg-white flex flex-col max-h-[240px] lg:max-h-none">
        <div className="px-4 py-3 border-b border-certifica-200">
          <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
            Evidências RAI
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-certifica-500/50" strokeWidth={1.5} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar evidencia..."
              className="w-full h-8 pl-8 pr-3 bg-certifica-50 border border-certifica-200 rounded-[3px] text-[12px] focus:outline-none focus:ring-1 focus:ring-certifica-700/30"
            />
          </div>
          {matchedAudit && (
            <DSButton
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={async () => {
                const newFinding = await addFinding({
                  audit_id: matchedAudit.id,
                  tipo: "observacao",
                  clausula: "",
                  descricao: "Nova constatação",
                  evidencia: "",
                  acao_corretiva: "",
                  responsavel: "",
                  prazo: null,
                  status: "aberta",
                });
                if (newFinding?.id) setSelectedId(newFinding.id);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Nova Constatação
            </DSButton>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {auditIdFromUrl && audits.length === 0 ? (
            <div className="px-4 py-6 text-[12px] text-certifica-500 text-center">
              Carregando evidencias...
            </div>
          ) : (
            filtered.map((ev) => {
              const active = ev.id === selectedId;
              const badge = statusBadge(ev.status);
              return (
                <button
                  key={ev.id}
                  onClick={() => setSelectedId(ev.id)}
                  className={`w-full text-left px-4 py-3 border-b border-certifica-200 transition-colors ${active ? "bg-certifica-50" : "hover:bg-certifica-50/60"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-certifica-700 font-mono" style={{ fontWeight: 600 }}>
                      {ev.id}
                    </span>
                    <DSBadge variant={badge.variant} className="text-[9px] px-1.5 py-0">
                      {badge.label}
                    </DSBadge>
                  </div>
                  <div className="text-[12px] text-certifica-dark" style={{ fontWeight: active ? 600 : 400 }}>
                    {ev.titulo}
                  </div>
                  <div className="text-[10.5px] text-certifica-500 mt-1">{ev.processo} · Clausula {ev.initialClause}</div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto min-h-[500px] lg:min-h-0">
        <div className="max-w-[760px] mx-auto px-6 py-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[12px] text-certifica-700 font-mono" style={{ fontWeight: 600 }}>
                  {selected?.id?.startsWith("EV-") ? selected.id : `RAI-${(selected?.id ?? "").slice(0, 8)}`}
                </span>
                <ChevronRight className="w-3 h-3 text-certifica-500/60" strokeWidth={1.5} />
                <span className="text-[12px] text-certifica-500">Fluxo RAI rastreavel</span>
              </div>
              <h3 className="text-certifica-900">Formulario tecnico de RAI</h3>
              <p className="text-[12px] text-certifica-500 mt-0.5">
                {auditInfo.id} · {auditInfo.standard} · {auditInfo.auditor}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <DSButton
                variant="primary"
                size="sm"
                icon={<FileText className="w-3.5 h-3.5" strokeWidth={1.5} />}
                onClick={handleExportFullReport}
              >
                Relatório Completo
              </DSButton>
              <DSButton
                variant="outline"
                size="sm"
                icon={<Printer className="w-3.5 h-3.5" strokeWidth={1.5} />}
                onClick={() => {
                  const doc = buildRaiPdf({
                    codigo: auditInfo.id,
                    cliente: auditInfo.client,
                    norma: auditInfo.standard,
                    auditor: auditInfo.auditor,
                    dataInicio: matchedAudit?.data_inicio ?? "",
                    dataFim: matchedAudit?.data_fim ?? "",
                    descricao,
                    evidencia,
                    requisito: requisito || clausula,
                    classificacao,
                    recomendacao,
                    status: matchedAudit?.status ?? "",
                    observacoes: matchedAudit?.observacoes ?? "",
                  });
                  exportCertificaPdf(doc);
                  toast.success("PDF gerado! Use Ctrl+P para salvar.");
                }}
              >
                Imprimir / PDF
              </DSButton>
              <DSButton variant="outline" size="sm" icon={<Save className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={saveDraft}>
                Salvar
              </DSButton>
              {matchedAudit && !selected?.id.startsWith("EV-") && (
                <DSButton
                  variant="outline"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />}
                  onClick={handleDeleteFinding}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  Apagar
                </DSButton>
              )}
              <DSButton
                variant="outline"
                size="sm"
                icon={generatingRai ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.5} /> : <Bot className="w-3.5 h-3.5" strokeWidth={1.5} />}
                onClick={handleGenerateRAI}
                disabled={generatingRai}
              >
                {generatingRai ? "Gerando…" : "Gerar Relatório"}
              </DSButton>
              <DSButton variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={nextWorkflow}>
                Avançar workflow
              </DSButton>
            </div>
          </div>

          <div className="bg-white border border-certifica-200 rounded-[4px] p-4">
            <FindingForm data={findingForm} onChange={setFindingForm} compact />

            {evidenceMissing && (
              <div className="mt-3 text-[12px] text-nao-conformidade bg-nao-conformidade/5 border border-nao-conformidade/20 rounded-[4px] px-3 py-2">
                Regra anti-viés: a análise não pode inventar evidência. Dados insuficientes — complemente com fato objetivo.
              </div>
            )}

            <div className="flex justify-end gap-2 mt-3">
              <DSButton variant="outline" size="sm" icon={<Lightbulb className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={suggestDescriptionByAi}>
                Sugerir descrição
              </DSButton>
              <DSButton variant="outline" size="sm" icon={<Lightbulb className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={suggestRecommendationByAi}>
                Sugerir recomendação
              </DSButton>
            </div>
          </div>

          {/* CONCLUSÃO DA AUDITORIA */}
          <div className="bg-white border border-certifica-200 rounded-[4px] p-4 space-y-4">
            <div className="text-[13px] text-certifica-dark mb-1" style={{ fontWeight: 600 }}>
              Conclusão da Auditoria
            </div>
            <p className="text-[11px] text-certifica-500 mb-3">
              Marque as respostas para compor a seção de conclusão do relatório completo.
            </p>
            <div className="space-y-2">
              {([
                { key: "planoCumprido" as const, label: "1) Plano de auditoria foi cumprido?" },
                { key: "acoesAuditadas" as const, label: "2) Ações corretivas e preventivas foram auditadas?" },
                { key: "analiseCriticaAuditada" as const, label: "3) Análise Crítica pela Alta Direção foi auditada?" },
                { key: "documentacaoAtende" as const, label: "4) Documentação atende à norma de referência?" },
                { key: "obstaculoEncontrado" as const, label: "5) Houve algum obstáculo encontrado durante a auditoria?" },
                { key: "objetivosAtendidos" as const, label: "6) Os objetivos da auditoria foram atendidos dentro do escopo?" },
                { key: "sistemaEstabelecido" as const, label: "7) As constatações confirmam que o SGQ está estabelecido, implementado e mantido?" },
              ]).map((item) => (
                <label key={item.key} className="flex items-center gap-3 cursor-pointer px-3 py-2 rounded-[4px] border border-certifica-200 hover:bg-certifica-50/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={conclusaoAuditoria[item.key]}
                    onChange={(e) => setConclusaoAuditoria((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                    className="w-4 h-4 accent-certifica-700 rounded"
                  />
                  <span className="text-[12px] text-certifica-dark">{item.label}</span>
                </label>
              ))}
            </div>

            <DSTextarea
              label="Parecer Final (opcional)"
              value={parecerFinal}
              onChange={(e) => setParecerFinal(e.target.value)}
              placeholder="Deixe em branco para gerar automaticamente com base nos resultados, ou escreva um parecer personalizado."
            />
          </div>
        </div>
      </main>

      <aside className="w-full lg:w-[290px] lg:flex-shrink-0 border-t lg:border-t-0 lg:border-l border-certifica-200 bg-white overflow-y-auto">
        <div className="px-4 py-3 border-b border-certifica-200">
          <div className="text-[10px] tracking-[0.08em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
            Workflow de aprovação
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-3.5 h-3.5 text-certifica-700" strokeWidth={1.5} />
            <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>
              {auditInfo.client}
            </span>
          </div>
          <DSBadge variant={workflow === "aprovado" || workflow === "enviado-cliente" ? "conformidade" : "observacao"}>
            {workflowLabel[workflow]}
          </DSBadge>
          <div className="mt-3">
            <div className="flex justify-between text-[11px] text-certifica-500 mb-1">
              <span>Progresso</span>
              <span className="font-mono text-certifica-700">{progress}%</span>
            </div>
            <div className="h-[4px] bg-certifica-200 rounded-full overflow-hidden">
              <div className="h-full bg-certifica-700 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-certifica-200 space-y-2">
          <div className="text-[10px] tracking-[0.08em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
            Validações técnicas
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span>Clareza textual</span>
            <DSBadge variant={qualityChecks.clarity ? "conformidade" : "nao-conformidade"}>{qualityChecks.clarity ? "OK" : "Ajustar"}</DSBadge>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span>Objetividade</span>
            <DSBadge variant={qualityChecks.objective ? "conformidade" : "nao-conformidade"}>{qualityChecks.objective ? "OK" : "Ajustar"}</DSBadge>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span>Critério de auditoria</span>
            <DSBadge variant={qualityChecks.criteria ? "conformidade" : "nao-conformidade"}>{qualityChecks.criteria ? "OK" : "Ajustar"}</DSBadge>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <span>Consistência classe x severidade</span>
            <DSBadge variant={severityConsistency ? "conformidade" : "nao-conformidade"}>{severityConsistency ? "Consistente" : "Inconsistente"}</DSBadge>
          </div>
          {!severityConsistency && (
            <div className="mt-2 text-[10.5px] text-certifica-500 bg-certifica-50 border border-certifica-200 rounded-[3px] px-2.5 py-2 leading-relaxed">
              <span style={{ fontWeight: 600 }}>Combinações válidas:</span>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                <li>NC Maior: severidade Alta ou Crítica</li>
                <li>NC Menor: severidade Média ou Baixa</li>
                <li>Observação: severidade Baixa</li>
              </ul>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-b border-certifica-200">
          <div className="flex items-center gap-1.5 mb-2">
            <History className="w-3 h-3 text-certifica-500" strokeWidth={1.5} />
            <span className="text-[10px] tracking-[0.08em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
              Versionamento por revisão
            </span>
          </div>
          <div className="space-y-2">
            {revisionList.map((rev) => (
              <div key={`${rev.version}-${rev.date}`} className="border border-certifica-200 rounded-[4px] px-2.5 py-2">
                <div className="flex justify-between text-[11px]">
                  <span className="font-mono text-certifica-700">{rev.version}</span>
                  <span className="text-certifica-500">{rev.date}</span>
                </div>
                <div className="text-[11px] text-certifica-dark mt-1">{rev.action}</div>
                <div className="text-[10px] text-certifica-500 mt-0.5">por {rev.author}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3 space-y-2">
          <DSButton variant="outline" size="sm" className="w-full justify-start" icon={<Download className="w-3.5 h-3.5" />} onClick={exportPdf}>
            Exportar PDF com assinatura
          </DSButton>
          <DSButton variant="outline" size="sm" className="w-full justify-start" icon={<Send className="w-3.5 h-3.5" />} onClick={nextWorkflow}>
            Validar e avancar etapa
          </DSButton>
          {lastExport && (
            <div className="text-[11px] text-certifica-500">
              Ultima exportacao tecnica: {lastExport}
            </div>
          )}
        </div>
      </aside>
    </div>

      {/* Modal de confirmação de exclusão */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm certifica-modal-backdrop" onClick={() => !deleting && setConfirmDelete(false)} />
          <div className="relative bg-white rounded-lg shadow-2xl border border-certifica-200 w-full max-w-[420px] mx-4 p-6 certifica-modal-content">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100">
                <Trash2 className="w-5 h-5 text-red-600" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-certifica-900">Apagar constatação</h3>
                <p className="text-[12px] text-certifica-500">Essa ação não pode ser desfeita</p>
              </div>
            </div>
            <div className="bg-certifica-50 border border-certifica-200 rounded-md px-3 py-2.5 mb-5">
              <p className="text-[12px] text-certifica-700 font-medium mb-0.5">{selected?.id}</p>
              <p className="text-[12px] text-certifica-600 line-clamp-2">{selected?.titulo}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-[13px] font-medium text-certifica-700 bg-certifica-100 hover:bg-certifica-200 rounded-md transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeDeleteFinding}
                disabled={deleting}
                className="px-4 py-2 text-[13px] font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                    Apagando...
                  </>
                ) : (
                  "Apagar"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
