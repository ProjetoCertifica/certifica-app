import React from "react";

interface DSTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helper?: string;
  error?: string;
}

export function DSTextarea({ label, helper, error, className = "", id, ...props }: DSTextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-[13px] text-certifica-dark" style={{ fontWeight: 500 }}>
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`w-full px-3 py-2 bg-white border rounded-[4px] text-[14px] text-certifica-dark placeholder:text-certifica-500/60 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-certifica-700 focus:border-certifica-700 resize-y min-h-[80px] ${
          error ? "border-nao-conformidade focus:ring-nao-conformidade" : "border-certifica-200"
        } ${className}`}
        style={{ fontWeight: 400, lineHeight: "1.5" }}
        {...props}
      />
      {helper && !error && <span className="text-[12px] text-certifica-500">{helper}</span>}
      {error && <span className="text-[12px] text-nao-conformidade">{error}</span>}
    </div>
  );
}
