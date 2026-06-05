## Problemas

1. **Erro genérico ao criar unidade/departamento/cargo**: as tabelas `org_units`, `departments` e `job_roles` no schema `public` **não possuem GRANTs** para os papéis `authenticated` e `service_role` (verificado em `information_schema.role_table_grants` → 0 linhas). RLS está OK, mas sem GRANT o PostgREST rejeita qualquer operação com erro de permissão genérico.
2. **Tenants novos nascem vazios**: não há semente automática de estrutura organizacional, o que obriga o usuário a cadastrar tudo do zero (e hoje nem consegue, por causa do problema 1).

## Correção (uma migration única)

### a) GRANTs faltantes
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_units   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_roles   TO authenticated;
GRANT ALL ON public.org_units, public.departments, public.job_roles TO service_role;
```

### b) Função + trigger para semear padrões em todo novo tenant
Função `public.seed_default_org_structure(_tenant_id uuid)` SECURITY DEFINER, idempotente (só insere se ainda não houver linhas para o tenant):
- `org_units`: **"Matriz"** (parent_id NULL).
- `departments`: **"Geral"** ligado a "Matriz".
- `job_roles`: **"Colaborador"**.

Trigger `AFTER INSERT ON public.tenants FOR EACH ROW` chama a função para `NEW.id`.

### c) Backfill
Rodar a função para todo tenant existente que ainda não tem nenhum org_unit/department/job_role.

## Sem mudanças de código/UI
As telas `/estrutura` e `/colaboradores` continuam permitindo cadastro manual — só passam a (i) funcionar de fato e (ii) já encontrar registros padrão.

## Verificação após aplicar

1. `/estrutura` → "Nova Unidade" / "Novo Departamento" / "Novo Cargo" funcionam (toast verde).
2. Tenants existentes mostram "Matriz", "Geral", "Colaborador".
3. Criar novo usuário pela tela de signup → entrar em `/estrutura` → padrões já presentes.
