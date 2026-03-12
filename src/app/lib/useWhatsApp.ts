import { useState, useCallback } from "react";
import {
  getZApiStatus,
  sendText,
  sendImage,
  sendDocument,
  sendAudio,
  ZApiNotConfiguredError,
  type ZApiStatus,
  type ZApiSendResult,
} from "./zapi";

export type WhatsAppSendKind = "text" | "image" | "document" | "audio";

export interface WhatsAppSendOptions {
  phone: string;
  kind: WhatsAppSendKind;
  message?: string;
  fileUrl?: string;
  fileName?: string;
  caption?: string;
}

export interface WhatsAppState {
  status: ZApiStatus | null;
  statusLoading: boolean;
  statusError: string | null;
  configured: boolean;
  sending: boolean;
  sendError: string | null;
  lastResult: ZApiSendResult | null;
}

export function useWhatsApp() {
  const [state, setState] = useState<WhatsAppState>({
    status: null,
    statusLoading: false,
    statusError: null,
    configured: false,
    sending: false,
    sendError: null,
    lastResult: null,
  });

  /** Verifica conexão e status do WhatsApp */
  const checkStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, statusLoading: true, statusError: null }));
    try {
      const s = await getZApiStatus();
      setState((prev) => ({
        ...prev,
        status: s,
        configured: true,
        statusLoading: false,
      }));
      return s;
    } catch (err) {
      const isNotConfigured = err instanceof ZApiNotConfiguredError;
      const msg = err instanceof Error ? err.message : "Erro ao verificar status";
      setState((prev) => ({
        ...prev,
        status: null,
        configured: !isNotConfigured,
        statusLoading: false,
        statusError: isNotConfigured ? null : msg,
      }));
      return null;
    }
  }, []);

  /** Envia mensagem via WhatsApp */
  const send = useCallback(async (opts: WhatsAppSendOptions): Promise<ZApiSendResult | null> => {
    if (!opts.phone) return null;
    setState((prev) => ({ ...prev, sending: true, sendError: null, lastResult: null }));
    try {
      let result: ZApiSendResult;
      switch (opts.kind) {
        case "text":
          result = await sendText(opts.phone, opts.message ?? "");
          break;
        case "image":
          result = await sendImage(opts.phone, opts.fileUrl ?? "", opts.caption);
          break;
        case "document":
          result = await sendDocument(opts.phone, opts.fileUrl ?? "", opts.fileName ?? "documento.pdf", opts.caption);
          break;
        case "audio":
          result = await sendAudio(opts.phone, opts.fileUrl ?? "");
          break;
        default:
          throw new Error("Tipo de mensagem inválido");
      }
      setState((prev) => ({ ...prev, sending: false, lastResult: result }));
      return result;
    } catch (err) {
      const isNotConfigured = err instanceof ZApiNotConfiguredError;
      const msg = isNotConfigured
        ? "Z-API não configurado. Configure as credenciais em Configurações → Integrações."
        : (err instanceof Error ? err.message : "Erro ao enviar mensagem");
      setState((prev) => ({ ...prev, sending: false, sendError: msg }));
      return null;
    }
  }, []);

  return { ...state, checkStatus, send };
}
