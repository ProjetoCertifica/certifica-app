import React, { useEffect, useMemo, useState } from "react";
import { DSBadge } from "../components/ds/DSBadge";
import { DSButton } from "../components/ds/DSButton";
import {
  Search, BookOpen, Building2, ChevronRight, ChevronDown, Plus, X,
  CheckCircle2, AlertTriangle, FileText, Users, Shield, Leaf, Zap,
  Globe, Truck, Lock, Heart, Factory, Lightbulb, ExternalLink, Copy,
} from "lucide-react";

type NormCategory = "qualidade" | "ambiental" | "seguranca" | "energia" | "informacao" | "responsabilidade" | "automotivo" | "alimentos" | "saude" | "telecom" | "continuidade" | "outro";
type ImplStatus = "nao-iniciado" | "em-andamento" | "implementado" | "certificado";

interface NormClause {
  id: string;
  number: string;
  title: string;
  description: string;
  subClauses?: { number: string; title: string }[];
}

interface Norm {
  id: string;
  code: string;
  name: string;
  fullName: string;
  category: NormCategory;
  year: number;
  description: string;
  applicability: string;
  benefits: string[];
  clauses: NormClause[];
  popularity: number;
}

interface CompanyAssignment {
  id: string;
  companyName: string;
  normId: string;
  status: ImplStatus;
  startDate: string;
  targetDate: string;
  consultant: string;
  progress: number;
}

