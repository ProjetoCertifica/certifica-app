# Prompts Mestre - Plataforma Certifica

Este documento foi preparado para voce enviar a outro assistant e construir a ferramenta completa.  
Os prompts abaixo ja estao estruturados para gerar telas, fluxos, regras de negocio, estados, validacoes e UX.

## Como usar

- Use primeiro o **Prompt 00 (Mestre de Contexto)** para alinhar o assistente.
- Depois rode um prompt por aba, na ordem desejada.
- Para cada aba, peca para o assistente retornar:
  - componentes,
  - estrutura de dados,
  - estados da interface,
  - regras de negocio,
  - plano de implementacao tecnico.

---

## Prompt 00 - Mestre de Contexto (usar antes de todos)

```text
Voce e um arquiteto de produto e frontend senior especialista em SaaS B2B de consultoria de sistemas de gestao (ISO 9001, 14001, 45001, 50001, 22000, FSC e ESG).

Contexto de negocio:
- Plataforma: Certifica
- Publico: consultores, auditores, coordenadores e diretores de clientes.
- Objetivo: centralizar operacao de consultoria, auditorias, evidencias, documentos, reunioes, comunicacao com cliente, pipeline comercial e relatorios executivos.
- Tom visual: corporativo, tecnico, confiavel, orientado a decisao.
- Estilo UX: alta densidade de informacao, mas clara; foco em produtividade operacional.

Regras obrigatorias:
1) Sempre pensar em fluxo ponta a ponta: entrada de dados -> processamento -> saida -> rastreabilidade.
2) Sempre incluir estado vazio, estado de erro, estado de carregamento e estado de sucesso.
3) Sempre incluir filtros, busca, ordenacao e exportacao quando fizer sentido.
4) Sempre definir permissoes por perfil: Admin Certifica, Consultor, Auditor, Cliente Gestor, Cliente Leitor.
5) Sempre prever auditoria de alteracoes (historico/versionamento/log de acao).
6) Sempre padronizar datas pt-BR e valores em BRL.
7) Sempre detalhar validacoes de formulario (obrigatorio, formato, faixa, consistencia).
8) Sempre incluir indicadores operacionais e indicadores executivos.
9) Sempre considerar LGPD: minimizacao de dados, trilha de acesso, mascaramento quando necessario.
10) Nunca devolver somente layout; devolver tambem regras funcionais e estrutura de dados.

Formato de resposta obrigatorio para cada aba:
- Objetivo da aba
- Perfis e permissoes
- Estrutura de dados (entidades e campos)
- Componentes UI (lista completa)
- Fluxos principais (passo a passo)
- Regras de negocio
- Validacoes
- Automacoes e IA aplicaveis
- KPI/metricas da aba
- Casos de borda
- Backlog de evolucao (v1, v1.1, v2)

Se eu enviar uma aba especifica, responda de forma hiper detalhada, com exemplos reais do contexto Certifica.
```

---

## Prompt 01 - Dashboard Executivo + Operacional

```text
Com base no contexto mestre da plataforma Certifica, projete e detalhe a aba Dashboard.

Quero duas camadas de visualizacao:
1) Operacional (consultores)
2) Executiva (gestao)

Detalhe:
- cards KPI (projetos ativos, atrasos, NCs abertas, auditorias do mes, docs pendentes, taxa de conformidade, risco de prazo)
- tabela de projetos com semaforo de risco
- agenda de compromissos (reunioes, auditorias, treinamentos)
- pendencias criticas priorizadas
- graficos por norma e por fase do pipeline
- alertas inteligentes (prazo, NC critica, vencimento certificacao)
- drill-down (clicar no KPI abre lista filtrada)

Inclua:
- logica de priorizacao de alertas
- filtros globais (periodo, consultor, cliente, norma)
- comparativo mes atual vs anterior
- estado vazio e carregamento
- recomendacoes de acao por IA no topo do dashboard

Entregue tudo no formato obrigatorio definido no prompt mestre.
```

## Prompt 02 - Reunioes (gravacao, transcricao e plano de acao)

