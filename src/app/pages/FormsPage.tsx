import React, { useState } from "react";
import { DSCard } from "../components/ds/DSCard";
import { DSInput } from "../components/ds/DSInput";
import { DSSelect } from "../components/ds/DSSelect";
import { DSTextarea } from "../components/ds/DSTextarea";
import { DSButton } from "../components/ds/DSButton";
import { DSBadge } from "../components/ds/DSBadge";
import { DSTable } from "../components/ds/DSTable";
import {
  Shield,
  Save,
  Send,
  Plus,
  User,
  Calendar,
  Building2,
  FileText,
  ChevronRight,
  Hash,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";

export default function FormsPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-certifica-900 mb-2">Formularios</h2>
        <p className="text-[14px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.6" }}>
          Composicoes completas de formulario que demonstram como os componentes
          do design system se integram em contextos reais de auditoria.
        </p>
      </div>

      {/* Full Audit Form */}
      <div>
        <h3 className="text-certifica-900 mb-4">Plano de Auditoria</h3>
        <DSCard
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-4.5 h-4.5 text-certifica-900" strokeWidth={1.5} />
                <div>
                  <div className="text-[14px] text-certifica-900" style={{ fontWeight: 600 }}>Novo Plano de Auditoria</div>
                  <div className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Preencha os dados para criar um novo plano</div>
                </div>
              </div>
              <DSBadge variant="outline">Rascunho</DSBadge>
            </div>
          }
          footer={
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>* Campos obrigatorios</span>
              <div className="flex items-center gap-2">
                <DSButton variant="ghost" size="sm">Cancelar</DSButton>
                <DSButton variant="outline" size="sm" icon={<Save className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                  Salvar Rascunho
                </DSButton>
                <DSButton variant="primary" size="sm" icon={<Send className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                  Submeter Plano
                </DSButton>
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Section 1 */}
            <div>
              <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-3 pb-2 border-b border-certifica-200" style={{ fontWeight: 600 }}>
                Dados Gerais
              </div>
              <div className="grid grid-cols-3 gap-4">
                <DSInput label="Titulo da Auditoria *" placeholder="Ex: Auditoria ISO 9001 - Q1 2026" />
                <DSSelect
                  label="Norma de Referencia *"
                  options={[
                    { value: "", label: "Selecione..." },
                    { value: "iso9001", label: "ISO 9001:2015" },
                    { value: "iso14001", label: "ISO 14001:2015" },
                    { value: "iso45001", label: "ISO 45001:2018" },
                  ]}
                />
                <DSSelect
                  label="Tipo de Auditoria *"
                  options={[
                    { value: "", label: "Selecione..." },
                    { value: "interna", label: "Interna" },
                    { value: "externa", label: "Externa" },
                    { value: "certificacao", label: "Certificacao" },
                  ]}
                />
              </div>
            </div>

            {/* Section 2 */}
            <div>
              <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-3 pb-2 border-b border-certifica-200" style={{ fontWeight: 600 }}>
                Equipe e Logistica
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <DSInput label="Auditor Lider *" placeholder="Nome completo" icon={<User className="w-4 h-4" strokeWidth={1.5} />} />
                <DSInput label="Data Inicio *" placeholder="DD/MM/AAAA" icon={<Calendar className="w-4 h-4" strokeWidth={1.5} />} />
                <DSInput label="Data Fim *" placeholder="DD/MM/AAAA" icon={<Calendar className="w-4 h-4" strokeWidth={1.5} />} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DSInput label="Unidade / Site *" placeholder="Ex: Unidade Industrial Norte" icon={<Building2 className="w-4 h-4" strokeWidth={1.5} />} />
                <DSInput label="Numero de Referencia" placeholder="Gerado automaticamente" icon={<Hash className="w-4 h-4" strokeWidth={1.5} />} disabled className="opacity-50" />
              </div>
            </div>

            {/* Section 3 */}
            <div>
              <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-3 pb-2 border-b border-certifica-200" style={{ fontWeight: 600 }}>
                Escopo e Objetivos
              </div>
              <div className="space-y-4">
                <DSTextarea label="Escopo da Auditoria *" placeholder="Defina os processos, areas e requisitos a serem auditados..." />
                <DSTextarea label="Objetivos" placeholder="Objetivos especificos desta auditoria..." helper="Opcional" />
              </div>
            </div>
          </div>
        </DSCard>
      </div>

      {/* Checklist Demo */}
      <div>
        <h3 className="text-certifica-900 mb-4">Checklist de Verificacao</h3>
        <DSCard
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[14px] text-certifica-900" style={{ fontWeight: 600 }}>Requisitos — Clausula 7</span>
                <DSBadge variant="default">ISO 9001</DSBadge>
              </div>
              <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>5 de 8 verificados</span>
            </div>
          }
        >
          <div className="space-y-0">
            {[
              { id: "7.1.1", title: "Recursos — Generalidades", status: "conforme" as const },
              { id: "7.1.2", title: "Pessoas", status: "conforme" as const },
              { id: "7.1.3", title: "Infraestrutura", status: "observacao" as const },
              { id: "7.1.4", title: "Ambiente para operacao de processos", status: "conforme" as const },
              { id: "7.1.5", title: "Recursos de monitoramento e medicao", status: "nao-conforme" as const },
              { id: "7.1.6", title: "Conhecimento organizacional", status: "pendente" as const },
              { id: "7.2", title: "Competencia", status: "pendente" as const },
              { id: "7.3", title: "Conscientizacao", status: "pendente" as const },
            ].map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center gap-4 py-3 ${idx > 0 ? "border-t border-certifica-200" : ""}`}
              >
                <span className="w-[50px] text-[12px] text-certifica-700 font-mono" style={{ fontWeight: 500 }}>{item.id}</span>
                <span className="flex-1 text-[13px] text-certifica-dark" style={{ fontWeight: 400 }}>{item.title}</span>
                <div className="flex items-center gap-2">
                  {item.status === "conforme" && (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-conformidade" strokeWidth={1.5} />
                      <DSBadge variant="conformidade">Conforme</DSBadge>
                    </>
                  )}
                  {item.status === "nao-conforme" && (
                    <>
                      <XCircle className="w-4 h-4 text-nao-conformidade" strokeWidth={1.5} />
                      <DSBadge variant="nao-conformidade">NC Menor</DSBadge>
                    </>
                  )}
                  {item.status === "observacao" && (
                    <>
                      <AlertTriangle className="w-4 h-4 text-observacao" strokeWidth={1.5} />
                      <DSBadge variant="observacao">Observacao</DSBadge>
                    </>
                  )}
                  {item.status === "pendente" && (
                    <>
                      <Clock className="w-4 h-4 text-certifica-500" strokeWidth={1.5} />
                      <DSBadge variant="outline">Pendente</DSBadge>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DSCard>
      </div>

      {/* Tabbed Form */}
      <div>
        <h3 className="text-certifica-900 mb-4">Formulario com Abas</h3>
        <DSCard>
          {/* Tabs */}
          <div className="flex border-b border-certifica-200 mb-5 -mx-5 px-5">
            {["Dados Gerais", "Constatacoes", "Acoes Corretivas", "Anexos"].map((tab, idx) => (
              <button
                key={tab}
                onClick={() => setActiveTab(idx)}
                className={`px-4 py-2.5 text-[13px] border-b-2 transition-colors -mb-px ${
                  activeTab === idx
                    ? "border-certifica-900 text-certifica-900"
                    : "border-transparent text-certifica-500 hover:text-certifica-dark"
                }`}
                style={{ fontWeight: activeTab === idx ? 600 : 400 }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 0 && (
            <div className="grid grid-cols-2 gap-4">
              <DSInput label="Titulo" placeholder="Titulo da auditoria" />
              <DSSelect
                label="Status"
                options={[
                  { value: "rascunho", label: "Rascunho" },
                  { value: "em_andamento", label: "Em Andamento" },
                  { value: "concluida", label: "Concluida" },
                ]}
              />
              <DSInput label="Auditor Lider" placeholder="Nome" icon={<User className="w-4 h-4" strokeWidth={1.5} />} />
              <DSInput label="Data" placeholder="DD/MM/AAAA" icon={<Calendar className="w-4 h-4" strokeWidth={1.5} />} />
            </div>
          )}
          {activeTab === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Lista de Constatacoes</span>
                <DSButton variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                  Nova Constatacao
                </DSButton>
              </div>
              <DSTable
                columns={[
                  { key: "clausula", header: "Clausula", width: "80px" },
                  { key: "tipo", header: "Tipo",
                    render: (row) => {
                      const t = row.tipo as string;
                      const v = t.includes("NC") ? "nao-conformidade" as const : t === "OBS" ? "observacao" as const : "conformidade" as const;
                      return <DSBadge variant={v}>{t}</DSBadge>;
                    }
                  },
                  { key: "descricao", header: "Descricao" },
                ]}
                data={[
                  { clausula: "7.1.5", tipo: "NC Menor", descricao: "Equipamento sem calibracao vigente" },
                  { clausula: "7.1.3", tipo: "OBS", descricao: "Area de armazenamento necessita organizacao" },
                  { clausula: "8.5.1", tipo: "C", descricao: "Controle de producao adequado" },
                ]}
              />
            </div>
          )}
          {activeTab === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <DSSelect
                  label="Constatacao Vinculada"
                  options={[
                    { value: "", label: "Selecione..." },
                    { value: "nc1", label: "NC-001: Equipamento sem calibracao" },
                    { value: "obs1", label: "OBS-001: Area de armazenamento" },
                  ]}
                />
                <DSInput label="Responsavel" placeholder="Nome do responsavel" icon={<User className="w-4 h-4" strokeWidth={1.5} />} />
              </div>
              <DSTextarea label="Descricao da Acao Corretiva" placeholder="Descreva a acao corretiva proposta..." />
              <div className="grid grid-cols-2 gap-4">
                <DSInput label="Prazo" placeholder="DD/MM/AAAA" icon={<Calendar className="w-4 h-4" strokeWidth={1.5} />} />
                <DSSelect
                  label="Prioridade"
                  options={[
                    { value: "baixa", label: "Baixa" },
                    { value: "media", label: "Media" },
                    { value: "alta", label: "Alta" },
                    { value: "critica", label: "Critica" },
                  ]}
                />
              </div>
            </div>
          )}
          {activeTab === 3 && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-12 h-12 bg-certifica-200/50 rounded-[4px] flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-certifica-500" strokeWidth={1.5} />
              </div>
              <div className="text-[13px] text-certifica-900 mb-1" style={{ fontWeight: 600 }}>Nenhum anexo</div>
              <div className="text-[12px] text-certifica-500 mb-3" style={{ fontWeight: 400 }}>Arraste arquivos ou clique para anexar</div>
              <DSButton variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Adicionar Anexo
              </DSButton>
            </div>
          )}
        </DSCard>
      </div>
    </div>
  );
}
