import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Contato, ContatoInsert, ContatoUpdate } from "./database.types";

export interface ContatoWithEmpresa extends Contato {
  empresa_nome: string;
}

const CONTATOS_CHANGED = "certifica:contatos-changed";
function notifyContatosChanged() { window.dispatchEvent(new Event(CONTATOS_CHANGED)); }

export function useContatos(empresaId?: string) {
  const [contatos, setContatos] = useState<ContatoWithEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = supabase
      .from("contatos")
      .select("*, clientes(nome_fantasia)")
      .order("principal", { ascending: false })
      .order("nome", { ascending: true });

    if (empresaId) {
      query = query.eq("empresa_id", empresaId);
    }

    const { data, error: err } = await query;
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const mapped: ContatoWithEmpresa[] = (data ?? []).map((c: any) => ({
      ...c,
      empresa_nome: c.clientes?.nome_fantasia || "",
      clientes: undefined,
    }));
    setContatos(mapped);
    setLoading(false);
  }, [empresaId]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const handler = () => { fetch(); };
    window.addEventListener(CONTATOS_CHANGED, handler);
    return () => window.removeEventListener(CONTATOS_CHANGED, handler);
  }, [fetch]);

  const create = useCallback(async (input: ContatoInsert) => {
    setError(null);
    const { data, error: err } = await supabase
      .from("contatos")
      .insert(input)
      .select()
      .single();
    if (err) { setError(err.message); return null; }
    await fetch();
    notifyContatosChanged();
    return data as Contato;
  }, [fetch]);

  const update = useCallback(async (id: string, patch: ContatoUpdate) => {
    setError(null);
    const { error: err } = await supabase
      .from("contatos")
      .update(patch)
      .eq("id", id);
    if (err) { setError(err.message); return false; }
    await fetch();
    notifyContatosChanged();
    return true;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    setError(null);
    const { error: err } = await supabase
      .from("contatos")
      .delete()
      .eq("id", id);
    if (err) { setError(err.message); return false; }
    await fetch();
    notifyContatosChanged();
    return true;
  }, [fetch]);

  return { contatos, loading, error, refetch: fetch, create, update, remove };
}

/** Busca contato pelo número de WhatsApp */
export async function findContatoByPhone(phone: string): Promise<ContatoWithEmpresa | null> {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;

  // Try exact match, then with/without 55 prefix
  const variants = [digits];
  if (digits.startsWith("55") && digits.length >= 12) variants.push(digits.slice(2));
  if (!digits.startsWith("55") && digits.length >= 10) variants.push("55" + digits);

  const { data } = await supabase
    .from("contatos")
    .select("*, clientes(nome_fantasia)")
    .in("whatsapp", variants)
    .limit(1);

  if (!data || data.length === 0) return null;
  const c = data[0] as any;
  return { ...c, empresa_nome: c.clientes?.nome_fantasia || "", clientes: undefined };
}
