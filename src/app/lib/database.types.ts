/* ── Tipos auxiliares ── */
export interface TranscriptLine {
  time: string;
  speaker: string;
  text: string;
}

export interface MeetingAction {
  descricao: string;
  responsavel: string;
  prazo: string;
  concluida: boolean;
}

export type Database = {
  public: {
    Tables: {
      /* ── Clientes ─────────────────────────────────────── */
      clientes: {
        Row: {
          id: string;
          cnpj: string;
          razao_social: string;
          nome_fantasia: string;
          segmento: string;
          porte: "MEI" | "ME" | "EPP" | "Medio" | "Grande";
          status: "ativo" | "inativo" | "prospect";
          contato_nome: string;
          contato_cargo: string;
          contato_email: string;
          contato_telefone: string;
          endereco: string;
          cidade: string;
          uf: string;
          consultor_responsavel: string;
          logo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["clientes"]["Row"], "id" | "logo_url" | "created_at" | "updated_at"> & { logo_url?: string | null };
        Update: Partial<Database["public"]["Tables"]["clientes"]["Insert"]> & { logo_url?: string | null };
      };

      /* ── Projetos ─────────────────────────────────────── */
      projetos: {
        Row: {
          id: string;
          codigo: string;
          titulo: string;
          cliente_id: string;
          norma: string;
          fase: number;
          fase_label: string;
          status: "proposta" | "em-andamento" | "concluido" | "pausado" | "cancelado";
          prioridade: "alta" | "media" | "baixa";
          consultor: string;
          equipe: string[];
          inicio: string | null;
          previsao: string | null;
          escopo: string;
          valor: string;
          condicoes_pagamento: string;
          total_documentos: number;
          total_auditorias: number;
          observacoes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["projetos"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["projetos"]["Insert"]>;
      };

      /* ── Entregáveis ──────────────────────────────────── */
      entregaveis: {
        Row: {
          id: string;
          projeto_id: string;
          texto: string;
          concluido: boolean;
          ordem: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["entregaveis"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["entregaveis"]["Insert"]>;
      };

      /* ── Roles ────────────────────────────────────────── */
      roles: {
        Row: {
          id: string;
          name: string;
          description: string;
          permissions: unknown;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["roles"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
      };

      /* ── Profiles ─────────────────────────────────────── */
      profiles: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          avatar_url: string | null;
          role_id: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };

      /* ── Pipelines ────────────────────────────────────── */
      pipelines: {
        Row: {
          id: string;
          name: string;
          description: string;
          icon: string;
          user_id: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["pipelines"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["pipelines"]["Insert"]>;
      };

      /* ── Pipeline Columns ─────────────────────────────── */
      pipeline_columns: {
        Row: {
          id: string;
          pipeline_id: string | null;
          title: string;
          position: number;
          wip_limit: number;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["pipeline_columns"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["pipeline_columns"]["Insert"]>;
      };

      /* ── Pipeline Cards ───────────────────────────────── */
      pipeline_cards: {
        Row: {
          id: string;
          column_id: string;
          projeto_id: string | null;
          title: string;
          description: string;
          position: number;
          assigned_to: string;
          due_date: string | null;
          tags: string[];
          sla_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["pipeline_cards"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["pipeline_cards"]["Insert"]>;
      };

      /* ── Audits ───────────────────────────────────────── */
      audits: {
        Row: {
          id: string;
          codigo: string;
          tipo: "interna" | "externa" | "certificacao";
          cliente_id: string;
          projeto_id: string | null;
          auditor: string;
          data_inicio: string | null;
          data_fim: string | null;
          status: "planejada" | "em-andamento" | "concluida" | "cancelada";
          escopo: string;
          norma: string;
          observacoes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audits"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["audits"]["Insert"]>;
      };

      /* ── Audit Findings ───────────────────────────────── */
      audit_findings: {
        Row: {
          id: string;
          audit_id: string;
          tipo: "nc-maior" | "nc-menor" | "observacao" | "oportunidade" | "conformidade";
          clausula: string;
          descricao: string;
          evidencia: string;
          acao_corretiva: string;
          responsavel: string;
          prazo: string | null;
          status: "aberta" | "em-tratamento" | "verificada" | "fechada";
          /* Card 1: Identificação */
          norma: string;
          subclausula: string;
          titulo_clausula: string;
          area_auditada: string;
          processo_auditado: string;
          setor: string;
          local_evidencia: string;
          severidade: string;
          prioridade: string;
          /* Card 2: Evidência e Análise */
          criterio_requisito: string;
          tipo_evidencia: string;
          documento_avaliado: string;
          codigo_documento: string;
          revisao_documento: string;
          registro_analisado: string;
          amostra_qtd: string;
          criterio_amostragem: string;
          entrevistados: string;
          condicao_encontrada: string;
          desvio_identificado: string;
          impacto_potencial: string;
          risco_associado: string;
          abrangencia: string;
          qtd_itens_afetados: string;
          periodo_afetado: string;
          recorrencia: boolean;
          /* Card 3: Tratamento */
          contencao_imediata: string;
          data_contencao: string | null;
          responsavel_contencao: string;
          causa_imediata: string;
          causa_raiz: string;
          metodo_analise: string;
          correcao_imediata: string;
          acao_preventiva: string;
          recomendacao_auditor: string;
          custo_estimado: string;
          /* Card 4: Fechamento */
          verificacao_eficacia: string;
          responsavel_verificacao: string;
          data_verificacao: string | null;
          status_eficacia: string;
          observacao_anexo: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_findings"]["Row"], "id" | "created_at" | "updated_at"
          | "norma" | "subclausula" | "titulo_clausula" | "area_auditada" | "processo_auditado"
          | "setor" | "local_evidencia" | "severidade" | "prioridade"
          | "criterio_requisito" | "tipo_evidencia" | "documento_avaliado" | "codigo_documento"
          | "revisao_documento" | "registro_analisado" | "amostra_qtd" | "criterio_amostragem"
          | "entrevistados" | "condicao_encontrada" | "desvio_identificado" | "impacto_potencial"
          | "risco_associado" | "abrangencia" | "qtd_itens_afetados" | "periodo_afetado" | "recorrencia"
          | "contencao_imediata" | "data_contencao" | "responsavel_contencao" | "causa_imediata"
          | "causa_raiz" | "metodo_analise" | "correcao_imediata" | "acao_preventiva"
          | "recomendacao_auditor" | "custo_estimado"
          | "verificacao_eficacia" | "responsavel_verificacao" | "data_verificacao"
          | "status_eficacia" | "observacao_anexo"
        > & Partial<Pick<Database["public"]["Tables"]["audit_findings"]["Row"],
          | "norma" | "subclausula" | "titulo_clausula" | "area_auditada" | "processo_auditado"
          | "setor" | "local_evidencia" | "severidade" | "prioridade"
          | "criterio_requisito" | "tipo_evidencia" | "documento_avaliado" | "codigo_documento"
          | "revisao_documento" | "registro_analisado" | "amostra_qtd" | "criterio_amostragem"
          | "entrevistados" | "condicao_encontrada" | "desvio_identificado" | "impacto_potencial"
          | "risco_associado" | "abrangencia" | "qtd_itens_afetados" | "periodo_afetado" | "recorrencia"
          | "contencao_imediata" | "data_contencao" | "responsavel_contencao" | "causa_imediata"
          | "causa_raiz" | "metodo_analise" | "correcao_imediata" | "acao_preventiva"
          | "recomendacao_auditor" | "custo_estimado"
          | "verificacao_eficacia" | "responsavel_verificacao" | "data_verificacao"
          | "status_eficacia" | "observacao_anexo"
        >>;
        Update: Partial<Database["public"]["Tables"]["audit_findings"]["Row"]>;
      };

      /* ── RAI Reports ──────────────────────────────────── */
      rai_reports: {
        Row: {
          id: string;
          audit_id: string;
          codigo: string;
          titulo: string;
          conteudo: unknown;
          status: "rascunho" | "revisao" | "aprovado" | "publicado";
          elaborado_por: string;
          revisado_por: string;
          aprovado_por: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["rai_reports"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["rai_reports"]["Insert"]>;
      };

      /* ── Meetings ─────────────────────────────────────── */
      meetings: {
        Row: {
          id: string;
          titulo: string;
          tipo: "kickoff" | "acompanhamento" | "auditoria" | "analise-critica";
          projeto_id: string | null;
          cliente_id: string | null;
          data: string | null;
          duracao_min: number;
          local: string;
          pauta: string;
          participantes: string[];
          status: "agendada" | "gravando" | "processando" | "transcrita" | "concluida" | "cancelada";
          ata: string;
          meet_link: string;
          resumo: string;
          resumo_aprovado: boolean;
          resumo_historico: unknown[];
          transcricao: TranscriptLine[];
          acoes: MeetingAction[];
          gravacao_url: string;
          gravacao_inicio: string | null;
          gravacao_fim: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["meetings"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["meetings"]["Insert"]>;
      };

      /* ── Meeting Messages ─────────────────────────────── */
      meeting_messages: {
        Row: {
          id: string;
          meeting_id: string;
          author: string;
          content: string;
          type: "mensagem" | "acao" | "decisao";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["meeting_messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["meeting_messages"]["Insert"]>;
      };

      /* ── Documents ────────────────────────────────────── */
      documents: {
        Row: {
          id: string;
          codigo: string;
          titulo: string;
          tipo: "manual" | "procedimento" | "instrucao" | "formulario" | "registro" | "evidencia";
          norma: string;
          projeto_id: string | null;
          cliente_id: string | null;
          versao: number;
          status: "rascunho" | "em-revisao" | "aprovado" | "obsoleto";
          arquivo_url: string | null;
          arquivo_nome: string;
          tamanho_bytes: number;
          uploaded_by: string;
          aprovado_por: string;
          tags: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["documents"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
      };

      /* ── Trainings ────────────────────────────────────── */
      trainings: {
        Row: {
          id: string;
          titulo: string;
          descricao: string;
          norma: string;
          carga_horaria: number;
          instrutor: string;
          tipo: "presencial" | "ead" | "hibrido";
          status: "planejado" | "em-andamento" | "concluido";
          data_inicio: string | null;
          data_fim: string | null;
          material_pdf_url: string | null;
          video_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["trainings"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["trainings"]["Insert"]>;
      };

      /* ── Enrollments ──────────────────────────────────── */
      enrollments: {
        Row: {
          id: string;
          training_id: string;
          participante_nome: string;
          participante_email: string;
          status: "inscrito" | "presente" | "ausente" | "aprovado" | "reprovado";
          nota: number | null;
          certificado_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["enrollments"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["enrollments"]["Insert"]>;
      };

      /* ── Reports ──────────────────────────────────────── */
      reports: {
        Row: {
          id: string;
          titulo: string;
          template_id: string;
          filtros: unknown;
          dados_snapshot: unknown;
          gerado_por: string;
          formato: "pdf" | "xlsx" | "html";
          arquivo_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reports"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
      };

      /* ── Settings ─────────────────────────────────────── */
      settings: {
        Row: {
          id: string;
          chave: string;
          valor: unknown;
          categoria: "geral" | "notificacoes" | "rbac" | "integracao";
          descricao: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["settings"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
      };

      /* ── Audit Logs ───────────────────────────────────── */
      audit_logs: {
        Row: {
          id: string;
          tabela: string;
          registro_id: string;
          acao: "INSERT" | "UPDATE" | "DELETE";
          dados_antes: unknown | null;
          dados_depois: unknown | null;
          usuario_id: string | null;
          ip: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["audit_logs"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };

      /* ── Notifications ────────────────────────────────── */
      notifications: {
        Row: {
          id: string;
          user_id: string | null;
          titulo: string;
          mensagem: string;
          tipo: "info" | "alerta" | "urgente" | "sucesso";
          lida: boolean;
          link: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };

      /* ── WhatsApp Messages ──────────────────────────────── */
      whatsapp_messages: {
        Row: {
          id: string;
          created_at: string;
          message_id: string | null;
          phone: string;
          from_me: boolean;
          timestamp: number | null;
          status: string;
          sender_name: string;
          chat_name: string;
          body: string;
          message_type: string;
          raw: Record<string, unknown>;
        };
        Insert: Omit<Database["public"]["Tables"]["whatsapp_messages"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["whatsapp_messages"]["Row"]>;
      };

      /* ── WhatsApp AI Settings ───────────────────────────── */
      whatsapp_ai_settings: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          agent_name: string;
          agent_instructions: string;
          agent_enabled: boolean;
          auto_reply: boolean;
          model: string;
          temperature: number;
          max_tokens: number;
          keywords: string[];
          timeout_minutes: number;
          business_hours_only: boolean;
          business_hours_start: string;
          business_hours_end: string;
          business_days: number[];
          outside_hours_message: string;
          max_messages_per_chat: number;
          daily_message_limit: number;
          blacklist_phones: string[];
          split_messages: boolean;
          humanize_delay: boolean;
          understand_audio: boolean;
          analyze_images: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["whatsapp_ai_settings"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["whatsapp_ai_settings"]["Row"]>;
      };

      /* ── AI Reply Triggers ──────────────────────────────── */
      ai_reply_triggers: {
        Row: {
          incoming_message_id: string;
          created_at: string;
        };
        Insert: { incoming_message_id: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["ai_reply_triggers"]["Row"]>;
      };

      /* ── Agent Pauses ───────────────────────────────────── */
      agent_pauses: {
        Row: {
          phone: string;
          paused_until: string;
          pause_minutes: number;
          created_at: string;
        };
        Insert: { phone: string; paused_until: string; pause_minutes?: number; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["agent_pauses"]["Row"]>;
      };

      /* ── Contatos (vinculados a empresas) ─────────────── */
      contatos: {
        Row: {
          id: string;
          empresa_id: string;
          nome: string;
          cargo: string;
          email: string;
          telefone: string;
          whatsapp: string;
          principal: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["contatos"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["contatos"]["Insert"]>;
      };

      /* ── Deleted Chats ──────────────────────────────────── */
      deleted_chats: {
        Row: {
          phone: string;
          created_at: string;
        };
        Insert: { phone: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["deleted_chats"]["Row"]>;
      };

      /* ── Chat Conversations ────────────────────────────── */
      chat_conversations: {
        Row: {
          id: string;
          titulo: string;
          cliente_id: string | null;
          projeto_id: string | null;
          participantes: string[];
          status: "ativo" | "arquivado";
          ultima_mensagem: string;
          ultima_mensagem_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["chat_conversations"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["chat_conversations"]["Insert"]>;
      };

      /* ── Chat Messages ─────────────────────────────────── */
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          autor: string;
          conteudo: string;
          tipo: "mensagem" | "evidencia" | "urgente" | "bloqueio" | "duvida";
          classificacao: "geral" | "duvida" | "evidencia" | "urgencia" | "bloqueio";
          arquivo_url: string | null;
          arquivo_nome: string | null;
          lida: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["chat_messages"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
      };

      /* ── Faturamento ───────────────────────────────────── */
      faturamento: {
        Row: {
          id: string;
          projeto_id: string | null;
          cliente_id: string | null;
          consultor: string;
          numero_nf: string;
          descricao: string;
          valor: number;
          data_emissao: string;
          data_vencimento: string | null;
          data_pagamento: string | null;
          status: string;
          tipo: string;
          mes_competencia: string;
          observacoes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["faturamento"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["faturamento"]["Insert"]>;
      };
    };

    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

/* ── Exports de tipos ───────────────────────────────── */

export type Cliente = Database["public"]["Tables"]["clientes"]["Row"];
export type ClienteInsert = Database["public"]["Tables"]["clientes"]["Insert"];
export type ClienteUpdate = Database["public"]["Tables"]["clientes"]["Update"];

export type Projeto = Database["public"]["Tables"]["projetos"]["Row"];
export type ProjetoInsert = Database["public"]["Tables"]["projetos"]["Insert"];
export type ProjetoUpdate = Database["public"]["Tables"]["projetos"]["Update"];

export type Entregavel = Database["public"]["Tables"]["entregaveis"]["Row"];
export type EntregavelInsert = Database["public"]["Tables"]["entregaveis"]["Insert"];
export type EntregavelUpdate = Database["public"]["Tables"]["entregaveis"]["Update"];

export type Role = Database["public"]["Tables"]["roles"]["Row"];
export type RoleInsert = Database["public"]["Tables"]["roles"]["Insert"];
export type RoleUpdate = Database["public"]["Tables"]["roles"]["Update"];

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export type Pipeline = Database["public"]["Tables"]["pipelines"]["Row"];
export type PipelineInsert = Database["public"]["Tables"]["pipelines"]["Insert"];
export type PipelineUpdate = Database["public"]["Tables"]["pipelines"]["Update"];

export type PipelineColumn = Database["public"]["Tables"]["pipeline_columns"]["Row"];
export type PipelineColumnInsert = Database["public"]["Tables"]["pipeline_columns"]["Insert"];
export type PipelineColumnUpdate = Database["public"]["Tables"]["pipeline_columns"]["Update"];

export type PipelineCard = Database["public"]["Tables"]["pipeline_cards"]["Row"];
export type PipelineCardInsert = Database["public"]["Tables"]["pipeline_cards"]["Insert"];
export type PipelineCardUpdate = Database["public"]["Tables"]["pipeline_cards"]["Update"];

export type Audit = Database["public"]["Tables"]["audits"]["Row"];
export type AuditInsert = Database["public"]["Tables"]["audits"]["Insert"];
export type AuditUpdate = Database["public"]["Tables"]["audits"]["Update"];

export type AuditFinding = Database["public"]["Tables"]["audit_findings"]["Row"];
export type AuditFindingInsert = Database["public"]["Tables"]["audit_findings"]["Insert"];
export type AuditFindingUpdate = Database["public"]["Tables"]["audit_findings"]["Update"];

export type RaiReport = Database["public"]["Tables"]["rai_reports"]["Row"];
export type RaiReportInsert = Database["public"]["Tables"]["rai_reports"]["Insert"];
export type RaiReportUpdate = Database["public"]["Tables"]["rai_reports"]["Update"];

export type Meeting = Database["public"]["Tables"]["meetings"]["Row"];
export type MeetingInsert = Database["public"]["Tables"]["meetings"]["Insert"];
export type MeetingUpdate = Database["public"]["Tables"]["meetings"]["Update"];

export type MeetingMessage = Database["public"]["Tables"]["meeting_messages"]["Row"];
export type MeetingMessageInsert = Database["public"]["Tables"]["meeting_messages"]["Insert"];
export type MeetingMessageUpdate = Database["public"]["Tables"]["meeting_messages"]["Update"];

export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentInsert = Database["public"]["Tables"]["documents"]["Insert"];
export type DocumentUpdate = Database["public"]["Tables"]["documents"]["Update"];

export type Training = Database["public"]["Tables"]["trainings"]["Row"];
export type TrainingInsert = Database["public"]["Tables"]["trainings"]["Insert"];
export type TrainingUpdate = Database["public"]["Tables"]["trainings"]["Update"];

export type Enrollment = Database["public"]["Tables"]["enrollments"]["Row"];
export type EnrollmentInsert = Database["public"]["Tables"]["enrollments"]["Insert"];
export type EnrollmentUpdate = Database["public"]["Tables"]["enrollments"]["Update"];

export type Report = Database["public"]["Tables"]["reports"]["Row"];
export type ReportInsert = Database["public"]["Tables"]["reports"]["Insert"];
export type ReportUpdate = Database["public"]["Tables"]["reports"]["Update"];

export type Setting = Database["public"]["Tables"]["settings"]["Row"];
export type SettingInsert = Database["public"]["Tables"]["settings"]["Insert"];
export type SettingUpdate = Database["public"]["Tables"]["settings"]["Update"];

export type AuditLog = Database["public"]["Tables"]["audit_logs"]["Row"];
export type AuditLogInsert = Database["public"]["Tables"]["audit_logs"]["Insert"];

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
export type NotificationUpdate = Database["public"]["Tables"]["notifications"]["Update"];

export type WhatsAppMessage = Database["public"]["Tables"]["whatsapp_messages"]["Row"];
export type WhatsAppMessageInsert = Database["public"]["Tables"]["whatsapp_messages"]["Insert"];
export type WhatsAppMessageUpdate = Database["public"]["Tables"]["whatsapp_messages"]["Update"];

export type WhatsAppAiSettings = Database["public"]["Tables"]["whatsapp_ai_settings"]["Row"];
export type WhatsAppAiSettingsInsert = Database["public"]["Tables"]["whatsapp_ai_settings"]["Insert"];
export type WhatsAppAiSettingsUpdate = Database["public"]["Tables"]["whatsapp_ai_settings"]["Update"];

export type AiReplyTrigger = Database["public"]["Tables"]["ai_reply_triggers"]["Row"];
export type AiReplyTriggerInsert = Database["public"]["Tables"]["ai_reply_triggers"]["Insert"];

export type AgentPause = Database["public"]["Tables"]["agent_pauses"]["Row"];
export type AgentPauseInsert = Database["public"]["Tables"]["agent_pauses"]["Insert"];

export type Contato = Database["public"]["Tables"]["contatos"]["Row"];
export type ContatoInsert = Database["public"]["Tables"]["contatos"]["Insert"];
export type ContatoUpdate = Database["public"]["Tables"]["contatos"]["Update"];
export type AgentPauseUpdate = Database["public"]["Tables"]["agent_pauses"]["Update"];

export type DeletedChat = Database["public"]["Tables"]["deleted_chats"]["Row"];
export type DeletedChatInsert = Database["public"]["Tables"]["deleted_chats"]["Insert"];

export type ChatConversation = Database["public"]["Tables"]["chat_conversations"]["Row"];
export type ChatConversationInsert = Database["public"]["Tables"]["chat_conversations"]["Insert"];
export type ChatConversationUpdate = Database["public"]["Tables"]["chat_conversations"]["Update"];

export type ChatMessageRow = Database["public"]["Tables"]["chat_messages"]["Row"];
export type ChatMessageInsert = Database["public"]["Tables"]["chat_messages"]["Insert"];
export type ChatMessageUpdate = Database["public"]["Tables"]["chat_messages"]["Update"];

export type FaturamentoRow = Database["public"]["Tables"]["faturamento"]["Row"];
export type FaturamentoInsertRow = Database["public"]["Tables"]["faturamento"]["Insert"];
export type FaturamentoUpdateRow = Database["public"]["Tables"]["faturamento"]["Update"];