```text
Projete a aba Reunioes da Certifica com fluxo completo:
- cadastro/agendamento
- vinculacao com cliente e projeto
- captura de link Meet
- gravacao
- transcricao
- resumo automatico por IA
- extracao de acoes com responsavel e prazo
- exportacao de ata/plano de acao

Detalhe:
- status da reuniao (agendada, gravando, processando, transcrita, concluida)
- parser de action items (descricao, responsavel, prazo, criticidade)
- aprovacao humana antes de publicar resumo para cliente
- integracao futura com calendario e WhatsApp
- painel lateral com historico de reunioes por cliente

Inclua regras de:
- confidencialidade
- controle de acesso a transcricoes
- versionamento de resumo
- reprocessamento de audio com erro

Entregue no formato obrigatorio do prompt mestre.
```

## Prompt 03 - Chat Operacional (cliente + consultor)

```text
Desenhe a aba Chat Operacional da Certifica com foco em atendimento tecnico de consultoria e auditoria.

Quero:
- lista de conversas por cliente/projeto
- chat em tempo real com texto, audio, anexo e imagem
- status de atendimento (aberto, aguardando cliente, resolvido)
- classificacao automatica da mensagem por IA (duvida, evidencia, urgencia, bloqueio)
- sugestao automatica de resposta para consultor
- vinculo de mensagens com:
  1) evidencias de auditoria
  2) documentos
  3) tarefas/plano de acao

Inclua:
- SLA por tipo de demanda
- roteamento por consultor responsavel
- etiqueta de risco (baixa/media/alta)
- historico completo e trilha de auditoria
- integracao futura com Z-API/WhatsApp

Entregue com dados, fluxos, regras e casos de borda no formato mestre.
```

## Prompt 04 - Clientes (cadastro, consulta CNPJ, visao 360)

```text
Estruture a aba Clientes da Certifica para operar como CRM tecnico-consultivo.

Escopo:
- cadastro de cliente (manual + consulta CNPJ)
- normalizacao de dados cadastrais
- status de relacionamento (prospect, ativo, inativo)
- dados de contato e decisores
- visao 360 do cliente: projetos, auditorias, documentos, reunioes, NCs

Necessario:
- validacao de CNPJ e deduplicacao
- regras anti-duplicidade por CNPJ + razao social
- timeline de interacoes
- score de saude do cliente (engajamento, atraso, risco, satisfacao)
- campos obrigatorios por etapa

Adicione:
- sugestao de proxima acao comercial/consultiva por IA
- alertas de risco de churn
- painel de clientes sem movimentacao

Entregue no formato mestre.
```

## Prompt 05 - Projetos (visao geral, detalhe, proposta)

```text
Projete a aba Projetos da Certifica com ciclo completo:
- proposta
- planejamento
- execucao
- verificacao
- acompanhamento
- encerramento

Quero:
- lista de projetos com filtros avancados
- detalhe lateral com abas (info, entregaveis, proposta)
- modal wizard para novo projeto em 3 etapas
- progresso por entregaveis
- risco de prazo e risco de escopo
- controle financeiro basico (valor, condicao, previsao)

Defina:
- entidade Projeto com campos obrigatorios por fase
- regra de transicao de fase (pre-condicoes)
- bloqueios para avancar fase sem evidencias minimas
- estrutura de equipe por projeto (consultor principal e colaboradores)

Inclua backlog evolutivo para:
- timesheet
- rentabilidade por projeto
- margem e custos

Formato mestre obrigatorio.
```

## Prompt 06 - Pipeline/Kanban Comercial + Gantt

```text
Desenhe a aba Pipeline (Kanban + Gantt) para Certifica, com orientacao comercial e operacional.

Kanban:
- colunas configuraveis (nome, subtitulo, cor, WIP limit)
- criacao de oportunidade por coluna
- drag and drop de cards
- alertas de WIP excedido
- score de prioridade e temperatura (quente/morno/frio)

Card detalhado:
- dados cliente/contato
- dados comerciais
- cronograma
- checklists
- anexos
- comentarios
- atividades
- tags

Gantt:
- timeline por projeto
- barra de progresso por entregaveis
- marcador de hoje
- visual de atraso/risco

Regras:
- ao excluir coluna, definir estrategia de realocacao
- historico de movimentacao de card
- SLA por fase comercial
- previsao de receita por fase e por probabilidade

Entregue no formato mestre.
```

