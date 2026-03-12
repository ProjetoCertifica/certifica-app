import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Cliente, ClienteInsert, ClienteUpdate } from "./database.types";

export interface ClienteWithProjetos extends Cliente {
  projetos_count: number;
}

export function useClientes() {
  const [clientes, setClientes] = useState<ClienteWithProjetos[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("clientes")
      .select("*, projetos(id)")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const mapped: ClienteWithProjetos[] = (data ?? []).map((c: any) => ({
      ...c,
      projetos_count: Array.isArray(c.projetos) ? c.projetos.length : 0,
      projetos: undefined,
    }));
    setClientes(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const create = useCallback(async (input: ClienteInsert) => {
    setError(null);
    const { data, error: err } = await supabase
      .from("clientes")
      .insert(input)
      .select()
      .single();
    if (err) { setError(err.message); return null; }
    await fetch();
    return data as Cliente;
  }, [fetch]);

  const update = useCallback(async (id: string, patch: ClienteUpdate) => {
    setError(null);
    const { error: err } = await supabase
      .from("clientes")
      .update(patch)
      .eq("id", id);
    if (err) { setError(err.message); return false; }
    await fetch();
    return true;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    setError(null);
    const { error: err } = await supabase
      .from("clientes")
      .delete()
      .eq("id", id);
    if (err) { setError(err.message); return false; }
    await fetch();
    return true;
  }, [fetch]);

  return { clientes, loading, error, refetch: fetch, create, update, remove };
}
