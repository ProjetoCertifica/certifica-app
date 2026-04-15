import React, { useState, useCallback, useMemo } from "react";
import { DSCard } from "../components/ds/DSCard";
import { DSButton } from "../components/ds/DSButton";
import { DSInput } from "../components/ds/DSInput";
import { DSSelect } from "../components/ds/DSSelect";
import { DSTextarea } from "../components/ds/DSTextarea";
import { FileText, Plus, Eye, X, Trash2 } from "lucide-react";
import PropostaPreview, { type PropostaData } from "../components/propostas/PropostaPreview";
import { toast } from "sonner";

/* ─────────────────────────────────────────────────────────────────────────────
   PROPOSTAS TEST PAGE — versao MOCK da PropostasPage real (sem Supabase/login)
   Usada so para o Pedro validar o fluxo: lista mock -> form -> preview PDF
───────────────────────────────────────────────────────────────────────────── */

interface ProjetoMock {
  id: string;
  codigo: string;
  titulo: string;
  norma: string;
  escopo: string;
  valor: number;
  condicoes: string;
  consultor: string;
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

const PROJETOS_MOCK: ProjetoMock[] = [
  {
    id: "1",
    codigo: "PRJ-2026-001",
    titulo: "Implementação ISO 9001:2015",
    norma: "ISO 9001:2015",
    escopo: "Implementação ISO 9001:2015 - Sistema de Gestão da Qualidade",
    valor: 24750,
    condicoes: "30 dias da NF",
    consultor: "Paulo Mendonça",
    cliente_nome: "Heineken Brasil",
    cliente_razao: "Heineken Brasil S.A.",
    cliente_cnpj: "12.345.678/0001-99",
    cliente_endereco: "Rua Exemplo, 100",
    cliente_cidade: "Sorocaba",
    cliente_uf: "SP",
    cliente_contato_nome: "Carlos Silva",
    cliente_contato_cargo: "Gerente de Qualidade",
    cliente_contato_email: "carlos@heineken.com.br",
    cliente_contato_telefone: "(15) 99999-0000",
  },
  {
    id: "2",
    codigo: "PRJ-2026-002",
    titulo: "Implementação ISO 14001:2015",
    norma: "ISO 14001:2015",
    escopo: "Implementação ISO 14001:2015 - Sistema de Gestão Ambiental",
    valor: 19800,
    condicoes: "60 dias da NF",
    consultor: "Matteo Mendonça",
    cliente_nome: "Ambev",
    cliente_razao: "Ambev S.A.",
    cliente_cnpj: "98.765.432/0001-11",
    cliente_endereco: "Av. Brigadeiro, 500",
    cliente_cidade: "São Paulo",
    cliente_uf: "SP",
    cliente_contato_nome: "Maria Santos",
    cliente_contato_cargo: "Diretora ESG",
    cliente_contato_email: "maria@ambev.com.br",
    cliente_contato_telefone: "(11) 98765-4321",
  },
  {
    id: "3",
    codigo: "PRJ-2026-003",
    titulo: "Implementação ISO 45001:2018",
    norma: "ISO 45001:2018",
    escopo: "Implementação ISO 45001:2018 - Sistema de Gestão de SST",
    valor: 16500,
    condicoes: "30 dias da NF",
    consultor: "Paulo Mendonça",
    cliente_nome: "Scania",
    cliente_razao: "Scania Latin America Ltda.",
    cliente_cnpj: "11.222.333/0001-44",
    cliente_endereco: "Av. José Odorizzi, 151",
    cliente_cidade: "São Bernardo do Campo",
    cliente_uf: "SP",
    cliente_contato_nome: "João Oliveira",
    cliente_contato_cargo: "Gerente de SSMA",
    cliente_contato_email: "joao@scania.com.br",
    cliente_contato_telefone: "(11) 4344-9999",
  },
];

interface PropostaForm {
  projetoId: string;
  numero: string;
  titulo: string;
  norma: string;
  escopo: string;
  descricaoProjeto: string;
  modalidade: string;
  diasEstimados: number;
  valorDiario: number;
  valorTotal: number;
  parcelas: number;
  condicoes: string;
  validadeDias: number;
  premissa: string;
  restricao: string;
  consultor: string;
  observacoes: string;
  etapas: string[];
}

const ETAPAS_DEFAULT = [
  "Diagnóstico inicial e gap analysis",
  "Elaboração da documentação do sistema de gestão",
  "Implementação e treinamento da equipe",
  "Auditoria interna",
  "Análise crítica e ações corretivas",
  "Acompanhamento da auditoria de certificação",
];

const emptyForm: PropostaForm = {
  projetoId: "",
  numero: "",
  titulo: "",
  norma: "",
  escopo: "",
  descricaoProjeto: "",
  modalidade: "PRESENCIAL",
  diasEstimados: 10,
  valorDiario: 0,
  valorTotal: 0,
  parcelas: 1,
  condicoes: "60 dias da NF",
  validadeDias: 30,
  premissa: "Disponibilização das equipes para apoio na implementação. Cumprimento do plano.",
  restricao: "Internet, acidentes, doença.",
  consultor: "",
  observacoes: "",
  etapas: [...ETAPAS_DEFAULT],
};

function currency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PropostasTestPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PropostaForm>({ ...emptyForm });
  const [preview, setPreview] = useState<PropostaData | null>(null);

