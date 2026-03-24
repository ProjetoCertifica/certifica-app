import React, { useMemo, useRef, useState } from "react";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { DSBadge } from "../components/ds/DSBadge";
import { DSButton } from "../components/ds/DSButton";
import {
  Search, GraduationCap, Plus, X, Users, Clock, Award, BookOpen,
  CheckCircle2, Calendar, Loader2, FileText, Video, Trash2, Download,
  ExternalLink, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useTrainings } from "../lib/useTrainings";
import type { TrainingWithEnrollments, Enrollment } from "../lib/useTrainings";
import type { TrainingInsert } from "../lib/database.types";

// ── UI-only types (category and mandatory live only in the UI layer) ──────────
type TrainingCategory = "iso" | "auditoria" | "seguranca" | "ambiental" | "lideranca" | "tecnico";

// DB enrollment statuses that map to the UI badge variants
type UIEnrollStatus = "inscrito" | "presente" | "ausente" | "aprovado" | "reprovado";

const categoryMeta: Record<TrainingCategory, { label: string; color: string }> = {
  iso:       { label: "Normas ISO",  color: "text-certifica-accent" },
  auditoria: { label: "Auditoria",   color: "text-observacao" },
  seguranca: { label: "Segurança",   color: "text-nao-conformidade" },
  ambiental: { label: "Ambiental",   color: "text-conformidade" },
  lideranca: { label: "Liderança",   color: "text-oportunidade" },
  tecnico:   { label: "Técnico",     color: "text-certifica-500" },
};

const enrollStatusMeta: Record<UIEnrollStatus, { label: string; variant: "outline" | "conformidade" | "observacao" | "oportunidade" | "nao-conformidade" }> = {
  inscrito:  { label: "Inscrito",   variant: "oportunidade" },
  presente:  { label: "Presente",   variant: "observacao" },
  ausente:   { label: "Ausente",    variant: "nao-conformidade" },
  aprovado:  { label: "Aprovado",   variant: "conformidade" },
  reprovado: { label: "Reprovado",  variant: "nao-conformidade" },
};

// Training DB status → badge
const trainingStatusMeta: Record<string, { label: string; variant: "outline" | "conformidade" | "observacao" | "oportunidade" | "nao-conformidade" }> = {
  "planejado":    { label: "Planejado",    variant: "oportunidade" },
  "em-andamento": { label: "Em andamento", variant: "observacao" },
  "concluido":    { label: "Concluído",    variant: "conformidade" },
};

// Derive a UI category from the norma field for display purposes
function categoryFromNorma(norma: string): TrainingCategory {
  const n = (norma ?? "").toUpperCase();
  if (n.includes("14001") || n.includes("50001")) return "ambiental";
  if (n.includes("45001"))                          return "seguranca";
  if (n.includes("27001"))                          return "iso";
  if (n.includes("9001"))                           return "iso";
  if (n.includes("AUDIT"))                          return "auditoria";
  return "tecnico";
}

// DB tipo → UI format label
function formatLabel(tipo: "presencial" | "ead" | "hibrido"): string {
  if (tipo === "ead") return "Online";
  if (tipo === "presencial") return "Presencial";
  return "Híbrido";
}

const companies = [
  "Metalúrgica AçoForte", "Grupo Energis", "Plastiform Industrial",
  "TechSoft Sistemas", "EcoVerde Sustentável", "BioFarma Ltda",
];

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return local.slice(0, 3) + "***@" + domain;
}

