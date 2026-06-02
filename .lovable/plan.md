## Objetivo

Concluir a restauração do sistema MarQ HR no projeto Supabase **externo** `zvltrjcpecqpplbtzwhz` — sem usar Lovable Cloud, Lovable Emails, connectors ou qualquer recurso gerenciado pela Lovable. Apenas Supabase puro (migrations, edge functions, storage, auth admin API) + Resend direto via HTTP.

## Estado atual

- Schema restaurado: 23 tabelas, 3 enums, 8 funções, 8 triggers, 43 policies.
- Trigger `on_auth_user_created` em `auth.users` já recriado.
- Banco vazio: 0 linhas em todas as tabelas.
- Sem buckets, sem usuários auth, sem `RESEND_API_KEY`.
- Sandbox **não** tem `psql` nem `SUPABASE_SERVICE_ROLE_KEY` exposto como env do shell — `service_role` existe apenas como Edge Function Secret no projeto Supabase.
- Edge functions já existentes (`send-survey-emails`, `send-welcome-email`) chamam **Resend diretamente** via `fetch("https://api.resend.com/emails", …)` usando `Deno.env.get("RESEND_API_KEY")`. Nenhuma dependência de connector ou gateway Lovable.

## Princípio de "sem Lovable Cloud"

- **Não** usar `email_domain--*`, `setup_email_infra`, `scaffold_transactional_email`, queue pgmq, cron de emails, `auth-email-hook` da Lovable.
- **Não** usar connectors (`standard_connectors--*`) nem o gateway `connector-gateway.lovable.dev`.
- Emails de auth (reset de senha, confirmação) continuam saindo pelo **SMTP nativo do Supabase** (configurável em Auth → SMTP no painel Supabase, fora do nosso escopo aqui).
- Emails transacionais do app (convites de survey, welcome) saem das edge functions chamando **API HTTP da Resend** diretamente, com `RESEND_API_KEY` armazenado como **Supabase Edge Function Secret** (não como secret Lovable Cloud).

## Passos

### 1. Armazenar `RESEND_API_KEY` no Supabase

A chave `re_VJHYJHKw_9CvY1zLjs3Gha9qGUTcGzdvP` precisa virar Edge Function Secret no projeto Supabase. Caminhos possíveis, sem Lovable Cloud:

- **Opção A (recomendada)**: você cola a chave em https://supabase.com/dashboard/project/zvltrjcpecqpplbtzwhz/settings/functions → "Add new secret" → nome `RESEND_API_KEY`. É o método oficial do Supabase e não passa pela infra da Lovable.
- **Opção B**: eu uso a tool `secrets--add_secret` (que, neste projeto conectado a Supabase externo, repassa o valor para o Edge Function Secret do próprio Supabase — sem criar nada do lado Lovable Cloud). Funcionalmente equivalente à Opção A.

A função `send-survey-emails` já checa `Deno.env.get("RESEND_API_KEY")` e retorna erro claro se ausente.

### 2. Ajustar `supabase/config.toml`

Adicionar `[functions.<nome>] verify_jwt = false` para as 10 edge functions existentes (todas validam JWT/secret internamente):
`capture-consent, create-tenant-user, delete-tenant-user, full-system-export, generate-report, process-scoring, seed-demo-tenant, seed-test-data, send-survey-emails, send-welcome-email`.

Adicionar também `[functions.restore-seed] verify_jwt = false` para a função temporária do passo 4.

### 3. Criar os 3 buckets de storage

Via tool dedicada de bucket do Supabase:
- `logos` — público
- `reports` — privado
- `platform-exports` — privado

Migration separada com policies em `storage.objects`:
- `logos`: SELECT público; INSERT/UPDATE/DELETE para `authenticated` no escopo do tenant.
- `reports`: SELECT/INSERT/UPDATE/DELETE só para `authenticated` cujo `tenant_id` (via `get_user_tenant_id(auth.uid())`) bata com a primeira pasta do path.
- `platform-exports`: tudo restrito a super admin (`has_role(auth.uid(), 'super_admin')`).

**Binários não estão no zip** — referências em `tenants.logo_url` e tabela `reports` ficarão 404 até serem regerados (via `generate-report`) ou repostos manualmente.

### 4. Seed de dados + auth users via edge function temporária

Como não temos `psql` nem service role no shell, crio `supabase/functions/restore-seed/index.ts` que roda dentro do Supabase (onde `SUPABASE_SERVICE_ROLE_KEY` é `Deno.env`):

1. Autentica pelo header `x-restore-token` (segredo aleatório que eu gero e te mostro só nesta execução).
2. Recebe payload `{ table: string, rows: any[] }` ou `{ users: [...] }`.
3. Para `users`: desabilita trigger (`ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created`), cria os 20 via `supabase.auth.admin.createUser({ id, email, email_confirm: true, user_metadata })` preservando IDs, reabilita o trigger ao final.
4. Para tabelas: upsert por `id` em batches de 500, bypass RLS via service role.
5. Retorna contagem inserida.

Sandbox orquestra: lê `/tmp/exp/data/*.ndjson` e `/tmp/exp/auth/users.json`, dispara `fetch` para a função respeitando a ordem de FK:

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

Ao final, deleto a função com `supabase--delete_edge_functions` para não deixar rota privilegiada exposta.

### 5. Validação final

- Contagens por tabela batem com `manifest.json` (tenants 11, profiles 20, employees 166, survey_answers 8982, …).
- `SELECT count(*) FROM auth.users` = 20.
- Smoke test manual: super admin (`mauricio@marqponto.com.br`) usa "Esqueci minha senha" no `/auth`, entra, abre `/dashboard` e `/atividades`.
- Teste opcional de envio: chamar `send-survey-emails` em uma campanha de teste para validar Resend.

## Limitações conhecidas

- **Senhas**: nenhum usuário entra sem reset por email (export Supabase não traz hash). Reset depende do SMTP do Supabase estar configurado para `flewpulse.com.br` (ou usar o SMTP default do Supabase para o primeiro acesso).
- **Binários de storage**: logos de tenant e PDFs/HTMLs em `reports` ficarão 404 até repostos ou regerados via `generate-report`.
- **`tenants.logo_url`** continua apontando para URLs do projeto antigo até o re-upload.
- Como decidimos não usar Lovable Emails: emails de auth (reset de senha, confirmação) saem pelo SMTP configurado no Supabase. Se quiser usar o domínio `flewpulse.com.br` nesses emails, é necessário configurar SMTP custom no painel do Supabase (Auth → SMTP). Fora do escopo deste plano.

## Arquivos afetados

- Editado: `supabase/config.toml` (blocos `[functions.*] verify_jwt = false`).
- Criado e deletado ao final: `supabase/functions/restore-seed/index.ts`.
- Nova migration: policies de `storage.objects` para os 3 buckets.
- Edge Function Secret no Supabase: `RESEND_API_KEY`.

Nada no frontend muda.

## Após sua aprovação

Executo na ordem: `RESEND_API_KEY` → `config.toml` → buckets + policies → função `restore-seed` → seed orquestrado → validação de contagens → deleção da `restore-seed` → relatório final.
