"use client";

import React, { useState } from "react";
import { Search, Eye, User, DollarSign, Clock, Tag, Plus } from "lucide-react";
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

const prioridadeStyle: Record<string, { label: string; color: string }> = {
  alta: { label: "Alta", color: "#DC2626" },
  media: { label: "Média", color: "#D97706" },
  baixa: { label: "Baixa", color: "#6B7280" },
};

interface PipelineListViewProps {
  cols: ColumnWithCards[];
  onSelectCard: (id: string) => void;
  onAddCard?: (colId: string) => void;
}

export function PipelineListView({ cols, onSelectCard, onAddCard }: PipelineListViewProps) {
  const [search, setSearch] = useState("");

  const allCards = cols.flatMap((col) =>
    col.cards.map((card) => ({ ...card, colTitle: col.title, colColor: col.color }))
  );

  const filtered = search
    ? allCards.filter((c) => {
        const q = search.toLowerCase();
        const data = parseCardData(c.description);
        return (
          c.title.toLowerCase().includes(q) ||
          (c.assigned_to || "").toLowerCase().includes(q) ||
          (data.descricao || "").toLowerCase().includes(q) ||
          c.colTitle.toLowerCase().includes(q)
        );
      })
    : allCards;

  return (
    <div className="w-full">
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-certifica-500 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cards..."
          className="w-full pl-9 pr-4 py-2 rounded-[3px] border border-certifica-200 bg-white text-certifica-dark placeholder:text-certifica-500 focus:outline-none focus:ring-1 focus:ring-certifica-accent/40"
          style={{ fontSize: "12px", fontWeight: 400 }}
        />
      </div>

      {onAddCard && (
        <div className="flex items-center gap-2 mb-3">
          {cols.length > 0 ? (
            <button
              onClick={() => onAddCard(cols[0].id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-certifica-accent text-white rounded-[4px] text-[11px] cursor-pointer hover:opacity-90 transition-opacity"
              style={{ fontWeight: 600 }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              Novo card
            </button>
          ) : (
            <span className="text-[11px] text-certifica-500 italic">Crie uma coluna primeiro (via Kanban) para adicionar cards.</span>
          )}
          <span className="text-[11px] text-certifica-500 ml-auto">{filtered.length} card{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      <div className="w-full overflow-x-auto rounded-[3px] border border-certifica-200 bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-certifica-200">
              {["Título", "Coluna", "Responsável", "Prioridade", "Valor", "Prazo", "Tags", ""].map((col) => (
                <th
                  key={col || "__action"}
                  className="px-3 py-2.5 text-left text-certifica-500 uppercase tracking-[0.06em] whitespace-nowrap"
                  style={{ fontSize: "10px", fontWeight: 600 }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-certifica-500" style={{ fontSize: "12px" }}>
                  Nenhum card encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((card, index) => {
                const data = parseCardData(card.description);
                const prio = prioridadeStyle[data.prioridade || "media"] || prioridadeStyle.media;
                const daysLeft = card.due_date ? Math.ceil((new Date(card.due_date).getTime() - Date.now()) / 86400000) : null;

                return (
                  <tr
                    key={card.id}
                    onClick={() => onSelectCard(card.id)}
                    className="border-b border-certifica-200/60 cursor-pointer transition-colors duration-150 hover:bg-certifica-50/50"
                    style={{ animation: `fadeInRow 0.25s ease-out ${index * 0.035}s both` }}
                  >
                    <td className="px-3 py-2.5 max-w-[220px]">
                      <span className="text-certifica-dark truncate block" style={{ fontSize: "11.5px", fontWeight: 600 }}>
                        {card.title}
                      </span>
                      {data.descricao && (
                        <span className="text-certifica-500 truncate block" style={{ fontSize: "10px" }}>
                          {data.descricao.slice(0, 60)}{data.descricao.length > 60 ? "..." : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ backgroundColor: card.colColor }} />
                        <span className="text-certifica-700" style={{ fontSize: "11px", fontWeight: 500 }}>{card.colTitle}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-certifica-700" style={{ fontSize: "11px", fontWeight: 500 }}>
                        {card.assigned_to || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-[6px] h-[6px] rounded-full flex-shrink-0" style={{ backgroundColor: prio.color }} />
                        <span className="text-certifica-700" style={{ fontSize: "10.5px", fontWeight: 500 }}>{prio.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="font-mono text-certifica-700" style={{ fontSize: "10.5px", fontWeight: 500 }}>
                        {data.valor || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {daysLeft !== null ? (
                        <span className={`font-mono ${daysLeft < 0 ? "text-nao-conformidade" : daysLeft <= 7 ? "text-observacao" : "text-certifica-700"}`} style={{ fontSize: "10.5px", fontWeight: 600 }}>
                          {daysLeft < 0 ? `${Math.abs(daysLeft)}d atraso` : `${daysLeft}d`}
                        </span>
                      ) : (
                        <span className="text-certifica-500" style={{ fontSize: "10.5px" }}>—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 flex-wrap">
                        {(card.tags || []).slice(0, 2).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 bg-certifica-100 text-certifica-500 rounded-[2px] text-[9px]" style={{ fontWeight: 500 }}>{t}</span>
                        ))}
                        {(card.tags || []).length > 2 && <span className="text-[9px] text-certifica-500/50">+{card.tags.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onSelectCard(card.id); }}
                        className="p-1 rounded-[2px] text-certifica-500 hover:text-certifica-dark hover:bg-certifica-100 transition-colors duration-150">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
