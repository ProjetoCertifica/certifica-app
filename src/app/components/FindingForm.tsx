import React, { useState, useCallback } from "react";
import { ChevronDown, Tag, ClipboardList, Wrench, CheckSquare } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FindingFormData {
  // Card 1: Identificacao
  norma: string;
  clausula: string;
  subclausula: string;
  titulo_clausula: string;
  area_auditada: string;
  processo_auditado: string;
  setor: string;
  local_evidencia: string;
  tipo: string;
  severidade: string;
  prioridade: string;

  // Card 2: Evidencia e Analise
  descricao: string;
  criterio_requisito: string;
  evidencia: string;
  tipo_evidencia: string;
  documento_avaliado: string;
  codigo_documento: string;
  revisao_documento: string;
  registro_analisado: string;
  amostra_qtd: string;
  criterio_amostragem: string;
  entrevistados: string;
  condicao_encontrada: string;
  desvio_identificado: string;
  impacto_potencial: string;
  risco_associado: string;
  abrangencia: string;
  qtd_itens_afetados: string;
  periodo_afetado: string;
  recorrencia: boolean;

  // Card 3: Tratamento
  contencao_imediata: string;
  data_contencao: string;
  responsavel_contencao: string;
  causa_imediata: string;
  causa_raiz: string;
  metodo_analise: string;
  correcao_imediata: string;
  acao_corretiva: string;
  acao_preventiva: string;
  recomendacao_auditor: string;
  responsavel: string;
  prazo: string;
  custo_estimado: string;
  status: string;

  // Card 4: Fechamento
  verificacao_eficacia: string;
  responsavel_verificacao: string;
  data_verificacao: string;
  status_eficacia: string;
  observacao_anexo: string;
}