const categoryMeta: Record<NormCategory, { label: string; color: string; icon: React.ReactNode }> = {
  qualidade: { label: "Qualidade", color: "text-certifica-accent", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  ambiental: { label: "Ambiental", color: "text-conformidade", icon: <Leaf className="w-3.5 h-3.5" /> },
  seguranca: { label: "Segurança", color: "text-observacao", icon: <Shield className="w-3.5 h-3.5" /> },
  energia: { label: "Energia", color: "text-oportunidade", icon: <Zap className="w-3.5 h-3.5" /> },
  informacao: { label: "Segurança da Informação", color: "text-certifica-accent", icon: <Lock className="w-3.5 h-3.5" /> },
  responsabilidade: { label: "Responsabilidade Social", color: "text-nao-conformidade", icon: <Heart className="w-3.5 h-3.5" /> },
  automotivo: { label: "Automotivo", color: "text-certifica-500", icon: <Truck className="w-3.5 h-3.5" /> },
  alimentos: { label: "Alimentos", color: "text-conformidade", icon: <Factory className="w-3.5 h-3.5" /> },
  saude: { label: "Saúde", color: "text-nao-conformidade", icon: <Heart className="w-3.5 h-3.5" /> },
  telecom: { label: "Telecom / TI", color: "text-certifica-accent", icon: <Globe className="w-3.5 h-3.5" /> },
  continuidade: { label: "Continuidade de Negócios", color: "text-observacao", icon: <Shield className="w-3.5 h-3.5" /> },
  outro: { label: "Outros", color: "text-certifica-500", icon: <Globe className="w-3.5 h-3.5" /> },
};

const statusMeta: Record<ImplStatus, { label: string; variant: "outline" | "conformidade" | "observacao" | "oportunidade" | "nao-conformidade" }> = {
  "nao-iniciado": { label: "Não iniciado", variant: "outline" },
  "em-andamento": { label: "Em andamento", variant: "observacao" },
  implementado: { label: "Implementado", variant: "oportunidade" },
  certificado: { label: "Certificado", variant: "conformidade" },
};

const norms: Norm[] = [
  {
    id: "iso9001", code: "ISO 9001", name: "Gestão da Qualidade", fullName: "ISO 9001:2015 – Sistemas de Gestão da Qualidade",
    category: "qualidade", year: 2015, popularity: 99,
    description: "Norma internacional mais adotada no mundo. Especifica requisitos para um sistema de gestão da qualidade, ajudando organizações a demonstrar capacidade de fornecer produtos e serviços que atendam requisitos do cliente e regulamentares de forma consistente.",
    applicability: "Qualquer organização, independente do porte ou setor, que deseje melhorar a satisfação do cliente e a consistência dos processos.",
    benefits: ["Melhoria da satisfação do cliente", "Padronização de processos", "Redução de retrabalho e custos", "Maior competitividade no mercado", "Requisito para licitações e grandes contratos"],
    clauses: [
      { id: "c4", number: "4", title: "Contexto da organização", description: "Entender a organização, partes interessadas, escopo e SGQ.", subClauses: [{ number: "4.1", title: "Entendendo a organização e seu contexto" }, { number: "4.2", title: "Entendendo necessidades das partes interessadas" }, { number: "4.3", title: "Determinando o escopo do SGQ" }, { number: "4.4", title: "SGQ e seus processos" }] },
      { id: "c5", number: "5", title: "Liderança", description: "Comprometimento da alta direção, política e responsabilidades.", subClauses: [{ number: "5.1", title: "Liderança e comprometimento" }, { number: "5.2", title: "Política da qualidade" }, { number: "5.3", title: "Papéis, responsabilidades e autoridades" }] },
      { id: "c6", number: "6", title: "Planejamento", description: "Ações para abordar riscos e oportunidades, objetivos da qualidade.", subClauses: [{ number: "6.1", title: "Ações para abordar riscos e oportunidades" }, { number: "6.2", title: "Objetivos da qualidade e planejamento" }, { number: "6.3", title: "Planejamento de mudanças" }] },
      { id: "c7", number: "7", title: "Apoio", description: "Recursos, competência, conscientização, comunicação e informação documentada.", subClauses: [{ number: "7.1", title: "Recursos" }, { number: "7.2", title: "Competência" }, { number: "7.3", title: "Conscientização" }, { number: "7.4", title: "Comunicação" }, { number: "7.5", title: "Informação documentada" }] },
      { id: "c8", number: "8", title: "Operação", description: "Planejamento e controle operacional, requisitos, design, provisão externa.", subClauses: [{ number: "8.1", title: "Planejamento e controle operacional" }, { number: "8.2", title: "Requisitos para produtos e serviços" }, { number: "8.3", title: "Projeto e desenvolvimento" }, { number: "8.4", title: "Controle de provisão externa" }, { number: "8.5", title: "Produção e provisão de serviço" }, { number: "8.6", title: "Liberação de produtos e serviços" }, { number: "8.7", title: "Controle de saídas não conformes" }] },
      { id: "c9", number: "9", title: "Avaliação de desempenho", description: "Monitoramento, medição, análise, avaliação, auditoria interna e análise crítica.", subClauses: [{ number: "9.1", title: "Monitoramento, medição, análise e avaliação" }, { number: "9.2", title: "Auditoria interna" }, { number: "9.3", title: "Análise crítica pela direção" }] },
      { id: "c10", number: "10", title: "Melhoria", description: "Não conformidade, ação corretiva e melhoria contínua.", subClauses: [{ number: "10.1", title: "Generalidades" }, { number: "10.2", title: "Não conformidade e ação corretiva" }, { number: "10.3", title: "Melhoria contínua" }] },
    ],
  },
  {
    id: "iso14001", code: "ISO 14001", name: "Gestão Ambiental", fullName: "ISO 14001:2015 – Sistemas de Gestão Ambiental",
    category: "ambiental", year: 2015, popularity: 92,
    description: "Norma que especifica requisitos para um sistema de gestão ambiental eficaz, permitindo que organizações gerenciem suas responsabilidades ambientais de forma sistemática, contribuindo para o pilar ambiental da sustentabilidade.",
    applicability: "Organizações de qualquer porte e setor que desejam estabelecer, implementar, manter e melhorar continuamente um sistema de gestão ambiental.",
    benefits: ["Redução de impactos ambientais", "Conformidade legal ambiental", "Economia de recursos e energia", "Melhoria da imagem corporativa", "Acesso a mercados internacionais"],
    clauses: [
      { id: "c4e", number: "4", title: "Contexto da organização", description: "Questões internas/externas, partes interessadas, escopo do SGA.", subClauses: [{ number: "4.1", title: "Entendendo a organização e seu contexto" }, { number: "4.2", title: "Partes interessadas" }, { number: "4.3", title: "Escopo do SGA" }, { number: "4.4", title: "Sistema de gestão ambiental" }] },
      { id: "c5e", number: "5", title: "Liderança", description: "Comprometimento, política ambiental, papéis e responsabilidades.", subClauses: [{ number: "5.1", title: "Liderança e comprometimento" }, { number: "5.2", title: "Política ambiental" }, { number: "5.3", title: "Papéis, responsabilidades e autoridades" }] },
      { id: "c6e", number: "6", title: "Planejamento", description: "Aspectos ambientais, requisitos legais, riscos e oportunidades, objetivos.", subClauses: [{ number: "6.1", title: "Ações para abordar riscos e oportunidades" }, { number: "6.2", title: "Objetivos ambientais e planejamento" }] },
      { id: "c7e", number: "7", title: "Apoio", description: "Recursos, competência, comunicação, informação documentada.", subClauses: [{ number: "7.1", title: "Recursos" }, { number: "7.2", title: "Competência" }, { number: "7.3", title: "Conscientização" }, { number: "7.4", title: "Comunicação" }, { number: "7.5", title: "Informação documentada" }] },
      { id: "c8e", number: "8", title: "Operação", description: "Planejamento operacional, preparação para emergências.", subClauses: [{ number: "8.1", title: "Planejamento e controle operacional" }, { number: "8.2", title: "Preparação e resposta a emergências" }] },
      { id: "c9e", number: "9", title: "Avaliação de desempenho", description: "Monitoramento ambiental, auditoria interna, análise crítica.", subClauses: [{ number: "9.1", title: "Monitoramento, medição, análise e avaliação" }, { number: "9.2", title: "Auditoria interna" }, { number: "9.3", title: "Análise crítica pela direção" }] },
      { id: "c10e", number: "10", title: "Melhoria", description: "Não conformidade, ação corretiva, melhoria contínua.", subClauses: [{ number: "10.1", title: "Generalidades" }, { number: "10.2", title: "Não conformidade e ação corretiva" }, { number: "10.3", title: "Melhoria contínua" }] },
    ],
  },
  {
    id: "iso45001", code: "ISO 45001", name: "Saúde e Segurança Ocupacional", fullName: "ISO 45001:2018 – Sistemas de Gestão de SSO",
    category: "seguranca", year: 2018, popularity: 88,
    description: "Norma internacional para sistemas de gestão de saúde e segurança ocupacional, fornecendo estrutura para melhorar a segurança dos trabalhadores, reduzir riscos no ambiente de trabalho e criar condições melhores e mais seguras.",
    applicability: "Qualquer organização que queira melhorar proativamente o desempenho de SSO, eliminar perigos e minimizar riscos ocupacionais.",
    benefits: ["Redução de acidentes de trabalho", "Conformidade com legislação trabalhista", "Melhoria do ambiente de trabalho", "Redução de custos com afastamentos", "Cultura de prevenção"],
    clauses: [
      { id: "c4s", number: "4", title: "Contexto da organização", description: "Questões internas e externas, necessidades dos trabalhadores.", subClauses: [{ number: "4.1", title: "Entendendo a organização" }, { number: "4.2", title: "Necessidades dos trabalhadores e partes interessadas" }, { number: "4.3", title: "Escopo do SGSSO" }, { number: "4.4", title: "Sistema de gestão de SSO" }] },
      { id: "c5s", number: "5", title: "Liderança e participação dos trabalhadores", description: "Comprometimento, política SSO, consulta e participação.", subClauses: [{ number: "5.1", title: "Liderança e comprometimento" }, { number: "5.2", title: "Política de SSO" }, { number: "5.3", title: "Papéis e responsabilidades" }, { number: "5.4", title: "Consulta e participação dos trabalhadores" }] },
      { id: "c6s", number: "6", title: "Planejamento", description: "Identificação de perigos, avaliação de riscos, requisitos legais.", subClauses: [{ number: "6.1", title: "Ações para abordar riscos e oportunidades" }, { number: "6.2", title: "Objetivos de SSO" }] },
      { id: "c7s", number: "7", title: "Apoio", description: "Recursos, competência, conscientização, comunicação.", subClauses: [{ number: "7.1", title: "Recursos" }, { number: "7.2", title: "Competência" }, { number: "7.3", title: "Conscientização" }, { number: "7.4", title: "Comunicação" }, { number: "7.5", title: "Informação documentada" }] },
      { id: "c8s", number: "8", title: "Operação", description: "Eliminação de perigos, gestão de mudanças, aquisição, contratados, emergências.", subClauses: [{ number: "8.1", title: "Planejamento e controle operacional" }, { number: "8.2", title: "Preparação e resposta a emergências" }] },
      { id: "c9s", number: "9", title: "Avaliação de desempenho", description: "Monitoramento, auditoria interna, análise crítica.", subClauses: [{ number: "9.1", title: "Monitoramento, medição, análise e avaliação" }, { number: "9.2", title: "Auditoria interna" }, { number: "9.3", title: "Análise crítica pela direção" }] },
      { id: "c10s", number: "10", title: "Melhoria", description: "Incidentes, não conformidades, melhoria contínua.", subClauses: [{ number: "10.1", title: "Generalidades" }, { number: "10.2", title: "Incidentes, NC e ação corretiva" }, { number: "10.3", title: "Melhoria contínua" }] },
    ],
  },
  {
    id: "iso27001", code: "ISO 27001", name: "Segurança da Informação", fullName: "ISO/IEC 27001:2022 – Segurança da Informação",
    category: "informacao", year: 2022, popularity: 85,
    description: "Norma para estabelecer, implementar, manter e melhorar um sistema de gestão de segurança da informação (SGSI). Essencial para proteger dados e ativos digitais contra ameaças cibernéticas, incluindo requisitos para avaliação e tratamento de riscos.",
    applicability: "Empresas de tecnologia, financeiras, saúde, governo e qualquer organização que lida com dados sensíveis ou confidenciais.",
    benefits: ["Proteção de dados sensíveis", "Conformidade com LGPD e GDPR", "Redução de incidentes de segurança", "Confiança de clientes e parceiros", "Vantagem competitiva em TI"],
    clauses: [
      { id: "c4i", number: "4", title: "Contexto da organização", description: "Entendimento do contexto e escopo do SGSI.", subClauses: [{ number: "4.1", title: "Contexto" }, { number: "4.2", title: "Partes interessadas" }, { number: "4.3", title: "Escopo" }, { number: "4.4", title: "SGSI" }] },
      { id: "c5i", number: "5", title: "Liderança", description: "Comprometimento, política e responsabilidades.", subClauses: [{ number: "5.1", title: "Liderança" }, { number: "5.2", title: "Política" }, { number: "5.3", title: "Papéis" }] },
      { id: "c6i", number: "6", title: "Planejamento", description: "Avaliação de riscos, tratamento e objetivos.", subClauses: [{ number: "6.1", title: "Riscos e oportunidades" }, { number: "6.2", title: "Objetivos de segurança" }, { number: "6.3", title: "Planejamento de mudanças" }] },
      { id: "c7i", number: "7", title: "Apoio", description: "Recursos, competência, comunicação, informação documentada.", subClauses: [{ number: "7.1", title: "Recursos" }, { number: "7.2", title: "Competência" }, { number: "7.3", title: "Conscientização" }, { number: "7.4", title: "Comunicação" }, { number: "7.5", title: "Informação documentada" }] },
      { id: "c8i", number: "8", title: "Operação", description: "Avaliação e tratamento de riscos de segurança.", subClauses: [{ number: "8.1", title: "Planejamento e controle" }, { number: "8.2", title: "Avaliação de riscos" }, { number: "8.3", title: "Tratamento de riscos" }] },
      { id: "c9i", number: "9", title: "Avaliação de desempenho", description: "Monitoramento, auditoria interna, análise crítica.", subClauses: [{ number: "9.1", title: "Monitoramento e medição" }, { number: "9.2", title: "Auditoria interna" }, { number: "9.3", title: "Análise crítica" }] },
      { id: "c10i", number: "10", title: "Melhoria", description: "Não conformidade, ação corretiva, melhoria contínua.", subClauses: [{ number: "10.1", title: "Melhoria contínua" }, { number: "10.2", title: "NC e ação corretiva" }] },
    ],
  },
  {
    id: "iso22301", code: "ISO 22301", name: "Continuidade de Negócios", fullName: "ISO 22301:2019 – Segurança e Resiliência – Continuidade de Negócios",
    category: "continuidade", year: 2019, popularity: 74,
    description: "Norma que define requisitos para planejar, estabelecer, implementar e manter um sistema de gestão de continuidade de negócios (SGCN), garantindo que a organização consiga continuar operando durante e após interrupções.",
    applicability: "Organizações que precisam garantir resiliência operacional: bancos, saúde, TI, logística, governo e infraestrutura crítica.",
    benefits: ["Resiliência operacional", "Proteção de receita e reputação", "Atendimento a requisitos regulatórios (BACEN, CVM)", "Redução do tempo de recuperação", "Confiança de stakeholders"],
    clauses: [
      { id: "c4bc", number: "4", title: "Contexto da organização", description: "Escopo, partes interessadas, requisitos legais para continuidade.", subClauses: [{ number: "4.1", title: "Contexto" }, { number: "4.2", title: "Partes interessadas" }, { number: "4.3", title: "Escopo do SGCN" }, { number: "4.4", title: "SGCN" }] },
      { id: "c6bc", number: "6", title: "Planejamento", description: "Riscos e oportunidades, objetivos de continuidade.", subClauses: [{ number: "6.1", title: "Riscos e oportunidades" }, { number: "6.2", title: "Objetivos de continuidade" }, { number: "6.3", title: "Planejamento de mudanças" }] },
      { id: "c8bc", number: "8", title: "Operação", description: "Análise de impacto (BIA), avaliação de riscos, estratégias, planos e exercícios.", subClauses: [{ number: "8.1", title: "Planejamento e controle" }, { number: "8.2", title: "Análise de impacto nos negócios (BIA)" }, { number: "8.3", title: "Estratégias de continuidade" }, { number: "8.4", title: "Planos de continuidade" }, { number: "8.5", title: "Programa de exercícios e testes" }] },
    ],
  },
  {
    id: "iso31000", code: "ISO 31000", name: "Gestão de Riscos", fullName: "ISO 31000:2018 – Gestão de Riscos – Diretrizes",
    category: "qualidade", year: 2018, popularity: 78,
    description: "Norma de diretrizes para gestão de riscos em qualquer tipo de organização. Fornece princípios, estrutura e processo para gerenciar riscos de forma sistemática, transparente e confiável, dentro de qualquer escopo e contexto.",
    applicability: "Todas as organizações, públicas e privadas, independente de porte, setor ou atividade.",
    benefits: ["Tomada de decisão baseada em riscos", "Melhoria da governança corporativa", "Identificação proativa de ameaças e oportunidades", "Alinhamento com requisitos de compliance", "Base para integração com outras normas ISO"],
    clauses: [
      { id: "c5r", number: "5", title: "Estrutura", description: "Liderança, integração, design, implementação, avaliação e melhoria.", subClauses: [{ number: "5.2", title: "Liderança e comprometimento" }, { number: "5.3", title: "Integração" }, { number: "5.4", title: "Concepção" }, { number: "5.5", title: "Implementação" }, { number: "5.6", title: "Avaliação" }, { number: "5.7", title: "Melhoria" }] },
      { id: "c6r", number: "6", title: "Processo", description: "Comunicação, escopo/contexto, identificação, análise, avaliação, tratamento, monitoramento.", subClauses: [{ number: "6.1", title: "Comunicação e consulta" }, { number: "6.2", title: "Escopo, contexto e critérios" }, { number: "6.3", title: "Identificação de riscos" }, { number: "6.4", title: "Análise de riscos" }, { number: "6.5", title: "Avaliação de riscos" }, { number: "6.6", title: "Tratamento de riscos" }, { number: "6.7", title: "Monitoramento e análise crítica" }] },
    ],
  },
  {
    id: "iso19011", code: "ISO 19011", name: "Auditoria de Sistemas de Gestão", fullName: "ISO 19011:2018 – Diretrizes para Auditoria de Sistemas de Gestão",
    category: "qualidade", year: 2018, popularity: 82,
    description: "Guia essencial para a condução de auditorias internas e externas de qualquer sistema de gestão. Define princípios de auditoria, gerenciamento de programa de auditoria, realização de auditorias e competência de auditores.",
    applicability: "Auditores internos e externos, gestores de programas de auditoria, organizações certificadas ou em processo de certificação.",
    benefits: ["Padronização do processo de auditoria", "Melhoria da competência dos auditores", "Maior eficácia nas auditorias integradas", "Base para programas de auditoria interna", "Suporte à melhoria contínua"],
    clauses: [
      { id: "c4au", number: "4", title: "Princípios de auditoria", description: "Integridade, apresentação justa, due professional care, confidencialidade, independência, abordagem baseada em evidência, abordagem baseada em risco.", subClauses: [] },
      { id: "c5au", number: "5", title: "Gerenciamento de programa de auditoria", description: "Estabelecer, implementar, monitorar, analisar e melhorar o programa.", subClauses: [{ number: "5.1", title: "Generalidades" }, { number: "5.2", title: "Objetivos do programa" }, { number: "5.3", title: "Riscos e oportunidades" }, { number: "5.4", title: "Estabelecendo o programa" }, { number: "5.5", title: "Implementando o programa" }, { number: "5.6", title: "Monitorando o programa" }, { number: "5.7", title: "Analisando e melhorando" }] },
      { id: "c6au", number: "6", title: "Realizando uma auditoria", description: "Etapas desde planejamento até conclusão e acompanhamento.", subClauses: [{ number: "6.2", title: "Iniciando a auditoria" }, { number: "6.3", title: "Preparando atividades" }, { number: "6.4", title: "Conduzindo atividades" }, { number: "6.5", title: "Preparando o relatório" }, { number: "6.6", title: "Concluindo a auditoria" }, { number: "6.7", title: "Acompanhamento" }] },
      { id: "c7au", number: "7", title: "Competência e avaliação de auditores", description: "Determinação de competência, critérios de avaliação e manutenção.", subClauses: [{ number: "7.1", title: "Generalidades" }, { number: "7.2", title: "Comportamento pessoal" }, { number: "7.3", title: "Conhecimentos e habilidades" }, { number: "7.4", title: "Alcançando competência" }, { number: "7.5", title: "Avaliando auditores" }] },
    ],
  },
  {
    id: "iso50001", code: "ISO 50001", name: "Gestão de Energia", fullName: "ISO 50001:2018 – Sistemas de Gestão de Energia",
    category: "energia", year: 2018, popularity: 65,
    description: "Norma para estabelecer sistemas e processos para melhorar o desempenho energético, incluindo eficiência, uso e consumo de energia, contribuindo diretamente para metas de descarbonização.",
    applicability: "Indústrias, edifícios comerciais, setor público e qualquer organização com consumo energético significativo.",
    benefits: ["Redução de custos energéticos (até 20%)", "Diminuição de emissões de GEE", "Conformidade regulatória energética", "Melhoria da eficiência operacional", "Sustentabilidade corporativa"],
    clauses: [
      { id: "c4en", number: "4", title: "Contexto da organização", description: "Contexto, partes interessadas, escopo do SGEn.", subClauses: [{ number: "4.1", title: "Contexto" }, { number: "4.2", title: "Partes interessadas" }, { number: "4.3", title: "Escopo" }, { number: "4.4", title: "SGEn" }] },
      { id: "c6en", number: "6", title: "Planejamento", description: "Revisão energética, indicadores, linha de base, objetivos.", subClauses: [{ number: "6.1", title: "Riscos e oportunidades" }, { number: "6.2", title: "Objetivos e metas energéticas" }, { number: "6.3", title: "Revisão energética" }, { number: "6.4", title: "Indicadores de desempenho energético (IDEn)" }, { number: "6.5", title: "Linha de base energética (LBEn)" }, { number: "6.6", title: "Planejamento para coleta de dados" }] },
      { id: "c8en", number: "8", title: "Operação", description: "Planejamento operacional, design, aquisição de energia.", subClauses: [{ number: "8.1", title: "Planejamento e controle" }, { number: "8.2", title: "Design" }, { number: "8.3", title: "Aquisição" }] },
    ],
  },
  {
    id: "iso22000", code: "ISO 22000", name: "Segurança de Alimentos", fullName: "ISO 22000:2018 – Sistemas de Gestão de Segurança de Alimentos",
    category: "alimentos", year: 2018, popularity: 68,
    description: "Norma para sistemas de gestão de segurança de alimentos, aplicável a toda a cadeia alimentar — do campo à mesa. Integra princípios do Codex Alimentarius (APPCC/HACCP) com requisitos de gestão ISO.",
    applicability: "Produtores agrícolas, indústrias alimentícias, distribuidores, varejistas, serviços de alimentação, embalagens e transporte de alimentos.",
    benefits: ["Garantia da segurança alimentar", "Conformidade com ANVISA e regulamentação sanitária", "Acesso a mercados internacionais", "Redução de recalls e contaminações", "Confiança do consumidor"],
    clauses: [
      { id: "c4a", number: "4", title: "Contexto da organização", description: "Contexto, escopo do SGSA.", subClauses: [{ number: "4.1", title: "Contexto" }, { number: "4.2", title: "Partes interessadas" }, { number: "4.3", title: "Escopo" }, { number: "4.4", title: "SGSA" }] },
      { id: "c7a", number: "7", title: "Apoio", description: "Recursos, competência, comunicação.", subClauses: [{ number: "7.1", title: "Recursos" }, { number: "7.2", title: "Competência" }, { number: "7.4", title: "Comunicação" }, { number: "7.5", title: "Informação documentada" }] },
      { id: "c8a", number: "8", title: "Operação", description: "PPRs, rastreabilidade, análise de perigos, plano APPCC.", subClauses: [{ number: "8.1", title: "Planejamento e controle operacional" }, { number: "8.2", title: "PPR – Programas de pré-requisitos" }, { number: "8.3", title: "Sistema de rastreabilidade" }, { number: "8.4", title: "Preparação e resposta a emergências" }, { number: "8.5", title: "Análise de perigos" }, { number: "8.6", title: "Atualização de PPR e plano APPCC" }, { number: "8.7", title: "Controle de monitoramento e medição" }] },
    ],
  },
  {
    id: "iso37001", code: "ISO 37001", name: "Antissuborno", fullName: "ISO 37001:2016 – Sistemas de Gestão Antissuborno",
    category: "responsabilidade", year: 2016, popularity: 62,
    description: "Norma para ajudar organizações a prevenir, detectar e tratar o suborno. Muito relevante no Brasil devido à Lei Anticorrupção (12.846/2013) e ao Programa de Integridade para licitações públicas.",
    applicability: "Empresas em mercados regulados, exportadoras, empresas públicas, estatais e qualquer organização exposta a riscos de corrupção.",
    benefits: ["Prevenção de corrupção", "Conformidade com Lei Anticorrupção (12.846/2013)", "Atenuação de sanções administrativas", "Transparência nas relações comerciais", "Due diligence de parceiros e terceiros"],
    clauses: [
      { id: "c4as", number: "4", title: "Contexto", description: "Contexto da organização e riscos de suborno.", subClauses: [{ number: "4.1", title: "Contexto" }, { number: "4.2", title: "Partes interessadas" }, { number: "4.3", title: "Escopo" }, { number: "4.4", title: "SGAS" }, { number: "4.5", title: "Avaliação de riscos de suborno" }] },
      { id: "c5as", number: "5", title: "Liderança", description: "Comprometimento, política antissuborno, função de compliance.", subClauses: [{ number: "5.1", title: "Liderança e comprometimento" }, { number: "5.2", title: "Política antissuborno" }, { number: "5.3", title: "Papéis e responsabilidades" }] },
      { id: "c8as", number: "8", title: "Operação", description: "Due diligence, controles financeiros, presentes, doações, relatos.", subClauses: [{ number: "8.1", title: "Planejamento e controle" }, { number: "8.2", title: "Due diligence" }, { number: "8.3", title: "Controles financeiros" }, { number: "8.4", title: "Controles não financeiros" }, { number: "8.5", title: "Implementação de controles" }, { number: "8.9", title: "Relatar preocupações" }, { number: "8.10", title: "Investigação e tratamento" }] },
    ],
  },
  {
    id: "iatf16949", code: "IATF 16949", name: "Qualidade Automotiva", fullName: "IATF 16949:2016 – Gestão da Qualidade Automotiva",
    category: "automotivo", year: 2016, popularity: 55,
    description: "Norma do setor automotivo baseada na ISO 9001, com requisitos adicionais específicos para a cadeia de fornecimento automotivo. Obrigatória para fornecedores que desejam trabalhar com grandes montadoras (VW, GM, Toyota, etc.).",
    applicability: "Fornecedores diretos e indiretos da indústria automotiva (OEMs e Tier 1/2/3).",
    benefits: ["Acesso à cadeia automotiva global", "Redução de defeitos e recalls", "Melhoria contínua de processos", "Padronização com montadoras", "FMEA, PPAP, APQP, MSA, SPC integrados"],
    clauses: [
      { id: "c4at", number: "4", title: "Contexto + Requisitos específicos", description: "Segurança do produto, processos específicos do cliente.", subClauses: [{ number: "4.3.1", title: "Determinação do escopo (complemento)" }, { number: "4.3.2", title: "Requisitos específicos do cliente" }, { number: "4.4.1.1", title: "Conformidade de produtos e processos" }, { number: "4.4.1.2", title: "Segurança do produto" }] },
      { id: "c8at", number: "8", title: "Operação", description: "APQP, FMEA, plano de controle, MSA, SPC.", subClauses: [{ number: "8.3", title: "Projeto e desenvolvimento de produtos" }, { number: "8.3.3.3", title: "Características especiais" }, { number: "8.5", title: "Produção e provisão de serviço" }, { number: "8.5.6.1", title: "Gestão de ferramental" }, { number: "8.7.1.4", title: "Controle de produto retrabalhado" }] },
    ],
  },
  {
    id: "iso13485", code: "ISO 13485", name: "Dispositivos Médicos", fullName: "ISO 13485:2016 – Dispositivos Médicos – SGQ",
    category: "saude", year: 2016, popularity: 58,
    description: "Norma que especifica requisitos para um sistema de gestão da qualidade em organizações que fornecem dispositivos médicos e serviços relacionados, visando atender requisitos regulamentares e do cliente de forma consistente.",
    applicability: "Fabricantes de dispositivos médicos, distribuidores, importadores, representantes e prestadores de serviços associados (esterilização, calibração, etc.).",
    benefits: ["Conformidade com ANVISA e FDA", "Acesso a mercados regulados (EUA, UE, Japão)", "Rastreabilidade de dispositivos", "Redução de riscos ao paciente", "Facilitação de registros de produtos na saúde"],
    clauses: [
      { id: "c4dm", number: "4", title: "SGQ", description: "Requisitos gerais, documentação e registros.", subClauses: [{ number: "4.1", title: "Requisitos gerais" }, { number: "4.2", title: "Requisitos de documentação" }] },
      { id: "c7dm", number: "7", title: "Realização do produto", description: "Planejamento, requisitos do cliente, projeto, compras, produção e controle.", subClauses: [{ number: "7.1", title: "Planejamento da realização" }, { number: "7.2", title: "Processos relacionados ao cliente" }, { number: "7.3", title: "Projeto e desenvolvimento" }, { number: "7.4", title: "Aquisição" }, { number: "7.5", title: "Produção e provisão de serviço" }, { number: "7.6", title: "Controle de dispositivos de monitoramento e medição" }] },
      { id: "c8dm", number: "8", title: "Medição, análise e melhoria", description: "Monitoramento, controle de produto NC, análise de dados, melhoria.", subClauses: [{ number: "8.2", title: "Monitoramento e medição" }, { number: "8.3", title: "Controle de produto não conforme" }, { number: "8.4", title: "Análise de dados" }, { number: "8.5", title: "Melhoria" }] },
    ],
  },
  {
    id: "iso20000", code: "ISO/IEC 20000-1", name: "Gestão de Serviços de TI", fullName: "ISO/IEC 20000-1:2018 – Gestão de Serviços de TI",
    category: "telecom", year: 2018, popularity: 52,
    description: "Norma para sistemas de gestão de serviços de TI (SGS), baseada nas melhores práticas ITIL. Define requisitos para planejar, estabelecer, implementar, operar, monitorar e melhorar continuamente a entrega de serviços de TI.",
    applicability: "Provedores de serviços de TI internos e externos, MSPs, empresas de outsourcing e data centers.",
    benefits: ["Melhoria da entrega de serviços de TI", "Alinhamento com ITIL e melhores práticas", "Maior satisfação do cliente/usuário", "Gestão eficaz de incidentes e mudanças", "Diferenciação no mercado de TI"],
    clauses: [
      { id: "c4ti", number: "4", title: "Contexto da organização", description: "Contexto, partes interessadas, escopo do SGS.", subClauses: [{ number: "4.1", title: "Contexto" }, { number: "4.2", title: "Partes interessadas" }, { number: "4.3", title: "Escopo do SGS" }, { number: "4.4", title: "SGS" }] },
      { id: "c8ti", number: "8", title: "Operação do SGS", description: "Planejamento, catálogo, gestão de ativos, configuração, relacionamento, capacidade, demanda, nível de serviço.", subClauses: [{ number: "8.2", title: "Portfólio de serviços" }, { number: "8.3", title: "Gestão de relacionamento" }, { number: "8.4", title: "Resolução e cumprimento" }, { number: "8.5", title: "Gestão de problemas" }, { number: "8.6", title: "Gestão de configuração e ativos" }] },
    ],
  },
  {
    id: "iso37301", code: "ISO 37301", name: "Compliance", fullName: "ISO 37301:2021 – Sistemas de Gestão de Compliance",
    category: "responsabilidade", year: 2021, popularity: 70,
    description: "Norma que substitui a ISO 19600, fornecendo requisitos certificáveis para sistemas de gestão de compliance. Fundamental para organizações que buscam demonstrar comprometimento com conformidade legal, ética e regulatória.",
    applicability: "Todas as organizações, especialmente as reguladas (financeiro, saúde, energia), estatais, multinacionais e empresas em mercados de alto risco.",
    benefits: ["Cultura de integridade e conformidade", "Prevenção de sanções e multas", "Melhoria da governança corporativa", "Integração com ISO 37001 (antissuborno)", "Atendimento a CGU e programas de integridade"],
    clauses: [
      { id: "c4cp", number: "4", title: "Contexto da organização", description: "Contexto, obrigações de compliance, partes interessadas, escopo.", subClauses: [{ number: "4.1", title: "Contexto" }, { number: "4.2", title: "Partes interessadas" }, { number: "4.3", title: "Escopo" }, { number: "4.4", title: "Sistema de gestão de compliance" }, { number: "4.5", title: "Obrigações de compliance" }, { number: "4.6", title: "Avaliação de riscos de compliance" }] },
      { id: "c5cp", number: "5", title: "Liderança", description: "Comprometimento, política, cultura, função de compliance.", subClauses: [{ number: "5.1", title: "Liderança e comprometimento" }, { number: "5.2", title: "Política de compliance" }, { number: "5.3", title: "Papéis e responsabilidades" }, { number: "5.4", title: "Função de compliance" }] },
      { id: "c8cp", number: "8", title: "Operação", description: "Planejamento, controle de riscos, obrigações, reporte de preocupações.", subClauses: [{ number: "8.1", title: "Planejamento e controle" }, { number: "8.2", title: "Obrigações e riscos" }, { number: "8.3", title: "Reporte de preocupações" }, { number: "8.4", title: "Processo de investigação" }] },
    ],
  },
  {
    id: "iso14064", code: "ISO 14064", name: "Gases de Efeito Estufa", fullName: "ISO 14064-1:2018 – Quantificação de GEE",
    category: "ambiental", year: 2018, popularity: 60,
    description: "Norma para quantificação e relato de emissões e remoções de gases de efeito estufa (GEE). Essencial para inventários de carbono, metas Net Zero e conformidade com regulamentações climáticas crescentes.",
    applicability: "Organizações que precisam inventariar suas emissões de GEE, reportar para CDP, GRI, GHG Protocol ou atender regulamentações climáticas.",
    benefits: ["Inventário de carbono padronizado", "Base para metas Net Zero e SBTi", "Conformidade com CDP, GRI, TCFD", "Identificação de oportunidades de redução", "Transparência climática para investidores"],
    clauses: [
      { id: "c5ghg", number: "5", title: "Princípios", description: "Relevância, completude, consistência, exatidão, transparência.", subClauses: [{ number: "5.1", title: "Relevância" }, { number: "5.2", title: "Completude" }, { number: "5.3", title: "Consistência" }, { number: "5.4", title: "Exatidão" }, { number: "5.5", title: "Transparência" }] },
      { id: "c6ghg", number: "6", title: "Escopo e limites", description: "Limites organizacionais, limites operacionais (escopos 1, 2, 3).", subClauses: [{ number: "6.1", title: "Limites organizacionais" }, { number: "6.2", title: "Limites operacionais" }] },
      { id: "c7ghg", number: "7", title: "Quantificação", description: "Identificação de fontes, seleção de metodologia, coleta de dados, cálculos.", subClauses: [{ number: "7.1", title: "Identificação de fontes de GEE" }, { number: "7.2", title: "Seleção de abordagem de quantificação" }, { number: "7.3", title: "Coleta de dados" }, { number: "7.4", title: "Cálculo de emissões" }] },
    ],
  },
  {
    id: "fsc", code: "FSC CoC", name: "Cadeia de Custódia Florestal", fullName: "FSC – Forest Stewardship Council – Cadeia de Custódia",
    category: "ambiental", year: 2015, popularity: 72,
    description: "Certificação do Forest Stewardship Council que garante que produtos florestais (madeira, papel, embalagens, borracha) foram manejados de forma ambientalmente responsável, socialmente benéfica e economicamente viável ao longo de toda a cadeia de custódia. O Brasil é um dos países com maior área certificada FSC do mundo.",
    applicability: "Fabricantes, processadores e distribuidores de produtos florestais: madeireiras, papeleiras, gráficas, fabricantes de embalagens, moveleiros e distribuidores.",
    benefits: ["Acesso a mercados internacionais exigentes (Europa, EUA)", "Diferenciação ambiental do produto", "Compliance com legislação florestal (SFB, IBAMA)", "Preferência em licitações públicas federais", "Valorização da marca e relatórios ESG"],
    clauses: [
      { id: "c1fsc", number: "1", title: "Conformidade com a legislação", description: "Conformidade com leis florestais, trabalhistas e ambientais aplicáveis.", subClauses: [] },
      { id: "c2fsc", number: "2", title: "Sistema de controle da cadeia de custódia", description: "Controle de materiais FSC por segregação física ou sistema de porcentagem.", subClauses: [{ number: "2.1", title: "Identificação de materiais de entrada" }, { number: "2.2", title: "Controle de entradas e saídas" }, { number: "2.3", title: "Segregação ou sistema de porcentagem" }] },
      { id: "c3fsc", number: "3", title: "Documentação e rastreabilidade", description: "Registros de compras, vendas, produção e reivindicações FSC.", subClauses: [{ number: "3.1", title: "Documentos de compra (invoices)" }, { number: "3.2", title: "Documentos de venda com declaração FSC" }, { number: "3.3", title: "Registros de produção e processamento" }] },
      { id: "c4fsc", number: "4", title: "Reivindicações de marketing", description: "Uso correto do rótulo FSC em produtos e materiais de comunicação.", subClauses: [{ number: "4.1", title: "Reivindicações em produtos" }, { number: "4.2", title: "Reivindicações promocionais e digitais" }] },
    ],
  },
  {
    id: "fssc22000", code: "FSSC 22000", name: "Certificação Segurança de Alimentos", fullName: "FSSC 22000 v6 – Food Safety System Certification",
    category: "alimentos", year: 2023, popularity: 66,
    description: "Esquema de certificação reconhecido pelo GFSI (Global Food Safety Initiative) que combina ISO 22000 com requisitos adicionais específicos por categoria de produto. Exigido por grandes varejistas e redes de fast food globais para seus fornecedores de alimentos e embalagens.",
    applicability: "Processadores de alimentos e bebidas, embalagens para contato com alimentos, fabricantes de ingredientes e aditivos, logística refrigerada de alimentos.",
    benefits: ["Reconhecimento GFSI (Walmart, Carrefour, McDonald's, Nestlé)", "Integração com ISO 22000:2018", "Requisito para exportação de alimentos processados", "Redução de auditorias de segunda parte (clientes)", "Benchmarking internacional de segurança alimentar"],
    clauses: [
      { id: "c1fs22", number: "Base", title: "ISO 22000:2018", description: "Todos os requisitos da ISO 22000:2018 são a base do FSSC 22000.", subClauses: [] },
      { id: "c2fs22", number: "Adicionais", title: "Requisitos adicionais FSSC", description: "Requisitos específicos por categoria de produto além da ISO 22000.", subClauses: [{ number: "A.1", title: "Gestão de alérgenos" }, { number: "A.2", title: "Monitoramento ambiental" }, { number: "A.3", title: "Rotulagem de produtos" }, { number: "A.4", title: "Food Defense (Bioterrorismo alimentar)" }, { number: "A.5", title: "Food Fraud (Autenticidade e adulteração)" }, { number: "A.6", title: "Cultura de segurança de alimentos" }] },
    ],
  },
  {
    id: "iso17025", code: "ISO/IEC 17025", name: "Laboratórios de Calibração e Ensaio", fullName: "ISO/IEC 17025:2017 – Competência de Laboratórios de Calibração e Ensaio",
    category: "qualidade", year: 2017, popularity: 75,
    description: "Norma que especifica os requisitos gerais para a competência, imparcialidade e operação consistente de laboratórios de ensaio e calibração. Acreditação pelo INMETRO (RBC – calibração e RBLE – ensaio) é baseada nesta norma e frequentemente exigida por contratos, ANVISA e MAPA.",
    applicability: "Laboratórios de ensaio industrial, calibração metrológica, análises clínicas, controle de qualidade em alimentos e farmacêutica, laboratórios ambientais e de construção civil.",
    benefits: ["Acreditação INMETRO (RBC e RBLE)", "Confiança e rastreabilidade metrológica dos resultados", "Conformidade com requisitos de clientes, ANVISA, MAPA e INMETRO", "Redução de erros, reensaios e reclamações", "Habilitação para laudos válidos em processos legais e regulatórios"],
    clauses: [
      { id: "c4lb", number: "4", title: "Requisitos gerais", description: "Imparcialidade e confidencialidade como pilares do laboratório.", subClauses: [{ number: "4.1", title: "Imparcialidade" }, { number: "4.2", title: "Confidencialidade" }] },
      { id: "c5lb", number: "5", title: "Requisitos estruturais", description: "Estrutura legal, organizacional e responsabilidades do laboratório.", subClauses: [{ number: "5.1", title: "Entidade legal e responsabilidade" }, { number: "5.3", title: "Pessoal-chave (responsável técnico)" }] },
      { id: "c6lb", number: "6", title: "Requisitos de recursos", description: "Pessoal, instalações, equipamentos, rastreabilidade metrológica.", subClauses: [{ number: "6.2", title: "Pessoal (competência e autorização)" }, { number: "6.3", title: "Instalações e condições ambientais" }, { number: "6.4", title: "Equipamentos (calibração e manutenção)" }, { number: "6.5", title: "Rastreabilidade metrológica ao SI" }, { number: "6.6", title: "Produtos e serviços externos" }] },
      { id: "c7lb", number: "7", title: "Requisitos do processo", description: "Métodos, manuseio de amostras, incerteza de medição, resultados.", subClauses: [{ number: "7.2", title: "Seleção, verificação e validação de métodos" }, { number: "7.4", title: "Manuseio de itens de ensaio/calibração" }, { number: "7.6", title: "Avaliação da incerteza de medição" }, { number: "7.7", title: "Assegurar a validade dos resultados (CCI)" }, { number: "7.8", title: "Relato de resultados (laudos e certificados)" }] },
      { id: "c8lb", number: "8", title: "Requisitos do sistema de gestão", description: "Documentação, reclamações, não conformidades, auditorias internas.", subClauses: [{ number: "8.4", title: "Trabalho não conforme" }, { number: "8.5", title: "Ações corretivas" }, { number: "8.7", title: "Auditorias internas" }, { number: "8.8", title: "Análise crítica pela direção" }] },
    ],
  },
  {
    id: "iso26000", code: "ISO 26000", name: "Responsabilidade Social (Diretrizes)", fullName: "ISO 26000:2010 – Diretrizes sobre Responsabilidade Social",
    category: "responsabilidade", year: 2010, popularity: 68,
    description: "Norma de diretrizes (não certificável) que fornece orientação sobre responsabilidade social. Referência global para as 7 matérias fundamentais de RS, complementar ao Pacto Global da ONU e ao GRI. Amplamente usada como base para estratégias ESG e relatórios de sustentabilidade no Brasil.",
    applicability: "Qualquer tipo de organização — pública ou privada, de qualquer porte — incluindo ONGs, cooperativas, governos e empresas que desejam integrar RS em suas práticas e estratégias.",
    benefits: ["Framework para relatórios ESG e de sustentabilidade", "Cobertura das 7 matérias fundamentais de RS", "Alinhamento com Pacto Global da ONU e ODS", "Engajamento estruturado de partes interessadas", "Norma de orientação — complementa ISO 37001, ISO 37301 e GRI"],
    clauses: [
      { id: "c5rs", number: "5", title: "Reconhecendo a responsabilidade social", description: "Identificar responsabilidades, due diligence e engajar partes interessadas.", subClauses: [{ number: "5.1", title: "Reconhecendo a RS e o desenvolvimento sustentável" }, { number: "5.2", title: "Identificando e engajando partes interessadas" }, { number: "5.3", title: "Exercendo due diligence" }] },
      { id: "c6rs", number: "6", title: "As 7 matérias fundamentais de RS", description: "Governança, Direitos Humanos, Práticas Trabalhistas, Meio Ambiente, Práticas Operacionais, Questões do Consumidor e Desenvolvimento da Comunidade.", subClauses: [{ number: "6.2", title: "Governança organizacional" }, { number: "6.3", title: "Direitos humanos" }, { number: "6.4", title: "Práticas trabalhistas" }, { number: "6.5", title: "Meio ambiente" }, { number: "6.6", title: "Práticas leais de operação" }, { number: "6.7", title: "Questões relativas ao consumidor" }, { number: "6.8", title: "Envolvimento e desenvolvimento da comunidade" }] },
      { id: "c7rs", number: "7", title: "Integrando a RS na organização", description: "Comunicar a RS, aumentar a credibilidade, revisar e melhorar.", subClauses: [{ number: "7.3", title: "Comunicando a RS" }, { number: "7.5", title: "Aumentando a credibilidade em RS" }, { number: "7.7", title: "Revisando e melhorando as ações de RS" }] },
    ],
  },
  {
    id: "sa8000", code: "SA 8000", name: "Responsabilidade Social Trabalhista", fullName: "SA 8000:2014 – Social Accountability International",
    category: "responsabilidade", year: 2014, popularity: 50,
    description: "Norma internacional certificável baseada em convenções da OIT e na Declaração Universal dos Direitos Humanos, que verifica condições de trabalho dignas: ausência de trabalho infantil ou forçado, liberdade de associação, remuneração justa e controle de horas de trabalho.",
    applicability: "Empresas exportadoras, fornecedoras de grandes cadeias varejistas globais (moda, eletrônicos, alimentos), indústrias de manufatura intensiva em mão de obra e empresas com operações em países em desenvolvimento.",
    benefits: ["Conformidade com padrões internacionais trabalhistas (OIT)", "Exigência de grandes compradores globais (Gap, H&M, Nike, IKEA)", "Prevenção de denúncias, boicotes e auditoria social", "Melhoria das condições de trabalho e retenção", "Diferenciação ESG na cadeia de fornecimento global"],
    clauses: [
      { id: "c1sa", number: "1", title: "Trabalho infantil", description: "Proibição de trabalho de menores de 15 anos (ou 14 em países com exceção OIT Convênio 138).", subClauses: [] },
      { id: "c2sa", number: "2", title: "Trabalho forçado e compulsório", description: "Proibição de qualquer forma de trabalho forçado, servidão por dívida e tráfico de pessoas.", subClauses: [] },
      { id: "c3sa", number: "3", title: "Saúde e segurança", description: "Ambiente de trabalho seguro, prevenção de acidentes, EPIs e gestão de riscos ocupacionais.", subClauses: [] },
      { id: "c4sa", number: "4", title: "Liberdade de associação e negociação coletiva", description: "Direito à sindicalização e negociação coletiva sem represálias.", subClauses: [] },
      { id: "c5sa", number: "5", title: "Discriminação", description: "Proibição de discriminação por raça, gênero, religião, origem, deficiência, gravidez.", subClauses: [] },
      { id: "c6sa", number: "6", title: "Práticas disciplinares", description: "Proibição de punição corporal, coerção mental ou física e abuso verbal.", subClauses: [] },
      { id: "c7sa", number: "7", title: "Horas de trabalho", description: "Máximo de 48 horas semanais regulares + 12 horas extras voluntárias, com um dia de descanso.", subClauses: [] },
      { id: "c8sa", number: "8", title: "Remuneração", description: "Salário mínimo legal e suficiente para cobrir necessidades básicas dos trabalhadores.", subClauses: [] },
      { id: "c9sa", number: "9", title: "Sistema de gestão", description: "Política, representante da gestão, planejamento, controle de fornecedores e gestão de reclamações.", subClauses: [{ number: "9.1", title: "Política de responsabilidade social" }, { number: "9.4", title: "Controle de fornecedores e subcontratados" }, { number: "9.11", title: "Auditoria interna" }, { number: "9.16", title: "Gestão de reclamações" }] },
    ],
  },
  {
    id: "iso55001", code: "ISO 55001", name: "Gestão de Ativos Físicos", fullName: "ISO 55001:2014 – Sistemas de Gestão de Ativos",
    category: "qualidade", year: 2014, popularity: 58,
    description: "Norma para gestão de ativos físicos (equipamentos, infraestrutura, frotas) ao longo de todo o ciclo de vida, alinhando as decisões de investimento e manutenção aos objetivos organizacionais. Crescente no Brasil em energia elétrica (requisito ANEEL), saneamento e concessões de infraestrutura.",
    applicability: "Concessionárias de energia elétrica, saneamento básico, transporte e logística, empresas com grande parque de ativos industriais, mineradoras e infraestrutura pública concedida.",
    benefits: ["Otimização do ciclo de vida e TCO dos ativos", "Redução de falhas, paradas não planejadas e custos de manutenção", "Alinhamento com requisitos da ANEEL (PRODIST) e ARSESP", "Melhoria na tomada de decisão de capex vs opex", "Integração natural com ISO 31000 (riscos) e ISO 50001 (energia)"],
    clauses: [
      { id: "c4at55", number: "4", title: "Contexto da organização", description: "Partes interessadas, requisitos legais de ativos, escopo do Sistema de Gestão de Ativos.", subClauses: [{ number: "4.1", title: "Contexto e questões internas/externas" }, { number: "4.2", title: "Partes interessadas e seus requisitos" }, { number: "4.3", title: "Escopo do SGA" }] },
      { id: "c6at55", number: "6", title: "Planejamento", description: "Plano Estratégico de Gestão de Ativos (PEGA), objetivos e planos de ativos.", subClauses: [{ number: "6.1", title: "Riscos e oportunidades para o SGA" }, { number: "6.2", title: "Objetivos de gestão de ativos e planos" }, { number: "6.2.2", title: "Planos de ativos individuais e portfólio" }] },
      { id: "c8at55", number: "8", title: "Operação", description: "Gestão do ciclo de vida, controle de mudanças e terceirização de serviços.", subClauses: [{ number: "8.1", title: "Planejamento e controle operacional" }, { number: "8.2", title: "Gestão de mudanças que afetam ativos" }, { number: "8.3", title: "Terceirização de atividades de ativos" }] },
      { id: "c9at55", number: "9", title: "Avaliação de desempenho", description: "Monitoramento de KPIs de ativos, auditoria e análise crítica.", subClauses: [{ number: "9.1", title: "Monitoramento, medição e avaliação de ativos" }, { number: "9.2", title: "Auditoria interna do SGA" }, { number: "9.3", title: "Análise crítica pela direção" }] },
    ],
  },
  {
    id: "gri", code: "GRI Standards", name: "Relatório de Sustentabilidade ESG", fullName: "GRI Standards 2021 – Global Reporting Initiative",
    category: "responsabilidade", year: 2021, popularity: 73,
    description: "Padrão global mais adotado para relatórios de sustentabilidade ESG (Environmental, Social and Governance). Permite que organizações divulguem impactos em economia, meio ambiente e sociedade de forma padronizada e comparável. Exigido pela B3 (Nível 1) e por investidores institucionais no Brasil.",
    applicability: "Empresas listadas na B3, empresas de capital aberto, grandes corporações, estatais e qualquer organização que emite relatório de sustentabilidade ou integrado.",
    benefits: ["Padrão B3 e ANBIMA para relatórios ESG", "Alinhamento com ODS da ONU (Agenda 2030)", "Transparência para investidores, fundos e stakeholders ESG", "Compatibilidade com ISSB (IFRS S1/S2) e CSRD europeia", "Base para relatórios integrados (Framework IIRC/ISSB)"],
    clauses: [
      { id: "c1gri", number: "GRI 1", title: "Fundação 2021", description: "Conceitos fundamentais, princípios de relatório e requisitos básicos de uso.", subClauses: [{ number: "1.1", title: "Propósito e princípios GRI" }, { number: "1.2", title: "Processo de due diligence e dupla materialidade" }, { number: "1.3", title: "Requisitos de conformidade" }] },
      { id: "c2gri", number: "GRI 2", title: "Divulgações gerais 2021", description: "Perfil organizacional, estratégia, práticas, governança e engajamento de partes interessadas.", subClauses: [{ number: "2-1", title: "Detalhes organizacionais" }, { number: "2-6", title: "Atividades, cadeia de valor e relações de negócio" }, { number: "2-9", title: "Estrutura e composição de governança" }, { number: "2-22", title: "Declaração sobre estratégia de desenvolvimento sustentável" }, { number: "2-29", title: "Abordagem de engajamento de partes interessadas" }] },
      { id: "c3gri", number: "GRI 3", title: "Tópicos materiais 2021", description: "Processo de materialidade, lista e gestão de tópicos materiais ESG.", subClauses: [{ number: "3-1", title: "Processo para determinar tópicos materiais" }, { number: "3-2", title: "Lista de tópicos materiais" }, { number: "3-3", title: "Gestão de tópicos materiais" }] },
      { id: "c200gri", number: "GRI 200–400", title: "Padrões temáticos (E, S e G)", description: "Econômico (GRI 200), Ambiental (GRI 300) e Social (GRI 400) — indicadores quantitativos e qualitativos.", subClauses: [{ number: "302", title: "Energia (consumo e intensidade)" }, { number: "305", title: "Emissões de GEE (escopos 1, 2 e 3)" }, { number: "306", title: "Resíduos" }, { number: "401", title: "Emprego (contratações e rotatividade)" }, { number: "403", title: "SSO (acidentes, doenças e absenteísmo)" }, { number: "405", title: "Diversidade e igualdade de remuneração" }, { number: "413", title: "Comunidades locais" }] },
    ],
  },
  {
    id: "iso39001", code: "ISO 39001", name: "Segurança no Tráfego Rodoviário", fullName: "ISO 39001:2012 – Sistemas de Gestão de Segurança Viária (STT)",
    category: "seguranca", year: 2012, popularity: 48,
    description: "Norma para sistemas de gestão de segurança no tráfego rodoviário, ajudando organizações a reduzir mortes e ferimentos graves no trânsito. Relevante no Brasil para frotas corporativas, transportadoras e empresas com alto volume de deslocamentos (Brasil ocupa posição crítica no ranking de mortes no trânsito).",
    applicability: "Transportadoras e empresas de logística, empresas com frotas próprias significativas, operadoras de infraestrutura viária (concessionárias), montadoras e órgãos de trânsito (DENATRAN/SENATRAN).",
    benefits: ["Redução de acidentes fatais e custos com sinistros", "Redução de prêmios de seguro de frota", "Conformidade com Política Nacional de Segurança Viária (Lei 13.546)", "Estruturação de programa de gestão de frotas e motoristas", "Diferenciação em ESG e responsabilidade social corporativa"],
    clauses: [
      { id: "c4stt", number: "4", title: "Contexto da organização", description: "Fatores do sistema viário, partes interessadas e escopo do STT.", subClauses: [{ number: "4.1", title: "Fatores do sistema de segurança viária" }, { number: "4.2", title: "Partes interessadas e seus requisitos" }, { number: "4.3", title: "Escopo do STT" }] },
      { id: "c6stt", number: "6", title: "Planejamento", description: "Identificação de riscos viários, indicadores de desempenho e objetivos.", subClauses: [{ number: "6.1", title: "Riscos e oportunidades de segurança viária" }, { number: "6.2", title: "Resultados de desempenho viário (mortes, ferimentos)" }, { number: "6.3", title: "Identificação de fatores críticos de risco" }] },
      { id: "c8stt", number: "8", title: "Operação", description: "Controles operacionais: veículos, rotas, velocidade, condutores e fadiga.", subClauses: [{ number: "8.1", title: "Planejamento e controle operacional de viagens" }, { number: "8.2", title: "Gestão de incidentes e acidentes" }] },
    ],
  },
  {
    id: "nbr16001", code: "ABNT NBR 16001", name: "Responsabilidade Social (ABNT)", fullName: "ABNT NBR 16001:2012 – Responsabilidade Social – Sistema de Gestão",
    category: "responsabilidade", year: 2012, popularity: 45,
    description: "Norma brasileira certificável de responsabilidade social, desenvolvida pela ABNT. É a referência nacional para organizações que buscam implementar e certificar um sistema de gestão de RS com foco nas realidades do contexto brasileiro, incluindo CLT, Estatuto da Criança e do Adolescente e legislação ambiental nacional.",
    applicability: "Empresas brasileiras de qualquer porte e setor, especialmente aquelas voltadas ao mercado doméstico e que precisam de certificação de RS reconhecida por compradores e órgãos públicos no Brasil.",
    benefits: ["Única norma brasileira certificável de responsabilidade social", "Alinhamento com legislação trabalhista nacional (CLT) e ECA", "Referência para licitações e compras públicas sustentáveis", "Complementar à ISO 26000 e GRI", "Reconhecimento em programas de integridade (CGU, TCU)"],
    clauses: [
      { id: "c4nbr", number: "4", title: "Sistema de gestão da responsabilidade social", description: "Requisitos gerais, política, planejamento, implementação, verificação e análise crítica.", subClauses: [{ number: "4.1", title: "Requisitos gerais" }, { number: "4.2", title: "Política de responsabilidade social" }, { number: "4.3", title: "Planejamento (aspectos e partes interessadas)" }, { number: "4.4", title: "Implementação e operação" }, { number: "4.5", title: "Verificação e monitoramento" }, { number: "4.6", title: "Análise crítica pela direção" }] },
    ],
  },
  {
    id: "iso45003", code: "ISO 45003", name: "Saúde Psicossocial no Trabalho", fullName: "ISO 45003:2021 – Gestão de SSO – Saúde Psicológica no Trabalho",
    category: "seguranca", year: 2021, popularity: 55,
    description: "Primeira norma internacional focada especificamente na gestão de riscos psicossociais no trabalho — estresse, burnout, assédio moral e sexual, violência, isolamento e fatores organizacionais. Complementa a ISO 45001 com foco na saúde mental dos trabalhadores, tema crescentemente exigido por investidores ESG.",
    applicability: "Qualquer organização certificada ou em processo de certificação em ISO 45001 que queira ampliar o escopo para riscos psicossociais — especialmente em call centers, saúde, educação e tecnologia.",
    benefits: ["Gestão estruturada de burnout, estresse e assédio", "Redução de absenteísmo, presenteísmo e turnover", "Alinhamento com NR-17 (ergonomia) e tendências ESG", "Retenção de talentos e melhoria do clima organizacional", "Complemento obrigatório à ISO 45001 em ambientes de alta pressão"],
    clauses: [
      { id: "c5psi", number: "5", title: "Liderança e comprometimento", description: "Papel da liderança na criação de ambiente psicologicamente seguro e cultura organizacional saudável.", subClauses: [{ number: "5.1", title: "Cultura organizacional e comprometimento da liderança" }, { number: "5.4", title: "Participação e consulta dos trabalhadores" }] },
      { id: "c6psi", number: "6", title: "Planejamento", description: "Identificação de perigos psicossociais, avaliação e priorização de riscos.", subClauses: [{ number: "6.1.2.1", title: "Identificação de perigos psicossociais" }, { number: "6.1.2.2", title: "Fatores de risco: carga, controle, relacionamento, papel, mudanças" }] },
      { id: "c8psi", number: "8", title: "Operação", description: "Controles operacionais: carga de trabalho, comunicação, suporte social, conflito e assédio.", subClauses: [{ number: "8.1", title: "Planejamento e controle de riscos psicossociais" }, { number: "8.1.3", title: "Gestão de mudanças organizacionais" }, { number: "8.2", title: "Preparação e resposta a situações de crise psicossocial" }] },
      { id: "c9psi", number: "9", title: "Avaliação de desempenho", description: "Monitoramento de indicadores de saúde mental, auditoria e revisão.", subClauses: [{ number: "9.1", title: "Indicadores de saúde mental e bem-estar" }, { number: "9.2", title: "Auditoria interna de riscos psicossociais" }] },
    ],
  },
  {
    id: "iso27701", code: "ISO 27701", name: "Gestão da Privacidade", fullName: "ISO/IEC 27701:2019 – Gestão da Privacidade da Informação",
    category: "informacao", year: 2019, popularity: 64,
    description: "Extensão da ISO 27001/27002 com requisitos adicionais para gestão de informações de identificação pessoal (PII). Alinhada com a LGPD brasileira e o GDPR europeu, fornece orientações para controladores e operadores de dados pessoais.",
    applicability: "Organizações que tratam dados pessoais (controladores e operadores), especialmente as sujeitas a LGPD, GDPR ou outras regulamentações de privacidade.",
    benefits: ["Conformidade com LGPD e GDPR", "Demonstração de accountability em privacidade", "Framework para DPIA e gestão de consentimento", "Redução de riscos de vazamento de dados pessoais", "Confiança de titulares e reguladores (ANPD)"],
    clauses: [
      { id: "c5pv", number: "5", title: "Requisitos específicos PIMS (ISO 27001)", description: "Extensões dos requisitos da ISO 27001 para privacidade.", subClauses: [{ number: "5.2", title: "Contexto e escopo PIMS" }, { number: "5.4", title: "Avaliação de riscos de privacidade" }] },
      { id: "c7pv", number: "7", title: "Orientações para controladores de PII", description: "Condições de coleta, finalidade, minimização, precisão, comunicação ao titular.", subClauses: [{ number: "7.2", title: "Condições para coleta e processamento" }, { number: "7.3", title: "Obrigações para titulares" }, { number: "7.4", title: "Gestão de privacidade por design" }, { number: "7.5", title: "Compartilhamento e transferência" }] },
      { id: "c8pv", number: "8", title: "Orientações para operadores de PII", description: "Processamento sob contrato, subcontratados, transferência, confidencialidade.", subClauses: [{ number: "8.2", title: "Condições de processamento" }, { number: "8.3", title: "Obrigações para com o controlador" }, { number: "8.4", title: "Gestão de violação de dados" }, { number: "8.5", title: "Conformidade" }] },
    ],
  },
];

const mockCompanies = [
  "Metalúrgica AçoForte", "Grupo Energis", "Plastiform Industrial",
  "TechSoft Sistemas", "BioFarma Ltda", "Construtora Nova Era",
  "Alimentos Sabor & Cia", "TransLog Logística", "EcoVerde Sustentável",
];

const consultants = ["Carlos Silva", "Ana Costa", "Roberto Lima", "Juliana Mendes"];

export default function NormasPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<NormCategory | "todas">("todas");
  const [selectedNorm, setSelectedNorm] = useState<Norm | null>(null);
  const [expandedClause, setExpandedClause] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<CompanyAssignment[]>([
    { id: "a1", companyName: "Metalúrgica AçoForte", normId: "iso9001", status: "certificado", startDate: "2024-01-15", targetDate: "2024-12-30", consultant: "Carlos Silva", progress: 100 },
    { id: "a2", companyName: "Metalúrgica AçoForte", normId: "iso14001", status: "em-andamento", startDate: "2025-03-01", targetDate: "2026-06-30", consultant: "Ana Costa", progress: 45 },
    { id: "a3", companyName: "Grupo Energis", normId: "iso50001", status: "em-andamento", startDate: "2025-06-01", targetDate: "2026-08-15", consultant: "Carlos Silva", progress: 30 },
    { id: "a4", companyName: "Grupo Energis", normId: "iso9001", status: "certificado", startDate: "2023-02-10", targetDate: "2024-01-30", consultant: "Roberto Lima", progress: 100 },
    { id: "a5", companyName: "Plastiform Industrial", normId: "iso14001", status: "certificado", startDate: "2024-05-01", targetDate: "2025-04-30", consultant: "Juliana Mendes", progress: 100 },
    { id: "a6", companyName: "TechSoft Sistemas", normId: "iso27001", status: "em-andamento", startDate: "2025-09-01", targetDate: "2026-12-30", consultant: "Ana Costa", progress: 20 },
    { id: "a7", companyName: "Alimentos Sabor & Cia", normId: "iso22000", status: "implementado", startDate: "2025-01-10", targetDate: "2026-03-15", consultant: "Roberto Lima", progress: 85 },
    { id: "a8", companyName: "BioFarma Ltda", normId: "iso9001", status: "em-andamento", startDate: "2025-11-01", targetDate: "2026-10-30", consultant: "Carlos Silva", progress: 15 },
  ]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ company: "", normId: "", consultant: "", targetDate: "" });

  // Trava scroll do body quando modal está aberto
  useEffect(() => {
    if (showAssignModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showAssignModal]);

  const filteredNorms = useMemo(() => {
    return norms.filter((n) => {
      if (categoryFilter !== "todas" && n.category !== categoryFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return n.code.toLowerCase().includes(q) || n.name.toLowerCase().includes(q) || n.fullName.toLowerCase().includes(q) || n.description.toLowerCase().includes(q);
    }).sort((a, b) => b.popularity - a.popularity);
  }, [search, categoryFilter]);

  const normAssignments = useMemo(() => {
    if (!selectedNorm) return [];
    return assignments.filter((a) => a.normId === selectedNorm.id);
  }, [selectedNorm, assignments]);

  const handleAssign = () => {
    if (!assignForm.company || !assignForm.normId || !assignForm.consultant || !assignForm.targetDate) return;
    const exists = assignments.some((a) => a.companyName === assignForm.company && a.normId === assignForm.normId && a.status !== "certificado");
    if (exists) { alert("Essa empresa já possui essa norma em andamento."); return; }
    setAssignments((prev) => [...prev, {
      id: `a-${Date.now()}`, companyName: assignForm.company, normId: assignForm.normId,
      status: "nao-iniciado", startDate: new Date().toISOString().slice(0, 10),
      targetDate: assignForm.targetDate, consultant: assignForm.consultant, progress: 0,
    }]);
    setAssignForm({ company: "", normId: "", consultant: "", targetDate: "" });
    setShowAssignModal(false);
  };

  const stats = useMemo(() => {
    const total = assignments.length;
    const cert = assignments.filter((a) => a.status === "certificado").length;
    const andamento = assignments.filter((a) => a.status === "em-andamento").length;
    const impl = assignments.filter((a) => a.status === "implementado").length;
    return { total, cert, andamento, impl };
  }, [assignments]);

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-certifica-900 text-lg" style={{ fontWeight: 700 }}>Painel de Normas</h2>
          <p className="text-[11px] text-certifica-500">Biblioteca completa de normas ISO e certificações — vincule normas a empresas e acompanhe a implementação.</p>
        </div>
        <div className="flex gap-2">
          <DSButton size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => { setShowAssignModal(true); setAssignForm({ company: "", normId: selectedNorm?.id ?? "", consultant: "", targetDate: "" }); }}>
            Vincular norma a empresa
          </DSButton>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Normas cadastradas", value: norms.length, color: "text-certifica-accent" },
          { label: "Certificações ativas", value: stats.cert, color: "text-conformidade" },
          { label: "Implementações em andamento", value: stats.andamento, color: "text-observacao" },
          { label: "Implementadas (aguardando cert.)", value: stats.impl, color: "text-oportunidade" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-certifica-200 rounded-[4px] p-3">
            <div className="text-[10px] uppercase tracking-wider text-certifica-500 mb-1" style={{ fontWeight: 600 }}>{kpi.label}</div>
            <div className={`text-2xl ${kpi.color}`} style={{ fontWeight: 700 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        {/* Left – norm list */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-certifica-500/40" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar norma por código, nome ou descrição..." className="w-full h-8 pl-8 pr-3 rounded-[4px] bg-white border border-certifica-200 text-[12px] focus:outline-none focus:ring-1 focus:ring-certifica-accent/40" />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as NormCategory | "todas")} className="h-8 px-2 rounded-[4px] border border-certifica-200 text-[11px] bg-white">
              <option value="todas">Todas categorias</option>
              {Object.entries(categoryMeta).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            {filteredNorms.map((norm) => {
              const cat = categoryMeta[norm.category];
              const companyCount = assignments.filter((a) => a.normId === norm.id).length;
              const isActive = selectedNorm?.id === norm.id;
              return (
                <button key={norm.id} onClick={() => { setSelectedNorm(norm); setExpandedClause(null); }} className={`w-full text-left bg-white border rounded-[4px] p-3.5 transition-all ${isActive ? "border-certifica-accent shadow-sm" : "border-certifica-200 hover:border-certifica-accent/40"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cat.color}>{cat.icon}</span>
                        <span className="text-[13px] text-certifica-dark" style={{ fontWeight: 700 }}>{norm.code}</span>
                        <span className="text-[12px] text-certifica-500">·</span>
                        <span className="text-[12px] text-certifica-dark" style={{ fontWeight: 500 }}>{norm.name}</span>
                        <DSBadge variant="outline">{norm.year}</DSBadge>
                      </div>
                      <p className="text-[11px] text-certifica-500 line-clamp-2">{norm.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <DSBadge variant="conformidade">{cat.label}</DSBadge>
                      {companyCount > 0 && (
                        <span className="text-[10px] text-certifica-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {companyCount} empresa{companyCount > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            {filteredNorms.length === 0 && (
              <div className="text-center py-12 text-certifica-500 text-[12px]">Nenhuma norma encontrada para "{search}".</div>
            )}
          </div>
        </div>

        {/* Right – detail panel */}
        <div className="bg-white border border-certifica-200 rounded-[4px] overflow-hidden">
          {!selectedNorm ? (
            <div className="h-full flex flex-col items-center justify-center text-certifica-500 p-8 text-center">
              <BookOpen className="w-10 h-10 mb-3 text-certifica-200" />
              <p className="text-[13px]" style={{ fontWeight: 500 }}>Selecione uma norma</p>
              <p className="text-[11px] mt-1">Clique em qualquer norma para ver detalhes, cláusulas e empresas vinculadas.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full max-h-[calc(100vh-220px)]">
              <div className="px-4 py-3 border-b border-certifica-200 flex-shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={categoryMeta[selectedNorm.category].color}>{categoryMeta[selectedNorm.category].icon}</span>
                  <span className="text-[15px] text-certifica-dark" style={{ fontWeight: 700 }}>{selectedNorm.code}</span>
                  <DSBadge variant="outline">{selectedNorm.year}</DSBadge>
                </div>
                <p className="text-[12px] text-certifica-dark" style={{ fontWeight: 500 }}>{selectedNorm.fullName}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
                {/* Description */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Descrição</div>
                  <p className="text-[11.5px] text-certifica-dark leading-relaxed">{selectedNorm.description}</p>
                </div>

                {/* Applicability */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Aplicabilidade</div>
                  <p className="text-[11.5px] text-certifica-dark leading-relaxed">{selectedNorm.applicability}</p>
                </div>

                {/* Benefits */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-certifica-500 mb-1.5" style={{ fontWeight: 600 }}>Benefícios</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNorm.benefits.map((b) => (
                      <span key={b} className="inline-flex items-center gap-1 px-2 py-1 bg-conformidade/10 text-conformidade rounded-[3px] text-[10px]">
                        <Lightbulb className="w-2.5 h-2.5" /> {b}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Clauses */}
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-certifica-500 mb-1.5" style={{ fontWeight: 600 }}>
                    Estrutura de cláusulas ({selectedNorm.clauses.length})
                  </div>
                  <div className="space-y-1">
                    {selectedNorm.clauses.map((clause) => {
                      const isExpanded = expandedClause === clause.id;
                      return (
                        <div key={clause.id} className="border border-certifica-200 rounded-[4px] overflow-hidden">
                          <button
                            onClick={() => setExpandedClause(isExpanded ? null : clause.id)}
                            className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-certifica-50 transition-colors"
                          >
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-certifica-accent" /> : <ChevronRight className="w-3.5 h-3.5 text-certifica-500" />}
                            <span className="text-[11px] text-certifica-accent" style={{ fontWeight: 700 }}>{clause.number}</span>
                            <span className="text-[11px] text-certifica-dark" style={{ fontWeight: 500 }}>{clause.title}</span>
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-2.5 border-t border-certifica-100">
                              <p className="text-[10.5px] text-certifica-500 mt-2 mb-2">{clause.description}</p>
                              {clause.subClauses && clause.subClauses.length > 0 && (
                                <div className="space-y-1 ml-2">
                                  {clause.subClauses.map((sc) => (
                                    <div key={sc.number} className="flex items-center gap-2 text-[10.5px]">
                                      <span className="text-certifica-accent" style={{ fontWeight: 600 }}>{sc.number}</span>
                                      <span className="text-certifica-dark">{sc.title}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Companies */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-certifica-500" style={{ fontWeight: 600 }}>
                      Empresas vinculadas ({normAssignments.length})
                    </div>
                    <button
                      onClick={() => { setShowAssignModal(true); setAssignForm({ company: "", normId: selectedNorm.id, consultant: "", targetDate: "" }); }}
                      className="text-[10px] text-certifica-accent hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Vincular empresa
                    </button>
                  </div>
                  {normAssignments.length === 0 ? (
                    <p className="text-[11px] text-certifica-500 italic">Nenhuma empresa vinculada a esta norma.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {normAssignments.map((a) => {
                        const st = statusMeta[a.status];
                        return (
                          <div key={a.id} className="border border-certifica-200 rounded-[4px] p-2.5">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11.5px] text-certifica-dark" style={{ fontWeight: 600 }}>{a.companyName}</span>
                              <DSBadge variant={st.variant}>{st.label}</DSBadge>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-certifica-500 mb-1.5">
                              <span>Consultor: {a.consultant}</span>
                              <span>Meta: {a.targetDate}</span>
                            </div>
                            <div className="w-full bg-certifica-100 rounded-full h-1.5">
                              <div className="bg-certifica-accent rounded-full h-1.5 transition-all" style={{ width: `${a.progress}%` }} />
                            </div>
                            <div className="text-right text-[9px] text-certifica-500 mt-0.5">{a.progress}%</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center certifica-modal-backdrop" onClick={() => setShowAssignModal(false)}>
          <div className="bg-white rounded-[6px] border border-certifica-200 w-[440px] shadow-lg certifica-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-certifica-200 flex items-center justify-between">
              <span className="text-[13px] text-certifica-dark" style={{ fontWeight: 600 }}>Vincular norma a empresa</span>
              <button onClick={() => setShowAssignModal(false)} className="text-certifica-500 hover:text-certifica-dark cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Empresa *</label>
                <select value={assignForm.company} onChange={(e) => setAssignForm((p) => ({ ...p, company: e.target.value }))} className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]">
                  <option value="">Selecione a empresa</option>
                  {mockCompanies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Norma *</label>
                <select value={assignForm.normId} onChange={(e) => setAssignForm((p) => ({ ...p, normId: e.target.value }))} className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]">
                  <option value="">Selecione a norma</option>
                  {norms.map((n) => <option key={n.id} value={n.id}>{n.code} – {n.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Consultor responsável *</label>
                <select value={assignForm.consultant} onChange={(e) => setAssignForm((p) => ({ ...p, consultant: e.target.value }))} className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]">
                  <option value="">Selecione o consultor</option>
                  {consultants.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-certifica-500 mb-1" style={{ fontWeight: 600 }}>Data alvo de certificação *</label>
                <input type="date" value={assignForm.targetDate} onChange={(e) => setAssignForm((p) => ({ ...p, targetDate: e.target.value }))} className="w-full h-8 px-2 rounded-[4px] border border-certifica-200 text-[12px]" />
              </div>
            </div>
            <div className="px-4 py-3 border-t border-certifica-200 flex justify-end gap-2">
              <DSButton variant="outline" size="sm" onClick={() => setShowAssignModal(false)}>Cancelar</DSButton>
              <DSButton size="sm" onClick={handleAssign}>Vincular</DSButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
