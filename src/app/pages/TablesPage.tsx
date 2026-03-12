import React from "react";
import { DSTable } from "../components/ds/DSTable";
import { DSBadge } from "../components/ds/DSBadge";
import { DSCard } from "../components/ds/DSCard";
import { DSButton } from "../components/ds/DSButton";
import { Eye, Download, Filter, Search, Plus } from "lucide-react";
import { DSInput } from "../components/ds/DSInput";

type StatusVariant = "conformidade" | "nao-conformidade" | "observacao" | "oportunidade";

const statusBadge = (status: string, variant: StatusVariant) => (
  <DSBadge variant={variant}>{status}</DSBadge>
);

const auditData = [
  { id: "AUD-2026-0047", norma: "ISO 9001:2015", tipo: "Interna", data: "18/02/2026", auditor: "Carlos M. Silva", status: "Em Andamento", statusVariant: "observacao" as StatusVariant },
  { id: "AUD-2026-0046", norma: "ISO 14001:2015", tipo: "Externa", data: "12/02/2026", auditor: "Ana R. Costa", status: "Concluida", statusVariant: "conformidade" as StatusVariant },
  { id: "AUD-2026-0045", norma: "ISO 45001:2018", tipo: "Certificacao", data: "05/02/2026", auditor: "Pedro L. Souza", status: "NC Pendente", statusVariant: "nao-conformidade" as StatusVariant },
  { id: "AUD-2026-0044", norma: "ISO 9001:2015", tipo: "Manutencao", data: "28/01/2026", auditor: "Maria F. Santos", status: "Concluida", statusVariant: "conformidade" as StatusVariant },
  { id: "AUD-2026-0043", norma: "ISO 27001:2022", tipo: "Interna", data: "20/01/2026", auditor: "Roberto A. Lima", status: "Em Analise", statusVariant: "oportunidade" as StatusVariant },
];

const findingsData = [
  { clausula: "7.1.6", processo: "Producao", tipo: "NC Menor", descricao: "Equipamento de medicao sem calibracao vigente", responsavel: "J. Oliveira", prazo: "15/03/2026", status: "Aberta" },
  { clausula: "8.5.1", processo: "Logistica", tipo: "Observacao", descricao: "Controle de rastreabilidade parcialmente documentado", responsavel: "M. Santos", prazo: "01/03/2026", status: "Em Tratamento" },
  { clausula: "6.1.2", processo: "Qualidade", tipo: "NC Maior", descricao: "Ausencia de analise de riscos para processo critico", responsavel: "A. Costa", prazo: "28/02/2026", status: "Aberta" },
  { clausula: "9.1.3", processo: "Diretoria", tipo: "Oportunidade", descricao: "Implementar dashboard de indicadores em tempo real", responsavel: "C. Silva", prazo: "30/04/2026", status: "Planejada" },
  { clausula: "7.2", processo: "RH", tipo: "Conforme", descricao: "Programa de competencias atualizado e eficaz", responsavel: "—", prazo: "—", status: "Fechada" },
];

const findingStatusVariant = (tipo: string): StatusVariant => {
  if (tipo.includes("NC")) return "nao-conformidade";
  if (tipo === "Observacao") return "observacao";
  if (tipo === "Oportunidade") return "oportunidade";
  return "conformidade";
};

const findingOpenVariant = (status: string): StatusVariant => {
  if (status === "Aberta") return "nao-conformidade";
  if (status === "Em Tratamento") return "observacao";
  if (status === "Planejada") return "oportunidade";
  return "conformidade";
};

