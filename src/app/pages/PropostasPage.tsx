import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DSCard } from "../components/ds/DSCard";
import { DSButton } from "../components/ds/DSButton";
import { DSBadge } from "../components/ds/DSBadge";
import { DSInput } from "../components/ds/DSInput";
import { DSSelect } from "../components/ds/DSSelect";
import { DSTextarea } from "../components/ds/DSTextarea";
import {
  FileText,
  Plus,
  Eye,
  RefreshCw,
  X,
  Trash2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { parseValorBR } from "../lib/useFinanceiro";
import PropostaPreview, { type PropostaData } from "../components/propostas/PropostaPreview";
import { toast } from "sonner";

/* ── types ── */

interface ProjetoComCliente {
  id: string;
  codigo: string;
  titulo: string;
  norma: string;
  escopo: string;
  valor: string;
  condicoes_pagamento: string;
  consultor: string;
  status: string;
  previsao: string;
  inicio: string;
  cliente_id: string;
  /* joined */
  cliente_nome: string;
  cliente_razao: string;
  cliente_cnpj: string;
  cliente_endereco: string;
  cliente_cidade: string;
  cliente_uf: string;
  cliente_contato_nome: string;
  cliente_contato_cargo: string;
  cliente_contato_email: string;
  cliente_contato_telefone: string;
}

interface PropostaForm {
  projetoId: string;
  numero: string;
  titulo: string;
  norma: string;
  escopo: string;
  diasEstimados: number;
  valorTotal: number;
  parcelas: number;
  condicoes: string;
  validadeDias: number;
  consultor: string;
  observacoes: string;
  etapas: string[];
}

const ETAPAS_DEFAULT = [
  "Diagnostico inicial e gap analysis",
  "Elaboracao da documentacao do sistema de gestao",
  "Implementacao e treinamento da equipe",
  "Auditoria interna",
  "Analise critica e acoes corretivas",
  "Acompanhamento da auditoria de certificacao",
];

const emptyForm: PropostaForm = {
  projetoId: "",
  numero: "",
  titulo: "",
  norma: "",
  escopo: "",
  diasEstimados: 90,
  valorTotal: 0,
  parcelas: 1,
  condicoes: "",
  validadeDias: 15,
  consultor: "",
  observacoes: "",
  etapas: [...ETAPAS_DEFAULT],
};

function currency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ── page ── */

export default function PropostasPage() {
  const [projetos, setProjetos] = useState<ProjetoComCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PropostaForm>({ ...emptyForm });
  const [preview, setPreview] = useState<PropostaData | null>(null);

  /* next proposal number */
  const nextNumero = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const seq = String(projetos.length + 1).padStart(3, "0");
    return `PROP-${y}${m}-${seq}`;
  }, [projetos.length]);

  /* fetch projects (all statuses, to allow generating proposals for any) */
  const fetchProjetos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("projetos")
        .select("id, codigo, titulo, norma, escopo, valor, condicoes_pagamento, consultor, status, previsao, inicio, cliente_id, clientes(nome_fantasia, razao_social, cnpj, endereco, cidade, uf, contato_nome, contato_cargo, contato_email, contato_telefone)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setProjetos(
        (data ?? []).map((p: any) => ({
          id: p.id,
          codigo: p.codigo,
          titulo: p.titulo,
          norma: p.norma ?? "",
          escopo: p.escopo ?? "",
          valor: p.valor ?? "",
          condicoes_pagamento: p.condicoes_pagamento ?? "",
          consultor: p.consultor ?? "",
          status: p.status,
          previsao: p.previsao ?? "",
          inicio: p.inicio ?? "",
          cliente_id: p.cliente_id,
          cliente_nome: p.clientes?.nome_fantasia ?? "",
          cliente_razao: p.clientes?.razao_social ?? "",
          cliente_cnpj: p.clientes?.cnpj ?? "",
          cliente_endereco: p.clientes?.endereco ?? "",
          cliente_cidade: p.clientes?.cidade ?? "",
          cliente_uf: p.clientes?.uf ?? "",
          cliente_contato_nome: p.clientes?.contato_nome ?? "",
          cliente_contato_cargo: p.clientes?.contato_cargo ?? "",
          cliente_contato_email: p.clientes?.contato_email ?? "",
          cliente_contato_telefone: p.clientes?.contato_telefone ?? "",
        }))
      );
    } catch (e) {
      console.error("[PropostasPage] Erro:", e);
      toast.error("Erro ao carregar projetos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjetos(); }, [fetchProjetos]);

  /* Projetos em status proposta (prioritários) */
  const projetosPropostas = useMemo(
    () => projetos.filter((p) => p.status === "proposta"),
    [projetos]
  );

  /* Fill form from project */
  const handleSelectProjeto = useCallback(
    (projetoId: string) => {
      const p = projetos.find((x) => x.id === projetoId);
      if (!p) return;

      const valor = parseValorBR(p.valor);
      const diasMatch = p.previsao && p.inicio
        ? Math.max(1, Math.round((new Date(p.previsao).getTime() - new Date(p.inicio).getTime()) / 86400000))
        : 90;

      setForm((f) => ({
        ...f,
        projetoId,
        numero: nextNumero,
        titulo: `${p.codigo} — ${p.titulo}`,
        norma: p.norma,
        escopo: p.escopo,
        diasEstimados: diasMatch,
        valorTotal: valor,
        parcelas: 1,
        condicoes: p.condicoes_pagamento,
        consultor: p.consultor,
        observacoes: "",
        etapas: [...ETAPAS_DEFAULT],
      }));
    },
    [projetos, nextNumero]
  );

  /* Open form for new proposal */
  const handleNew = useCallback(
    (projetoId?: string) => {
      setForm({ ...emptyForm, numero: nextNumero });
      if (projetoId) handleSelectProjeto(projetoId);
      setShowForm(true);
    },
    [nextNumero, handleSelectProjeto]
  );

  /* Generate preview data */
  const handlePreview = useCallback(() => {
    if (!form.titulo) {
      toast.error("Selecione um projeto e preencha os campos.");
      return;
    }

    const p = projetos.find((x) => x.id === form.projetoId);
    const now = new Date();
    const validade = new Date(now.getTime() + form.validadeDias * 86400000);

    const data: PropostaData = {
      numero: form.numero || nextNumero,
      data: now.toISOString().split("T")[0],
      validade: validade.toISOString().split("T")[0],
      clienteNome: p?.cliente_nome ?? "",
      clienteRazaoSocial: p?.cliente_razao ?? "",
      clienteCnpj: p?.cliente_cnpj ?? "",
      clienteEndereco: p?.cliente_endereco ?? "",
      clienteCidade: p?.cliente_cidade ?? "",
      clienteUf: p?.cliente_uf ?? "",
      clienteContato: p?.cliente_contato_nome ?? "",
      clienteContatoCargo: p?.cliente_contato_cargo ?? "",
      clienteContatoEmail: p?.cliente_contato_email ?? "",
      clienteContatoTelefone: p?.cliente_contato_telefone ?? "",
      titulo: form.titulo,
      norma: form.norma,
      escopo: form.escopo,
      diasEstimados: form.diasEstimados,
      etapas: form.etapas.filter(Boolean),
      valorTotal: form.valorTotal,
      parcelas: form.parcelas,
      valorParcela: form.parcelas > 0 ? Math.round((form.valorTotal / form.parcelas) * 100) / 100 : form.valorTotal,
      condicoes: form.condicoes,
      consultor: form.consultor,
      observacoes: form.observacoes,
    };

    setPreview(data);
  }, [form, projetos, nextNumero]);

  /* Etapa helpers */
  const addEtapa = () => setForm((f) => ({ ...f, etapas: [...f.etapas, ""] }));
  const removeEtapa = (idx: number) => setForm((f) => ({ ...f, etapas: f.etapas.filter((_, i) => i !== idx) }));
  const updateEtapa = (idx: number, value: string) =>
    setForm((f) => ({ ...f, etapas: f.etapas.map((e, i) => (i === idx ? value : e)) }));

  const updateField = <K extends keyof PropostaForm>(key: K, value: PropostaForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /* loading */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-5 h-5 text-certifica-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-certifica-900" style={{ letterSpacing: "-0.02em" }}>Propostas</h2>
          <p className="text-[12px] text-certifica-500 mt-0.5">Gere propostas comerciais a partir dos projetos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchProjetos}
            className="h-7 w-7 flex items-center justify-center rounded-[4px] border border-certifica-200 text-certifica-500/60 hover:text-certifica-700 hover:border-certifica-400 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <DSButton variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={() => handleNew()}>
            Nova Proposta
          </DSButton>
        </div>
      </div>

      {/* Projects with proposta status */}
      <DSCard
        header={
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-certifica-accent" strokeWidth={1.5} />
            <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>
              Projetos em fase de proposta ({projetosPropostas.length})
            </span>
          </div>
        }
      >
        {projetosPropostas.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-certifica-500">
            Nenhum projeto em fase de proposta. Crie um projeto com status "Proposta" para gerar propostas.
          </div>
        ) : (
          <div className="divide-y divide-certifica-200">
            {projetosPropostas.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2.5 px-1">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono text-certifica-700" style={{ fontWeight: 500 }}>{p.codigo}</span>
                    <span className="text-[12px] text-certifica-900" style={{ fontWeight: 500 }}>{p.titulo}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-certifica-500">{p.cliente_nome}</span>
                    <span className="text-[11px] text-certifica-400">{p.norma}</span>
                    <span className="text-[11px] font-mono text-certifica-500">{p.valor ? currency(parseValorBR(p.valor)) : "—"}</span>
                    <span className="text-[11px] text-certifica-400">{p.consultor}</span>
                  </div>
                </div>
                <DSButton variant="outline" size="sm" icon={<FileText className="w-3 h-3" strokeWidth={1.5} />} onClick={() => handleNew(p.id)}>
                  Gerar
                </DSButton>
              </div>
            ))}
          </div>
        )}
      </DSCard>

      {/* All other projects */}
      {projetos.filter((p) => p.status !== "proposta").length > 0 && (
        <DSCard
          header={
            <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>
              Outros projetos
            </span>
          }
        >
          <div className="divide-y divide-certifica-200">
            {projetos
              .filter((p) => p.status !== "proposta")
              .slice(0, 10)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2 px-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-certifica-500">{p.codigo}</span>
                      <span className="text-[12px] text-certifica-700">{p.titulo}</span>
                      <DSBadge variant={p.status === "em-andamento" ? "observacao" : p.status === "concluido" ? "conformidade" : "outline"}>
                        {p.status}
                      </DSBadge>
                    </div>
                    <span className="text-[10px] text-certifica-400">{p.cliente_nome}</span>
                  </div>
                  <button
                    onClick={() => handleNew(p.id)}
                    className="text-[10px] text-certifica-accent hover:underline cursor-pointer"
                  >
                    Gerar proposta
                  </button>
                </div>
              ))}
          </div>
        </DSCard>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-certifica-dark/45" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-[680px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-[15px] text-certifica-900" style={{ fontWeight: 600 }}>Configurar Proposta</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Projeto selector */}
              <DSSelect
                label="Projeto base"
                value={form.projetoId}
                onChange={(e) => handleSelectProjeto(e.target.value)}
                options={[
                  { value: "", label: "Selecione um projeto..." },
                  ...projetos.map((p) => ({ value: p.id, label: `${p.codigo} — ${p.titulo} (${p.cliente_nome})` })),
                ]}
              />

              <div className="grid grid-cols-2 gap-3">
                <DSInput label="N. da Proposta" value={form.numero} onChange={(e) => updateField("numero", e.target.value)} />
                <DSInput label="Titulo" value={form.titulo} onChange={(e) => updateField("titulo", e.target.value)} />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <DSInput label="Norma" value={form.norma} onChange={(e) => updateField("norma", e.target.value)} placeholder="ISO 9001:2015" />
                <DSInput label="Dias estimados" type="number" value={String(form.diasEstimados)} onChange={(e) => updateField("diasEstimados", Number(e.target.value) || 0)} />
                <DSInput label="Consultor" value={form.consultor} onChange={(e) => updateField("consultor", e.target.value)} />
              </div>

              <DSTextarea label="Escopo dos servicos" value={form.escopo} onChange={(e) => updateField("escopo", e.target.value)} rows={3} placeholder="Descreva o escopo dos servicos..." />

              {/* Etapas */}
              <div>
                <label className="text-[11px] text-certifica-500 uppercase tracking-[0.04em] mb-1 block" style={{ fontWeight: 600 }}>Etapas de execucao</label>
                <div className="space-y-1.5">
                  {form.etapas.map((etapa, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-[10px] text-certifica-400 w-5 text-right flex-shrink-0">{idx + 1}.</span>
                      <input
                        value={etapa}
                        onChange={(e) => updateEtapa(idx, e.target.value)}
                        className="flex-1 h-7 px-2 text-[12px] border border-certifica-200 rounded-[4px] text-certifica-dark focus:border-certifica-accent focus:outline-none"
                        placeholder={`Etapa ${idx + 1}`}
                      />
                      <button onClick={() => removeEtapa(idx)} className="p-1 text-certifica-400 hover:text-nao-conformidade cursor-pointer">
                        <Trash2 className="w-3 h-3" strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addEtapa} className="mt-1.5 text-[10px] text-certifica-accent hover:underline cursor-pointer flex items-center gap-1">
                  <Plus className="w-3 h-3" strokeWidth={1.5} /> Adicionar etapa
                </button>
              </div>

              {/* Financeiro */}
              <div className="grid grid-cols-3 gap-3">
                <DSInput label="Valor total (R$)" type="number" value={String(form.valorTotal)} onChange={(e) => updateField("valorTotal", Number(e.target.value) || 0)} />
                <DSInput label="Parcelas" type="number" value={String(form.parcelas)} onChange={(e) => updateField("parcelas", Math.max(1, Number(e.target.value) || 1))} />
                <div>
                  <label className="text-[11px] text-certifica-500 block mb-1">Valor por parcela</label>
                  <div className="h-[34px] px-2 flex items-center text-[13px] font-mono text-certifica-900 bg-certifica-50 border border-certifica-200 rounded-[4px]" style={{ fontWeight: 600 }}>
                    {form.parcelas > 0 ? currency(Math.round((form.valorTotal / form.parcelas) * 100) / 100) : "—"}
                  </div>
                </div>
              </div>

              <DSInput label="Condicoes de pagamento" value={form.condicoes} onChange={(e) => updateField("condicoes", e.target.value)} placeholder="Ex: 30/60/90 dias, boleto bancario" />

              <div className="grid grid-cols-2 gap-3">
                <DSInput label="Validade (dias)" type="number" value={String(form.validadeDias)} onChange={(e) => updateField("validadeDias", Number(e.target.value) || 15)} />
                <div /> {/* spacer */}
              </div>

              <DSTextarea label="Observacoes" value={form.observacoes} onChange={(e) => updateField("observacoes", e.target.value)} rows={2} placeholder="Observacoes adicionais..." />

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2 border-t border-certifica-200">
                <DSButton variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</DSButton>
                <DSButton variant="primary" size="sm" icon={<Eye className="w-3 h-3" strokeWidth={1.5} />} onClick={handlePreview}>
                  Visualizar Proposta
                </DSButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview overlay */}
      {preview && <PropostaPreview data={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
