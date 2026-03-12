import React from "react";
import { ChevronDown } from "lucide-react";

interface DSSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helper?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function DSSelect({ label, helper, error, options, className = "", id, ...props }: DSSelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-[13px] text-certifica-dark" style={{ fontWeight: 500 }}>
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={`w-full h-9 px-3 pr-8 bg-white border rounded-[4px] text-[14px] text-certifica-dark appearance-none transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-certifica-700 focus:border-certifica-700 ${
            error ? "border-nao-conformidade" : "border-certifica-200"
          } ${className}`}
          style={{ fontWeight: 400, lineHeight: "1.5" }}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-certifica-500 pointer-events-none" strokeWidth={1.5} />
      </div>
      {helper && !error && <span className="text-[12px] text-certifica-500">{helper}</span>}
      {error && <span className="text-[12px] text-nao-conformidade">{error}</span>}
    </div>
  );
}
