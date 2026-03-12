import React from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
type ButtonSize = "sm" | "md" | "lg";

interface DSButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-certifica-accent text-white hover:bg-certifica-accent-dark active:bg-certifica-900 border border-certifica-accent shadow-sm shadow-certifica-accent/20",
  secondary: "bg-certifica-100 text-certifica-dark hover:bg-certifica-200 border border-certifica-200",
  ghost: "bg-transparent text-certifica-dark hover:bg-certifica-100 border border-transparent",
  destructive: "bg-nao-conformidade text-white hover:bg-nao-conformidade/90 border border-nao-conformidade shadow-sm shadow-nao-conformidade/15",
  outline: "bg-white text-certifica-dark hover:bg-certifica-50 border border-certifica-200 hover:border-certifica-500/30",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12px] gap-1.5",
  md: "h-9 px-4 text-[13px] gap-2",
  lg: "h-10 px-5 text-[14px] gap-2",
};

const loaderSizes: Record<ButtonSize, string> = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
  lg: "w-4 h-4",
};

export function DSButton({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: DSButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <button
      className={`inline-flex items-center justify-center rounded-[4px] transition-all duration-150 cursor-pointer whitespace-nowrap ${variantStyles[variant]} ${sizeStyles[size]} ${isDisabled ? "opacity-55 pointer-events-none" : ""} ${className}`}
      style={{ fontWeight: 500 }}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Loader2 className={`${loaderSizes[size]} animate-spin`} strokeWidth={2} />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}