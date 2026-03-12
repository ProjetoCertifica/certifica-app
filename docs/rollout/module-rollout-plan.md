# Certifica - Plano de Rollout e Criterios de Aceite

## 1. Estrategia de rollout

Rollout em ondas para reduzir risco de interrupcao:

- Onda 1: Clientes, Projetos, Auditorias, RAI, Documentos
- Onda 2: Central de Acoes, Relatorios, ESG
- Onda 3: Configuracoes avancadas, Integracoes externas, IA avancada

## 2. Criterios de aceite por modulo

## Dashboard
- [ ] Camadas operacional e executiva consistentes.
- [ ] Filtros funcionam sem regressao.
- [ ] KPIs batem com dados de origem.

## Reunioes
- [ ] Plano de acao exportavel.
- [ ] Sincronizacao para Central de Acoes funcionando.
- [ ] Busca/filtro sem quebra de estado.

## Chat
- [ ] Classificacao e sugestoes IA estaveis.
- [ ] Vinculos com evidencias/documentos funcionando.

## Clientes
- [ ] Cadastro e validacoes corretas.
- [ ] Saude do cliente e proxima acao calculadas.

## Projetos
- [ ] Wizard de criacao completo.
- [ ] Regras de transicao de fase aplicadas.
- [ ] Riscos de prazo/escopo corretos.

## Pipeline/Kanban
- [ ] DnD de cards e colunas funcional.
- [ ] SLA por fase e forecast confiavel.

## Documentos
- [ ] Upload/versionamento completo.
- [ ] Aprovacao/assinatura com trilha de log.
- [ ] Vinculo ESG e compliance consistente.

## Auditorias e RAI
- [ ] RAI com workflow completo.
- [ ] Anti-vies ativo (sem inventar evidencia).
- [ ] Exportacao com trilha de auditoria.

## ESG
- [ ] Indicadores, metas e progresso mensal corretos.
- [ ] Alertas de desvio de meta.
- [ ] Narrativa executiva e tendencias disponiveis.

## Relatorios
- [ ] Templates por modulo funcionando.
- [ ] Comparativo por periodo valido.
- [ ] Agendamento + exportacao + trilha.

## Configuracoes
- [ ] Matriz de permissao por papel efetiva.
- [ ] Politicas de seguranca/LGPD persistidas.
- [ ] Integracoes e logs auditaveis.

## Central de Acoes
- [ ] Inbox unificada consolidada por origem.
- [ ] Priorizacao por risco + prazo correta.
- [ ] Escalonamento automatico operacional.

## 3. Gate de Go-Live

- [ ] Testes de regressao E2E dos fluxos criticos.
- [ ] Auditoria de permissao por perfil aprovada.
- [ ] Checklist de observabilidade e alertas ativo.
- [ ] Plano de rollback documentado.
- [ ] Treinamento dos usuarios-chave concluido.

## 4. Riscos e mitigacoes de rollout

- Risco: inconsistencias entre modulos.
  - Mitigacao: contrato unico de eventos + smoke tests cross-modulo.

- Risco: permissao mal configurada.
  - Mitigacao: matriz RBAC validada por perfil antes do go-live.

- Risco: dados historicos incompletos.
  - Mitigacao: migracao em staging com reconciliacao e relatorio de divergencias.

- Risco: sobrecarga em horarios de pico.
  - Mitigacao: monitoramento ativo + plano de scaling e fila para jobs.
