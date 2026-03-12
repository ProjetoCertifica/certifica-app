import { useState, useCallback, useRef } from "react";
import { supabase } from "./supabase";

export interface SearchResult {
  id: string;
  type: "cliente" | "projeto" | "documento" | "auditoria" | "treinamento" | "norma";
  title: string;
  subtitle: string;
  path: string;
}

export function useGlobalSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((term: string) => {
    setQuery(term);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (term.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const pattern = `%${term.trim()}%`;
        const items: SearchResult[] = [];

        const [clientes, projetos, documentos, auditorias, treinamentos] =
          await Promise.allSettled([
            supabase
              .from("clientes")
              .select("id, razao_social, nome_fantasia, segmento")
              .or(`razao_social.ilike.${pattern},nome_fantasia.ilike.${pattern}`)
              .limit(5),
            supabase
              .from("projetos")
              .select("id, codigo, titulo, norma")
              .or(`titulo.ilike.${pattern},codigo.ilike.${pattern},norma.ilike.${pattern}`)
              .limit(5),
            supabase
              .from("documents")
              .select("id, titulo, tipo_documento, cliente_id")
              .or(`titulo.ilike.${pattern},tipo_documento.ilike.${pattern}`)
              .limit(5),
            supabase
              .from("audits")
              .select("id, titulo, norma, tipo")
              .or(`titulo.ilike.${pattern},norma.ilike.${pattern}`)
              .limit(5),
            supabase
              .from("trainings")
              .select("id, titulo, norma, instrutor")
              .or(`titulo.ilike.${pattern},norma.ilike.${pattern}`)
              .limit(5),
          ]);

        if (clientes.status === "fulfilled" && clientes.value.data) {
          for (const c of clientes.value.data) {
            items.push({
              id: c.id,
              type: "cliente",
              title: c.nome_fantasia || c.razao_social,
              subtitle: c.segmento || "Cliente",
              path: "/clientes",
            });
          }
        }

        if (projetos.status === "fulfilled" && projetos.value.data) {
          for (const p of projetos.value.data) {
            items.push({
              id: p.id,
              type: "projeto",
              title: `${p.codigo} — ${p.titulo}`,
              subtitle: p.norma || "Projeto",
              path: "/projetos",
            });
          }
        }

        if (documentos.status === "fulfilled" && documentos.value.data) {
          for (const d of documentos.value.data) {
            items.push({
              id: d.id,
              type: "documento",
              title: d.titulo,
              subtitle: d.tipo_documento || "Documento",
              path: "/documentos",
            });
          }
        }

        if (auditorias.status === "fulfilled" && auditorias.value.data) {
          for (const a of auditorias.value.data) {
            items.push({
              id: a.id,
              type: "auditoria",
              title: a.titulo,
              subtitle: `${a.tipo} — ${a.norma}`,
              path: "/auditorias",
            });
          }
        }

        if (treinamentos.status === "fulfilled" && treinamentos.value.data) {
          for (const t of treinamentos.value.data) {
            items.push({
              id: t.id,
              type: "treinamento",
              title: t.titulo,
              subtitle: t.norma || "Treinamento",
              path: "/treinamentos",
            });
          }
        }

        setResults(items);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clear = useCallback(() => {
    setQuery("");
    setResults([]);
    setLoading(false);
  }, []);

  return { query, results, loading, search, clear };
}
