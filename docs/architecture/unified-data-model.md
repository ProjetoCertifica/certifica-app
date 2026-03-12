# Certifica - Modelo de Dados Unificado

## 1. Premissas

- Multi-tenant por organizacao (`organization_id`).
- Todas entidades com metadados comuns:
  - `id`
  - `organization_id`
  - `created_at`
  - `updated_at`
  - `created_by`
  - `updated_by`
  - `deleted_at` (soft delete)
- Eventos e logs rastreaveis por `entity_type` + `entity_id`.

## 2. Entidades de dominio

### Identity e governanca
- `organization`
- `user`
- `role`
- `permission`
- `role_permission`
- `user_role`

### CRM e projetos
- `client`
- `project`
- `project_deliverable`
- `project_phase_transition`

### Reunioes
- `meeting`
- `meeting_transcript_line`
- `meeting_action_item`

### Auditoria e RAI
- `audit`
- `finding`
- `rai`
- `rai_revision`
- `rai_workflow_event`

### GED
- `document`
- `document_revision`
- `document_access_log`

### ESG
- `esg_indicator`
- `esg_progress`
- `esg_risk`
- `esg_materiality_topic`

### Operacao unificada
- `task` (Central de Acoes)
- `task_evidence`
- `task_dependency`

### Relatorios e automacao
- `report_template`
- `report_run`
- `report_schedule`
- `report_delivery`

### Integracoes e observabilidade
- `integration_config`
- `integration_sync_log`
- `audit_log`
- `domain_event`

## 3. Relacionamentos principais

- `organization 1:N user`
- `organization 1:N client`
- `client 1:N project`
- `project 1:N meeting`
- `project 1:N audit`
- `audit 1:N finding`
- `audit 1:N rai`
- `rai 1:N rai_revision`
- `project 1:N document`
- `document 1:N document_revision`
- `client 1:N esg_indicator`
- `esg_indicator 1:N esg_progress`
- `esg_indicator 1:N esg_risk`
- `task N:1 origin` via (`origin_type`, `origin_id`) para:
  - `audit`, `rai`, `meeting`, `project`, `document`, `chat_thread`

## 4. Entidade Task (contrato minimo)

- `id`
- `organization_id`
- `title`
- `description`
- `source_type` (`auditoria|reuniao|projeto|chat|documento|rai`)
- `source_ref`
- `status` (`a-fazer|em-andamento|concluida|bloqueada`)
- `owner_user_id`
- `due_date`
- `dependency_text`
- `risk_score` (0..100)
- `priority_score` (derivado)
- `escalated` (bool)

## 5. Regras de integridade

- Nao permitir `task` duplicada aberta para mesmo `source_type + source_ref + title`.
- Toda mudanca de `status` em `task`, `rai`, `document` deve gerar `audit_log`.
- `rai` nao pode ir para `enviado-cliente` sem evidencias minimas + validacao textual.
- `document.aprovado` exige `approver_user_id` e `approved_at`.

## 6. Indices recomendados

- `task (organization_id, status, due_date)`
- `task (organization_id, owner_user_id, status)`
- `audit (organization_id, status, date_start)`
- `rai (organization_id, workflow_status, updated_at)`
- `document (organization_id, status, expires_at)`
- `esg_progress (indicator_id, period_month)`
- `audit_log (organization_id, timestamp desc)`
