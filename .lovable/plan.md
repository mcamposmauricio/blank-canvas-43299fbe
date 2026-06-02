# Menu "Atividades" + Exportação Completa do Sistema

Funcionalidade exclusiva do usuário `mauricio@marqponto.com.br` (uid `302dc367-1b53-4a47-af5e-d54a6b877e59`) — super-admin de plataforma. Nenhuma outra conta vê ou acessa.

## 1. Identificação do super-admin

Criar helper único usado em frontend e backend:

- Frontend: `src/lib/superAdmin.ts` exporta `SUPER_ADMIN_EMAIL` e `isSuperAdmin(profile)`.
- Backend: validação por **email + user_id** dentro da Edge Function (defesa em profundidade).

Sem mudanças em `app_role` nem em RLS existente — é um gate adicional, não uma nova role do tenant.

## 2. Menu "Atividades" (frontend)

- Nova entrada no sidebar (`src/components/layout/AppSidebar.tsx`), em um grupo separado **"Plataforma"** que só renderiza se `isSuperAdmin`. Ícone `Database` / `Package`.
- Rota `/atividades` em `src/App.tsx`, protegida por um novo wrapper `<SuperAdminRoute>` (similar ao `ProtectedRoute`, mas valida email do `profile`). Quem não for super-admin é redirecionado para `/dashboard`.
- Não tocar em `ROUTE_ALLOWED_ROLES` — o gate é por identidade, não por role.

## 3. Página `/atividades` — Exportação Completa do Sistema

`src/pages/Atividades.tsx`:

- Card único "Exportação Completa do Sistema" com botão **"Gerar pacote de exportação"**.
- Ao clicar: chama Edge Function `full-system-export` via `supabase.functions.invoke`, recebendo stream de logs por SSE / chunked response.
- UI: barra de progresso (`Progress`), painel de logs em tempo real (texto monoespaçado), estado final com link de download direto do `.zip` no Storage (URL assinada, expira em 1h).
- Histórico das últimas 10 exportações listadas abaixo (tabela `platform_exports`).

## 4. Edge Function `full-system-export`

`supabase/functions/full-system-export/index.ts`, `verify_jwt = false` (validação interna):

1. Valida `Authorization: Bearer <jwt>` via `supabase.auth.getUser()` e confirma `email === mauricio@marqponto.com.br` **e** `user_id === 302dc367-...`. Qualquer divergência → 403.
2. Coleta tudo com `SUPABASE_SERVICE_ROLE_KEY`:
   - **Schema do banco**: query em `information_schema` + `pg_catalog` para tabelas, colunas, índices, constraints, views, sequences, enums (ex.: `app_role`, `action_status`, `campaign_status`).
   - **Functions/triggers**: `pg_proc` + `pg_trigger` (schema `public`).
   - **RLS policies**: `pg_policies`.
   - **Migrations existentes**: lê `supabase/migrations/` empacotado junto (via arquivos do repo incluídos no deploy da função — alternativa: reconstruir DDL via introspecção).
   - **Dados**: `SELECT *` de todas as tabelas `public` → NDJSON por tabela.
   - **Storage**: lista buckets (`reports`, `logos`) e baixa todos os objetos via `storage.from(bucket).download()`.
   - **Auth**: `auth.admin.listUsers()` (metadata + emails, sem senhas — senhas não são exportáveis; documentado no README).
   - **Edge Functions**: snapshot do código-fonte das funções (incluído no bundle do deploy via leitura de `Deno.readTextFile` nos arquivos disponíveis no runtime, ou listados como referência no README quando não acessíveis).
   - **Config**: `supabase/config.toml`, lista de secrets (apenas nomes, nunca valores), providers de auth ativos.
