# Certifica - Padroes de Design, Estado e Eventos

## 1. Design system de componentes

Componentes base obrigatorios:
- `DSCard`
- `DSButton`
- `DSInput`
- `DSSelect`
- `DSTextarea`
- `DSBadge`
- `DSTable`

Regras:
- CTA primaria unica por contexto.
- Acao destrutiva sempre com confirmacao.
- Campos obrigatorios com validacao inline.
- Padrao visual consistente para status:
  - `conformidade`
  - `observacao`
  - `nao-conformidade`
  - `oportunidade`
  - `outline`

## 2. Padrao de estados por tela

Estados obrigatorios:
- `loading`
- `empty`
- `error`
- `success`
- `dirty` (edicao nao salva)

Padrao de tela:
1. Header (titulo + contexto + CTA)
2. Barra de filtros
3. Conteudo principal (lista/tabela/board)
4. Painel lateral de detalhe
5. Modais de criacao/edicao

## 3. Padrao de eventos de dominio

Envelope padrao:

```json
{
  "event_id": "evt_01J...",
  "timestamp": "2026-02-19T14:35:00Z",
  "organization_id": "org_123",
  "actor_id": "usr_456",
  "module": "auditorias",
  "entity_type": "rai",
  "entity_id": "rai_789",
  "action": "workflow_transition",
  "before": {},
  "after": {},
  "metadata": {}
}
```

## 4. Acoes que DEVEM gerar auditoria de log

- Criar, editar, excluir (soft delete).
- Mudanca de status/workflow.
- Aprovar e assinar documento/RAI.
- Exportar PDF/Excel e compartilhar relatorio.
- Alterar matriz de permissao.
- Alterar politicas de seguranca/LGPD.
- Escalonamento automatico de tarefa.

## 5. Observabilidade

- Cada evento critico gera:
  - `domain_event`
  - `audit_log`
  - opcionalmente `notification` (se alerta ativo)
- Correlation id recomendado para rastrear fluxo ponta a ponta.
