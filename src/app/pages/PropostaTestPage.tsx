import React from "react";
import PropostaPreview, { type PropostaData } from "../components/propostas/PropostaPreview";

const EXEMPLO: PropostaData = {
  numero: "156-2026",
  data: "2026-04-09",
  validade: "2026-05-09",
  clienteNome: "Heineken Brasil",
  clienteRazaoSocial: "Heineken Brasil S.A.",
  clienteCnpj: "12.345.678/0001-99",
  clienteEndereco: "Rua Exemplo, 100",
  clienteCidade: "Sorocaba",
  clienteUf: "SP",
  clienteContato: "Carlos Silva",
  clienteContatoCargo: "Gerente de Qualidade",
  clienteContatoEmail: "carlos@heineken.com.br",
  clienteContatoTelefone: "(15) 99999-0000",
  titulo: "Implementacao ISO 14001:2015 - Sistema de Gestao Ambiental",
  norma: "ISO 14001:2015",
  escopo: "Implementacao ISO 14001:2015 - Sistema de Gestao Ambiental",
  descricaoProjeto: "Consultoria para implementacao do Sistema de Gestao Ambiental conforme requisitos da norma ISO 14001:2015, incluindo levantamento de aspectos e impactos ambientais, definicao de controles operacionais e preparacao para auditoria de certificacao.",
  modalidade: "PRESENCIAL",
  diasEstimados: 15,
  etapas: [
    "Diagnostico inicial do sistema de gestao ambiental atual",
    "Levantamento e classificacao de aspectos e impactos ambientais",
    "Elaboracao da politica ambiental e objetivos ambientais",
    "Desenvolvimento da documentacao obrigatoria (procedimentos, registros, instrucoes)",
    "Treinamento e capacitacao das equipes envolvidas",
    "Realizacao de auditoria interna",
    "Preparacao para auditoria de certificacao",
    "Demais atividades pertinentes ao escopo",
  ],
  premissa: "disponibilizacao das equipes para apoio na implementacao. Cumprimento do plano.",
  restricao: "internet, acidentes, doenca.",
  valorDiario: 1650,
  valorTotal: 24750,
  parcelas: 1,
  valorParcela: 24750,
  condicoes: "30 dias da NF",
  codigoServicoNf: "1701 - Assessoria ou consultoria de qualquer natureza",
  despesasViagem: "Todas as despesas de viagem a cargo da contratada",
  despesasAlimentacao: "Todas as despesas de alimentacao durante o trabalho, a cargo da contratante",
  consultor: "Paulo Mendonca",
  observacoes: "",
};

export default function PropostaTestPage() {
  return <PropostaPreview data={EXEMPLO} onClose={() => window.history.back()} />;
}
