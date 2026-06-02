## Objetivo

Restaurar no projeto Supabase atual (`zvltrjcpecqpplbtzwhz`) o sistema MarQ HR a partir do `export-2026-06-02T16-31-57-474Z.zip`. O código React e o código das Edge Functions já estão clonados; falta recriar **schema, dados, auth, storage e config**.

## Estado atual

- Banco vazio. Sem tabelas, sem funções, sem triggers, sem buckets.
- Edge functions já existem em `supabase/functions/*` (10 funções).
- `supabase/config.toml` só tem `project_id` — falta `verify_jwt = false` para as funções que validam JWT internamente.
- Secrets básicos do Supabase OK. Falta `RESEND_API_KEY` (será solicitado depois, não bloqueia restauração).

## Conteúdo útil do zip

- `schema/introspection.json` — 3 enums, 23 tabelas, 8 funções, 8 triggers, 43 policies.
- `data/*.ndjson` — 23 tabelas (ex.: tenants 11, profiles 20, employees 166, survey_answers 8982, etc.).
- `auth/users.json` — 20 usuários (sem hash de senha).
- `storage/inventory.json` + `_files.json` por bucket — **apenas metadados**, binários não estão no zip.
- `config/secret-names.json` — lista de secrets esperados.

## Passos

### 1. Migration única reconstruindo o schema

Gerar SQL a partir de `introspection.json` na ordem:

1. `CREATE TYPE` para os 3 enums (`action_status`, `app_role`, `campaign_status`).
2. `CREATE TABLE public.<nome>` para as 23 tabelas, com colunas/types/defaults/not-null vindos da introspecção. PKs e FKs reconstruídas a partir das convenções (`id uuid PK`, `<x>_id uuid` → `<x>(id)`). FKs explicitamente mapeadas onde houver risco: `profiles.tenant_id → tenants.id`, `departments.org_unit_id → org_units.id`, `employees.{tenant_id,department_id,job_role_id}`, `survey_*` chains, `action_plans.{tenant_id,campaign_id,department_id}`, `consent_records`, `audit_logs`, `platform_exports.created_by`, etc.
3. `GRANT` para cada tabela `public`: padrão `SELECT,INSERT,UPDATE,DELETE` para `authenticated` e `ALL` para `service_role`. `anon` ganha `SELECT` apenas onde o RLS permitir (verificar policies — provavelmente nenhuma, pois tudo escopa por `auth.uid()` ou `tenant_id`; `survey_invitations` por token é validado em edge function com service_role).
4. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` em todas as 23 tabelas.
5. `CREATE FUNCTION` para as 8 funções (definições copiadas verbatim do introspection: `update_updated_at_column`, `has_role`, `get_user_tenant_id`, `get_user_department_id`, `get_employee_metadata_by_token`, `handle_new_user`, `export_dump_schema`, `export_list_public_tables`).
6. `CREATE TRIGGER` para os 8 triggers `update_*_updated_at` (definições verbatim).
7. Trigger `on_auth_user_created AFTER INSERT ON auth.users` → `handle_new_user()` (não está no introspection porque vive em `auth`, mas a função `handle_new_user` está; é o gatilho padrão Supabase de signup).
8. `CREATE POLICY` para as 43 policies (cmd/qual/with_check/roles verbatim).

### 2. Buckets de storage

Criados via tool dedicada (não SQL):
- `logos` — público.
- `reports` — privado.
- `platform-exports` — privado.

Policies de storage para super admin (`platform-exports`) e leitura pública (`logos`) replicadas a partir do código/uso atual.

**Binários não estão no zip.** Logos de tenant (`tenants.logo_url`) e PDFs/HTMLs em `reports` continuarão referenciados mas com 404 até serem repostos. Documentado para o usuário.

### 3. Seed dos dados (`data/*.ndjson`)

Script Node executado via `code--exec` usando `SUPABASE_SERVICE_ROLE_KEY` (bypass RLS). Ordem respeitando FKs:

```
tenants
profiles, user_roles
org_units → departments → job_roles → employees
survey_templates → survey_dimensions → survey_items
survey_campaigns → survey_invitations
survey_responses → survey_answers
response_scores → campaign_scores → group_scores
risk_alerts → action_plans
reports, consent_records, audit_logs, platform_exports
```

Inserts em lote (chunks de ~500). Ao final, comparar contagens com `manifest.json.tables` e reportar diferenças.

### 4. Auth users

Para cada um dos 20 usuários de `auth/users.json`:
- `supabase.auth.admin.createUser({ id, email, email_confirm: true, user_metadata, app_metadata })` preservando o `id` (essencial para FKs em `profiles.user_id`, `user_roles.user_id`, `platform_exports.created_by`).
- O trigger `on_auth_user_created` precisa ser **temporariamente desabilitado** durante o seed para não duplicar tenants (o seed já traz `profiles` e `user_roles` reais). Habilitar de volta depois.
- Senhas não exportáveis: usuários precisam usar "Esqueci minha senha" no primeiro acesso. Documentado.

### 5. `supabase/config.toml`

Adicionar blocos `[functions.<nome>] verify_jwt = false` para as 10 funções existentes (todas validam JWT/secret internamente):
`capture-consent, create-tenant-user, delete-tenant-user, full-system-export, generate-report, process-scoring, seed-demo-tenant, seed-test-data, send-survey-emails, send-welcome-email`.

### 6. Secrets

Verificar via `fetch_secrets`. `RESEND_API_KEY` está faltando — necessário para `send-survey-emails` e `send-welcome-email`. Será pedido **só quando** o usuário for usar essas funções (não bloqueia o resto). Demais secrets do Supabase já existem.

### 7. Validação final

- Contagem por tabela bate com `manifest.json`.
- `SELECT count(*) FROM auth.users` = 20.
- Lista de policies/triggers/funções bate com introspecção.
- Smoke test: abrir `/auth`, fazer reset de senha de um super admin (`mauricio@marqponto.com.br`), entrar, conferir que `/dashboard` carrega e `/atividades` aparece para o super admin.

## Limitações conhecidas

- **Senhas**: zero usuários conseguem entrar sem reset por email (limitação do Supabase, não do export).
- **Binários do storage** (logos dos tenants, PDFs e HTMLs em `reports`): não estão no zip; ficarão 404 até serem repostos a partir do projeto original via `supabase storage cp` ou regerados pelas funções (`generate-report` recria HTMLs).
- **Trigger `on_auth_user_created`**: o introspection só dump triggers de `public`; a versão recriada é fiel ao `handle_new_user` capturado e ao fluxo de signup usado em `Auth.tsx`.
- **FKs inferidas por convenção**: como o introspection.json exportado não traz as constraints explicitamente, FKs serão inferidas pelo nome (`<x>_id → <x>.id`). Caso alguma diferença apareça no seed (violação de FK), ajusto pontualmente.

## Arquivos afetados

- Novo: `supabase/migrations/<ts>_restore_marqhr_schema.sql` (migração única grande, gerada a partir do introspection).
- Editado: `supabase/config.toml` (blocos `[functions.*]`).
- Temporário em `/tmp/`: script de seed (não vai pro repo).

Nada no frontend muda.
