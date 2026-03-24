import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Pipeline, PipelineInsert, PipelineUpdate } from "./database.types";

export type { Pipeline };

const PIPELINES_CHANGED_EVENT = "certifica:pipelines-changed";

function notifyPipelinesChanged() {
  window.dispatchEvent(new Event(PIPELINES_CHANGED_EVENT));
}

export function usePipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("pipelines")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at");

      if (err) throw err;
      setPipelines(data ?? []);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar pipelines");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Reload when another instance changes pipelines
  useEffect(() => {
    const handler = () => { load(); };
    window.addEventListener(PIPELINES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(PIPELINES_CHANGED_EVENT, handler);
  }, [load]);

  const create = useCallback(
    async (data: Omit<PipelineInsert, "user_id">): Promise<Pipeline | null> => {
      const { data: user } = await supabase.auth.getUser();
      const { data: inserted, error: err } = await supabase
        .from("pipelines")
        .insert({ ...data, user_id: user?.user?.id ?? null })
        .select()
        .single();

      if (err) {
        setError(err.message);
        return null;
      }
      setPipelines((prev) => [...prev, inserted]);
      notifyPipelinesChanged();
      return inserted;
    },
    []
  );

  const update = useCallback(
    async (id: string, data: PipelineUpdate): Promise<boolean> => {
      const { error: err } = await supabase
        .from("pipelines")
        .update(data)
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      setPipelines((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data } : p))
      );
      notifyPipelinesChanged();
      return true;
    },
    []
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("pipelines")
        .delete()
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      setPipelines((prev) => prev.filter((p) => p.id !== id));
      notifyPipelinesChanged();
      return true;
    },
    []
  );

  const duplicate = useCallback(
    async (id: string, newName: string): Promise<Pipeline | null> => {
      const source = pipelines.find((p) => p.id === id);
      if (!source) return null;

      const created = await create({
        name: newName,
        description: source.description,
        icon: source.icon,
        is_default: false,
      });
      if (!created) return null;

      // Copiar colunas do pipeline original
      const { data: cols } = await supabase
        .from("pipeline_columns")
        .select("*")
        .eq("pipeline_id", id)
        .order("position");

      if (cols && cols.length > 0) {
        const newCols = cols.map((c) => ({
          pipeline_id: created.id,
          title: c.title,
          position: c.position,
          wip_limit: c.wip_limit,
          color: c.color,
        }));
        await supabase.from("pipeline_columns").insert(newCols);
      }

      return created;
    },
    [pipelines, create]
  );

  return {
    pipelines,
    loading,
    error,
    load,
    create,
    update,
    remove,
    duplicate,
  };
}
