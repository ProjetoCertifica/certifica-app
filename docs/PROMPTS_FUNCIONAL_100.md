# Prompts para deixar o site 100% funcional

Documento orientado a implementacao real (nao apenas visual), cobrindo rotas, botoes, formularios, persistencia, integracoes e testes.

## Como usar este documento

- Rode os prompts em ordem: `P00` ate `P16`.
- Em cada prompt, exija:
  - codigo completo,
  - migracoes,
  - endpoints,
  - testes automatizados,
  - criterios de aceite.
- Regra obrigatoria para o outro assistant: **nunca entregar somente UI**.

---

## P00 - Prompt mestre de execucao real

```text
Voce e um Tech Lead Full Stack senior.

Quero transformar a plataforma Certifica em sistema de producao 100% funcional.
Stack atual: React + TypeScript + Vite.

Regras obrigatorias:
1) Nada somente visual.
2) Todo botao deve acionar caso de uso real (API, estado persistido, log de auditoria).
3) Toda alteracao de dado deve persistir em banco.
4) Toda tela deve ter loading, sucesso, erro e estado vazio.
5) Toda acao critica deve ter permissao por perfil e trilha de auditoria.
6) Toda feature deve ter testes unitarios + integracao + e2e.
7) Sempre retornar:
   - plano tecnico,
   - arquivos alterados,
   - codigo,
   - testes,
   - checklist de validacao manual.

Perfis:
- admin
- gestor
- consultor
- auditor
- cliente

Padrao de resposta:
- Objetivo da entrega
- Modelo de dados
- API/Contratos
- Regras de negocio
- UI conectada a backend
- Validacoes
- Seguranca
- Testes
- Criterios de aceite
```

---

## P01 - Fundacao backend e persistencia

```text
Implemente a fundacao de backend para o produto Certifica com foco em producao.

Entregas obrigatorias:
1) API REST em Node + TypeScript.
2) Banco PostgreSQL.
3) ORM (Prisma).
4) Migracoes.
5) Seeds iniciais.
6) Autenticacao JWT com refresh token.
7) RBAC por perfil.
8) Middleware de auditoria (log de todas as mudancas CRUD).
9) Tratamento padrao de erros.
10) Documentacao OpenAPI.

Entidades minimas:
- users
- roles
- clients
- projects
- pipeline_columns
- pipeline_cards
- audits
- audit_findings
- rai_reports
- meetings
- meeting_messages
- documents
- trainings
- enrollments
- reports
- settings
- audit_logs
- notifications

Saida obrigatoria:
- schema prisma completo
- migracoes SQL
- endpoints com exemplos
- politicas RBAC por endpoint
- testes de integracao
```

---

## P02 - Contrato de funcionalidade por botao (global)

```text
Crie uma matriz de funcionalidade por controle clicavel da plataforma.

Para cada botao/acao, gere:
- nome do controle
- rota/tela
- evento esperado
- endpoint chamado
- payload
- validacoes
- resposta esperada
- atualizacao de estado local
- persistencia em banco
- log de auditoria
- permissao necessaria
- mensagens de erro
- teste automatizado associado

Inclua todos os controles das telas:
- Dashboard
- Reunioes
- Chat
- Clientes
- Projetos
- Pipeline/Kanban
- Documentos
- Auditorias
- RAI
- Normas
- Treinamentos
- Relatorios
- Configuracoes
- Header global
- Sidebar global

Formato de saida: tabela completa pronta para execucao pelo time.
```

---

## P03 - Header e Sidebar (acoes globais)

```text
Implemente funcionalmente todos os controles globais:

Header:
- busca global real
- notificacoes (dropdown + leitura + marcar como lida)
- ajuda (painel com docs e atalhos)

Sidebar:
- logout real
- persistencia da ultima rota
- controle de acesso por perfil (esconder itens sem permissao)

Requisitos:
- endpoints reais
- logs de auditoria
- testes e2e para navegacao e logout
- fallback quando API falhar
```

---

## P04 - Dashboard 100% funcional

```text
Conecte Dashboard ao backend para funcionar em producao.

Implementar:
- KPIs reais por filtro (periodo, consultor, cliente, norma)
- drill-down de cada KPI para lista real
- botao "Filtrar" abrindo filtros avancados reais
- botao "Ver todos" navegando para lista completa
- botoes de "Eye" abrindo detalhe real do item
- criar projeto pelo botao "Novo Projeto" com persistencia

Regras:
- cache de consulta
- pagina com loading skeleton
- erros de API com retry
- comparativo mes atual vs anterior

Testes:
- unitario de calculo KPI
- integracao de filtros
- e2e de drill-down completo
```