## Prompt 07 - Documentos (GED tecnico com versao)

```text
Projete a aba Documentos da Certifica como GED focado em compliance e auditoria.

Necessario:
- listagem e grid
- filtros por cliente, projeto, categoria, tipo e status
- upload e versionamento (major/minor)
- historico de revisao com autor, data, justificativa
- status do documento (rascunho, revisao, aprovado, obsoleto)
- vinculo com clausula da norma e com evidencia de auditoria

Inclua:
- controle de permissao por documento
- assinatura/validacao de aprovador
- trilha de acesso e download
- deteccao de documentos vencidos/obsoletos
- exportacao de pacote documental para auditoria externa

Evolucao:
- OCR
- classificacao automatica por IA
- sugestao de metadata no upload

Formato mestre.
```

## Prompt 08 - Auditorias (painel, agenda, NCs, RAI)

```text
Crie a especificacao completa da aba Auditorias para Certifica.

Submodulos:
1) Painel de auditorias
2) Agenda/timeline
3) NCs abertas e monitoramento
4) Geracao de RAI

Quero:
- criar auditoria
- filtrar por status e norma
- visualizar achados por categoria (C, NC, OBS, OPM)
- acompanhar NC aberta por severidade e prazo
- mostrar ciclo de tratamento de NC (abertura -> acao -> verificacao -> encerramento)

Inclua:
- matriz de criticidade
- risco de reincidencia
- escalonamento automatico de NC vencida
- controle de evidencias obrigatorias por tipo de achado

Formato mestre obrigatorio.
```

## Prompt 09 - RAI (Relatorio de Auditoria Inteligente)

```text
Desenhe a aba/formulario de RAI da Certifica com foco tecnico e rastreavel.

Estrutura obrigatoria do RAI:
1) Descricao da constatacao
2) Evidencia objetiva
3) Requisito tecnico
4) Classificacao
5) Recomendacao/acao sugerida

Inclua:
- biblioteca de clausulas por norma
- sugestao de texto por IA para descricao e recomendacao
- validacao de qualidade textual (clareza, objetividade, criterio de auditoria)
- consistencia entre classificacao e severidade
- workflow de aprovacao (rascunho -> revisao tecnica -> aprovado -> enviado ao cliente)
- versionamento por revisao de RAI
- exportacao PDF com assinatura/rodape tecnico

Adicione regra anti-vies:
- IA nao pode "inventar evidencia"; precisa marcar quando faltar dado e pedir complemento.

Formato mestre.
```

## Prompt 10 - Normas (painel geral + ISO 9001/14001/45001)

```text
Projete o modulo Normas da Certifica com:
- painel geral de conformidade por norma
- subabas ISO 9001, ISO 14001 e ISO 45001
- matriz de clausulas x evidencias x status

Quero:
- heatmap de conformidade por clausula
- gaps priorizados
- plano de acao por clausula
- maturidade por processo
- comparativo entre clientes/projetos

Para cada norma:
- destaque clausulas criticas
- checklist tecnico
- documentos/evidencias requeridos
- pendencias para auditoria externa

Inclua IA:
- recomendacao de proxima melhor acao por clausula
- sugestao de evidencias faltantes
- explicacao tecnica simplificada para cliente

Formato mestre.
```

## Prompt 11 - Treinamentos

```text
Desenhe a aba Treinamentos para Certifica com foco em capacitacao vinculada a conformidade.

Escopo:
- trilhas por norma e por funcao
- calendario de turmas
- presenca e avaliacao
- certificado
- eficacia do treinamento (antes/depois, auditoria, reincidencia de NC)

Regras:
- treinamentos obrigatorios por projeto/fase
- bloqueio de avanco de fase se treinamento critico estiver pendente
- renovacao periodica

IA:
- recomendacao de trilha por perfil e gaps de auditoria
- resumo automatico de reuniao de treinamento
- questoes de avaliacao geradas automaticamente

Formato mestre.
```

