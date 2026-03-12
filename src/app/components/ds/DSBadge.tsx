import React from "react";

type BadgeVariant = "conformidade" | "nao-conformidade" | "observacao" | "oportunidade" | "default" | "outline";

interface DSBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  conformidade: "bg-conformidade/10 text-conformidade border border-conformidade/20",
  "nao-conformidade": "bg-nao-conformidade/10 text-nao-conformidade border border-nao-conformidade/20",
  observacao: "bg-observacao/10 text-observacao border border-observacao/20",
  oportunidade: "bg-oportunidade/10 text-oportunidade border border-oportunidade/20",
  default: "bg-certifica-accent text-white border border-certifica-accent",
  outline: "bg-transparent text-certifica-dark border border-certifica-200",
};

export function DSBadge({ variant = "default", children, className = "" }: DSBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-[2px] text-[11px] tracking-[0.04em] uppercase ${variantStyles[variant]} ${className}`}
      style={{ fontWeight: 600, lineHeight: "1.5" }}
    >
      {children}
    </span>
  );
}