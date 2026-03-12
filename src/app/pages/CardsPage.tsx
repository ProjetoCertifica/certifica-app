import React from "react";
import { DSCard } from "../components/ds/DSCard";
import { DSBadge } from "../components/ds/DSBadge";
import { DSButton } from "../components/ds/DSButton";
import {
  Shield,
  FileText,
  Users,
  TrendingUp,
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Building2,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  Target,
} from "lucide-react";

export default function CardsPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-certifica-900 mb-2">Cards</h2>
        <p className="text-[14px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.6" }}>
          Cards institucionais com bordas de 1px, cantos de 4px, sem sombras.
          Projetados para dashboards, relatorios e paineis de controle.
        </p>
      </div>

      {/* Stat Cards */}
      <div>
        <h3 className="text-certifica-900 mb-4">Cards de Metricas</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Shield, label: "Auditorias Ativas", value: "12", change: "+3 este mes", color: "text-certifica-900", bg: "bg-certifica-900/5" },
            { icon: CheckCircle2, label: "Taxa de Conformidade", value: "76%", change: "+4% vs. anterior", color: "text-conformidade", bg: "bg-conformidade/5" },
            { icon: AlertTriangle, label: "NC Abertas", value: "8", change: "3 vencidas", color: "text-nao-conformidade", bg: "bg-nao-conformidade/5" },
            { icon: TrendingUp, label: "Oportunidades", value: "15", change: "5 implementadas", color: "text-oportunidade", bg: "bg-oportunidade/5" },
          ].map((item) => (
            <DSCard key={item.label}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-[3px] ${item.bg} flex items-center justify-center`}>
                  <item.icon className={`w-4.5 h-4.5 ${item.color}`} strokeWidth={1.5} />
                </div>
              </div>
              <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-1" style={{ fontWeight: 600 }}>
                {item.label}
              </div>
              <div className="text-[28px] text-certifica-900 mb-0.5" style={{ fontWeight: 600, lineHeight: "1.2" }}>
                {item.value}
              </div>
              <div className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>
                {item.change}
              </div>
            </DSCard>
          ))}
        </div>
      </div>

      {/* Audit Card */}
      <div>
        <h3 className="text-certifica-900 mb-4">Card de Auditoria</h3>
        <div className="grid grid-cols-2 gap-4">
          <DSCard
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-[14px] text-certifica-900" style={{ fontWeight: 600 }}>AUD-2026-0047</span>
                  <DSBadge variant="observacao">Em Andamento</DSBadge>
                </div>
                <DSButton variant="ghost" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                  Abrir
                </DSButton>
              </div>
            }
            footer={
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  <DSBadge variant="default">ISO 9001</DSBadge>
                  <DSBadge variant="default">ISO 14001</DSBadge>
                </div>
                <span className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Atualizado ha 2h</span>
              </div>
            }
          >
            <div className="space-y-3">
              <div className="text-[13px] text-certifica-dark" style={{ fontWeight: 400, lineHeight: "1.6" }}>
                Auditoria combinada de qualidade e meio ambiente na unidade industrial Norte.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-certifica-500" strokeWidth={1.5} />
                  <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>Carlos M. Silva</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-certifica-500" strokeWidth={1.5} />
                  <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>18/02/2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-certifica-500" strokeWidth={1.5} />
                  <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>Unidade Norte</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-certifica-500" strokeWidth={1.5} />
                  <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>12 dias restantes</span>
                </div>
              </div>
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] text-certifica-500" style={{ fontWeight: 500 }}>Progresso</span>
                  <span className="text-[11px] text-certifica-900 font-mono" style={{ fontWeight: 600 }}>68%</span>
                </div>
                <div className="h-1.5 bg-certifica-200 rounded-full overflow-hidden">
                  <div className="h-full bg-certifica-700 rounded-full" style={{ width: "68%" }}></div>
                </div>
              </div>
            </div>
          </DSCard>

          <DSCard
            header={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-[14px] text-certifica-900" style={{ fontWeight: 600 }}>AUD-2026-0046</span>
                  <DSBadge variant="conformidade">Concluida</DSBadge>
                </div>
                <DSButton variant="ghost" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                  Abrir
                </DSButton>
              </div>
            }
            footer={
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  <DSBadge variant="default">ISO 14001</DSBadge>
                </div>
                <span className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Concluida em 12/02/2026</span>
              </div>
            }
          >
            <div className="space-y-3">
              <div className="text-[13px] text-certifica-dark" style={{ fontWeight: 400, lineHeight: "1.6" }}>
                Auditoria ambiental de manutencao do certificado na unidade Sul.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-certifica-500" strokeWidth={1.5} />
                  <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>Ana R. Costa</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-certifica-500" strokeWidth={1.5} />
                  <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>12/02/2026</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-certifica-500" strokeWidth={1.5} />
                  <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>Unidade Sul</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-certifica-500" strokeWidth={1.5} />
                  <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>Porto Alegre, RS</span>
                </div>
              </div>
              {/* Summary */}
              <div className="flex gap-2">
                <DSBadge variant="conformidade">28 C</DSBadge>
                <DSBadge variant="nao-conformidade">2 NC</DSBadge>
                <DSBadge variant="observacao">4 OBS</DSBadge>
                <DSBadge variant="oportunidade">3 OPM</DSBadge>
              </div>
            </div>
          </DSCard>
        </div>
      </div>

      {/* Institutional Card */}
      <div>
        <h3 className="text-certifica-900 mb-4">Cards Institucionais</h3>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              icon: FileText,
              title: "Documentacao",
              desc: "Controle de documentos e registros conforme requisitos normativos ISO.",
              count: "247 documentos",
              tags: ["Politicas", "Procedimentos", "Instrucoes"],
            },
            {
              icon: Target,
              title: "Objetivos e Metas",
              desc: "Monitoramento de objetivos da qualidade e indicadores de desempenho.",
              count: "18 indicadores",
              tags: ["KPI", "OKR", "SLA"],
            },
            {
              icon: BarChart3,
              title: "Analise Critica",
              desc: "Dados para analise critica pela direcao e tomada de decisoes estrategicas.",
              count: "4 relatorios",
              tags: ["Trimestral", "Anual", "Extraordinario"],
            },
          ].map((item) => (
            <DSCard key={item.title}>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 bg-certifica-900/5 rounded-[3px] flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-certifica-900" strokeWidth={1.5} />
                  </div>
                  <DSButton variant="ghost" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                    Acessar
                  </DSButton>
                </div>
                <div>
                  <div className="text-[14px] text-certifica-900 mb-1" style={{ fontWeight: 600 }}>{item.title}</div>
                  <div className="text-[12px] text-certifica-500 mb-2" style={{ fontWeight: 400, lineHeight: "1.6" }}>{item.desc}</div>
                  <div className="text-[11px] text-certifica-700 mb-2.5" style={{ fontWeight: 600 }}>{item.count}</div>
                  <div className="flex gap-1.5">
                    {item.tags.map((tag) => (
                      <DSBadge key={tag} variant="outline">{tag}</DSBadge>
                    ))}
                  </div>
                </div>
              </div>
            </DSCard>
          ))}
        </div>
      </div>

      {/* Empty State Card */}
      <div>
        <h3 className="text-certifica-900 mb-4">Card de Estado Vazio</h3>
        <DSCard>
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-12 h-12 bg-certifica-200/50 rounded-[4px] flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-certifica-500" strokeWidth={1.5} />
            </div>
            <div className="text-[14px] text-certifica-900 mb-1" style={{ fontWeight: 600 }}>
              Nenhuma auditoria encontrada
            </div>
            <div className="text-[12px] text-certifica-500 mb-4 text-center max-w-[300px]" style={{ fontWeight: 400 }}>
              Nao ha auditorias registradas para o periodo selecionado. Crie uma nova auditoria para comecar.
            </div>
            <DSButton variant="primary" size="sm" icon={<Shield className="w-3.5 h-3.5" strokeWidth={1.5} />}>
              Criar Auditoria
            </DSButton>
          </div>
        </DSCard>
      </div>

      {/* Anatomy */}
      <div>
        <h3 className="text-certifica-900 mb-4">Anatomia do Card</h3>
        <DSCard>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
                Estrutura
              </div>
              <ul className="space-y-1.5">
                {[
                  "Border: 1px solid #E6E8EB",
                  "Border-radius: 4px",
                  "Background: #FFFFFF",
                  "Shadow: none",
                  "Header padding: 14px 20px",
                  "Body padding: 16px 20px",
                  "Footer padding: 12px 20px",
                ].map((item) => (
                  <li key={item} className="text-[12px] text-certifica-500 font-mono" style={{ fontWeight: 400 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
                Variantes
              </div>
              <ul className="space-y-1.5">
                {[
                  "Basico (apenas body)",
                  "Com header",
                  "Com footer",
                  "Com header + footer",
                  "Estado vazio",
                  "Metrica / KPI",
                  "Institucional",
                ].map((item) => (
                  <li key={item} className="text-[12px] text-certifica-dark" style={{ fontWeight: 400 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
                Diretrizes
              </div>
              <ul className="space-y-1.5">
                {[
                  "Sem sombras em nenhum estado",
                  "Hover sutil apenas quando clicavel",
                  "Divisorias internas com 1px",
                  "Header com fundo #FAFAFA sutil",
                  "Hierarquia clara no conteudo",
                ].map((item) => (
                  <li key={item} className="text-[12px] text-certifica-dark" style={{ fontWeight: 400 }}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </DSCard>
      </div>
    </div>
  );
}