export default function TablesPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-certifica-900 mb-2">Tabelas</h2>
        <p className="text-[14px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.6" }}>
          Tabelas estruturadas com cabecalho tecnico, bordas de 1px,
          e formatacao otimizada para dados de auditoria e conformidade.
        </p>
      </div>

      {/* Audits Table */}
      <div>
        <h3 className="text-certifica-900 mb-4">Registro de Auditorias</h3>
        <DSCard>
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-[240px]">
                <DSInput placeholder="Buscar auditorias..." icon={<Search className="w-4 h-4" strokeWidth={1.5} />} />
              </div>
              <DSButton variant="outline" size="sm" icon={<Filter className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Filtrar
              </DSButton>
            </div>
            <div className="flex items-center gap-2">
              <DSButton variant="outline" size="sm" icon={<Download className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Exportar
              </DSButton>
              <DSButton variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Nova Auditoria
              </DSButton>
            </div>
          </div>

          <DSTable
            caption="Auditorias 2026"
            columns={[
              { key: "id", header: "Referencia", width: "140px" },
              { key: "norma", header: "Norma" },
              { key: "tipo", header: "Tipo" },
              { key: "data", header: "Data" },
              { key: "auditor", header: "Auditor Lider" },
              {
                key: "status",
                header: "Status",
                render: (row) => statusBadge(
                  row.status as string,
                  row.statusVariant as StatusVariant
                ),
              },
              {
                key: "acoes",
                header: "",
                width: "60px",
                render: () => (
                  <DSButton variant="ghost" size="sm" className="p-1 h-auto">
                    <Eye className="w-4 h-4 text-certifica-500" strokeWidth={1.5} />
                  </DSButton>
                ),
              },
            ]}
            data={auditData}
          />

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-certifica-200">
            <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>
              Mostrando 5 de 47 registros
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, "...", 10].map((page, idx) => (
                <button
                  key={idx}
                  className={`w-7 h-7 flex items-center justify-center rounded-[3px] text-[12px] transition-colors ${
                    page === 1
                      ? "bg-certifica-900 text-white"
                      : "text-certifica-500 hover:bg-certifica-200/50"
                  }`}
                  style={{ fontWeight: page === 1 ? 600 : 400 }}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        </DSCard>
      </div>

      {/* Findings Table */}
      <div>
        <h3 className="text-certifica-900 mb-4">Registro de Constatacoes</h3>
        <DSTable
          caption="Constatacoes — AUD-2026-0047"
          columns={[
            { key: "clausula", header: "Clausula", width: "90px",
              render: (row) => (
                <span className="font-mono text-[12px] text-certifica-700" style={{ fontWeight: 500 }}>
                  {row.clausula as string}
                </span>
              ),
            },
            { key: "processo", header: "Processo" },
            { key: "tipo", header: "Tipo",
              render: (row) => statusBadge(row.tipo as string, findingStatusVariant(row.tipo as string)),
            },
            { key: "descricao", header: "Descricao" },
            { key: "responsavel", header: "Responsavel" },
            { key: "prazo", header: "Prazo" },
            { key: "status", header: "Status",
              render: (row) => statusBadge(row.status as string, findingOpenVariant(row.status as string)),
            },
          ]}
          data={findingsData}
        />
      </div>

      {/* Compact Table */}
      <div>
        <h3 className="text-certifica-900 mb-4">Tabela Compacta — Indicadores</h3>
        <DSTable
          caption="KPIs de Conformidade — Q1 2026"
          columns={[
            { key: "indicador", header: "Indicador" },
            { key: "meta", header: "Meta",
              render: (row) => <span className="font-mono text-[12px]">{row.meta as string}</span>,
            },
            { key: "real", header: "Realizado",
              render: (row) => <span className="font-mono text-[12px]" style={{ fontWeight: 600 }}>{row.real as string}</span>,
            },
            { key: "desvio", header: "Desvio",
              render: (row) => {
                const val = row.desvio as string;
                const isPositive = val.startsWith("+");
                const isNeutral = val === "0%";
                return (
                  <span className={`font-mono text-[12px] ${isNeutral ? "text-certifica-500" : isPositive ? "text-conformidade" : "text-nao-conformidade"}`} style={{ fontWeight: 600 }}>
                    {val}
                  </span>
                );
              },
            },
            { key: "status", header: "Status",
              render: (row) => statusBadge(row.status as string, row.statusVariant as StatusVariant),
            },
          ]}
          data={[
            { indicador: "Taxa de Conformidade", meta: "≥ 85%", real: "76%", desvio: "-9%", status: "Abaixo", statusVariant: "nao-conformidade" },
            { indicador: "NC Fechadas no Prazo", meta: "≥ 90%", real: "92%", desvio: "+2%", status: "Atingida", statusVariant: "conformidade" },
            { indicador: "Acoes Corretivas Abertas", meta: "≤ 5", real: "3", desvio: "+2", status: "Atingida", statusVariant: "conformidade" },
            { indicador: "Tempo Medio de Resolucao", meta: "≤ 15 dias", real: "12 dias", desvio: "-3d", status: "Atingida", statusVariant: "conformidade" },
            { indicador: "Auditorias Realizadas", meta: "12", real: "10", desvio: "-2", status: "Em Progresso", statusVariant: "observacao" },
          ]}
        />
      </div>
    </div>
  );
}
