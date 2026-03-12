import React from "react";
import { DSInput } from "../components/ds/DSInput";
import { DSSelect } from "../components/ds/DSSelect";
import { DSTextarea } from "../components/ds/DSTextarea";
import { DSCard } from "../components/ds/DSCard";
import { DSButton } from "../components/ds/DSButton";
import { Search, Calendar, Hash, Mail, Lock, User, Save } from "lucide-react";

export default function InputsPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-certifica-900 mb-2">Inputs</h2>
        <p className="text-[14px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.6" }}>
          Campos de entrada projetados para formularios de auditoria, relatorios
          tecnicos e captura de dados normativos.
        </p>
      </div>

      {/* Text Inputs */}
      <div>
        <h3 className="text-certifica-900 mb-4">Campos de Texto</h3>
        <DSCard>
          <div className="grid grid-cols-2 gap-6">
            <DSInput label="Titulo da Auditoria" placeholder="Ex: Auditoria ISO 9001 - Ciclo 2026" />
            <DSInput label="Numero de Referencia" placeholder="AUD-2026-0000" helper="Gerado automaticamente" />
            <DSInput label="Auditor Lider" placeholder="Nome completo" icon={<User className="w-4 h-4" strokeWidth={1.5} />} />
            <DSInput label="Email de Contato" placeholder="auditor@empresa.com" icon={<Mail className="w-4 h-4" strokeWidth={1.5} />} type="email" />
            <DSInput label="Data Prevista" placeholder="DD/MM/AAAA" icon={<Calendar className="w-4 h-4" strokeWidth={1.5} />} />
            <DSInput label="Codigo da Norma" placeholder="ISO 9001:2015" icon={<Hash className="w-4 h-4" strokeWidth={1.5} />} />
          </div>
        </DSCard>
      </div>

      {/* States */}
      <div>
        <h3 className="text-certifica-900 mb-4">Estados</h3>
        <DSCard>
          <div className="grid grid-cols-3 gap-6">
            <DSInput label="Default" placeholder="Valor padrao" />
            <DSInput label="Com valor" defaultValue="Auditoria Interna Q1-2026" />
            <DSInput label="Com helper" placeholder="Digite aqui" helper="Maximo 200 caracteres" />
            <DSInput label="Com erro" defaultValue="abc" error="Formato invalido. Use: AUD-AAAA-NNNN" />
            <DSInput label="Desabilitado" placeholder="Campo bloqueado" disabled className="opacity-50" />
            <DSInput label="Somente leitura" defaultValue="ISO 14001:2015" readOnly className="bg-certifica-50" />
          </div>
        </DSCard>
      </div>

      {/* Selects */}
      <div>
        <h3 className="text-certifica-900 mb-4">Selects</h3>
        <DSCard>
          <div className="grid grid-cols-3 gap-6">
            <DSSelect
              label="Norma de Referencia"
              options={[
                { value: "", label: "Selecione..." },
                { value: "iso9001", label: "ISO 9001:2015" },
                { value: "iso14001", label: "ISO 14001:2015" },
                { value: "iso45001", label: "ISO 45001:2018" },
                { value: "iso27001", label: "ISO 27001:2022" },
              ]}
            />
            <DSSelect
              label="Tipo de Auditoria"
              options={[
                { value: "", label: "Selecione..." },
                { value: "interna", label: "Auditoria Interna" },
                { value: "externa", label: "Auditoria Externa" },
                { value: "certificacao", label: "Auditoria de Certificacao" },
                { value: "manutencao", label: "Auditoria de Manutencao" },
              ]}
            />
            <DSSelect
              label="Prioridade"
              options={[
                { value: "baixa", label: "Baixa" },
                { value: "media", label: "Media" },
                { value: "alta", label: "Alta" },
                { value: "critica", label: "Critica" },
              ]}
              helper="Define o SLA de resolucao"
            />
          </div>
        </DSCard>
      </div>

      {/* Textarea */}
      <div>
        <h3 className="text-certifica-900 mb-4">Textarea</h3>
        <DSCard>
          <div className="grid grid-cols-2 gap-6">
            <DSTextarea
              label="Descricao da Constatacao"
              placeholder="Descreva a evidencia objetiva encontrada durante a auditoria..."
              helper="Inclua referencias as clausulas da norma"
            />
            <DSTextarea
              label="Acao Corretiva Proposta"
              placeholder="Descreva a acao corretiva necessaria..."
              error="Campo obrigatorio para nao conformidades"
            />
          </div>
        </DSCard>
      </div>

      {/* Form Composition */}
      <div>
        <h3 className="text-certifica-900 mb-4">Composicao de Formulario</h3>
        <DSCard
          header={
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>
                Registro de Constatacao
              </span>
              <span className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>
                * Campos obrigatorios
              </span>
            </div>
          }
          footer={
            <div className="flex items-center justify-end gap-2">
              <DSButton variant="ghost" size="sm">Cancelar</DSButton>
              <DSButton variant="outline" size="sm" icon={<Save className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Salvar Rascunho
              </DSButton>
              <DSButton variant="primary" size="sm">Registrar Constatacao</DSButton>
            </div>
          }
        >
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <DSInput label="Clausula da Norma *" placeholder="Ex: 7.1.6" />
              <DSSelect
                label="Tipo de Constatacao *"
                options={[
                  { value: "", label: "Selecione..." },
                  { value: "c", label: "Conformidade" },
                  { value: "nc-maior", label: "Nao Conformidade Maior" },
                  { value: "nc-menor", label: "Nao Conformidade Menor" },
                  { value: "obs", label: "Observacao" },
                  { value: "opm", label: "Oportunidade de Melhoria" },
                ]}
              />
              <DSInput label="Processo Auditado *" placeholder="Ex: Producao" />
            </div>
            <DSTextarea
              label="Evidencia Objetiva *"
              placeholder="Descreva a evidencia objetiva encontrada..."
            />
            <div className="grid grid-cols-2 gap-4">
              <DSInput label="Responsavel pela Acao" placeholder="Nome do responsavel" icon={<User className="w-4 h-4" strokeWidth={1.5} />} />
              <DSInput label="Prazo para Resolucao" placeholder="DD/MM/AAAA" icon={<Calendar className="w-4 h-4" strokeWidth={1.5} />} />
            </div>
          </div>
        </DSCard>
      </div>

      {/* Search */}
      <div>
        <h3 className="text-certifica-900 mb-4">Campo de Busca</h3>
        <DSCard>
          <div className="max-w-[400px]">
            <DSInput
              placeholder="Buscar auditorias, constatacoes, normas..."
              icon={<Search className="w-4 h-4" strokeWidth={1.5} />}
            />
          </div>
        </DSCard>
      </div>
    </div>
  );
}
