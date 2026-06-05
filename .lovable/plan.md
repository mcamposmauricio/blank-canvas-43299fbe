## Causa raiz

A trigger `on_auth_user_created` em `auth.users` que invoca `public.handle_new_user()` **não está instalada** no banco. Resultado: usuários criados via signup (ex.: `teste@teste.com`) ficam **sem registro em `public.profiles`**, então `get_user_tenant_id(auth.uid())` retorna `NULL` e toda RLS de tenant (`tenant_id = get_user_tenant_id(auth.uid())`) falha — o erro "new row violates row-level security policy" aparece em qualquer insert.

Confirmado:
- `auth.users` tem `teste@teste.com` (id `55adef1b-…`), mas `profiles` não tem linha para ele.
- `pg_trigger` em `auth.users` (não-internos) está vazio.
- A função `public.handle_new_user()` continua existindo e correta.

## Correção (uma migration)

1. **Recriar a trigger**:
   ```sql
   CREATE TRIGGER on_auth_user_created
   AFTER INSERT ON auth.users
   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```
2. **Backfill de usuários órfãos** (sem profile): executar manualmente o mesmo bloco do `handle_new_user` para cada `auth.users` que ainda não tem profile — cria tenant a partir de `raw_user_meta_data`, insere `profiles` e `user_roles` com role `admin_rh`. O trigger `trg_seed_default_org_structure` já em vigor cuidará de popular Matriz/Geral/Colaborador para esses tenants novos.

## Verificação após aplicar

1. `select * from profiles where email='teste@teste.com'` → 1 linha com `tenant_id` preenchido.
2. Logar como `teste@teste.com` em `/estrutura` → já aparecem "Matriz", "Geral", "Colaborador" e botão "Nova Unidade" cria sem erro.
3. Criar um novo signup → profile + tenant + estrutura padrão aparecem automaticamente.
