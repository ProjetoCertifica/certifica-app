import React from "react";
import { DSBadge } from "../components/ds/DSBadge";
import { DSCard } from "../components/ds/DSCard";

export default function BadgesPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-certifica-900 mb-2">Badges</h2>
        <p className="text-[14px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.6" }}>
          Badges retangulares com cantos de 2px, tipografia uppercase com tracking amplo.
          Utilizados para classificacao de estados, normas e prioridades.
        </p>
      </div>

      {/* Status Badges */}
      <div>
        <h3 className="text-certifica-900 mb-4">Badges de Estado</h3>
        <DSCard>
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-[180px] flex-shrink-0">
                <div className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Conformidade</div>
                <div className="text-[11px] text-certifica-500 font-mono" style={{ fontWeight: 400 }}>#1F5E3B</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <DSBadge variant="conformidade">Conforme</DSBadge>
                <DSBadge variant="conformidade">Aprovado</DSBadge>
                <DSBadge variant="conformidade">Atendido</DSBadge>
                <DSBadge variant="conformidade">Implementado</DSBadge>
                <DSBadge variant="conformidade">Verificado</DSBadge>
              </div>
            </div>

            <div className="border-t border-certifica-200"></div>

            <div className="flex items-center gap-4">
              <div className="w-[180px] flex-shrink-0">
                <div className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Nao Conformidade</div>
                <div className="text-[11px] text-certifica-500 font-mono" style={{ fontWeight: 400 }}>#7A1E1E</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <DSBadge variant="nao-conformidade">Nao Conforme</DSBadge>
                <DSBadge variant="nao-conformidade">NC Maior</DSBadge>
                <DSBadge variant="nao-conformidade">NC Menor</DSBadge>
                <DSBadge variant="nao-conformidade">Reprovado</DSBadge>
                <DSBadge variant="nao-conformidade">Critico</DSBadge>
              </div>
            </div>

            <div className="border-t border-certifica-200"></div>

            <div className="flex items-center gap-4">
              <div className="w-[180px] flex-shrink-0">
                <div className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Observacao</div>
                <div className="text-[11px] text-certifica-500 font-mono" style={{ fontWeight: 400 }}>#8C6A1F</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <DSBadge variant="observacao">Observacao</DSBadge>
                <DSBadge variant="observacao">Em Analise</DSBadge>
                <DSBadge variant="observacao">Pendente</DSBadge>
                <DSBadge variant="observacao">Em Andamento</DSBadge>
                <DSBadge variant="observacao">Atencao</DSBadge>
              </div>
            </div>

            <div className="border-t border-certifica-200"></div>

            <div className="flex items-center gap-4">
              <div className="w-[180px] flex-shrink-0">
                <div className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Oportunidade</div>
                <div className="text-[11px] text-certifica-500 font-mono" style={{ fontWeight: 400 }}>#274C77</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <DSBadge variant="oportunidade">Oportunidade</DSBadge>
                <DSBadge variant="oportunidade">Melhoria</DSBadge>
                <DSBadge variant="oportunidade">Sugestao</DSBadge>
                <DSBadge variant="oportunidade">Potencial</DSBadge>
                <DSBadge variant="oportunidade">Inovacao</DSBadge>
              </div>
            </div>
          </div>
        </DSCard>
      </div>

      {/* Utility Badges */}
      <div>
        <h3 className="text-certifica-900 mb-4">Badges Utilitarios</h3>
        <DSCard>
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-[180px] flex-shrink-0">
                <div className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Default</div>
                <div className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Solido escuro</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <DSBadge variant="default">ISO 9001</DSBadge>
                <DSBadge variant="default">ISO 14001</DSBadge>
                <DSBadge variant="default">ISO 45001</DSBadge>
                <DSBadge variant="default">ESG</DSBadge>
              </div>
            </div>

            <div className="border-t border-certifica-200"></div>

            <div className="flex items-center gap-4">
              <div className="w-[180px] flex-shrink-0">
                <div className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>Outline</div>
                <div className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>Borda suave</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <DSBadge variant="outline">Qualidade</DSBadge>
                <DSBadge variant="outline">Meio Ambiente</DSBadge>
                <DSBadge variant="outline">Seguranca</DSBadge>
                <DSBadge variant="outline">Saude</DSBadge>
              </div>
            </div>
          </div>
        </DSCard>
      </div>

      {/* Contextual Usage */}
      <div>
        <h3 className="text-certifica-900 mb-4">Uso Contextual</h3>
        <div className="grid grid-cols-2 gap-4">
          <DSCard header={
            <span className="text-[11px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
              Cabecalho de Auditoria
            </span>
          }>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-[14px] text-certifica-900" style={{ fontWeight: 600 }}>AUD-2026-0047</span>
                <DSBadge variant="observacao">Em Andamento</DSBadge>
              </div>
              <div className="flex gap-1.5">
                <DSBadge variant="default">ISO 9001</DSBadge>
                <DSBadge variant="default">ISO 14001</DSBadge>
              </div>
              <div className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>
                Auditoria combinada de qualidade e meio ambiente
              </div>
            </div>
          </DSCard>

          <DSCard header={
            <span className="text-[11px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
              Resumo de Constatacoes
            </span>
          }>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-certifica-dark" style={{ fontWeight: 400 }}>Conformidades</span>
                <div className="flex items-center gap-2">
                  <DSBadge variant="conformidade">32</DSBadge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-certifica-dark" style={{ fontWeight: 400 }}>Nao Conformidades</span>
                <div className="flex items-center gap-2">
                  <DSBadge variant="nao-conformidade">5</DSBadge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-certifica-dark" style={{ fontWeight: 400 }}>Observacoes</span>
                <div className="flex items-center gap-2">
                  <DSBadge variant="observacao">8</DSBadge>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-certifica-dark" style={{ fontWeight: 400 }}>Oportunidades</span>
                <div className="flex items-center gap-2">
                  <DSBadge variant="oportunidade">3</DSBadge>
                </div>
              </div>
            </div>
          </DSCard>
        </div>
      </div>

      {/* Anatomy */}
      <div>
        <h3 className="text-certifica-900 mb-4">Anatomia</h3>
        <DSCard>
          <div className="bg-certifica-900 rounded-[4px] p-4">
            <pre className="text-[12px] text-certifica-200/80 font-mono" style={{ fontWeight: 400, lineHeight: "1.8" }}>
{`<DSBadge variant="conformidade | nao-conformidade | observacao | oportunidade | default | outline">
  Label Text
</DSBadge>

Propriedades:
  border-radius: 2px
  padding: 2px 10px
  font-size: 11px
  font-weight: 600
  text-transform: uppercase
  letter-spacing: 0.04em`}
            </pre>
          </div>
        </DSCard>
      </div>
    </div>
  );
}
