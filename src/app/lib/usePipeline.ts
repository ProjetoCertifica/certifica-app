import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type {
  PipelineColumn,
  PipelineColumnInsert,
  PipelineCard,
  PipelineCardInsert,
  PipelineCardUpdate,
} from "./database.types";

export type { PipelineColumn, PipelineCard };

export interface ColumnWithCards extends PipelineColumn {
  cards: PipelineCard[];
}

export function usePipeline() {
  const [columns, setColumns] = useState<ColumnWithCards[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: cols, error: colErr } = await supabase
        .from("pipeline_columns")
        .select("*")
        .order("position");

      if (colErr) throw colErr;

      const { data: cards, error: cardErr } = await supabase
        .from("pipeline_cards")
        .select("*")
        .order("position");

      if (cardErr) throw cardErr;

      const mapped: ColumnWithCards[] = (cols ?? []).map((col) => ({
        ...col,
        cards: (cards ?? []).filter((c) => c.column_id === col.id),
      }));

      setColumns(mapped);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar pipeline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createColumn = useCallback(
    async (data: PipelineColumnInsert): Promise<PipelineColumn | null> => {
      const { data: inserted, error: err } = await supabase
        .from("pipeline_columns")
        .insert(data)
        .select()
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      const withCards: ColumnWithCards = { ...inserted, cards: [] };
      setColumns((prev) => [...prev, withCards].sort((a, b) => a.position - b.position));
      return inserted;
    },
    []
  );

  const updateColumn = useCallback(
    async (id: string, data: { title?: string; color?: string; wip_limit?: number }): Promise<boolean> => {
      const { error: err } = await supabase
        .from("pipeline_columns")
        .update(data)
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }

      setColumns((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...data } : c))
      );
      return true;
    },
    []
  );

  const createCard = useCallback(
    async (data: PipelineCardInsert): Promise<PipelineCard | null> => {
      const { data: inserted, error: err } = await supabase
        .from("pipeline_cards")
        .insert(data)
        .select()
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      setColumns((prev) =>
        prev.map((col) =>
          col.id === data.column_id
            ? { ...col, cards: [...col.cards, inserted] }
            : col
        )
      );
      return inserted;
    },
    []
  );

  const moveCard = useCallback(
    async (cardId: string, fromColumnId: string, toColumnId: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("pipeline_cards")
        .update({ column_id: toColumnId })
        .eq("id", cardId);

      if (err) {
        setError(err.message);
        return false;
      }

      setColumns((prev) => {
        let movedCard: PipelineCard | undefined;
        const updated = prev.map((col) => {
          if (col.id === fromColumnId) {
            const filtered = col.cards.filter((c) => {
              if (c.id === cardId) {
                movedCard = c;
                return false;
              }
              return true;
            });
            return { ...col, cards: filtered };
          }
          return col;
        });
        if (!movedCard) return prev;
        return updated.map((col) =>
          col.id === toColumnId
            ? { ...col, cards: [...col.cards, { ...movedCard!, column_id: toColumnId }] }
            : col
        );
      });
      return true;
    },
    []
  );

  const updateCard = useCallback(
    async (id: string, data: PipelineCardUpdate): Promise<boolean> => {
      const { error: err } = await supabase
        .from("pipeline_cards")
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

  const removeCard = useCallback(
    async (id: string, columnId: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("pipeline_cards")
        .delete()
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      setColumns((prev) =>
        prev.map((col) =>
          col.id === columnId
            ? { ...col, cards: col.cards.filter((c) => c.id !== id) }
            : col
        )
      );
      return true;
    },
    []
  );

  const removeColumn = useCallback(
    async (id: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("pipeline_columns")
        .delete()
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      setColumns((prev) => prev.filter((col) => col.id !== id));
      return true;
    },
    []
  );

  const allCards = columns.flatMap((col) => col.cards);

  return {
    columns,
    allCards,
    loading,
    error,
    load,
    createColumn,
    updateColumn,
    createCard,
    moveCard,
    updateCard,
    removeCard,
    removeColumn,
  };
}
