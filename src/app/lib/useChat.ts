import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

export interface ChatConversation {
  id: string;
  titulo: string;
  cliente_id: string | null;
  projeto_id: string | null;
  participantes: string[];
  status: "ativo" | "arquivado";
  ultima_mensagem: string;
  ultima_mensagem_at: string | null;
  created_at: string;
  updated_at: string;
  cliente_nome?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  autor: string;
  conteudo: string;
  tipo: "mensagem" | "evidencia" | "urgente" | "bloqueio" | "duvida";
  classificacao: "geral" | "duvida" | "evidencia" | "urgencia" | "bloqueio";
  arquivo_url: string | null;
  arquivo_nome: string | null;
  lida: boolean;
  created_at: string;
}

export function useChat() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("chat_conversations")
        .select(`*, clientes(razao_social)`)
        .eq("status", "ativo")
        .order("ultima_mensagem_at", { ascending: false, nullsFirst: false });

      if (err) throw err;

      const mapped: ChatConversation[] = (data ?? []).map((c: any) => ({
        ...c,
        cliente_nome: c.clientes?.razao_social ?? "",
      }));

      setConversations(mapped);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar conversas");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error: err } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (err) {
      setError(err.message);
      return;
    }

    setMessages((prev) => ({
      ...prev,
      [conversationId]: data ?? [],
    }));

    // Mark messages as read
    await supabase
      .from("chat_messages")
      .update({ lida: true })
      .eq("conversation_id", conversationId)
      .eq("lida", false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Supabase Realtime subscription for new messages
  const subscribeToConversation = useCallback((conversationId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => ({
            ...prev,
            [conversationId]: [...(prev[conversationId] ?? []), newMsg],
          }));
          // Update conversation preview
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    ultima_mensagem: newMsg.conteudo,
                    ultima_mensagem_at: newMsg.created_at,
                  }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const sendMessage = useCallback(
    async (
      conversationId: string,
      autor: string,
      conteudo: string,
      classificacao: ChatMessage["classificacao"] = "geral"
    ): Promise<ChatMessage | null> => {
      const tipo: ChatMessage["tipo"] =
        classificacao === "urgencia"
          ? "urgente"
          : classificacao === "evidencia"
          ? "evidencia"
          : classificacao === "bloqueio"
          ? "bloqueio"
          : classificacao === "duvida"
          ? "duvida"
          : "mensagem";

      const { data: inserted, error: err } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          autor,
          conteudo,
          tipo,
          classificacao,
          lida: false,
        })
        .select()
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      // Update conversation ultima_mensagem
      await supabase
        .from("chat_conversations")
        .update({
          ultima_mensagem: conteudo,
          ultima_mensagem_at: inserted.created_at,
        })
        .eq("id", conversationId);

      return inserted;
    },
    []
  );

  const createConversation = useCallback(
    async (data: {
      titulo: string;
      cliente_id?: string | null;
      projeto_id?: string | null;
      participantes: string[];
    }): Promise<ChatConversation | null> => {
      const { data: inserted, error: err } = await supabase
        .from("chat_conversations")
        .insert({
          ...data,
          status: "ativo",
          ultima_mensagem: "",
        })
        .select(`*, clientes(razao_social)`)
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      const mapped: ChatConversation = {
        ...inserted,
        cliente_nome: (inserted as any).clientes?.razao_social ?? "",
      };
      setConversations((prev) => [mapped, ...prev]);
      return mapped;
    },
    []
  );

  const archiveConversation = useCallback(
    async (id: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("chat_conversations")
        .update({ status: "arquivado" })
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      setConversations((prev) => prev.filter((c) => c.id !== id));
      return true;
    },
    []
  );

  const unreadCount = useCallback(
    (conversationId: string): number => {
      return (messages[conversationId] ?? []).filter((m) => !m.lida).length;
    },
    [messages]
  );

  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  return {
    conversations,
    messages,
    loading,
    error,
    loadConversations,
    loadMessages,
    subscribeToConversation,
    sendMessage,
    createConversation,
    archiveConversation,
    unreadCount,
  };
}

// Classify message by content (heuristic AI)
export function classifyMessage(text: string): ChatMessage["classificacao"] {
  const t = text.toLowerCase();
  if (/urgente|urgência|crítico|emergência|bloqueado/.test(t)) return "urgencia";
  if (/bloqueio|impedimento|não consigo|problema grave/.test(t)) return "bloqueio";
  if (/evidência|documento|certificado|registro|anexo|arquivo/.test(t)) return "evidencia";
  if (/dúvida|pergunta|como|quando|por que|qual/.test(t)) return "duvida";
  return "geral";
}

export function aiSuggestion(classificacao: ChatMessage["classificacao"]): string {
  switch (classificacao) {
    case "urgencia":
      return "Esta mensagem é urgente. Sugiro priorizar e responder em até 2 horas.";
    case "bloqueio":
      return "Há um bloqueio reportado. Verifique o impedimento e proponha solução.";
    case "evidencia":
      return "Evidência recebida. Verifique e classifique no RAI correspondente.";
    case "duvida":
      return "Dúvida técnica. Responda com referência à norma aplicável.";
    default:
      return "Mensagem geral. Responda conforme contexto do projeto.";
  }
}
