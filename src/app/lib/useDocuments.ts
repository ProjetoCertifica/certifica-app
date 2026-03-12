import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Document, DocumentInsert, DocumentUpdate } from "./database.types";

export type { Document, DocumentInsert, DocumentUpdate };

export interface DocumentWithRelations extends Document {
  cliente_nome?: string;
  projeto_titulo?: string;
}

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("documents")
        .select(`
          *,
          clientes(razao_social),
          projetos(titulo, norma)
        `)
        .order("updated_at", { ascending: false });

      if (err) throw err;

      const mapped: DocumentWithRelations[] = (data ?? []).map((d: any) => ({
        ...d,
        cliente_nome: d.clientes?.razao_social ?? "",
        projeto_titulo: d.projetos?.titulo ?? d.projetos?.norma ?? "",
      }));

      setDocuments(mapped);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar documentos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (data: DocumentInsert): Promise<DocumentWithRelations | null> => {
      const { data: inserted, error: err } = await supabase
        .from("documents")
        .insert(data)
        .select(`*, clientes(razao_social), projetos(titulo, norma)`)
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      const mapped: DocumentWithRelations = {
        ...inserted,
        cliente_nome: (inserted as any).clientes?.razao_social ?? "",
        projeto_titulo:
          (inserted as any).projetos?.titulo ??
          (inserted as any).projetos?.norma ??
          "",
      };
      setDocuments((prev) => [mapped, ...prev]);
      return mapped;
    },
    []
  );

  const update = useCallback(
    async (id: string, data: DocumentUpdate): Promise<boolean> => {
      const { error: err } = await supabase
        .from("documents")
        .update(data)
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      await load();
      return true;
    },
    [load]
  );

  const approve = useCallback(
    async (id: string, aprovadoPor: string): Promise<boolean> => {
      return update(id, {
        status: "aprovado",
        aprovado_por: aprovadoPor,
      });
    },
    [update]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("documents")
        .delete()
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      return true;
    },
    []
  );

  const uploadFile = useCallback(
    async (file: File, path: string): Promise<{ url: string | null; errorMsg: string | null }> => {
      const { error: err } = await supabase.storage
        .from("Certifica Arquivos")
        .upload(path, file, { upsert: true });

      if (err) {
        console.error("[Storage upload error]", err);
        setError(err.message);
        return { url: null, errorMsg: err.message };
      }

      const { data } = supabase.storage
        .from("Certifica Arquivos")
        .getPublicUrl(path);

      return { url: data.publicUrl, errorMsg: null };
    },
    []
  );

  return { documents, loading, error, load, create, update, approve, remove, uploadFile };
}
