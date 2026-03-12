# Certifica - Mapa de Navegacao Unificado

## 1. Navegacao principal (Sidebar)

- Dashboard
- Reunioes
- Chat
- Central de Acoes
- Clientes
- Projetos
- Documentos
- Auditorias
- Normas
- Treinamentos
- ESG
- Relatorios
- Configuracoes

## 2. Subnavegacao por modulo

### Dashboard
- Camada Operacional
- Camada Executiva

### Reunioes
- Resumo
- Transcricao
- Plano de acao

### Projetos
- Visao Geral
- Pipeline/Kanban

### Auditorias
- Painel
- RAI (Relatorio de Auditoria Inteligente)

### Normas
- Painel de Normas
- ISO 9001
- ISO 14001
- ISO 45001

### Relatorios
- Templates
- Construtor
- Agendamentos
- Trilha de emissao

### Configuracoes
- Usuarios e perfis
- Permissoes granulares
- Parametros da empresa
- Modelos de documento
- Regras de workflow
- Integracoes
- Logs e auditoria

## 3. Fluxos transversais

### Fluxo A - Evento de origem -> Central de Acoes
1. Usuario cria/atualiza entidade de negocio (auditoria, projeto, documento, reuniao, RAI).
2. Sistema gera tarefa automatica com `sourceType` e `sourceRef`.
3. Tarefa entra na inbox unificada da Central de Acoes.
4. Escalonamento automatico aplica quando prazo vence.

### Fluxo B - Operacao -> Relatorio executivo
1. Usuario aplica filtros dinamicos por periodo, cliente, consultor, norma e unidade.
2. Sistema monta comparativos por periodo.
3. IA gera resumo executivo e anomalias relevantes.
4. Exportacao e trilha de compartilhamento sao registradas em log.

### Fluxo C - Governanca e compliance
1. Admin atualiza matriz de permissao por papel.
2. Sistema aplica controle por modulo e acao.
3. Acoes sensiveis (aprovar, assinar, exportar, compartilhar) geram auditoria de log.
4. Politicas LGPD definem retencao e anonimização.

## 4. Regras de UX entre modulos

- Header padrao com titulo, subtitulo e CTA primaria.
- Filtros sempre no topo do contexto de listagem.
- Painel lateral de detalhe para entidade selecionada.
- Modais de criacao/edicao com validacao explicita.
- Estados obrigatorios: `loading`, `empty`, `error`, `success`.
- Transicoes suaves entre paginas e abas internas.
