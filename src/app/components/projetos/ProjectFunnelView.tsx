"use client";

import { useMemo, useState } from "react";
import { TrendingDown, ArrowRight, DollarSign, Target } from "lucide-react";
import type { ProjetoUI } from "../../lib/projetosShared";
import {
  faseColors,
  faseLabels,
  statusConfig,
  prioridadeConfig,
  getProgressPercent,
} from "../../lib/projetosShared";

/* ── Props ── */

interface ProjectFunnelViewProps {
  projetos: ProjetoUI[];
  onSelect: (id: string) => void;
}

/* ── Helpers ── */

/** Parse "R$ 48.000,00" → 48000.00 */
function parseValor(valor: string | null | undefined): number {
  if (!valor) return 0;
  const cleaned = valor
    .replace(/R\$\s*/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? 0 : n;
}

/** Format number → "R$ 48.000,00" */
function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

/* ── Stage data ── */

interface StageData {
  fase: number;
  label: string;
  color: string;
  projetos: ProjetoUI[];
  totalValor: number;
  count: number;
}

/* ── Component ── */

export function ProjectFunnelView({
  projetos,
  onSelect,
}: ProjectFunnelViewProps) {
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);

  const stages: StageData[] = useMemo(() => {
    const grouped: Record<number, ProjetoUI[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
    for (const p of projetos) {
      const f = p.fase;
      if (f >= 0 && f <= 4) {
        grouped[f].push(p);
      }
    }
    return [0, 1, 2, 3, 4].map((fase) => ({
      fase,
      label: faseLabels[fase],
      color: faseColors[fase],
      projetos: grouped[fase],
      totalValor: grouped[fase].reduce((sum, p) => sum + parseValor(p.valor), 0),
      count: grouped[fase].length,
    }));
  }, [projetos]);

  const totalProjects = projetos.length;
  const totalValue = stages.reduce((sum, s) => sum + s.totalValor, 0);
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  // Conversion rates: stage[i] count / stage[i-1] count
  const conversionRates = stages.map((s, i) => {
    if (i === 0) return 100;
    const prev = stages[i - 1].count;
    if (prev === 0) return 0;
    return Math.round((s.count / prev) * 100);
  });

  const avgConversion =
    conversionRates.length > 1
      ? Math.round(
          conversionRates.slice(1).reduce((a, b) => a + b, 0) /
            (conversionRates.length - 1)
        )
      : 0;

  const winRate =
    totalProjects > 0
      ? Math.round(
          (projetos.filter((p) => p.status === "concluido").length / totalProjects) * 100
        )
      : 0;

  /* ── Empty state ── */
  if (projetos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-certifica-dark/50">
        <TrendingDown className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-[13px] font-medium">Nenhum projeto no funil.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Summary bar ── */}
      <div className="flex flex-wrap items-center gap-5 rounded-[6px] border border-certifica-200 bg-certifica-50/60 px-5 py-3">
        <SummaryItem
          icon={<Target className="h-3.5 w-3.5 text-certifica-500" />}
          label="Projetos"
          value={String(totalProjects)}
        />
        <SummarySep />
        <SummaryItem
          icon={<DollarSign className="h-3.5 w-3.5 text-certifica-500" />}
          label="Valor total"
          value={formatCurrency(totalValue)}
        />
        <SummarySep />
        <SummaryItem
          icon={<TrendingDown className="h-3.5 w-3.5 text-certifica-500" />}
          label="Conversao media"
          value={`${avgConversion}%`}
        />
        <SummarySep />
        <SummaryItem
          icon={<Target className="h-3.5 w-3.5 text-certifica-accent" />}
          label="Taxa de conclusao"
          value={`${winRate}%`}
        />
      </div>

      {/* ── Funnel stages (horizontal) ── */}
      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {stages.map((stage, idx) => {
          const widthPct = Math.max(
            40,
            Math.round((stage.count / maxCount) * 100)
          );
          const isHovered = hoveredStage === stage.fase;

          return (
            <div key={stage.fase} className="flex items-start">
              {/* Stage column */}
              <div
                className="flex flex-col"
                style={{ minWidth: 200, maxWidth: 260, flex: "1 1 0" }}
                onMouseEnter={() => setHoveredStage(stage.fase)}
                onMouseLeave={() => setHoveredStage(null)}
              >
                {/* Funnel bar */}
                <div className="flex flex-col items-center px-1">
                  <div
                    className="relative w-full overflow-hidden rounded-[4px] transition-all duration-200"
                    style={{
                      height: 8,
                      width: `${widthPct}%`,
                      background: `linear-gradient(135deg, ${stage.color}, ${stage.color}CC)`,
                      opacity: isHovered ? 1 : 0.85,
                      transform: isHovered ? "scaleY(1.4)" : "scaleY(1)",
                    }}
                  />
                </div>

                {/* Stage header */}
                <div
                  className="mt-2 rounded-[6px] border px-3 py-2.5 transition-all duration-200"
                  style={{
                    borderColor: isHovered ? stage.color : "var(--color-certifica-200, #D1D5DB)",
                    background: isHovered
                      ? `${stage.color}08`
                      : "transparent",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="text-[12px] font-semibold tracking-wide text-certifica-dark">
                      {stage.label}
                    </span>
                    <span
                      className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                      style={{ backgroundColor: stage.color }}
                    >
                      {stage.count}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-certifica-dark/60">
                    {formatCurrency(stage.totalValor)}
                  </p>
                </div>

                {/* Project cards */}
                <div className="mt-2 flex flex-col gap-1.5 px-1">
                  {stage.projetos.map((projeto) => (
                    <FunnelCard
                      key={projeto.id}
                      projeto={projeto}
                      stageColor={stage.color}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </div>

              {/* Conversion arrow between stages */}
              {idx < stages.length - 1 && (
                <div className="flex flex-col items-center justify-start pt-[52px] px-1">
                  <ArrowRight className="h-3.5 w-3.5 text-certifica-dark/30" />
                  <span className="mt-0.5 text-[10px] font-medium text-certifica-dark/40">
                    {conversionRates[idx + 1]}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Mini card inside funnel stage ── */

function FunnelCard({
  projeto,
  stageColor,
  onSelect,
}: {
  projeto: ProjetoUI;
  stageColor: string;
  onSelect: (id: string) => void;
}) {
  const progress = getProgressPercent(projeto);
  const prioConfig = prioridadeConfig[projeto.prioridade];
  const stConfig = statusConfig[projeto.status];

  return (
    <button
      type="button"
      onClick={() => onSelect(projeto.id)}
      className="group w-full cursor-pointer rounded-[4px] border border-certifica-200 bg-white px-2.5 py-2 text-left transition-all duration-200 hover:scale-[1.02] hover:border-certifica-500/30 hover:shadow-md"
    >
      {/* Top row: codigo + prioridade dot */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold tracking-wide text-certifica-dark/50">
          {projeto.codigo}
        </span>
        {prioConfig && (
          <span
            className="ml-auto inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: prioConfig.color }}
            title={prioConfig.label}
          />
        )}
      </div>

      {/* Title */}
      <p className="mt-0.5 text-[11px] font-medium leading-tight text-certifica-dark">
        {truncate(projeto.titulo, 36)}
      </p>

      {/* Client */}
      <p className="mt-0.5 text-[10px] text-certifica-dark/50">
        {truncate(projeto.clienteNome, 28)}
      </p>

      {/* Progress bar */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-certifica-200/60">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundColor: stageColor,
            }}
          />
        </div>
        <span className="text-[9px] font-medium text-certifica-dark/40">
          {progress}%
        </span>
      </div>
    </button>
  );
}

/* ── Summary bar helpers ── */

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-certifica-dark/45">
          {label}
        </span>
        <span className="text-[13px] font-semibold text-certifica-dark">
          {value}
        </span>
      </div>
    </div>
  );
}

function SummarySep() {
  return <div className="h-8 w-px bg-certifica-200" />;
}