---

## P05 - Reunioes (gravacao, transcricao, plano de acao)

```text
Implementar modulo Reunioes real.

Acoes que devem funcionar:
- Nova reuniao salva em banco
- Link Meet validado e persistido
- Iniciar gravacao (integracao real ou mock de infraestrutura com fila e status)
- Processamento de transcricao
- Geracao de resumo por IA com aprovacao humana
- Extracao de acoes com responsavel/prazo
- Exportar ata PDF real
- Copiar resumo com trilha de auditoria

Regras:
- status lifecycle: agendada -> gravando -> processando -> transcrita -> concluida
- controle de acesso ao conteudo de transcricao
- historico de revisao do resumo

Testes:
- e2e do fluxo completo de reuniao
```

---

## P06 - Chat operacional (tempo real)

```text
Implementar Chat operacional com backend real e websocket.

Acoes obrigatorias:
- buscar conversas
- enviar mensagem
- receber mensagem em tempo real
- marcar como lida
- alterar status de atendimento
- aplicar classificacao IA real (ou servico mockado com contrato)
- vincular mensagem a evidencia/documento/plano de acao
- registrar trilha de auditoria por conversa

Integrações:
- preparar adaptador para WhatsApp/Z-API

Testes:
- integracao websocket
- e2e de envio/recebimento e troca de status
```

---

## P07 - Clientes (cadastro robusto + CNPJ real)

```text
Implementar Clientes com validacao e deduplicacao reais.

Acoes:
- criar cliente
- editar cliente
- inativar cliente
- consultar CNPJ via BrasilAPI real
- impedir duplicidade por CNPJ
- abrir visao 360 real com dados de projetos/auditorias/documentos/reunioes

Validacoes:
- CNPJ valido
- email valido
- telefone mascarado
- campos obrigatorios

Testes:
- unitario de validacao CNPJ
- integracao de deduplicacao
- e2e de cadastro completo
```

---

## P08 - Projetos (wizard, fases e regras)

```text
Implementar Projetos com regras de transicao e persistencia.

Acoes:
- criar projeto via wizard (3 etapas)
- editar dados no painel lateral
- avancar fase com pre-condicoes
- bloquear avanco quando faltarem requisitos
- registrar motivo de bloqueio
- salvar trilha de alteracoes

Regras:
- validacao de datas (fim >= inicio)
- controle financeiro basico (valor, condicoes)
- consistencia entregaveis x fase

Testes:
- unitario de regra de transicao
- e2e do wizard e avanco de fase
```

---

## P09 - Pipeline/Kanban + Gantt

```text
Implementar Pipeline/Kanban real.

Acoes:
- drag and drop com persistencia
- criar/editar/excluir coluna
- ao excluir coluna, modal obrigatorio de realocacao de cards
- criar oportunidade
- editar card no drawer e persistir
- anexos reais no card (upload)
- comentarios, tags e atividades persistidas
- visao Gantt alimentada por dados reais

Regras:
- WIP limit com bloqueio opcional configuravel
- score de prioridade calculado no backend
- log de movimentacao entre fases

Testes:
- e2e drag and drop
- integracao exclusao de coluna com realocacao
```

---

## P10 - Documentos (GED completo)

```text
Implementar Documentos como GED funcional.

Acoes:
- upload real de arquivo
- metadados por cliente/projeto/categoria/norma
- versionamento (major/minor)
- historico de revisao
- download e preview seguro
- aprovacao de documento
- controle de permissao por documento

Regras:
- nao permitir sobrescrever sem nova versao
- rastrear quem fez upload/download/aprovacao
- detectar documento obsoleto

Testes:
- upload/download
- versionamento
- autorizacao por perfil
```

---

## P11 - Auditorias

```text
Implementar modulo Auditorias completo.

Acoes:
- criar auditoria
- editar auditoria
- alterar status
- filtros reais
- abrir detalhe por botao Eye
- gerir NCs (abrir, tratar, verificar, encerrar)
- gerar RAI vinculado a auditoria

Regras:
- matriz de severidade
- prazo de tratamento por severidade
- escalonamento automatico de NC vencida

Testes:
- e2e de ciclo de NC
- integracao com RAI
```

