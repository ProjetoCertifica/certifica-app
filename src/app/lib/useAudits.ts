import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type {
  Audit,
  AuditInsert,
  AuditUpdate,
  AuditFinding,
  AuditFindingInsert,
  AuditFindingUpdate,
  RaiReport,
  RaiReportInsert,
  RaiReportUpdate,
} from "./database.types";

export type { Audit, AuditFinding, RaiReport };
export type { AuditInsert, AuditFindingInsert, RaiReportInsert };

export interface AuditWithDetails extends Audit {
  cliente_nome?: string;
  findings: AuditFinding[];
  rai_report?: RaiReport | null;
}

export function useAudits() {
  const [audits, setAudits] = useState<AuditWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auditData, error: auditErr } = await supabase
        .from("audits")
        .select(`
          *,
          clientes(razao_social),
          audit_findings(*),
          rai_reports(*)
        `)
        .order("created_at", { ascending: false });

      if (auditErr) throw auditErr;

      const mapped: AuditWithDetails[] = (auditData ?? []).map((a: any) => ({
        ...a,
        cliente_nome: a.clientes?.razao_social ?? "",
        findings: a.audit_findings ?? [],
        rai_report: a.rai_reports?.[0] ?? null,
      }));

      setAudits(mapped);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar auditorias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (data: AuditInsert): Promise<AuditWithDetails | null> => {
      const { data: inserted, error: err } = await supabase
        .from("audits")
        .insert(data)
        .select(`*, clientes(razao_social), audit_findings(*), rai_reports(*)`)
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      const mapped: AuditWithDetails = {
        ...inserted,
        cliente_nome: (inserted as any).clientes?.razao_social ?? "",
        findings: [],
        rai_report: null,
      };
      setAudits((prev) => [mapped, ...prev]);
      return mapped;
    },
    []
  );

  const update = useCallback(
    async (id: string, data: AuditUpdate): Promise<boolean> => {
      const { error: err } = await supabase
        .from("audits")
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

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("audits")
        .delete()
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      setAudits((prev) => prev.filter((a) => a.id !== id));
      return true;
    },
    []
  );

  // ── Findings ──────────────────────────────────────────────

  const addFinding = useCallback(
    async (data: AuditFindingInsert): Promise<AuditFinding | null> => {
      const { data: inserted, error: err } = await supabase
        .from("audit_findings")
        .insert(data)
        .select()
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      setAudits((prev) =>
        prev.map((a) =>
          a.id === data.audit_id
            ? { ...a, findings: [...a.findings, inserted] }
            : a
        )
      );
      return inserted;
    },
    []
  );

  const updateFinding = useCallback(
    async (id: string, data: AuditFindingUpdate): Promise<boolean> => {
      const { error: err } = await supabase
        .from("audit_findings")
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

  const removeFinding = useCallback(
    async (id: string, auditId: string): Promise<boolean> => {
      const { error: err } = await supabase
        .from("audit_findings")
        .delete()
        .eq("id", id);

      if (err) {
        setError(err.message);
        return false;
      }
      setAudits((prev) =>
        prev.map((a) =>
          a.id === auditId
            ? { ...a, findings: a.findings.filter((f) => f.id !== id) }
            : a
        )
      );
      return true;
    },
    []
  );

  // ── RAI Reports ────────────────────────────────────────────

  const createRai = useCallback(
    async (data: RaiReportInsert): Promise<RaiReport | null> => {
      const { data: inserted, error: err } = await supabase
        .from("rai_reports")
        .insert(data)
        .select()
        .single();

      if (err) {
        setError(err.message);
        return null;
      }

      setAudits((prev) =>
        prev.map((a) =>
          a.id === data.audit_id ? { ...a, rai_report: inserted } : a
        )
      );
      return inserted;
    },
    []
  );

  const updateRai = useCallback(
    async (id: string, data: RaiReportUpdate): Promise<boolean> => {
      const { error: err } = await supabase
        .from("rai_reports")
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

  return {
    audits,
    loading,
    error,
    load,
    create,
    update,
    remove,
    addFinding,
    updateFinding,
    removeFinding,
    createRai,
    updateRai,
  };
}

// ── Fetch Clientes for dropdown ──────────────────────────────
export async function fetchClientesSimple() {
  const { data } = await supabase
    .from("clientes")
    .select("id, razao_social")
    .eq("status", "ativo")
    .order("razao_social");
  return data ?? [];
}

export async function fetchProjetosSimple() {
  const { data } = await supabase
    .from("projetos")
    .select("id, titulo, codigo, cliente_id")
    .order("titulo");
  return data ?? [];
}