  const nextNumero = useMemo(() => {
    const year = new Date().getFullYear();
    return `156-${year}`;
  }, []);

  const handleSelectProjeto = useCallback((projetoId: string) => {
    const p = PROJETOS_MOCK.find((x) => x.id === projetoId);
    if (!p) return;
    const diasMatch = 15;
    const valorDiario = Math.round((p.valor / diasMatch) * 100) / 100;
    setForm((f) => ({
      ...f,
      projetoId,
      numero: nextNumero,
      titulo: `${p.codigo} — ${p.titulo}`,
      norma: p.norma,
      escopo: p.escopo,
      descricaoProjeto: p.escopo,
      modalidade: "PRESENCIAL",
      diasEstimados: diasMatch,
      valorDiario,
      valorTotal: p.valor,
      parcelas: 1,
      condicoes: p.condicoes,
      consultor: p.consultor,
      observacoes: "",
      etapas: [...ETAPAS_DEFAULT],
    }));
  }, [nextNumero]);

  const handleNew = useCallback((projetoId?: string) => {
    setForm({ ...emptyForm, numero: nextNumero });
    if (projetoId) handleSelectProjeto(projetoId);
    setShowForm(true);
  }, [nextNumero, handleSelectProjeto]);

  const handlePreview = useCallback(() => {
    if (!form.titulo) {
      toast.error("Selecione um projeto e preencha os campos.");
      return;
    }
    const p = PROJETOS_MOCK.find((x) => x.id === form.projetoId);
    const now = new Date();
    const validade = new Date(now.getTime() + form.validadeDias * 86400000);
    const computedTotal = form.valorDiario > 0
      ? Math.round(form.valorDiario * form.diasEstimados * 100) / 100
      : form.valorTotal;

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
      descricaoProjeto: form.descricaoProjeto || form.escopo,
      modalidade: form.modalidade,
      diasEstimados: form.diasEstimados,
      etapas: form.etapas.filter(Boolean),
      valorDiario: form.valorDiario,
      valorTotal: computedTotal,
      parcelas: form.parcelas,
      valorParcela: form.parcelas > 0 ? Math.round((computedTotal / form.parcelas) * 100) / 100 : computedTotal,
      condicoes: form.condicoes,
      premissa: form.premissa,
      restricao: form.restricao,
      consultor: form.consultor,
      observacoes: form.observacoes,
    };
    setPreview(data);
  }, [form, nextNumero]);

  const addEtapa = () => setForm((f) => ({ ...f, etapas: [...f.etapas, ""] }));
  const removeEtapa = (idx: number) => setForm((f) => ({ ...f, etapas: f.etapas.filter((_, i) => i !== idx) }));
  const updateEtapa = (idx: number, value: string) =>
    setForm((f) => ({ ...f, etapas: f.etapas.map((e, i) => (i === idx ? value : e)) }));
  const updateField = <K extends keyof PropostaForm>(key: K, value: PropostaForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="min-h-screen bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] text-certifica-900 font-semibold" style={{ letterSpacing: "-0.02em" }}>Propostas (modo teste)</h2>
          <p className="text-[12px] text-certifica-500 mt-0.5">Dados mockados — fluxo completo: selecionar projeto → preencher → visualizar PDF</p>
        </div>
        <DSButton variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" strokeWidth={1.5} />} onClick={() => handleNew()}>
          Nova Proposta
        </DSButton>
      </div>

      <DSCard
        header={
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-certifica-accent" strokeWidth={1.5} />
            <span className="text-[13px] text-certifica-900" style={{ fontWeight: 600 }}>
              Projetos disponíveis ({PROJETOS_MOCK.length})
            </span>
          </div>
        }
      >
        <div className="divide-y divide-certifica-200">
          {PROJETOS_MOCK.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5 px-1">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-mono text-certifica-700" style={{ fontWeight: 500 }}>{p.codigo}</span>
                  <span className="text-[12px] text-certifica-900" style={{ fontWeight: 500 }}>{p.titulo}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-certifica-500">{p.cliente_nome}</span>
                  <span className="text-[11px] text-certifica-400">{p.norma}</span>
                  <span className="text-[11px] font-mono text-certifica-500">{currency(p.valor)}</span>
                  <span className="text-[11px] text-certifica-400">{p.consultor}</span>
                </div>
              </div>
              <DSButton variant="outline" size="sm" icon={<FileText className="w-3 h-3" strokeWidth={1.5} />} onClick={() => handleNew(p.id)}>
                Gerar
              </DSButton>
            </div>
          ))}
        </div>
      </DSCard>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-certifica-dark/45" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-[680px] bg-white border border-certifica-200 rounded-[6px] shadow-[0_12px_40px_rgba(14,42,71,0.18)] max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-[15px] text-certifica-900" style={{ fontWeight: 600 }}>Configurar Proposta</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-certifica-500/40 hover:text-certifica-700 cursor-pointer">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <DSSelect
                label="Projeto base"
                value={form.projetoId}
                onChange={(e) => handleSelectProjeto(e.target.value)}
                options={[
                  { value: "", label: "Selecione um projeto..." },
                  ...PROJETOS_MOCK.map((p) => ({ value: p.id, label: `${p.codigo} — ${p.titulo} (${p.cliente_nome})` })),
                ]}
              />

              <div className="grid grid-cols-2 gap-3">
                <DSInput label="N. da Proposta" value={form.numero} onChange={(e) => updateField("numero", e.target.value)} />
                <DSInput label="Titulo" value={form.titulo} onChange={(e) => updateField("titulo", e.target.value)} />
              </div>

              <div className="grid grid-cols-4 gap-3">
                <DSInput label="Norma" value={form.norma} onChange={(e) => updateField("norma", e.target.value)} placeholder="ISO 9001:2015" />
                <DSSelect
                  label="Modalidade"
                  value={form.modalidade}
                  onChange={(e) => updateField("modalidade", e.target.value)}
                  options={[
                    { value: "PRESENCIAL", label: "Presencial" },
                    { value: "REMOTO", label: "Remoto" },
                    { value: "HIBRIDO", label: "Híbrido" },
                  ]}
                />
                <DSInput label="Dias" type="number" value={String(form.diasEstimados)} onChange={(e) => updateField("diasEstimados", Number(e.target.value) || 0)} />
                <DSInput label="Consultor" value={form.consultor} onChange={(e) => updateField("consultor", e.target.value)} />
              </div>

              <DSTextarea label="Escopo (título grande da capa)" value={form.escopo} onChange={(e) => updateField("escopo", e.target.value)} rows={2} placeholder="Ex: Implementação ISO 14001:2015 - Sistema de Gestão Ambiental" />

              <DSTextarea label="Descrição do projeto (aparece na página de etapas)" value={form.descricaoProjeto} onChange={(e) => updateField("descricaoProjeto", e.target.value)} rows={3} placeholder="Consultoria para implementação do Sistema de Gestão..." />

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

              <div className="grid grid-cols-3 gap-3">
                <DSInput
                  label="Valor diário (R$/dia)"
                  type="number"
                  value={String(form.valorDiario)}
                  onChange={(e) => updateField("valorDiario", Number(e.target.value) || 0)}
                  placeholder="Ex: 1650"
                />
                <div>
                  <label className="text-[11px] text-certifica-500 block mb-1">Valor total (calculado)</label>
                  <div className="h-[34px] px-2 flex items-center text-[13px] font-mono text-certifica-900 bg-certifica-50 border border-certifica-200 rounded-[4px]" style={{ fontWeight: 600 }}>
                    {form.valorDiario > 0
                      ? currency(Math.round(form.valorDiario * form.diasEstimados * 100) / 100)
                      : form.valorTotal > 0 ? currency(form.valorTotal) : "—"}
                  </div>
                </div>
                <DSInput label="Parcelas" type="number" value={String(form.parcelas)} onChange={(e) => updateField("parcelas", Math.max(1, Number(e.target.value) || 1))} />
              </div>

              <DSInput label="Condicoes de pagamento" value={form.condicoes} onChange={(e) => updateField("condicoes", e.target.value)} placeholder="Ex: 60 dias da NF" />

              <div className="grid grid-cols-2 gap-3">
                <DSInput label="Premissa" value={form.premissa} onChange={(e) => updateField("premissa", e.target.value)} />
                <DSInput label="Restrição" value={form.restricao} onChange={(e) => updateField("restricao", e.target.value)} />
              </div>

              <DSInput label="Validade (dias)" type="number" value={String(form.validadeDias)} onChange={(e) => updateField("validadeDias", Number(e.target.value) || 15)} />

              <DSTextarea label="Observacoes" value={form.observacoes} onChange={(e) => updateField("observacoes", e.target.value)} rows={2} />

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

      {preview && <PropostaPreview data={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}