---

## P12 - RAI (com exportacao real)

```text
Implementar RAI totalmente funcional.

Acoes:
- salvar rascunho real
- revisar e aprovar
- versionar revisoes
- exportar PDF real
- enviar ao cliente (email)
- copiar texto com log

IA:
- sugestao de texto com origem rastreavel
- bloquear alucinacao: se faltar evidencia, exigir complemento

Validacoes:
- consistencia entre classificacao e recomendacao
- campos obrigatorios para finalizar

Testes:
- e2e criar -> revisar -> aprovar -> exportar
```

---

## P13 - Normas

```text
Implementar Normas com vinculo real a empresas e clausulas.

Acoes:
- listar normas
- filtrar e buscar
- abrir detalhes e clausulas
- vincular norma a empresa
- atualizar status de implementacao
- acompanhar progresso por clausula

Regras:
- impedir duplicidade de vinculo ativo empresa+norma
- trilha de auditoria de mudancas de status

Testes:
- integracao de vinculo
- e2e de atualizacao de progresso
```

---

## P14 - Treinamentos

```text
Implementar Treinamentos com operacao real.

Acoes:
- cadastrar treinamento
- matricular participante
- controlar status de progresso
- concluir treinamento
- emitir certificado real (PDF)

Regras:
- limite de vagas
- obrigatoriedade por norma/projeto (quando aplicavel)
- validade de certificado e expiracao

Testes:
- e2e matricula -> conclusao -> certificado
```

---

## P15 - Relatorios e Configuracoes

```text
Implementar totalmente:

Relatorios:
- templates reais
- filtros reais
- agendamento de envio real
- exportacao PDF/Excel real
- trilha de emissao real

Configuracoes:
- salvar/carregar via backend (nao localStorage)
- usuarios e perfis reais
- matriz de permissao persistida
- regras de workflow reais
- integracoes com status real
- logs de auditoria reais

Testes:
- e2e agendamento de relatorio
- e2e alteracao de permissao
```

---

## P16 - Prompt de QA final (100% funcional)

```text
Execute validacao final da plataforma Certifica com foco em producao.

Objetivo:
- comprovar que nenhum botao ficou somente visual.

Passos obrigatorios:
1) varrer todas as rotas
2) clicar em todos os controles acionaveis
3) verificar chamada de API correspondente
4) verificar persistencia no banco
5) verificar log de auditoria da acao
6) verificar permissao por perfil
7) validar mensagens de erro e sucesso

Entregue:
- matriz final por controle: OK / FALHA
- evidencias de teste
- bugs restantes com severidade P0/P1/P2
- percentual de cobertura funcional real
- checklist go-live
```

---

## P17 - Prompt linha a linha (cada botao da matriz)

```text
Use como fonte obrigatoria o arquivo:
`RELATORIO_TESTE_FUNCIONAL.md`

Quero implementacao linha a linha para TODOS os controles da secao:
"A) MAPEAMENTO POR PAGINA - ELEMENTOS CLICAVEIS E STATUS"

Regra:
- para cada linha da tabela (um controle), gere:
  1) tarefa tecnica
  2) endpoint/acao de dominio necessaria
  3) mudanca de frontend
  4) validacoes
  5) testes (unit/integration/e2e)
  6) criterio de aceite

Formato de saida:
- um backlog detalhado por controle
- agrupado por pagina
- com prioridade P0/P1/P2
- sem pular nenhum item da matriz

Importante:
- controles marcados como "visual", "parcial" ou "quebrado" devem virar "funcional" com persistencia real.
- controles ja "funcionais" devem ganhar robustez de producao (erro, permissao, log, teste).
```

---

## Checklist final de aceite (usar junto com os prompts)

- [ ] Todo botao tem efeito funcional real.
- [ ] Nenhuma acao critica depende apenas de estado em memoria.
- [ ] Dados persistem apos reload.
- [ ] API e banco cobrem todos os CRUDs necessarios.
- [ ] RBAC aplicado em rotas, endpoints e acoes.
- [ ] Trilha de auditoria registra alteracoes.
- [ ] Upload/download/versionamento funcionando.
- [ ] Exportacao PDF/Excel funcionando.
- [ ] Integracoes principais com contrato definido.
- [ ] Testes e2e cobrindo fluxos criticos.