export default function TreinamentosPage() {
  const { trainings, loading, error, createTraining, updateTraining, removeTraining, enroll, updateEnrollment, removeEnrollment, uploadMaterial } = useTrainings();

  const [search, setSearch]             = useState("");
  const [catFilter, setCatFilter]       = useState<TrainingCategory | "todas">("todas");
  const [selectedTraining, setSelectedTraining] = useState<TrainingWithEnrollments | null>(null);

  // Enroll modal
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollForm, setEnrollForm]           = useState({
    participant: "",
    email: "",
    company: "",
    trainingId: "",
  });
  const [enrolling, setEnrolling] = useState(false);

  // Create training modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  useBodyScrollLock(showEnrollModal || showCreateModal);
  const [createForm, setCreateForm] = useState<{
    titulo: string;
    descricao: string;
    norma: string;
    carga_horaria: string;
    instrutor: string;
    tipo: "presencial" | "ead" | "hibrido";
    status: "planejado" | "em-andamento" | "concluido";
    data_inicio: string;
    data_fim: string;
    video_url: string;
  }>({
    titulo: "",
    descricao: "",
    norma: "",
    carga_horaria: "",
    instrutor: "",
    tipo: "presencial",
    status: "planejado",
    data_inicio: "",
    data_fim: "",
    video_url: "",
  });
  const [creating, setCreating] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Delete training confirmation
  const [confirmDeleteTraining, setConfirmDeleteTraining] = useState(false);

  // ── Derived / filtered list ──────────────────────────────────────────────
  const filtered = useMemo(() => {
    return trainings.filter((t) => {
      const cat = categoryFromNorma(t.norma);
      if (catFilter !== "todas" && cat !== catFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.titulo.toLowerCase().includes(q) ||
        t.descricao.toLowerCase().includes(q) ||
        (t.norma ?? "").toLowerCase().includes(q)
      );
    });
  }, [trainings, search, catFilter]);

  // Keep selectedTraining in sync when trainings array is refreshed
  const liveSelected: TrainingWithEnrollments | null = useMemo(() => {
    if (!selectedTraining) return null;
    return trainings.find((t) => t.id === selectedTraining.id) ?? selectedTraining;
  }, [trainings, selectedTraining]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const allEnrollments: Enrollment[] = trainings.flatMap((t) => t.enrollments);
    const totalEnrolled = allEnrollments.length;
    const completed     = allEnrollments.filter((e) => e.status === "aprovado").length;
    const certs         = allEnrollments.filter((e) => e.certificado_url).length;
    const scored        = allEnrollments.filter((e) => e.nota != null);
    const avgScore      = scored.length
      ? Math.round(scored.reduce((a, e) => a + (e.nota ?? 0), 0) / scored.length)
      : 0;
    return { totalEnrolled, completed, certs, avgScore };
  }, [trainings]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleEnroll = async () => {
    if (!enrollForm.participant || !enrollForm.email || !enrollForm.trainingId) return;
    setEnrolling(true);
    try {
      const result = await enroll({
        training_id:        enrollForm.trainingId,
        participante_nome:  enrollForm.participant,
        participante_email: enrollForm.email,
        status:             "inscrito",
      });
      if (result) {
        toast.success("Participante matriculado com sucesso!");
        setEnrollForm({ participant: "", email: "", company: "", trainingId: "" });
        setShowEnrollModal(false);
      } else {
        toast.error("Erro ao matricular participante. Verifique se já está inscrito.");
      }
    } catch {
      toast.error("Erro inesperado ao matricular participante.");
    } finally {
      setEnrolling(false);
    }
  };

  const handleCreateTraining = async () => {
    if (!createForm.titulo || !createForm.instrutor) return;
    setCreating(true);
    try {
      const payload: TrainingInsert = {
        titulo:           createForm.titulo,
        descricao:        createForm.descricao,
        norma:            createForm.norma,
        carga_horaria:    createForm.carga_horaria ? Number(createForm.carga_horaria) : 0,
        instrutor:        createForm.instrutor,
        tipo:             createForm.tipo,
        status:           createForm.status,
        data_inicio:      createForm.data_inicio || null,
        data_fim:         createForm.data_fim    || null,
        material_pdf_url: null,
        video_url:        createForm.video_url   || null,
      };
      const result = await createTraining(payload);
      if (result) {
        // Upload PDF if provided
        if (pdfFile) {
          const { url, errorMsg } = await uploadMaterial(pdfFile, result.id);
          if (url) {
            await updateTraining(result.id, { material_pdf_url: url });
          } else {
            toast.error(`Treinamento criado, mas erro no upload do PDF: ${errorMsg}`);
          }
        }
        toast.success("Treinamento criado com sucesso!");
        setCreateForm({
          titulo: "", descricao: "", norma: "", carga_horaria: "",
          instrutor: "", tipo: "presencial", status: "planejado",
          data_inicio: "", data_fim: "", video_url: "",
        });
        setPdfFile(null);
        if (pdfInputRef.current) pdfInputRef.current.value = "";
        setShowCreateModal(false);
      } else {
        toast.error("Erro ao criar treinamento.");
      }
    } catch {
      toast.error("Erro inesperado ao criar treinamento.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTraining = async (id: string) => {
    setConfirmDeleteTraining(false);
    setSelectedTraining(null);
    const ok = await removeTraining(id);
    if (ok) toast.success("Treinamento removido.");
    else toast.error("Erro ao remover treinamento.");
  };

  // ── Participant management handlers ────────────────────────────────────
  const handleEnrollmentStatusChange = async (enrollmentId: string, trainingId: string, newStatus: UIEnrollStatus) => {
    const ok = await updateEnrollment(enrollmentId, trainingId, { status: newStatus });
    if (ok) toast.success(`Status alterado para "${enrollStatusMeta[newStatus].label}".`);
    else toast.error("Erro ao alterar status do participante.");
  };

  const handleEnrollmentNotaBlur = async (enrollmentId: string, trainingId: string, value: string) => {
    const nota = value === "" ? null : Math.min(100, Math.max(0, Number(value)));
    const ok = await updateEnrollment(enrollmentId, trainingId, { nota });
    if (ok) toast.success("Nota atualizada.");
    else toast.error("Erro ao atualizar nota.");
  };

  const handleRemoveEnrollment = async (enrollmentId: string, trainingId: string, participantName: string) => {
    if (!window.confirm(`Remover "${participantName}" deste treinamento?`)) return;
    const ok = await removeEnrollment(enrollmentId, trainingId);
    if (ok) toast.success("Participante removido.");
    else toast.error("Erro ao remover participante.");
  };

  const handleBulkPresence = async (training: TrainingWithEnrollments) => {
    const inscritos = training.enrollments.filter((e) => e.status === "inscrito");
    if (inscritos.length === 0) {
      toast.info("Nenhum participante com status \"Inscrito\" para marcar presença.");
      return;
    }
    let successCount = 0;
    for (const e of inscritos) {
      const ok = await updateEnrollment(e.id, training.id, { status: "presente" });
      if (ok) successCount++;
    }
    toast.success(`Presença registrada para ${successCount} participante${successCount !== 1 ? "s" : ""}.`);
  };

  const generateCertificateHtml = (
    participantName: string,
    trainingTitle: string,
    norma: string,
    cargaHoraria: number,
    dataInicio: string | null,
    dataFim: string | null,
  ): string => {
    const today = new Date().toLocaleDateString("pt-BR");
    const periodo = dataInicio && dataFim
      ? `${new Date(dataInicio).toLocaleDateString("pt-BR")} a ${new Date(dataFim).toLocaleDateString("pt-BR")}`
      : dataInicio
        ? `A partir de ${new Date(dataInicio).toLocaleDateString("pt-BR")}`
        : "Data não informada";

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Certificado - ${participantName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Inter:wght@300;400;600&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
    .certificate {
      width: 900px; padding: 60px; background: #fff;
      border: 3px solid #1a365d; position: relative;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .certificate::before {
      content: ''; position: absolute; inset: 8px;
      border: 1px solid #cbd5e0; pointer-events: none;
    }
    .header { text-align: center; margin-bottom: 40px; }
    .logo-placeholder {
      width: 60px; height: 60px; margin: 0 auto 16px;
      border-radius: 50%; background: #1a365d; display: flex;
      align-items: center; justify-content: center;
      color: #fff; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 22px;
    }
    .title {
      font-family: 'Playfair Display', serif; font-size: 28px;
      color: #1a365d; letter-spacing: 4px; text-transform: uppercase;
      margin-bottom: 4px;
    }
    .subtitle { font-family: 'Inter', sans-serif; font-size: 11px; color: #718096; letter-spacing: 2px; text-transform: uppercase; }
    .body { text-align: center; margin-bottom: 36px; }
    .preamble { font-family: 'Inter', sans-serif; font-size: 13px; color: #4a5568; margin-bottom: 20px; }
    .participant-name {
      font-family: 'Playfair Display', serif; font-size: 32px;
      color: #1a365d; border-bottom: 2px solid #e2e8f0;
      display: inline-block; padding-bottom: 6px; margin-bottom: 20px;
    }
    .details { font-family: 'Inter', sans-serif; font-size: 13px; color: #4a5568; line-height: 2; }
    .details strong { color: #2d3748; }
    .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; }
    .signature-block { text-align: center; width: 220px; }
    .signature-line { border-top: 1px solid #a0aec0; margin-bottom: 6px; }
    .signature-label { font-family: 'Inter', sans-serif; font-size: 10px; color: #718096; }
    .date-block { font-family: 'Inter', sans-serif; font-size: 11px; color: #718096; text-align: center; }
    @media print {
      body { background: #fff; padding: 0; }
      .certificate { box-shadow: none; width: 100%; }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="logo-placeholder">C</div>
      <div class="title">Certificado de Conclusão</div>
      <div class="subtitle">Certifica - Gestão de Certificação e Compliance</div>
    </div>
    <div class="body">
      <div class="preamble">Certificamos que</div>
      <div class="participant-name">${participantName}</div>
      <div class="details">
        concluiu com aproveitamento o treinamento<br>
        <strong>${trainingTitle}</strong><br>
        ${norma ? `Norma de referência: <strong>${norma}</strong><br>` : ""}
        Carga horária: <strong>${cargaHoraria}h</strong><br>
        Período: <strong>${periodo}</strong>
      </div>
    </div>
    <div class="footer">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">Instrutor(a) responsável</div>
      </div>
      <div class="date-block">Emitido em ${today}</div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">Coordenação de treinamentos</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  };

  const handleGenerateCertificate = async (enrollment: Enrollment, training: TrainingWithEnrollments) => {
    const html = generateCertificateHtml(
      enrollment.participante_nome,
      training.titulo,
      training.norma ?? "",
      training.carga_horaria,
      training.data_inicio,
      training.data_fim,
    );
    // Open in new window
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
    // Mark enrollment with a placeholder certificado_url
    const ok = await updateEnrollment(enrollment.id, training.id, { certificado_url: `certificado_${enrollment.id}` });
    if (ok) toast.success("Certificado gerado com sucesso!");
    else toast.error("Certificado aberto, mas erro ao salvar registro.");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-5 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-certifica-accent mr-2" />
        <span className="text-certifica-500 text-[13px]">Carregando treinamentos…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5">
        <div className="bg-red-50 border border-red-200 rounded-[4px] px-4 py-3 text-[12px] text-red-700">
          Erro ao carregar treinamentos: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-certifica-900 text-lg" style={{ fontWeight: 700 }}>Treinamentos</h2>
          <p className="text-[11px] text-certifica-500">Catálogo de treinamentos, matrículas e certificados — vinculado às normas e projetos.</p>
        </div>
        <div className="flex items-center gap-2">
          <DSButton variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setShowCreateModal(true)}>
            Novo treinamento
          </DSButton>
          <DSButton size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => {
            setShowEnrollModal(true);
            setEnrollForm({ participant: "", email: "", company: "", trainingId: liveSelected?.id ?? "" });
          }}>
            Matricular participante
          </DSButton>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Treinamentos",   value: trainings.length,      icon: <BookOpen className="w-4 h-4" />,      color: "text-certifica-accent" },
          { label: "Matrículas ativas", value: stats.totalEnrolled, icon: <Users className="w-4 h-4" />,        color: "text-observacao" },
          { label: "Aprovados",      value: stats.completed,        icon: <CheckCircle2 className="w-4 h-4" />, color: "text-conformidade" },
          { label: "Nota média",     value: `${stats.avgScore}%`,   icon: <Award className="w-4 h-4" />,        color: "text-oportunidade" },
        ].map((k) => (
          <div key={k.label} className="bg-white border border-certifica-200 rounded-[4px] p-3 flex items-center gap-3">
            <div className={k.color}>{k.icon}</div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-certifica-500" style={{ fontWeight: 600 }}>{k.label}</div>
              <div className={`text-xl ${k.color}`} style={{ fontWeight: 700 }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search / filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-certifica-500/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar treinamento..."
            className="w-full h-8 pl-8 pr-3 rounded-[4px] bg-white border border-certifica-200 text-[12px] focus:outline-none focus:ring-1 focus:ring-certifica-accent/40"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value as TrainingCategory | "todas")}
          className="h-8 px-2 rounded-[4px] border border-certifica-200 text-[11px] bg-white"
        >
          <option value="todas">Todas categorias</option>
          {Object.entries(categoryMeta).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4">
        {/* Training list */}
        <div className="space-y-2">
          {filtered.map((t) => {
            const cat      = categoryMeta[categoryFromNorma(t.norma)];
            const isActive = liveSelected?.id === t.id;
            const total    = t.total_inscritos;
            // occupancy bar: use a nominal max of 25 when we don't have maxParticipants
            const nominalMax = 25;
            const occupancy  = Math.min(100, Math.round((total / nominalMax) * 100));

            return (
              <button
                key={t.id}
                onClick={() => { setSelectedTraining(t); setConfirmDeleteTraining(false); }}
                className={`w-full text-left bg-white border rounded-[4px] p-3 transition-all ${isActive ? "border-certifica-accent shadow-sm" : "border-certifica-200 hover:border-certifica-accent/40"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[12.5px] text-certifica-dark" style={{ fontWeight: 600 }}>{t.titulo}</span>
                      {t.status === "em-andamento" && (
                        <DSBadge variant="observacao">Em andamento</DSBadge>
                      )}
                      {t.status === "concluido" && (
                        <DSBadge variant="conformidade">Concluído</DSBadge>
                      )}
                    </div>
                    <p className="text-[10.5px] text-certifica-500 mb-1.5">{t.descricao}</p>
                    <div className="flex items-center gap-3 text-[10px] text-certifica-500">
                      <span className={cat.color} style={{ fontWeight: 500 }}>{cat.label}</span>
                      {t.norma && <span>Ref: {t.norma}</span>}
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" /> {t.carga_horaria}h
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Users className="w-3 h-3" /> {total} inscrito{total !== 1 ? "s" : ""}
                      </span>
                      <span className="capitalize">{formatLabel(t.tipo)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {t.data_inicio && (
                      <span className="text-[9px] text-certifica-500 flex items-center gap-0.5">
                        <Calendar className="w-3 h-3" /> {new Date(t.data_inicio).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    <div className="w-16 bg-certifica-100 rounded-full h-1.5 mt-1">
                      <div
                        className={`rounded-full h-1.5 ${occupancy > 90 ? "bg-nao-conformidade" : occupancy > 70 ? "bg-observacao" : "bg-conformidade"}`}
                        style={{ width: `${occupancy}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-certifica-500">{total} inscrito{total !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-certifica-500 text-[12px]">
              Nenhum treinamento encontrado.
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="bg-white border border-certifica-200 rounded-[4px] overflow-hidden">
          {!liveSelected ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-certifica-500 text-center">
              <GraduationCap className="w-10 h-10 mb-3 text-certifica-200" />
              <p className="text-[13px]" style={{ fontWeight: 500 }}>Selecione um treinamento</p>
              <p className="text-[11px] mt-1">Clique em qualquer treinamento para ver detalhes e participantes.</p>
            </div>
          ) : (
            <div className="flex flex-col max-h-[calc(100vh-260px)]">
              <div className="px-4 py-3 border-b border-certifica-200 flex-shrink-0">
                <div className="text-[14px] text-certifica-dark" style={{ fontWeight: 700 }}>{liveSelected.titulo}</div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-certifica-500">
                  <span>Instrutor: {liveSelected.instrutor}</span>
                  <span>·</span>
                  <span>{liveSelected.carga_horaria}h</span>
                  <span>·</span>
                  <span className="capitalize">{formatLabel(liveSelected.tipo)}</span>
                  {liveSelected.norma && <><span>·</span><span>Ref: {liveSelected.norma}</span></>}
                </div>
                <div className="mt-1">
                  <DSBadge variant={trainingStatusMeta[liveSelected.status]?.variant ?? "outline"}>
                    {trainingStatusMeta[liveSelected.status]?.label ?? liveSelected.status}
                  </DSBadge>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {liveSelected.descricao && (
                  <p className="text-[11.5px] text-certifica-dark">{liveSelected.descricao}</p>
                )}

                {/* Material PDF */}
                {liveSelected.material_pdf_url && (
                  <div className="border border-certifica-200 rounded-[4px] p-2.5 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-nao-conformidade flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-certifica-dark" style={{ fontWeight: 600 }}>Material de apoio (PDF)</div>
                      <div className="text-[10px] text-certifica-500 truncate">{liveSelected.titulo}</div>
                    </div>
                    <button
                      title="Baixar PDF"
                      onClick={async () => {
                        try {
                          const res = await fetch(liveSelected.material_pdf_url!);
                          const blob = await res.blob();
                          const blobUrl = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = blobUrl;
                          a.download = `${liveSelected.titulo}.pdf`;
                          a.click();
                          URL.revokeObjectURL(blobUrl);
                        } catch {
                          window.open(encodeURI(liveSelected.material_pdf_url!), "_blank");
                        }
                      }}
                      className="text-certifica-500 hover:text-certifica-accent cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      title="Abrir PDF"
                      onClick={() => window.open(encodeURI(liveSelected.material_pdf_url!), "_blank")}
                      className="text-certifica-500 hover:text-certifica-accent cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Video */}
                {liveSelected.video_url && (() => {
                  const url = liveSelected.video_url;
                  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
                  const vmMatch = url.match(/vimeo\.com\/(\d+)/);
                  if (ytMatch) {
                    return (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-certifica-500 mb-1.5 flex items-center gap-1" style={{ fontWeight: 600 }}>
                          <Video className="w-3 h-3" /> Vídeo do treinamento
                        </div>
                        <div className="rounded-[4px] overflow-hidden" style={{ aspectRatio: "16/9" }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${ytMatch[1]}`}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    );
                  }
                  if (vmMatch) {
                    return (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-certifica-500 mb-1.5 flex items-center gap-1" style={{ fontWeight: 600 }}>
                          <Video className="w-3 h-3" /> Vídeo do treinamento
                        </div>
                        <div className="rounded-[4px] overflow-hidden" style={{ aspectRatio: "16/9" }}>
                          <iframe
                            src={`https://player.vimeo.com/video/${vmMatch[1]}`}
                            className="w-full h-full"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="border border-certifica-200 rounded-[4px] p-2.5 flex items-center gap-2">
                      <Video className="w-4 h-4 text-certifica-accent flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-certifica-dark" style={{ fontWeight: 600 }}>Vídeo do treinamento</div>
                        <div className="text-[10px] text-certifica-500 truncate">{url}</div>
                      </div>
                      <button
                        onClick={() => window.open(encodeURI(url), "_blank")}
                        className="text-certifica-500 hover:text-certifica-accent cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })()}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-certifica-500" style={{ fontWeight: 600 }}>
                      Participantes ({liveSelected.enrollments.length})
                    </div>
                    {liveSelected.enrollments.some((e) => e.status === "inscrito") && (
                      <button
                        onClick={() => handleBulkPresence(liveSelected)}
                        className="flex items-center gap-1 text-[10px] text-conformidade hover:text-conformidade/80 cursor-pointer"
                        style={{ fontWeight: 600 }}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Registrar Presença
                      </button>
                    )}
                  </div>
                  {liveSelected.enrollments.length === 0 ? (
                    <p className="text-[11px] text-certifica-500 italic">Nenhum participante matriculado.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {liveSelected.enrollments.map((e) => {
                        const st = enrollStatusMeta[e.status as UIEnrollStatus] ?? { label: e.status, variant: "outline" as const };
                        const showNota = ["presente", "aprovado", "reprovado"].includes(e.status);
                        return (
                          <div key={e.id} className="border border-certifica-200 rounded-[4px] p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-certifica-dark" style={{ fontWeight: 600 }}>{e.participante_nome}</span>
                              <div className="flex items-center gap-1.5">
                                <DSBadge variant={st.variant}>{st.label}</DSBadge>
                                {e.certificado_url && (
                                  <span className="text-conformidade flex items-center gap-0.5 text-[10px]" style={{ fontWeight: 600 }}>
                                    <Award className="w-3 h-3" />
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-certifica-500 mb-2">
                              <span>{maskEmail(e.participante_email)}</span>
                              <span>Matrícula: {new Date(e.created_at).toLocaleDateString("pt-BR")}</span>
                              {e.nota != null && (
                                <span>Nota: <strong>{e.nota}%</strong></span>
                              )}
                            </div>
                            {/* Management controls */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <select
                                value={e.status}
                                onChange={(ev) => handleEnrollmentStatusChange(e.id, liveSelected.id, ev.target.value as UIEnrollStatus)}
                                className="h-6 px-1.5 rounded-[3px] border border-certifica-200 text-[10px] bg-white cursor-pointer"
                              >
                                <option value="inscrito">Inscrito</option>
                                <option value="presente">Presente</option>
                                <option value="ausente">Ausente</option>
                                <option value="aprovado">Aprovado</option>
                                <option value="reprovado">Reprovado</option>
                              </select>
                              {showNota && (
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  defaultValue={e.nota ?? ""}
                                  placeholder="Nota"
                                  onBlur={(ev) => handleEnrollmentNotaBlur(e.id, liveSelected.id, ev.target.value)}
                                  className="h-6 w-16 px-1.5 rounded-[3px] border border-certifica-200 text-[10px]"
                                />
                              )}
                              {e.status === "aprovado" && !e.certificado_url && (
                                <button
                                  onClick={() => handleGenerateCertificate(e, liveSelected)}
                                  className="flex items-center gap-0.5 h-6 px-2 rounded-[3px] bg-conformidade/10 text-conformidade text-[10px] hover:bg-conformidade/20 cursor-pointer"
                                  style={{ fontWeight: 600 }}
                                >
                                  <Award className="w-3 h-3" /> Gerar Certificado
                                </button>
                              )}
                              {e.status === "aprovado" && e.certificado_url && (
                                <button
                                  onClick={() => handleGenerateCertificate(e, liveSelected)}
                                  className="flex items-center gap-0.5 h-6 px-2 rounded-[3px] bg-certifica-100 text-certifica-500 text-[10px] hover:bg-certifica-200 cursor-pointer"
                                  style={{ fontWeight: 500 }}
                                >
                                  <Download className="w-3 h-3" /> Ver Certificado
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveEnrollment(e.id, liveSelected.id, e.participante_nome)}
                                className="ml-auto text-certifica-400 hover:text-red-500 cursor-pointer"
                                title="Remover participante"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Delete training */}
                <div className="pt-2 border-t border-certifica-100">
                  {!confirmDeleteTraining ? (
                    <button
                      onClick={() => setConfirmDeleteTraining(true)}
                      className="flex items-center gap-1.5 text-[11px] text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Apagar treinamento
                    </button>
                  ) : (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-[4px]">
                      <p className="text-[11px] text-red-700 mb-2">Tem certeza? Todos os participantes serão removidos.</p>
                      <div className="flex gap-1.5">
                        <DSButton variant="outline" size="sm" onClick={() => setConfirmDeleteTraining(false)}>Cancelar</DSButton>
                        <DSButton size="sm" onClick={() => handleDeleteTraining(liveSelected.id)}>Apagar</DSButton>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Enroll modal ───────────────────────────────────────────────────── */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center certifica-modal-backdrop" onClick={() => setShowEnrollModal(false)}>
          <div className="bg-white rounded-[6px] border border-certifica-200 w-[420px] shadow-lg certifica-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
              <span className="text-[13px] text-certifica-dark" style={{ fontWeight: 600 }}>Matricular participante</span>
              <button onClick={() => setShowEnrollModal(false)} className="text-certifica-500 hover:text-certifica-dark cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Nome do participante *</label>
                <input
                  value={enrollForm.participant}
                  onChange={(e) => setEnrollForm((p) => ({ ...p, participant: e.target.value }))}
                  placeholder="Nome completo"
                  className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>E-mail do participante *</label>
                <input
                  type="email"
                  value={enrollForm.email}
                  onChange={(e) => setEnrollForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Empresa</label>
                <select
                  value={enrollForm.company}
                  onChange={(e) => setEnrollForm((p) => ({ ...p, company: e.target.value }))}
                  className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]"
                >
                  <option value="">Selecione</option>
                  {companies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Treinamento *</label>
                <select
                  value={enrollForm.trainingId}
                  onChange={(e) => setEnrollForm((p) => ({ ...p, trainingId: e.target.value }))}
                  className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]"
                >
                  <option value="">Selecione</option>
                  {trainings.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                </select>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-certifica-200 flex justify-end gap-2">
              <DSButton variant="outline" size="sm" onClick={() => setShowEnrollModal(false)}>Cancelar</DSButton>
              <DSButton
                size="sm"
                onClick={handleEnroll}
                disabled={enrolling || !enrollForm.participant || !enrollForm.email || !enrollForm.trainingId}
              >
                {enrolling ? "Matriculando…" : "Matricular"}
              </DSButton>
            </div>
          </div>
        </div>
      )}

      {/* ── Create training modal ──────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center certifica-modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-[6px] border border-certifica-200 w-[480px] shadow-lg certifica-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
              <span className="text-[13px] text-certifica-dark" style={{ fontWeight: 600 }}>Novo treinamento</span>
              <button onClick={() => setShowCreateModal(false)} className="text-certifica-500 hover:text-certifica-dark cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Título *</label>
                <input
                  value={createForm.titulo}
                  onChange={(e) => setCreateForm((p) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Nome do treinamento"
                  className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Descrição</label>
                <textarea
                  value={createForm.descricao}
                  onChange={(e) => setCreateForm((p) => ({ ...p, descricao: e.target.value }))}
                  placeholder="Descreva o conteúdo do treinamento"
                  rows={2}
                  className="w-full px-2 py-1.5 rounded-[4px] border border-certifica-200 text-[12px] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Norma de referência</label>
                  <input
                    value={createForm.norma}
                    onChange={(e) => setCreateForm((p) => ({ ...p, norma: e.target.value }))}
                    placeholder="ex: ISO 9001"
                    className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Carga horária (h)</label>
                  <input
                    type="number"
                    min={1}
                    value={createForm.carga_horaria}
                    onChange={(e) => setCreateForm((p) => ({ ...p, carga_horaria: e.target.value }))}
                    placeholder="16"
                    className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Instrutor *</label>
                <input
                  value={createForm.instrutor}
                  onChange={(e) => setCreateForm((p) => ({ ...p, instrutor: e.target.value }))}
                  placeholder="Nome do instrutor"
                  className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Formato</label>
                  <select
                    value={createForm.tipo}
                    onChange={(e) => setCreateForm((p) => ({ ...p, tipo: e.target.value as "presencial" | "ead" | "hibrido" }))}
                    className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[11px] bg-white"
                  >
                    <option value="presencial">Presencial</option>
                    <option value="ead">Online (EAD)</option>
                    <option value="hibrido">Híbrido</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Status</label>
                  <select
                    value={createForm.status}
                    onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value as "planejado" | "em-andamento" | "concluido" }))}
                    className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[11px] bg-white"
                  >
                    <option value="planejado">Planejado</option>
                    <option value="em-andamento">Em andamento</option>
                    <option value="concluido">Concluído</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Data de início</label>
                  <input
                    type="date"
                    value={createForm.data_inicio}
                    onChange={(e) => setCreateForm((p) => ({ ...p, data_inicio: e.target.value }))}
                    className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Data de fim</label>
                  <input
                    type="date"
                    value={createForm.data_fim}
                    onChange={(e) => setCreateForm((p) => ({ ...p, data_fim: e.target.value }))}
                    className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]"
                  />
                </div>
              </div>

              {/* Material PDF */}
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Material de apoio (PDF)</label>
                <div
                  className="flex items-center gap-2 h-8 px-2 rounded-[4px] border border-certifica-200 border-dashed cursor-pointer hover:border-certifica-accent/60 transition-colors"
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5 text-certifica-500" />
                  <span className="text-[11px] text-certifica-500 truncate">
                    {pdfFile ? pdfFile.name : "Clique para selecionar PDF"}
                  </span>
                  {pdfFile && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setPdfFile(null); if (pdfInputRef.current) pdfInputRef.current.value = ""; }}
                      className="ml-auto text-certifica-500 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </div>

              {/* Video URL */}
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Link do vídeo (YouTube, Vimeo ou URL direta)</label>
                <input
                  value={createForm.video_url}
                  onChange={(e) => setCreateForm((p) => ({ ...p, video_url: e.target.value }))}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]"
                />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-certifica-200 flex justify-end gap-2">
              <DSButton variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>Cancelar</DSButton>
              <DSButton
                size="sm"
                onClick={handleCreateTraining}
                disabled={creating || !createForm.titulo || !createForm.instrutor}
              >
                {creating ? "Criando…" : "Criar treinamento"}
              </DSButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
