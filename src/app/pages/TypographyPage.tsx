import React from "react";
import { DSCard } from "../components/ds/DSCard";

const typeScale = [
  { tag: "H1", size: "32px", weight: "600", sample: "Relatorio de Auditoria ISO 9001:2015" },
  { tag: "H2", size: "24px", weight: "600", sample: "Resumo Executivo do Ciclo de Conformidade" },
  { tag: "H3", size: "20px", weight: "600", sample: "Secao 7: Suporte e Recursos" },
  { tag: "H4", size: "18px", weight: "500", sample: "Analise de Requisitos Legais Aplicaveis" },
  { tag: "Texto", size: "14px", weight: "400", sample: "O requisito 7.1.6 da norma ISO 9001:2015 estabelece que a organizacao deve determinar e prover os recursos necessarios para assegurar resultados validos e confiaveis." },
  { tag: "Meta", size: "12px", weight: "400", sample: "Atualizado em 18/02/2026 por auditor-lider • Referencia: AUD-2026-0047" },
];

export default function TypographyPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-certifica-900 mb-2">Tipografia</h2>
        <p className="text-[14px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.6" }}>
          Escala tipografica baseada na fonte Inter, otimizada para legibilidade
          em interfaces tecnicas de dados e relatorios.
        </p>
      </div>

      {/* Font Stack */}
      <DSCard
        header={
          <span className="text-[11px] tracking-[0.06em] uppercase text-certifica-500" style={{ fontWeight: 600 }}>
            Font Stack
          </span>
        }
      >
        <div className="flex items-baseline gap-4">
          <span className="text-[40px] text-certifica-900" style={{ fontWeight: 600, lineHeight: "1.2" }}>
            Inter
          </span>
          <span className="text-[14px] text-certifica-500 font-mono" style={{ fontWeight: 400 }}>
            'Inter', -apple-system, BlinkMacSystemFont, sans-serif
          </span>
        </div>
        <div className="mt-4 flex gap-6">
          {[
            { weight: 400, label: "Regular" },
            { weight: 500, label: "Medium" },
            { weight: 600, label: "SemiBold" },
          ].map((w) => (
            <div key={w.weight} className="flex flex-col items-start gap-1">
              <span className="text-[24px] text-certifica-900" style={{ fontWeight: w.weight, lineHeight: "1.3" }}>
                Aa
              </span>
              <span className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>
                {w.label} ({w.weight})
              </span>
            </div>
          ))}
        </div>
      </DSCard>

      {/* Type Scale */}
      <div>
        <h3 className="text-certifica-900 mb-4">Escala Tipografica</h3>
        <div className="space-y-0">
          {typeScale.map((item, idx) => (
            <div
              key={item.tag}
              className={`flex gap-6 py-5 ${idx > 0 ? "border-t border-certifica-200" : ""}`}
            >
              {/* Meta column */}
              <div className="w-[140px] flex-shrink-0">
                <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-1.5" style={{ fontWeight: 600 }}>
                  {item.tag}
                </div>
                <div className="text-[11px] text-certifica-500 font-mono" style={{ fontWeight: 400 }}>
                  {item.size} / {item.weight}
                </div>
                <div className="text-[11px] text-certifica-500 font-mono mt-0.5" style={{ fontWeight: 400 }}>
                  line-height: 1.5
                </div>
              </div>
              {/* Sample */}
              <div className="flex-1">
                <p
                  className="text-certifica-dark"
                  style={{
                    fontSize: item.size,
                    fontWeight: parseInt(item.weight),
                    lineHeight: "1.5",
                  }}
                >
                  {item.sample}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Characters */}
      <div>
        <h3 className="text-certifica-900 mb-4">Caracteres</h3>
        <DSCard>
          <div className="space-y-4">
            <div>
              <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
                Uppercase
              </div>
              <div className="text-[20px] text-certifica-dark tracking-[0.04em]" style={{ fontWeight: 400 }}>
                ABCDEFGHIJKLMNOPQRSTUVWXYZ
              </div>
            </div>
            <div>
              <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
                Lowercase
              </div>
              <div className="text-[20px] text-certifica-dark" style={{ fontWeight: 400 }}>
                abcdefghijklmnopqrstuvwxyz
              </div>
            </div>
            <div>
              <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
                Numeros
              </div>
              <div className="text-[20px] text-certifica-dark font-mono" style={{ fontWeight: 400 }}>
                0123456789
              </div>
            </div>
            <div>
              <div className="text-[11px] tracking-[0.06em] uppercase text-certifica-500 mb-2" style={{ fontWeight: 600 }}>
                Simbolos
              </div>
              <div className="text-[20px] text-certifica-dark" style={{ fontWeight: 400 }}>
                {"!@#$%^&*()_+-=[]{}|;':\",./<>?"}
              </div>
            </div>
          </div>
        </DSCard>
      </div>

      {/* Usage Guidelines */}
      <div>
        <h3 className="text-certifica-900 mb-4">Diretrizes de Uso</h3>
        <div className="grid grid-cols-2 gap-4">
          <DSCard>
            <div className="flex items-start gap-3">
              <div className="w-1 h-full min-h-[60px] bg-conformidade rounded-full flex-shrink-0"></div>
              <div>
                <div className="text-[13px] text-certifica-900 mb-1.5" style={{ fontWeight: 600 }}>Fazer</div>
                <ul className="space-y-1.5">
                  {[
                    "Usar uppercase com tracking para labels tecnicos",
                    "Manter hierarquia consistente entre H1-H4",
                    "Usar peso 600 para dados numericos importantes",
                    "Usar 12px para metadados e timestamps",
                  ].map((item) => (
                    <li key={item} className="text-[12px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.5" }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </DSCard>
          <DSCard>
            <div className="flex items-start gap-3">
              <div className="w-1 h-full min-h-[60px] bg-nao-conformidade rounded-full flex-shrink-0"></div>
              <div>
                <div className="text-[13px] text-certifica-900 mb-1.5" style={{ fontWeight: 600 }}>Evitar</div>
                <ul className="space-y-1.5">
                  {[
                    "Texto abaixo de 11px em qualquer contexto",
                    "Pesos abaixo de 400 (light/thin)",
                    "Italico exceto em citacoes de normas",
                    "Mais de 3 niveis de hierarquia numa secao",
                  ].map((item) => (
                    <li key={item} className="text-[12px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.5" }}>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </DSCard>
        </div>
      </div>
    </div>
  );
}
