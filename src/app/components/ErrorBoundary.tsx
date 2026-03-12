import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <h3
            className="text-[14px] text-certifica-dark mb-2"
            style={{ fontWeight: 600 }}
          >
            Algo deu errado
          </h3>
          <p className="text-[12px] text-certifica-500/60 max-w-md mb-4">
            {this.props.fallbackMessage || "Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte."}
          </p>
          {this.state.error && (
            <p className="text-[10px] text-certifica-500/40 bg-certifica-50 px-3 py-1.5 rounded mb-4 max-w-md truncate">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-certifica-accent text-white text-[12px] rounded-md hover:bg-certifica-accent-dark transition-colors cursor-pointer"
            style={{ fontWeight: 500 }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function APIFallback({
  error,
  onRetry,
  message,
}: {
  error: string | null;
  onRetry?: () => void;
  message?: string;
}) {
  if (!error) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg mx-4 mt-4">
      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] text-amber-800" style={{ fontWeight: 500 }}>
          {message || "Falha ao conectar com o servidor"}
        </p>
        <p className="text-[11px] text-amber-600/80 mt-0.5">{error}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] rounded-md transition-colors flex-shrink-0 cursor-pointer"
          style={{ fontWeight: 500 }}
        >
          <RefreshCw className="w-3 h-3" />
          Tentar novamente
        </button>
      )}
    </div>
  );
}
