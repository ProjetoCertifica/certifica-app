import React from "react";

interface DSCardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  hover?: boolean;
  onClick?: () => void;
}

export function DSCard({ children, className = "", header, footer, hover = false, onClick }: DSCardProps) {
  return (
    <div
      className={`bg-white border border-certifica-200 rounded-[4px] overflow-hidden ${hover ? "certifica-card-hover" : ""} ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      {header && (
        <div className="px-5 py-3.5 border-b border-certifica-200 bg-certifica-50/50">
          {header}
        </div>
      )}
      <div className="px-5 py-4">
        {children}
      </div>
      {footer && (
        <div className="px-5 py-3 border-t border-certifica-200 bg-certifica-50/30">
          {footer}
        </div>
      )}
    </div>
  );
}