## Prompt 12 - ESG

```text
Projete a aba ESG da Certifica para consolidar indicadores ambientais, sociais e governanca dos clientes.

Quero:
- cadastro de indicadores ESG por cliente
- baseline e meta anual
- progresso mensal
- evidencias de suporte
- riscos ESG e plano de mitigacao

Inclua:
- mapa de materialidade simplificado
- score ESG por cliente/projeto
- relatorio executivo para diretoria
- alertas de desvio de meta

IA:
- leitura de tendencias
- sugestao de plano de acao ESG
- narrativa executiva automatica para comite

Formato mestre.
```

## Prompt 13 - Relatorios

```text
Desenhe a aba Relatorios da Certifica com construtor de relatorios operacionais e executivos.

Necessario:
- templates prontos (auditoria, NC, status de projeto, reunioes, documentos, ESG)
- filtros dinamicos
- agendamento de envio
- exportacao PDF/Excel
- comparativos por periodo

Inclua:
- visao por cliente, por consultor, por norma, por unidade
- indicadores de produtividade da consultoria
- indicadores de risco de certificacao
- trilha de emissao e compartilhamento

IA:
- gerar resumo executivo automatico do periodo
- destacar anomalias relevantes

Formato mestre.
```

## Prompt 14 - Configuracoes

```text
Projete a aba Configuracoes da Certifica com governanca completa.

Submodulos:
- usuarios e perfis
- permissoes granulares
- parametros da empresa
- modelos de documento
- regras de workflow
- integracoes (Drive, Meet, WhatsApp/Z-API, e-mail, calendario)
- logs/auditoria do sistema

Inclua:
- matriz de permissao por papel
- politicas de senha e seguranca
- notificacoes e preferencias
- SLA e automacoes configuraveis
- LGPD (retenção, anonimização, consentimentos)

Formato mestre.
```

---

## Abas novas recomendadas (com prompt pronto)

## Prompt 15 - Central de Acoes (Tasks unificadas)

```text
Crie uma nova aba "Central de Acoes" para Certifica.

Objetivo:
- consolidar tarefas vindas de auditorias, reunioes, projetos, chat e documentos.

Quero:
- inbox unica de acoes
- priorizacao por risco e prazo
- quadro pessoal do consultor
- vinculacao da tarefa ao objeto de origem (RAI, reuniao, projeto etc.)
- status, responsavel, prazo, dependencia e evidencias de conclusao
- escalonamento automatico de atraso

IA:
- sugerir replanejamento semanal
- prever risco de atraso
- recomendar redistribuicao de carga entre consultores

Formato mestre.
```

## Prompt 16 - Copiloto de Compliance (IA)

```text
Crie uma nova aba "Copiloto de Compliance" para Certifica, focada em assistente IA interno.

Funcoes:
- responder perguntas tecnicas por norma
- revisar textos de RAI
- sugerir clausulas aplicaveis
- detectar lacunas de evidencias
- simular pre-auditoria com checklist inteligente

Regras:
- resposta sempre com base em fonte rastreavel (norma, documento interno, registro de auditoria)
- indicar nivel de confianca
- nunca afirmar sem evidencias
- registrar historico de perguntas e respostas

Inclua modo:
- tecnico (consultor)
- executivo (cliente)

Formato mestre.
```

---

## Prompt 17 - Integracao e padronizacao final do produto

```text
Agora consolide TODAS as abas da Certifica em uma arquitetura unica de produto.

Entregue:
1) mapa de navegacao completo (abas e subabas)
2) modelo de dados unificado (entidades e relacionamentos)
3) padrao de design de componentes e estados
4) padrao de eventos e auditoria de log
5) contrato de API por modulo (CRUD + consultas + relatorios)
6) estrategia de permissoes
7) backlog priorizado por fases:
   - Fase 1 (MVP operacional)
   - Fase 2 (escala + automacoes)
   - Fase 3 (IA avancada + inteligencia executiva)
8) riscos de implementacao e mitigacoes
9) plano de rollout com criterios de aceite por modulo

Quero resposta extremamente detalhada e orientada a execucao.
```

