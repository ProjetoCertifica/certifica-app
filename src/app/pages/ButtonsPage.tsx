import React from "react";
import { DSButton } from "../components/ds/DSButton";
import { DSCard } from "../components/ds/DSCard";
import {
  Plus,
  Download,
  Upload,
  FileText,
  Trash2,
  ChevronRight,
  Search,
  Filter,
  Printer,
  Send,
  Save,
  Eye,
} from "lucide-react";

export default function ButtonsPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-certifica-900 mb-2">Botoes</h2>
        <p className="text-[14px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.6" }}>
          Botoes com cantos de 4px, sem sombras, com transicoes suaves.
          Projetados para contextos de auditoria e gestao documental.
        </p>
      </div>

      {/* Variants */}
      <div>
        <h3 className="text-certifica-900 mb-4">Variantes</h3>
        <DSCard>
          <div className="space-y-6">
            {/* Primary */}
            <div className="flex items-center gap-6">
              <div className="w-[120px] flex-shrink-0">
                <div className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Primary</div>
                <div className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Acao principal</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <DSButton variant="primary" size="lg">Iniciar Auditoria</DSButton>
                <DSButton variant="primary" size="md">Salvar Registro</DSButton>
                <DSButton variant="primary" size="sm">Confirmar</DSButton>
              </div>
            </div>

            <div className="border-t border-certifica-200"></div>

            {/* Secondary */}
            <div className="flex items-center gap-6">
              <div className="w-[120px] flex-shrink-0">
                <div className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Secondary</div>
                <div className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Acao secundaria</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <DSButton variant="secondary" size="lg">Exportar PDF</DSButton>
                <DSButton variant="secondary" size="md">Filtrar</DSButton>
                <DSButton variant="secondary" size="sm">Limpar</DSButton>
              </div>
            </div>

            <div className="border-t border-certifica-200"></div>

            {/* Outline */}
            <div className="flex items-center gap-6">
              <div className="w-[120px] flex-shrink-0">
                <div className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Outline</div>
                <div className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Acao terciaria</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <DSButton variant="outline" size="lg">Ver Historico</DSButton>
                <DSButton variant="outline" size="md">Detalhes</DSButton>
                <DSButton variant="outline" size="sm">Info</DSButton>
              </div>
            </div>

            <div className="border-t border-certifica-200"></div>

            {/* Ghost */}
            <div className="flex items-center gap-6">
              <div className="w-[120px] flex-shrink-0">
                <div className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Ghost</div>
                <div className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Acao inline</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <DSButton variant="ghost" size="lg">Cancelar</DSButton>
                <DSButton variant="ghost" size="md">Voltar</DSButton>
                <DSButton variant="ghost" size="sm">Fechar</DSButton>
              </div>
            </div>

            <div className="border-t border-certifica-200"></div>

            {/* Destructive */}
            <div className="flex items-center gap-6">
              <div className="w-[120px] flex-shrink-0">
                <div className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Destructive</div>
                <div className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Acao destrutiva</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <DSButton variant="destructive" size="lg">Excluir Registro</DSButton>
                <DSButton variant="destructive" size="md">Remover</DSButton>
                <DSButton variant="destructive" size="sm">Excluir</DSButton>
              </div>
            </div>
          </div>
        </DSCard>
      </div>

      {/* With Icons */}
      <div>
        <h3 className="text-certifica-900 mb-4">Com Icones</h3>
        <DSCard>
          <div className="flex flex-wrap gap-3">
            <DSButton variant="primary" icon={<Plus className="w-4 h-4" strokeWidth={1.5} />}>
              Nova Auditoria
            </DSButton>
            <DSButton variant="outline" icon={<Download className="w-4 h-4" strokeWidth={1.5} />}>
              Exportar
            </DSButton>
            <DSButton variant="outline" icon={<Upload className="w-4 h-4" strokeWidth={1.5} />}>
              Importar
            </DSButton>
            <DSButton variant="secondary" icon={<FileText className="w-4 h-4" strokeWidth={1.5} />}>
              Gerar Relatorio
            </DSButton>
            <DSButton variant="ghost" icon={<Filter className="w-4 h-4" strokeWidth={1.5} />}>
              Filtrar
            </DSButton>
            <DSButton variant="outline" icon={<Printer className="w-4 h-4" strokeWidth={1.5} />}>
              Imprimir
            </DSButton>
            <DSButton variant="primary" icon={<Send className="w-4 h-4" strokeWidth={1.5} />}>
              Enviar
            </DSButton>
            <DSButton variant="outline" icon={<Save className="w-4 h-4" strokeWidth={1.5} />}>
              Salvar Rascunho
            </DSButton>
            <DSButton variant="ghost" icon={<Eye className="w-4 h-4" strokeWidth={1.5} />}>
              Visualizar
            </DSButton>
            <DSButton variant="destructive" icon={<Trash2 className="w-4 h-4" strokeWidth={1.5} />}>
              Excluir
            </DSButton>
          </div>
        </DSCard>
      </div>

      {/* Disabled States */}
      <div>
        <h3 className="text-certifica-900 mb-4">Estados Desabilitados</h3>
        <DSCard>
          <div className="flex flex-wrap gap-3">
            <DSButton variant="primary" className="opacity-40 pointer-events-none">Primary</DSButton>
            <DSButton variant="secondary" className="opacity-40 pointer-events-none">Secondary</DSButton>
            <DSButton variant="outline" className="opacity-40 pointer-events-none">Outline</DSButton>
            <DSButton variant="ghost" className="opacity-40 pointer-events-none">Ghost</DSButton>
            <DSButton variant="destructive" className="opacity-40 pointer-events-none">Destructive</DSButton>
          </div>
        </DSCard>
      </div>

      {/* Contextual Usage */}
      <div>
        <h3 className="text-certifica-900 mb-4">Uso Contextual</h3>
        <div className="grid grid-cols-2 gap-4">
          <DSCard header={
            <span className="text-[11px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
              Toolbar de Auditoria
            </span>
          }>
            <div className="flex items-center gap-2">
              <DSButton variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Novo Item
              </DSButton>
              <DSButton variant="outline" size="sm" icon={<Filter className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Filtrar
              </DSButton>
              <DSButton variant="outline" size="sm" icon={<Search className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Buscar
              </DSButton>
              <div className="flex-1"></div>
              <DSButton variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Exportar
              </DSButton>
            </div>
          </DSCard>

          <DSCard header={
            <span className="text-[11px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
              Acoes de Formulario
            </span>
          }>
            <div className="flex items-center justify-end gap-2">
              <DSButton variant="ghost" size="sm">Cancelar</DSButton>
              <DSButton variant="outline" size="sm" icon={<Save className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Salvar Rascunho
              </DSButton>
              <DSButton variant="primary" size="sm" icon={<ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Submeter
              </DSButton>
            </div>
          </DSCard>
        </div>
      </div>
    </div>
  );
}
