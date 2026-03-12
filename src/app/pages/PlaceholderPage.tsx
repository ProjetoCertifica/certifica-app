import React from "react";
import { useLocation, useNavigate } from "react-router";
import { AlertTriangle, ArrowLeft, Home } from "lucide-react";
import { DSButton } from "../components/ds/DSButton";

export default function PlaceholderPage() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full px-5 py-16">
      <div className="w-16 h-16 rounded-2xl bg-certifica-accent-light flex items-center justify-center mb-6">
        <AlertTriangle className="w-8 h-8 text-certifica-accent" strokeWidth={1.5} />
      </div>
      <h2 className="text-certifica-900 mb-2 text-center">Página não encontrada</h2>
      <p className="text-[13px] text-certifica-500 text-center max-w-[400px] mb-8" style={{ fontWeight: 400 }}>
        O caminho <code className="px-1.5 py-0.5 bg-certifica-100 rounded text-[12px] font-mono text-certifica-700">{location.pathname}</code> não existe ou ainda está em desenvolvimento.
      </p>
      <div className="flex items-center gap-3">
        <DSButton
          variant="outline"
          size="sm"
          icon={<ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />}
          onClick={() => navigate(-1)}
        >
          Voltar
        </DSButton>
        <DSButton
          variant="primary"
          size="sm"
          icon={<Home className="w-3.5 h-3.5" strokeWidth={1.5} />}
          onClick={() => navigate("/")}
        >
          Dashboard
        </DSButton>
      </div>
    </div>
  );
}