interface FindingFormProps {
  data: FindingFormData;
  onChange: (data: FindingFormData) => void;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Reusable field helpers (pure render functions, no extra components)
// ---------------------------------------------------------------------------

const labelCx = "block text-[11px] text-certifica-500 mb-1";
const labelStyle: React.CSSProperties = { fontWeight: 500 };

const inputCx =
  "w-full h-8 px-2.5 rounded-[4px] border border-certifica-200 text-[11px] text-certifica-dark bg-white focus:outline-none focus:ring-1 focus:ring-certifica-accent/30";

const textareaCx =
  "w-full px-2.5 py-1.5 rounded-[4px] border border-certifica-200 text-[11px] text-certifica-dark bg-white focus:outline-none focus:ring-1 focus:ring-certifica-accent/30 resize-y";

const selectCx =
  "w-full h-8 px-2.5 rounded-[4px] border border-certifica-200 text-[11px] text-certifica-dark bg-white focus:outline-none focus:ring-1 focus:ring-certifica-accent/30";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FindingForm({ data, onChange, compact = false }: FindingFormProps) {
  const [collapsed, setCollapsed] = useState<boolean[]>([false, false, false, false]);

  const toggle = useCallback((idx: number) => {
    setCollapsed((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  }, []);

  const set = useCallback(
    <K extends keyof FindingFormData>(field: K, value: FindingFormData[K]) => {
      onChange({ ...data, [field]: value });
    },
    [data, onChange],
  );

  const text = useCallback(
    (field: keyof FindingFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
      set(field, e.target.value),
    [set],
  );

  const area = useCallback(
    (field: keyof FindingFormData) => (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      set(field, e.target.value),
    [set],
  );

  const sel = useCallback(
    (field: keyof FindingFormData) => (e: React.ChangeEvent<HTMLSelectElement>) =>
      set(field, e.target.value),
    [set],
  );

  const px = compact ? "px-2 py-2" : "px-3 py-3";
  const gap = compact ? "gap-2" : "gap-2.5";

  // Card header renderer
  const renderHeader = (
    idx: number,
    icon: React.ReactNode,
    title: string,
  ) => (
    <button
      type="button"
      onClick={() => toggle(idx)}
      className="w-full flex items-center justify-between px-3 py-2.5 bg-certifica-50 border border-certifica-200 rounded-[4px] text-[12px] text-certifica-900 hover:bg-certifica-100 transition-colors cursor-pointer"
      style={{ fontWeight: 600 }}
    >
      <span className="flex items-center gap-1.5">
        {icon}
        {title}
      </span>
      <ChevronDown
        size={14}
        className={`transition-transform ${collapsed[idx] ? "-rotate-90" : "rotate-0"}`}
      />
    </button>
  );

  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      {/* ---------------------------------------------------------------- */}
      {/* Card 1 - Identificacao do Achado                                 */}
      {/* ---------------------------------------------------------------- */}
      <div>
        {renderHeader(0, <Tag size={13} />, "Identificacao do Achado")}
        {!collapsed[0] && (
          <div className={`${px} grid grid-cols-2 ${gap} border border-t-0 border-certifica-200 rounded-b-[4px]`}>
            {/* Norma | Clausula */}
            <div>
              <label className={labelCx} style={labelStyle}>Norma</label>
              <input className={inputCx} placeholder="ISO 9001:2015" value={data.norma} onChange={text("norma")} />
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Clausula</label>
              <input className={inputCx} placeholder="7.1.5" value={data.clausula} onChange={text("clausula")} />
            </div>

            {/* Subclausula | Titulo */}
            <div>
              <label className={labelCx} style={labelStyle}>Subclausula</label>
              <input className={inputCx} value={data.subclausula} onChange={text("subclausula")} />
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Titulo da clausula</label>
              <input className={inputCx} value={data.titulo_clausula} onChange={text("titulo_clausula")} />
            </div>

            {/* Area | Processo */}
            <div>
              <label className={labelCx} style={labelStyle}>Area auditada</label>
              <input className={inputCx} placeholder="Metrologia" value={data.area_auditada} onChange={text("area_auditada")} />
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Processo auditado</label>
              <input className={inputCx} placeholder="Controle de dispositivos" value={data.processo_auditado} onChange={text("processo_auditado")} />
            </div>

            {/* Setor | Local */}
            <div>
              <label className={labelCx} style={labelStyle}>Setor</label>
              <input className={inputCx} value={data.setor} onChange={text("setor")} />
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Local da evidencia</label>
              <input className={inputCx} placeholder="Laboratorio dimensional" value={data.local_evidencia} onChange={text("local_evidencia")} />
            </div>

            {/* Classificacao - full width */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Classificacao</label>
              <select className={selectCx} value={data.tipo} onChange={sel("tipo")}>
                <option value="">Selecione...</option>
                <option value="conformidade">Conformidade</option>
                <option value="nc-maior">NC Maior</option>
                <option value="nc-menor">NC Menor</option>
                <option value="observacao">Observacao</option>
                <option value="oportunidade">Oportunidade</option>
              </select>
            </div>

            {/* Severidade | Prioridade */}
            <div>
              <label className={labelCx} style={labelStyle}>Severidade</label>
              <select className={selectCx} value={data.severidade} onChange={sel("severidade")}>
                <option value="">Selecione...</option>
                <option value="critica">Critica</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Prioridade</label>
              <select className={selectCx} value={data.prioridade} onChange={sel("prioridade")}>
                <option value="">Selecione...</option>
                <option value="imediata">Imediata</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Card 2 - Evidencia e Analise                                     */}
      {/* ---------------------------------------------------------------- */}
      <div>
        {renderHeader(1, <ClipboardList size={13} />, "Evidencia e Analise")}
        {!collapsed[1] && (
          <div className={`${px} grid grid-cols-2 ${gap} border border-t-0 border-certifica-200 rounded-b-[4px]`}>
            {/* Descricao */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Descricao da constatacao</label>
              <textarea className={textareaCx} rows={3} value={data.descricao} onChange={area("descricao")} />
            </div>

            {/* Criterio */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Criterio / Requisito esperado</label>
              <textarea className={textareaCx} rows={2} value={data.criterio_requisito} onChange={area("criterio_requisito")} />
            </div>

            {/* Evidencia */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Evidencia objetiva</label>
              <textarea className={textareaCx} rows={3} value={data.evidencia} onChange={area("evidencia")} />
            </div>

            {/* Tipo de evidencia */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Tipo de evidencia</label>
              <select className={selectCx} value={data.tipo_evidencia} onChange={sel("tipo_evidencia")}>
                <option value="">Selecione...</option>
                <option value="documental">Documental</option>
                <option value="entrevista">Entrevista</option>
                <option value="observacao-campo">Observacao em campo</option>
                <option value="amostragem">Amostragem</option>
                <option value="registro">Registro sistemico</option>
                <option value="inspecao">Inspecao visual</option>
                <option value="medicao">Medicao/verificacao</option>
              </select>
            </div>

            {/* Documento | Codigo */}
            <div>
              <label className={labelCx} style={labelStyle}>Documento avaliado</label>
              <input className={inputCx} value={data.documento_avaliado} onChange={text("documento_avaliado")} />
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Codigo do documento</label>
              <input className={inputCx} value={data.codigo_documento} onChange={text("codigo_documento")} />
            </div>

            {/* Revisao | Registro */}
            <div>
              <label className={labelCx} style={labelStyle}>Revisao do documento</label>
              <input className={inputCx} value={data.revisao_documento} onChange={text("revisao_documento")} />
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Registro analisado</label>
              <input className={inputCx} placeholder="Certificado no, Lote, OS..." value={data.registro_analisado} onChange={text("registro_analisado")} />
            </div>

            {/* Amostra | Criterio amostragem */}
            <div>
              <label className={labelCx} style={labelStyle}>Amostra / Qtd verificada</label>
              <input className={inputCx} value={data.amostra_qtd} onChange={text("amostra_qtd")} />
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Criterio de amostragem</label>
              <input className={inputCx} value={data.criterio_amostragem} onChange={text("criterio_amostragem")} />
            </div>

            {/* Entrevistados */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Entrevistado(s)</label>
              <input className={inputCx} placeholder="Nome — Cargo — Area" value={data.entrevistados} onChange={text("entrevistados")} />
            </div>

            {/* Condicao encontrada */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Condicao encontrada</label>
              <textarea className={textareaCx} rows={2} value={data.condicao_encontrada} onChange={area("condicao_encontrada")} />
            </div>

            {/* Desvio identificado */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Desvio identificado</label>
              <textarea className={textareaCx} rows={2} value={data.desvio_identificado} onChange={area("desvio_identificado")} />
            </div>

            {/* Impacto potencial */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Impacto potencial</label>
              <textarea className={textareaCx} rows={2} value={data.impacto_potencial} onChange={area("impacto_potencial")} />
            </div>

            {/* Risco associado */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Risco associado</label>
              <input className={inputCx} value={data.risco_associado} onChange={text("risco_associado")} />
            </div>

            {/* Abrangencia | Qtd itens */}
            <div>
              <label className={labelCx} style={labelStyle}>Abrangencia</label>
              <select className={selectCx} value={data.abrangencia} onChange={sel("abrangencia")}>
                <option value="">Selecione...</option>
                <option value="pontual">Pontual</option>
                <option value="sistemico">Sistemico</option>
              </select>
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Qtd itens afetados</label>
              <input className={inputCx} value={data.qtd_itens_afetados} onChange={text("qtd_itens_afetados")} />
            </div>

            {/* Periodo | Recorrencia */}
            <div>
              <label className={labelCx} style={labelStyle}>Periodo afetado</label>
              <input className={inputCx} value={data.periodo_afetado} onChange={text("periodo_afetado")} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-1.5 text-[11px] text-certifica-500 cursor-pointer select-none" style={labelStyle}>
                <input
                  type="checkbox"
                  className="rounded border-certifica-200 text-certifica-accent focus:ring-certifica-accent/30"
                  checked={data.recorrencia}
                  onChange={(e) => set("recorrencia", e.target.checked)}
                />
                Recorrencia?
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Card 3 - Tratamento                                              */}
      {/* ---------------------------------------------------------------- */}
      <div>
        {renderHeader(2, <Wrench size={13} />, "Tratamento")}
        {!collapsed[2] && (
          <div className={`${px} grid grid-cols-2 ${gap} border border-t-0 border-certifica-200 rounded-b-[4px]`}>
            {/* Contencao imediata */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Contencao imediata</label>
              <textarea className={textareaCx} rows={2} value={data.contencao_imediata} onChange={area("contencao_imediata")} />
            </div>

            {/* Data contencao | Responsavel */}
            <div>
              <label className={labelCx} style={labelStyle}>Data da contencao</label>
              <input type="date" className={inputCx} value={data.data_contencao} onChange={text("data_contencao")} />
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Responsavel contencao</label>
              <input className={inputCx} value={data.responsavel_contencao} onChange={text("responsavel_contencao")} />
            </div>

            {/* Causa imediata */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Causa imediata</label>
              <textarea className={textareaCx} rows={2} value={data.causa_imediata} onChange={area("causa_imediata")} />
            </div>

            {/* Causa raiz */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Causa raiz</label>
              <textarea className={textareaCx} rows={2} value={data.causa_raiz} onChange={area("causa_raiz")} />
            </div>

            {/* Metodo de analise */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Metodo de analise</label>
              <select className={selectCx} value={data.metodo_analise} onChange={sel("metodo_analise")}>
                <option value="">Selecione...</option>
                <option value="5-porques">5 Porques</option>
                <option value="ishikawa">Ishikawa</option>
                <option value="simples">Analise simples</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            {/* Correcao imediata */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Correcao imediata</label>
              <textarea className={textareaCx} rows={2} value={data.correcao_imediata} onChange={area("correcao_imediata")} />
            </div>

            {/* Acao corretiva */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Acao corretiva</label>
              <textarea className={textareaCx} rows={3} value={data.acao_corretiva} onChange={area("acao_corretiva")} />
            </div>

            {/* Acao preventiva */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Acao preventiva</label>
              <textarea className={textareaCx} rows={2} value={data.acao_preventiva} onChange={area("acao_preventiva")} />
            </div>

            {/* Recomendacao do auditor */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Recomendacao do auditor</label>
              <textarea className={textareaCx} rows={2} value={data.recomendacao_auditor} onChange={area("recomendacao_auditor")} />
            </div>

            {/* Responsavel | Prazo */}
            <div>
              <label className={labelCx} style={labelStyle}>Responsavel</label>
              <input className={inputCx} value={data.responsavel} onChange={text("responsavel")} />
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Prazo</label>
              <input type="date" className={inputCx} value={data.prazo} onChange={text("prazo")} />
            </div>

            {/* Custo | Status */}
            <div>
              <label className={labelCx} style={labelStyle}>Custo estimado</label>
              <input className={inputCx} placeholder="R$ 0,00" value={data.custo_estimado} onChange={text("custo_estimado")} />
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Status</label>
              <select className={selectCx} value={data.status} onChange={sel("status")}>
                <option value="">Selecione...</option>
                <option value="aberta">Aberta</option>
                <option value="em-tratamento">Em tratamento</option>
                <option value="verificada">Verificada</option>
                <option value="fechada">Fechada</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Card 4 - Fechamento                                              */}
      {/* ---------------------------------------------------------------- */}
      <div>
        {renderHeader(3, <CheckSquare size={13} />, "Fechamento")}
        {!collapsed[3] && (
          <div className={`${px} grid grid-cols-2 ${gap} border border-t-0 border-certifica-200 rounded-b-[4px]`}>
            {/* Verificacao eficacia */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Como sera verificada a eficacia</label>
              <textarea className={textareaCx} rows={2} value={data.verificacao_eficacia} onChange={area("verificacao_eficacia")} />
            </div>

            {/* Responsavel | Data */}
            <div>
              <label className={labelCx} style={labelStyle}>Responsavel pela verificacao</label>
              <input className={inputCx} value={data.responsavel_verificacao} onChange={text("responsavel_verificacao")} />
            </div>
            <div>
              <label className={labelCx} style={labelStyle}>Data prevista</label>
              <input type="date" className={inputCx} value={data.data_verificacao} onChange={text("data_verificacao")} />
            </div>

            {/* Status eficacia */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Status da eficacia</label>
              <select className={selectCx} value={data.status_eficacia} onChange={sel("status_eficacia")}>
                <option value="">Selecione...</option>
                <option value="pendente">Pendente</option>
                <option value="eficaz">Eficaz</option>
                <option value="parcialmente-eficaz">Parcialmente eficaz</option>
                <option value="ineficaz">Ineficaz</option>
              </select>
            </div>

            {/* Observacoes / Anexos */}
            <div className="col-span-2">
              <label className={labelCx} style={labelStyle}>Observacoes / Anexos</label>
              <textarea
                className={textareaCx}
                rows={2}
                placeholder="Descreva anexos: fotos, certificados, prints..."
                value={data.observacao_anexo}
                onChange={area("observacao_anexo")}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FindingForm;
