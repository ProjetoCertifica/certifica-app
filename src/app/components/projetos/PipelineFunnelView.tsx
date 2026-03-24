"use client";

import { useMemo, useState } from "react";
import { TrendingDown, ArrowRight, DollarSign, Target, User, Clock } from "lucide-react";
import type { ColumnWithCards } from "../../lib/usePipeline";

interface CardData {
  descricao?: string;
  valor?: string;
  prioridade?: "alta" | "media" | "baixa";
  responsavel?: string;
  prazo?: string;
}

function parseCardData(desc: string): CardData {
  try {
    const p = JSON.parse(desc);
    return typeof p === "object" && p ? p : { descricao: desc };
  } catch {
    return { descricao: desc || "" };
  }
}

function parseCurrency(v: string): number {
  return parseFloat(v.replace(/[^\d,]/g, "").replace(",", ".")) || 0;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + "...";
}

const prioridadeColors: Record<string, string> = { alta: "#DC2626", media: "#D97706", baixa: "#6B7280" };

interface PipelineFunnelViewProps {
  cols: ColumnWithCards[];
  onSelectCard: (id: string) => void;
}

export function PipelineFunnelView({ cols, onSelectCard }: PipelineFunnelViewProps) {
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);

  const stages = useMemo(() => {
    return cols.map((col) => {
      const totalValor = col.cards.reduce((sum, card) => {
        const data = parseCardData(card.description);
        return sum + parseCurrency(data.valor || "0");
      }, 0);
      return { id: col.id, label: col.title, color: col.color, cards: col.cards, totalValor, count: col.cards.length };
    });
  }, [cols]);

  const totalCards = stages.reduce((s, st) => s + st.count, 0);
  const totalValue = stages.reduce((s, st) => s + st.totalValor, 0);
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  const conversionRates = stages.map((s, i) => {
    if (i === 0) return 100;
    const prev = stages[i - 1].count;
    return prev === 0 ? 0 : Math.round((s.count / prev) * 100);
  });

  const avgConversion = conversionRates.length > 1
    ? Math.round(conversionRates.slice(1).reduce((a, b) => a + b, 0) / (conversionRates.length - 1))
    : 0;

  if (totalCards === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-certifica-dark/50">
        <TrendingDown className="mb-3 h-10 w-10 opacity-40" />
        <p className="text-[13px] font-medium">Nenhum card no funil.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-5 rounded-[6px] border border-certifica-200 bg-certifica-50/60 px-5 py-3">
        <SummaryItem icon={<Target className="h-3.5 w-3.5 text-certifica-500" />} label="Cards" value={String(totalCards)} />
        <SummarySep />
        <SummaryItem icon={<DollarSign className="h-3.5 w-3.5 text-certifica-500" />} label="Valor total" value={formatCurrency(totalValue)} />
        <SummarySep />
        <SummaryItem icon={<TrendingDown className="h-3.5 w-3.5 text-certifica-500" />} label="Conversao media" value={`${avgConversion}%`} />
      </div>

      <div className="flex items-start gap-0 overflow-x-auto pb-2">
        {stages.map((stage, idx) => {
          const widthPct = Math.max(40, Math.round((stage.count / maxCount) * 100));
          const isHovered = hoveredStage === stage.id;

          return (
            <div key={stage.id} className="flex items-start">
              <div className="flex flex-col" style={{ minWidth: 200, maxWidth: 260, flex: "1 1 0" }}
                onMouseEnter={() => setHoveredStage(stage.id)} onMouseLeave={() => setHoveredStage(null)}>
                <div className="flex flex-col items-center px-1">
                  <div className="relative w-full overflow-hidden rounded-[4px] transition-all duration-200"
                    style={{ height: 8, width: `${widthPct}%`, background: `linear-gradient(135deg, ${stage.color}, ${stage.color}CC)`, opacity: isHovered ? 1 : 0.85, transform: isHovered ? "scaleY(1.4)" : "scaleY(1)" }} />
                </div>
                <div className="mt-2 rounded-[6px] border px-3 py-2.5 transition-all duration-200"
                  style={{ borderColor: isHovered ? stage.color : "var(--color-certifica-200, #D1D5DB)", background: isHovered ? `${stage.color}08` : "transparent" }}>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-[12px] font-semibold tracking-wide text-certifica-dark">{stage.label}</span>
                    <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white" style={{ backgroundColor: stage.color }}>{stage.count}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-certifica-dark/60">{formatCurrency(stage.totalValor)}</p>
                </div>

                <div className="mt-2 flex flex-col gap-1.5 px-1">
                  {stage.cards.map((card) => {
                    const data = parseCardData(card.description);
                    const prioColor = prioridadeColors[data.prioridade || "media"] || "#D97706";
                    const daysLeft = card.due_date ? Math.ceil((new Date(card.due_date).getTime() - Date.now()) / 86400000) : null;

                    return (
                      <button key={card.id} type="button" onClick={() => onSelectCard(card.id)}
                        className="group w-full cursor-pointer rounded-[4px] border border-certifica-200 bg-white px-2.5 py-2 text-left transition-all duration-200 hover:scale-[1.02] hover:border-certifica-500/30 hover:shadow-md">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-medium leading-tight text-certifica-dark flex-1 truncate">{truncate(card.title, 36)}</span>
                          <span className="ml-auto inline-block h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: prioColor }} />
                        </div>
                        {card.assigned_to && (
                          <p className="mt-0.5 text-[10px] text-certifica-dark/50 flex items-center gap-1">
                            <User className="w-2.5 h-2.5" strokeWidth={1.5} />{truncate(card.assigned_to, 28)}
                          </p>
                        )}
                        {data.valor && <p className="mt-0.5 text-[10px] text-certifica-dark/50 font-mono">{data.valor}</p>}
                        {daysLeft !== null && (
                          <div className={`mt-1 inline-flex items-center gap-1 px-1 py-0.5 rounded-[2px] text-[9px] font-mono ${
                            daysLeft < 0 ? "bg-nao-conformidade/8 text-nao-conformidade" : daysLeft <= 7 ? "bg-observacao/8 text-observacao" : "bg-certifica-50 text-certifica-500"
                          }`} style={{ fontWeight: 500 }}>
                            <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d atraso` : `${daysLeft}d`}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              {idx < stages.length - 1 && (
                <div className="flex flex-col items-center justify-start pt-[52px] px-1">
                  <ArrowRight className="h-3.5 w-3.5 text-certifica-dark/30" />
                  <span className="mt-0.5 text-[10px] font-medium text-certifica-dark/40">{conversionRates[idx + 1]}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-certifica-dark/45">{label}</span>
        <span className="text-[13px] font-semibold text-certifica-dark">{value}</span>
      </div>
    </div>
  );
}

function SummarySep() {
  return <div className="h-8 w-px bg-certifica-200" />;
}
