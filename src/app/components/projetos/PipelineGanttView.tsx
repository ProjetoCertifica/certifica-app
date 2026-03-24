"use client";

import { useRef, useState, useCallback, useMemo } from "react";
import type { ColumnWithCards } from "../../lib/usePipeline";

const PIXELS_PER_DAY = 32;
const LEFT_PANEL_WIDTH = 280;
const ROW_HEIGHT = 40;
const BAR_HEIGHT = 24;
const HEADER_HEIGHT = 48;
const PADDING_DAYS = 14;

interface PipelineGanttViewProps {
  cols: ColumnWithCards[];
  onSelectCard: (id: string) => void;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isMonday(d: Date): boolean { return d.getDay() === 1; }
function isSunday(d: Date): boolean { return d.getDay() === 0; }

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function PipelineGanttView({ cols, onSelectCard }: PipelineGanttViewProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; start: string; end: string } | null>(null);

  const handleListScroll = useCallback(() => {
    if (listRef.current && timelineRef.current) timelineRef.current.scrollTop = listRef.current.scrollTop;
  }, []);

  const handleTimelineScroll = useCallback(() => {
    if (timelineRef.current && listRef.current) listRef.current.scrollTop = timelineRef.current.scrollTop;
  }, []);

  const { rangeStart, rangeEnd, totalDays, cardsWithDates } = useMemo(() => {
    const today = startOfDay(new Date());
    const withDates: Array<{ card: any; colColor: string; colTitle: string; start: Date; end: Date }> = [];

    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    for (const col of cols) {
      for (const card of col.cards) {
        const s = card.created_at ? startOfDay(new Date(card.created_at)) : null;
        const e = card.due_date ? startOfDay(new Date(card.due_date + "T00:00:00")) : null;
        if (!s && !e) continue;
        const start = s ?? e!;
        const end = e ?? addDays(start, 14);
        withDates.push({ card, colColor: col.color, colTitle: col.title, start, end });
        if (!minDate || start < minDate) minDate = start;
        if (!maxDate || end > maxDate) maxDate = end;
      }
    }

    let rStart: Date, rEnd: Date;
    if (!minDate || !maxDate) {
      rStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
      rEnd = new Date(today.getFullYear(), today.getMonth() + 3, 0);
    } else {
      rStart = addDays(minDate, -PADDING_DAYS);
      rEnd = addDays(maxDate, PADDING_DAYS);
    }
    if (today < rStart) rStart = addDays(today, -PADDING_DAYS);
    if (today > rEnd) rEnd = addDays(today, PADDING_DAYS);
    const total = daysBetween(rStart, rEnd) + 1;

    return { rangeStart: rStart, rangeEnd: rEnd, totalDays: total, cardsWithDates: withDates };
  }, [cols]);

  const timelineWidth = totalDays * PIXELS_PER_DAY;
  const today = startOfDay(new Date());
  const todayOffset = daysBetween(rangeStart, today) * PIXELS_PER_DAY;

