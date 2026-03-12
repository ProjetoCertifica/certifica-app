import React from "react";
import { DSCard } from "../components/ds/DSCard";
import { DSBadge } from "../components/ds/DSBadge";
import { DSButton } from "../components/ds/DSButton";
import {
  Shield,
  ClipboardCheck,
  FileSearch,
  BarChart3,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lightbulb,
} from "lucide-react";

export default function OverviewPage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <DSBadge variant="default">Design System v1.0</DSBadge>
        </div>
        <h1 className="text-certifica-900 mb-2">
          CERTIFICA — Gestao de Sistemas
        </h1>
        <p className="text-[15px] text-certifica-500 max-w-[640px]" style={{ fontWeight: 400, lineHeight: "1.7" }}>
          Sistema de design institucional para plataforma de consultoria ISO, auditorias, ESG,
          qualidade e seguranca do trabalho. Conceito visual: Arquitetura da Conformidade.
        </p>
      </div>

      {/* Principles */}
      <div>
        <h3 className="text-certifica-900 mb-4">Principios de Design</h3>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: Shield, title: "Autoridade", desc: "Visual que transmite rigor tecnico e confiabilidade institucional" },
            { icon: ClipboardCheck, title: "Precisao", desc: "Componentes estruturados com funcionalidade clara e previsivel" },
            { icon: FileSearch, title: "Clareza", desc: "Hierarquia visual que facilita a leitura de dados criticos" },
            { icon: BarChart3, title: "Controle", desc: "Layout estruturado que permite monitoramento eficiente" },
          ].map((item) => (
            <DSCard key={item.title}>
              <div className="flex flex-col gap-3">
                <div className="w-9 h-9 bg-certifica-900/5 rounded-[3px] flex items-center justify-center">
                  <item.icon className="w-4.5 h-4.5 text-certifica-900" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="text-[14px] text-certifica-900 mb-1" style={{ fontWeight: 600 }}>{item.title}</div>
                  <div className="text-[12px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.6" }}>{item.desc}</div>
                </div>
              </div>
            </DSCard>
          ))}
        </div>
      </div>

      {/* Status System */}
      <div>
        <h3 className="text-certifica-900 mb-4">Sistema de Estados</h3>
        <DSCard>
          <div className="grid grid-cols-4 gap-6">
            <div className="flex flex-col gap-3 items-start">
              <div className="w-10 h-10 rounded-[3px] bg-conformidade/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-conformidade" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-[13px] text-certifica-900 mb-0.5" style={{ fontWeight: 600 }}>Conformidade</div>
                <div className="text-[12px] text-certifica-500 mb-2" style={{ fontWeight: 400 }}>Requisito atendido</div>
                <DSBadge variant="conformidade">Conforme</DSBadge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-5 h-5 rounded-[2px] bg-conformidade"></div>
                <span className="text-[11px] text-certifica-500 font-mono">#1F5E3B</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 items-start">
              <div className="w-10 h-10 rounded-[3px] bg-nao-conformidade/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-nao-conformidade" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-[13px] text-certifica-900 mb-0.5" style={{ fontWeight: 600 }}>Nao Conformidade</div>
                <div className="text-[12px] text-certifica-500 mb-2" style={{ fontWeight: 400 }}>Requisito nao atendido</div>
                <DSBadge variant="nao-conformidade">Nao Conforme</DSBadge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-5 h-5 rounded-[2px] bg-nao-conformidade"></div>
                <span className="text-[11px] text-certifica-500 font-mono">#7A1E1E</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 items-start">
              <div className="w-10 h-10 rounded-[3px] bg-observacao/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-observacao" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-[13px] text-certifica-900 mb-0.5" style={{ fontWeight: 600 }}>Observacao</div>
                <div className="text-[12px] text-certifica-500 mb-2" style={{ fontWeight: 400 }}>Ponto de atencao</div>
                <DSBadge variant="observacao">Observacao</DSBadge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-5 h-5 rounded-[2px] bg-observacao"></div>
                <span className="text-[11px] text-certifica-500 font-mono">#8C6A1F</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 items-start">
              <div className="w-10 h-10 rounded-[3px] bg-oportunidade/10 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-oportunidade" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-[13px] text-certifica-900 mb-0.5" style={{ fontWeight: 600 }}>Oportunidade</div>
                <div className="text-[12px] text-certifica-500 mb-2" style={{ fontWeight: 400 }}>Melhoria sugerida</div>
                <DSBadge variant="oportunidade">Oportunidade</DSBadge>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-5 h-5 rounded-[2px] bg-oportunidade"></div>
                <span className="text-[11px] text-certifica-500 font-mono">#274C77</span>
              </div>
            </div>
          </div>
        </DSCard>
      </div>

      {/* Quick Demo */}
      <div>
        <h3 className="text-certifica-900 mb-4">Exemplo de Composicao</h3>
        <DSCard
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h4 className="text-certifica-900">Auditoria ISO 9001:2015</h4>
                <DSBadge variant="observacao">Em Andamento</DSBadge>
              </div>
              <DSButton variant="outline" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" strokeWidth={1.5} />}>
                Ver Detalhes
              </DSButton>
            </div>
          }
          footer={
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>
                Ultima atualizacao: 18 Fev 2026, 14:30
              </span>
              <div className="flex items-center gap-2">
                <DSBadge variant="conformidade">12 C</DSBadge>
                <DSBadge variant="nao-conformidade">3 NC</DSBadge>
                <DSBadge variant="observacao">5 OBS</DSBadge>
              </div>
            </div>
          }
        >
          <div className="grid grid-cols-4 gap-6">
            {[
              { label: "Requisitos Avaliados", value: "47", sub: "de 52 totais" },
              { label: "Taxa de Conformidade", value: "76%", sub: "+4% vs. ciclo anterior" },
              { label: "Acoes Corretivas", value: "8", sub: "3 pendentes" },
              { label: "Prazo Restante", value: "12 dias", sub: "Vencimento: 02 Mar" },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-1" style={{ fontWeight: 600 }}>
                  {item.label}
                </div>
                <div className="text-[22px] text-certifica-900" style={{ fontWeight: 600, lineHeight: "1.3" }}>
                  {item.value}
                </div>
                <div className="text-[12px] text-certifica-500 mt-0.5" style={{ fontWeight: 400 }}>
                  {item.sub}
                </div>
              </div>
            ))}
          </div>
        </DSCard>
      </div>
    </div>
  );
}
