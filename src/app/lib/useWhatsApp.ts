import { useState, useCallback } from "react";
import {
  getStatus,
  sendText,
  sendMedia,
  sendAudio,
  type EvolutionStatus,
  type EvolutionSendResult,
} from "./evolution";

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
  status: EvolutionStatus | null;
  statusLoading: boolean;
  statusError: string | null;
  configured: boolean;
  sending: boolean;
  sendError: string | null;
  lastResult: EvolutionSendResult | null;
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

  /** Verifica conexão e status do WhatsApp via Evolution API */
  const checkStatus = useCallback(async () => {
    setState((prev) => ({ ...prev, statusLoading: true, statusError: null }));
    try {
      const s = await getStatus();
      setState((prev) => ({
        ...prev,
        status: s,
        configured: true,
        statusLoading: false,
      }));
      return s;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao verificar status";
      setState((prev) => ({
        ...prev,
        status: null,
        configured: false,
        statusLoading: false,
        statusError: msg,
      }));
      return null;
    }
  }, []);

  /** Envia mensagem via Evolution API */
  const send = useCallback(async (opts: WhatsAppSendOptions): Promise<EvolutionSendResult | null> => {
    if (!opts.phone) return null;
    setState((prev) => ({ ...prev, sending: true, sendError: null, lastResult: null }));
    try {
      let result: EvolutionSendResult;
      switch (opts.kind) {
        case "text":
          result = await sendText(opts.phone, opts.message ?? "");
          break;
        case "image":
          result = await sendMedia(opts.phone, opts.fileUrl ?? "", "image", opts.caption);
          break;
        case "document":
          result = await sendMedia(opts.phone, opts.fileUrl ?? "", "document", opts.caption, opts.fileName ?? "documento.pdf");
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
      const msg = err instanceof Error ? err.message : "Erro ao enviar mensagem";
      setState((prev) => ({ ...prev, sending: false, sendError: msg }));
      return null;
    }
  }, []);

  return { ...state, checkStatus, send };
}