  const monthLabels = useMemo(() => {
    const labels: Array<{ label: string; left: number; width: number }> = [];
    let cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cursor <= rangeEnd) {
      const monthStart = cursor < rangeStart ? rangeStart : new Date(cursor);
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const monthEnd = nextMonth > rangeEnd ? rangeEnd : addDays(nextMonth, -1);
      const left = daysBetween(rangeStart, monthStart) * PIXELS_PER_DAY;
      const width = (daysBetween(monthStart, monthEnd) + 1) * PIXELS_PER_DAY;
      labels.push({ label: formatMonthYear(monthStart), left, width });
      cursor = nextMonth;
    }
    return labels;
  }, [rangeStart, rangeEnd]);

  const gridLines = useMemo(() => {
    const lines: Array<{ left: number; isWeek: boolean }> = [];
    for (let i = 0; i <= totalDays; i++) {
      const d = addDays(rangeStart, i);
      if (isMonday(d)) lines.push({ left: i * PIXELS_PER_DAY, isWeek: true });
      else if (isSunday(d)) lines.push({ left: i * PIXELS_PER_DAY, isWeek: false });
    }
    return lines;
  }, [rangeStart, totalDays]);

  if (cardsWithDates.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-certifica-400" style={{ fontSize: 13 }}>
        Nenhum card com datas definidas.
      </div>
    );
  }

  return (
    <div className="flex border border-certifica-200 rounded-lg overflow-hidden bg-white"
      style={{ height: Math.max(320, cardsWithDates.length * ROW_HEIGHT + HEADER_HEIGHT + 16) }}>
      {/* Left panel */}
      <div className="flex-shrink-0 border-r border-certifica-200 flex flex-col" style={{ width: LEFT_PANEL_WIDTH }}>
        <div className="flex items-center px-3 border-b border-certifica-200 bg-certifica-50 text-certifica-500 font-medium"
          style={{ height: HEADER_HEIGHT, fontSize: 11, letterSpacing: "0.02em" }}>Cards</div>
        <div ref={listRef} className="flex-1 overflow-y-auto overflow-x-hidden" onScroll={handleListScroll} style={{ scrollbarWidth: "thin" }}>
          {cardsWithDates.map(({ card, colColor, colTitle }) => (
            <div key={card.id} className="flex items-center gap-2 px-3 cursor-pointer transition-all duration-200"
              style={{ height: ROW_HEIGHT, backgroundColor: hoveredId === card.id ? "var(--color-certifica-50, #F0F5FA)" : "transparent" }}
              onClick={() => onSelectCard(card.id)}
              onMouseEnter={() => setHoveredId(card.id)}
              onMouseLeave={() => setHoveredId(null)}>
              <span className="flex-shrink-0 rounded-full" style={{ width: 7, height: 7, backgroundColor: colColor }} />
              <div className="flex-1 min-w-0">
                <div className="truncate text-certifica-dark font-medium" style={{ fontSize: 11, lineHeight: "14px" }}>{card.title}</div>
                <div className="truncate text-certifica-400" style={{ fontSize: 10, lineHeight: "13px" }}>{colTitle}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel: timeline */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <div className="border-b border-certifica-200 bg-certifica-50 overflow-hidden relative" style={{ height: HEADER_HEIGHT, flexShrink: 0 }}>
          <div className="relative h-full" style={{ width: timelineWidth, transform: `translateX(-${timelineRef.current?.scrollLeft ?? 0}px)` }}>
            {monthLabels.map((m, i) => (
              <div key={i} className="absolute top-0 h-full flex items-end pb-1.5 px-2 border-l border-certifica-200/50 text-certifica-500 font-medium"
                style={{ left: m.left, width: m.width, fontSize: 10, letterSpacing: "0.02em" }}>
                <span className="capitalize">{m.label}</span>
              </div>
            ))}
            {todayOffset >= 0 && todayOffset <= timelineWidth && (
              <div className="absolute top-0 h-full flex flex-col items-center justify-start pt-0.5 pointer-events-none" style={{ left: todayOffset, zIndex: 10 }}>
                <span className="px-1 rounded text-white font-semibold" style={{ fontSize: 8, backgroundColor: "#EF4444", lineHeight: "14px" }}>Hoje</span>
              </div>
            )}
          </div>
        </div>

        <div ref={timelineRef} className="flex-1 overflow-auto relative"
          onScroll={(e) => {
            handleTimelineScroll();
            const header = (e.target as HTMLElement).previousElementSibling;
            if (header) {
              const inner = header.firstElementChild as HTMLElement;
              if (inner) inner.style.transform = `translateX(-${(e.target as HTMLElement).scrollLeft}px)`;
            }
          }}
          style={{ scrollbarWidth: "thin" }}>
          <div className="relative" style={{ width: timelineWidth, height: cardsWithDates.length * ROW_HEIGHT, minHeight: "100%" }}>
            {gridLines.map((line, i) => (
              <div key={i} className="absolute top-0 pointer-events-none"
                style={{ left: line.left, width: 1, height: "100%", backgroundColor: line.isWeek ? "rgba(39,76,119,0.12)" : "rgba(39,76,119,0.05)" }} />
            ))}
            {cardsWithDates.map((_, i) => (
              <div key={`row-${i}`} className="absolute left-0 pointer-events-none"
                style={{ top: (i + 1) * ROW_HEIGHT, width: "100%", height: 1, backgroundColor: "rgba(39,76,119,0.06)" }} />
            ))}
            {todayOffset >= 0 && todayOffset <= timelineWidth && (
              <div className="absolute top-0 pointer-events-none" style={{ left: todayOffset, width: 2, height: "100%", backgroundColor: "rgba(239,68,68,0.5)", zIndex: 5 }} />
            )}
            {cardsWithDates.map(({ card, colColor, start, end }, i) => {
              const barStart = daysBetween(rangeStart, start);
              const barDays = Math.max(1, daysBetween(start, end) + 1);
              const barLeft = barStart * PIXELS_PER_DAY;
              const barWidth = barDays * PIXELS_PER_DAY;
              const barTop = i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
              const isHovered = hoveredId === card.id;

              return (
                <div key={card.id} className="absolute cursor-pointer"
                  style={{
                    left: barLeft, top: barTop, width: barWidth, height: BAR_HEIGHT, borderRadius: 6,
                    backgroundColor: lightenHex(colColor, 60), overflow: "hidden",
                    transition: "transform 200ms ease, box-shadow 200ms ease",
                    transform: isHovered ? "scaleY(1.12)" : "scaleY(1)",
                    boxShadow: isHovered ? `0 2px 8px ${hexToRgba(colColor, 0.35)}` : "none",
                    zIndex: isHovered ? 8 : 2,
                  }}
                  onClick={() => onSelectCard(card.id)}
                  onMouseEnter={(e) => {
                    setHoveredId(card.id);
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    setTooltip({
                      x: rect.left + rect.width / 2, y: rect.top - 4,
                      title: card.title,
                      start: start.toLocaleDateString("pt-BR"),
                      end: end.toLocaleDateString("pt-BR"),
                    });
                  }}
                  onMouseLeave={() => { setHoveredId(null); setTooltip(null); }}>
                  <div style={{ width: "100%", height: "100%", backgroundColor: colColor, borderRadius: 6 }} />
                  {barWidth > 80 && (
                    <span className="absolute inset-0 flex items-center px-2 truncate font-medium pointer-events-none"
                      style={{ fontSize: 10, color: "#FFFFFF", textShadow: "0 1px 2px rgba(0,0,0,0.2)" }}>
                      {card.title}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {tooltip && (
          <div className="fixed pointer-events-none" style={{ left: tooltip.x, top: tooltip.y, transform: "translate(-50%, -100%)", zIndex: 50 }}>
            <div className="bg-certifica-dark text-white rounded-lg shadow-lg px-3 py-2" style={{ fontSize: 11, lineHeight: "16px", maxWidth: 220 }}>
              <div className="font-semibold mb-0.5" style={{ fontSize: 12 }}>{tooltip.title}</div>
              <div className="opacity-70">{tooltip.start} → {tooltip.end}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