3. Monta `.zip` em memória usando `jsr:@zip-js/zip-js`:
   ```
   export-YYYYMMDD-HHMMSS.zip
   ├── README.md                  ← prompt de reconstrução
   ├── manifest.json              ← inventário + checksums
   ├── schema/
   │   ├── 01_extensions.sql
   │   ├── 02_enums.sql
   │   ├── 03_tables.sql
   │   ├── 04_views.sql
   │   ├── 05_functions.sql
   │   ├── 06_triggers.sql
   │   ├── 07_rls_policies.sql
   │   └── 08_grants.sql
   ├── data/<table>.ndjson
   ├── storage/<bucket>/<path>
   ├── edge-functions/<name>/index.ts
   ├── auth/users.json            ← sem hashes de senha
   ├── auth/config.json
   ├── migrations/*.sql           ← cópia de supabase/migrations
   ├── frontend/package.json      ← referência de deps
   └── config/supabase.config.toml
   ```
4. Upload do `.zip` para bucket privado **novo** `platform-exports` (criado na migração); gera URL assinada de 1h e devolve no payload final.
5. Registra linha em `platform_exports` (id, gerado_em, tamanho_bytes, caminho_storage, logs_resumo).
6. Stream de progresso via `ReadableStream` (chunks JSON `{stage, pct, message}`).

### README.md gerado (prompt para IA)

Texto fixo embutido na função, instruindo a IA destinatária a:
- criar projeto Supabase novo + projeto Lovable;
- aplicar `schema/*.sql` em ordem;
- importar `data/*.ndjson` com `COPY` ou inserts em lote, respeitando FKs;
- recriar buckets e fazer upload de `storage/**`;
- redeployar `edge-functions/*` com mesma config (`verify_jwt`);
- recriar auth users a partir de `auth/users.json` (senhas precisam reset — documentado);
- conferir RLS, roles, multi-tenant e providers de auth conforme `auth/config.json`;
- validar `manifest.json` checksums após restauração.

## 5. Banco de dados

Migração nova:

- Tabela `platform_exports` (id, created_at, created_by, file_path, file_size_bytes, status, logs jsonb). RLS: `SELECT/INSERT` permitidos somente quando `auth.uid() = '302dc367-1b53-4a47-af5e-d54a6b877e59'`. GRANTs apenas para `authenticated` e `service_role`.
- Bucket privado `platform-exports` com policy permitindo apenas o super-admin via `auth.uid() = '302dc367-...'`.

## 6. Segurança

- Gate triplo: sidebar oculto, rota redireciona, Edge Function rejeita com 403.
- Validação no backend amarrada em **email + user_id** (não só email, evita squatting se um dia o email mudar).
- Bucket privado + URL assinada curta (1h).
- Nenhum secret é exportado em texto plano — apenas os **nomes** dos secrets configurados, para a IA destino saber o que precisa pedir ao novo dono.
- Senhas de auth jamais saem (impossível via API). README explicita o reset.

## 7. Arquivos afetados

**Novos:**
- `src/lib/superAdmin.ts`
- `src/components/SuperAdminRoute.tsx`
- `src/pages/Atividades.tsx`
- `supabase/functions/full-system-export/index.ts`
- `supabase/migrations/<ts>_platform_exports.sql`

**Editados:**
- `src/App.tsx` — registrar rota `/atividades`.
- `src/components/layout/AppSidebar.tsx` — grupo "Plataforma" condicional.
- `supabase/config.toml` — bloco `[functions.full-system-export]` com `verify_jwt = false`.

## 8. Limitações honestas

- **Senhas de usuários auth**: Supabase não expõe hashes; usuários precisarão redefinir senha no ambiente restaurado. Documentado no README gerado.
- **Cron jobs**: o projeto atualmente não possui cron jobs configurados (`pg_cron` não está em uso). Se forem adicionados depois, a introspecção em `cron.job` já é coberta pelo dump de schema.
- **Código-fonte do frontend**: o `.zip` inclui `package.json` e configs como referência, mas não o repositório completo — recriação do projeto Lovable é feita clonando o repo do GitHub conectado. README orienta esse passo.
- **Tamanho**: exportações grandes (>100MB) podem aproximar limites de Edge Function. Mitigação: gerar `.zip` em chunks para storage diretamente, sem buffer único; se exceder, particionar em `data.zip` separado.
