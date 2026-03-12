import { useCallback } from "react";
import { supabase } from "./supabase";

interface LogParams {
  tabela: string;
  registro_id: string;
  acao: "INSERT" | "UPDATE" | "DELETE";
  dados_antes?: unknown;
  dados_depois?: unknown;
}

export function useAuditLog() {
  const log = useCallback(async (params: LogParams) => {
    try {
      await supabase.from("audit_logs").insert({
        tabela: params.tabela,
        registro_id: params.registro_id,
        acao: params.acao,
        dados_antes: params.dados_antes ?? null,
        dados_depois: params.dados_depois ?? null,
        usuario_id: null,
        ip: null,
      });
    } catch {
      // silently fail — audit logs should never break the main flow
    }
  }, []);

  return { log };
}
