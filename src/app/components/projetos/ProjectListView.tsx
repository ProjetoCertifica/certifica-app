"use client";

import React from "react";
import { Search, Eye } from "lucide-react";
import { DSBadge } from "../ds/DSBadge";
import type { ProjetoUI } from "../../lib/projetosShared";
import {
  statusConfig,
  prioridadeConfig,
  faseColors,
  faseLabels,
  getRiskPrazo,
  getRiskEscopo,
} from "../../lib/projetosShared";

/* ── Props ── */

interface ProjectListViewProps {
  projetos: ProjetoUI[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

/* ── Helpers ── */

function riskColorClass(score: number): string {
  if (score >= 70) return "text-nao-conformidade";
  if (score >= 50) return "text-observacao";
  return "text-conformidade";
}

function entregaveisSubtitle(p: ProjetoUI): string {
  const done = p.entregaveis.filter((e) => e.concluido).length;
  const total = p.entregaveis.length;
  return `${done}/${total} entregaveis`;
}

/* ── Columns ── */

const columns = [
  "Codigo",
  "Projeto",
  "Cliente",
  "Norma",
  "Fase",
  "Status",
  "Prioridade",
  "Risco prazo",
  "Risco escopo",
  "Prazo",
  "",
] as const;

/* ── Component ── */

export function ProjectListView({
  projetos,
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
}: ProjectListViewProps) {
  return (
    <div className="w-full">
      {/* Search bar */}
      <div className="relative mb-4">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-certifica-500 pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar projetos..."
          className="w-full pl-9 pr-4 py-2 rounded-[3px] border border-certifica-200 bg-white text-certifica-dark placeholder:text-certifica-500 focus:outline-none focus:ring-1 focus:ring-certifica-accent/40"
          style={{ fontSize: "12px", fontWeight: 400 }}
        />
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-[3px] border border-certifica-200 bg-white">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead>
            <tr className="border-b border-certifica-200">
              {columns.map((col) => (
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

          {/* Body */}
          <tbody>
            {projetos.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-12 text-center text-certifica-500"
                  style={{ fontSize: "12px", fontWeight: 400 }}
                >
                  Nenhum projeto encontrado.
                </td>
              </tr>
            ) : (
              projetos.map((p, index) => {
                const riskPrazo = getRiskPrazo(p);
                const riskEscopo = getRiskEscopo(p);
                const sCfg = statusConfig[p.status];
                const pCfg = prioridadeConfig[p.prioridade];
                const isSelected = selectedId === p.id;

                return (
                  <tr
                    key={p.id}
                    onClick={() => onSelect(p.id)}
                    className={`border-b border-certifica-200/60 cursor-pointer transition-colors duration-150 ${
                      isSelected
                        ? "bg-certifica-50"
                        : "hover:bg-certifica-50/50"
                    }`}
                    style={{
                      animation: `fadeInRow 0.25s ease-out ${index * 0.035}s both`,
                    }}
                  >
                    {/* Codigo */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className="font-mono text-certifica-900"
                        style={{ fontSize: "11px", fontWeight: 600 }}
                      >
                        {p.codigo}
                      </span>
                    </td>

                    {/* Projeto */}
                    <td className="px-3 py-2.5 max-w-[220px]">
                      <div className="flex flex-col gap-0.5">
                        <span
                          className="text-certifica-dark truncate"
                          style={{ fontSize: "11.5px", fontWeight: 600 }}
                        >
                          {p.titulo}
                        </span>
                        <span
                          className="text-certifica-500"
                          style={{ fontSize: "10px", fontWeight: 400 }}
                        >
                          {entregaveisSubtitle(p)}
                        </span>
                      </div>
                    </td>

                    {/* Cliente */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className="text-certifica-700"
                        style={{ fontSize: "11px", fontWeight: 500 }}
                      >
                        {p.clienteNome}
                      </span>
                    </td>

                    {/* Norma */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className="font-mono text-certifica-700"
                        style={{ fontSize: "10.5px", fontWeight: 500 }}
                      >
                        {p.norma}
                      </span>
                    </td>

                    {/* Fase */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-[7px] h-[7px] rounded-[1px] flex-shrink-0"
                          style={{ backgroundColor: faseColors[p.fase] ?? "#6B7280" }}
                        />
                        <span
                          className="text-certifica-700"
                          style={{ fontSize: "10.5px", fontWeight: 500 }}
                        >
                          {p.fase} &middot; {faseLabels[p.fase] ?? p.faseLabel}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {sCfg ? (
                        <DSBadge variant={sCfg.variant}>{sCfg.label}</DSBadge>
                      ) : (
                        <span
                          className="text-certifica-500"
                          style={{ fontSize: "11px" }}
                        >
                          {p.status}
                        </span>
                      )}
                    </td>

                    {/* Prioridade */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block w-[6px] h-[6px] rounded-full flex-shrink-0"
                          style={{ backgroundColor: pCfg?.color ?? "#6B7280" }}
                        />
                        <span
                          className="text-certifica-700"
                          style={{ fontSize: "10.5px", fontWeight: 500 }}
                        >
                          {pCfg?.label ?? p.prioridade}
                        </span>
                      </div>
                    </td>

                    {/* Risco prazo */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">
                      <span
                        className={riskColorClass(riskPrazo)}
                        style={{ fontSize: "11px", fontWeight: 600 }}
                      >
                        {riskPrazo}
                      </span>
                    </td>

                    {/* Risco escopo */}
                    <td className="px-3 py-2.5 whitespace-nowrap text-center">
                      <span
                        className={riskColorClass(riskEscopo)}
                        style={{ fontSize: "11px", fontWeight: 600 }}
                      >
                        {riskEscopo}
                      </span>
                    </td>

                    {/* Prazo */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span
                        className="font-mono text-certifica-700"
                        style={{ fontSize: "10.5px", fontWeight: 500 }}
                      >
                        {p.previsao}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(p.id);
                        }}
                        className="p-1 rounded-[2px] text-certifica-500 hover:text-certifica-dark hover:bg-certifica-100 transition-colors duration-150"
                        aria-label={`Ver projeto ${p.codigo}`}
                      >
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

      {/* Staggered fade-in keyframes */}
      <style>{`
        @keyframes fadeInRow {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
