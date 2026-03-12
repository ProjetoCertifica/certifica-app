import React from "react";
import { DSCard } from "../components/ds/DSCard";

const primaryColors = [
  { name: "certifica-900", hex: "#0E2A47", css: "--certifica-900", desc: "Primaria / Sidebar / Headers" },
  { name: "certifica-800", hex: "#1F3F66", css: "--certifica-800", desc: "Hover / Accent secundario" },
  { name: "certifica-700", hex: "#2F5E8E", css: "--certifica-700", desc: "Links / Focus ring" },
  { name: "certifica-dark", hex: "#2B2F33", css: "--certifica-dark", desc: "Texto principal" },
  { name: "certifica-500", hex: "#6B7280", css: "--certifica-500", desc: "Texto secundario / Meta" },
  { name: "certifica-200", hex: "#E6E8EB", css: "--certifica-200", desc: "Bordas / Divisorias" },
  { name: "certifica-50", hex: "#FAFAFA", css: "--certifica-50", desc: "Background" },
];

const statusColors = [
  { name: "conformidade", hex: "#1F5E3B", css: "--status-conformidade", desc: "Requisitos atendidos", bg: "bg-conformidade" },
  { name: "nao-conformidade", hex: "#7A1E1E", css: "--status-nao-conformidade", desc: "Requisitos nao atendidos", bg: "bg-nao-conformidade" },
  { name: "observacao", hex: "#8C6A1F", css: "--status-observacao", desc: "Pontos de atencao", bg: "bg-observacao" },
  { name: "oportunidade", hex: "#274C77", css: "--status-oportunidade", desc: "Melhorias sugeridas", bg: "bg-oportunidade" },
];

const spacingScale = [
  { name: "0.5", px: "2px" },
  { name: "1", px: "4px" },
  { name: "1.5", px: "6px" },
  { name: "2", px: "8px" },
  { name: "2.5", px: "10px" },
  { name: "3", px: "12px" },
  { name: "4", px: "16px" },
  { name: "5", px: "20px" },
  { name: "6", px: "24px" },
  { name: "8", px: "32px" },
  { name: "10", px: "40px" },
  { name: "12", px: "48px" },
];

export default function TokensPage() {
  return (
    <div className="space-y-10">
      {/* Header */}
      <div>
        <h2 className="text-certifica-900 mb-2">Tokens de Design</h2>
        <p className="text-[14px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.6" }}>
          Variaveis CSS que formam a base do sistema visual da CERTIFICA. Todos os componentes
          utilizam estes tokens como referencia.
        </p>
      </div>

      {/* Primary Palette */}
      <div>
        <h3 className="text-certifica-900 mb-4">Paleta Primaria</h3>
        <div className="grid grid-cols-7 gap-3">
          {primaryColors.map((color) => (
            <div key={color.name} className="flex flex-col">
              <div
                className="w-full aspect-square rounded-[4px] border border-certifica-200 mb-2.5"
                style={{ backgroundColor: color.hex }}
              ></div>
              <div className="text-[12px] text-certifica-900 mb-0.5" style={{ fontWeight: 600 }}>{color.name}</div>
              <div className="text-[11px] text-certifica-500 font-mono mb-1">{color.hex}</div>
              <div className="text-[11px] text-certifica-500" style={{ fontWeight: 400, lineHeight: "1.4" }}>{color.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Status Colors */}
      <div>
        <h3 className="text-certifica-900 mb-4">Cores de Estado</h3>
        <div className="grid grid-cols-4 gap-4">
          {statusColors.map((color) => (
            <DSCard key={color.name}>
              <div className="flex items-start gap-3">
                <div
                  className="w-12 h-12 rounded-[3px] flex-shrink-0"
                  style={{ backgroundColor: color.hex }}
                ></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-certifica-900 mb-0.5" style={{ fontWeight: 600 }}>{color.name}</div>
                  <div className="text-[11px] text-certifica-500 font-mono mb-1">{color.hex}</div>
                  <div className="text-[11px] text-certifica-500" style={{ fontWeight: 400 }}>{color.desc}</div>
                </div>
              </div>
              {/* Scale demo */}
              <div className="flex gap-1 mt-3">
                {[10, 20, 30, 50, 80, 100].map((opacity) => (
                  <div
                    key={opacity}
                    className="flex-1 h-6 rounded-[2px]"
                    style={{ backgroundColor: color.hex, opacity: opacity / 100 }}
                  ></div>
                ))}
              </div>
            </DSCard>
          ))}
        </div>
      </div>

      {/* Spacing Scale */}
      <div>
        <h3 className="text-certifica-900 mb-4">Escala de Espacamento</h3>
        <DSCard>
          <div className="space-y-2">
            {spacingScale.map((space) => (
              <div key={space.name} className="flex items-center gap-4">
                <span className="w-8 text-right text-[12px] text-certifica-500 font-mono">{space.name}</span>
                <div
                  className="h-3 bg-certifica-700/20 rounded-[1px]"
                  style={{ width: space.px }}
                ></div>
                <span className="text-[11px] text-certifica-500">{space.px}</span>
              </div>
            ))}
          </div>
        </DSCard>
      </div>

      {/* Border Radius */}
      <div>
        <h3 className="text-certifica-900 mb-4">Raios de Borda</h3>
        <DSCard>
          <div className="flex items-end gap-6">
            {[
              { name: "none", value: "0px" },
              { name: "badge", value: "2px" },
              { name: "default", value: "4px" },
              { name: "max", value: "6px" },
            ].map((r) => (
              <div key={r.name} className="flex flex-col items-center gap-2">
                <div
                  className="w-16 h-16 border-2 border-certifica-700 bg-certifica-700/5"
                  style={{ borderRadius: r.value }}
                ></div>
                <div className="text-[12px] text-certifica-900" style={{ fontWeight: 600 }}>{r.name}</div>
                <div className="text-[11px] text-certifica-500 font-mono">{r.value}</div>
              </div>
            ))}
          </div>
        </DSCard>
      </div>

      {/* CSS Variables Reference */}
      <div>
        <h3 className="text-certifica-900 mb-4">Referencia de Variaveis CSS</h3>
        <DSCard>
          <div className="bg-certifica-900 rounded-[4px] p-4 overflow-x-auto">
            <pre className="text-[12px] text-certifica-200/80 font-mono" style={{ fontWeight: 400, lineHeight: "1.8" }}>
{`:root {
  /* Paleta Primaria */
  --certifica-900: #0E2A47;
  --certifica-800: #1F3F66;
  --certifica-700: #2F5E8E;
  --certifica-dark: #2B2F33;
  --certifica-500: #6B7280;
  --certifica-200: #E6E8EB;
  --certifica-50:  #FAFAFA;

  /* Estados */
  --status-conformidade:     #1F5E3B;
  --status-nao-conformidade: #7A1E1E;
  --status-observacao:       #8C6A1F;
  --status-oportunidade:     #274C77;

  /* Layout */
  --radius: 4px;
  --border-width: 1px;
  --sidebar-width: 240px;
  --header-height: 48px;
}`}
            </pre>
          </div>
        </DSCard>
      </div>
    </div>
  );
}
