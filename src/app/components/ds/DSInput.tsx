import React from "react";

interface DSInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helper?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function DSInput({ label, helper, error, icon, className = "", id, ...props }: DSInputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[13px] text-certifica-dark" style={{ fontWeight: 500 }}>
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-certifica-500">{icon}</span>
        )}
        <input
          id={inputId}
          className={`w-full h-9 px-3 bg-white border rounded-[4px] text-[14px] text-certifica-dark placeholder:text-certifica-500/60 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-certifica-700 focus:border-certifica-700 ${
            icon ? "pl-9" : ""
          } ${error ? "border-nao-conformidade focus:ring-nao-conformidade" : "border-certifica-200"} ${className}`}
          style={{ fontWeight: 400, lineHeight: "1.5" }}
          {...props}
        />
      </div>
      {helper && !error && (
        <span className="text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>{helper}</span>
      )}
      {error && (
        <span className="text-[12px] text-nao-conformidade" style={{ fontWeight: 400 }}>{error}</span>
      )}
    </div>
  );
}
