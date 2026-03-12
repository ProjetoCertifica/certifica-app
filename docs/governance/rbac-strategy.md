# Certifica - Estrategia de Permissoes (RBAC)

## 1. Perfis padrao

- `admin`
- `gestor`
- `consultor`
- `auditor`
- `cliente`

## 2. Acoes por recurso

Acoes canonicas:
- `read`
- `write`
- `approve`
- `export`
- `share`
- `admin`

Escopos:
- `own`
- `team`
- `organization`
- `client_assigned`

## 3. Matriz base (resumo)

- `admin`: acesso total.
- `gestor`: `read/write/export/share` em quase todos os modulos, `admin` limitado.
- `consultor`: foco operacional em clientes, projetos, auditorias, documentos, ESG e tasks.
- `auditor`: foco em auditorias, RAI, documentos, relatorios.
- `cliente`: leitura restrita (dashboard, documentos, relatorios permitidos).

## 4. Regra de enforcement

- Frontend: controle de exibicao de botoes e rotas.
- Backend: autorizacao obrigatoria por endpoint e por entidade.
- Logs: toda negacao de permissao deve ser auditavel.

## 5. Permissoes sensiveis

Devem exigir `approve` ou `admin`:
- Aprovar RAI
- Assinar documento
- Alterar matriz de permissao
- Alterar politicas LGPD/seguranca
- Exportar relatorio executivo em lote

## 6. Checklist de implantacao RBAC

1. Mapear endpoint -> permissao minima.
2. Mapear modulo UI -> permissao minima.
3. Cobrir testes de autorizacao por perfil.
4. Validar fluxo de impersonacao em homologacao.
5. Revisao trimestral da matriz com governanca.
