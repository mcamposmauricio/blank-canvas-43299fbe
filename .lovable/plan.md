## Objetivo

Resetar a senha de todos os 20 usuários em `auth.users` para `123456`, permitindo login imediato sem fluxo de "esqueci minha senha".

## Abordagem

Como o sandbox não tem `SUPABASE_SERVICE_ROLE_KEY` exposto no shell, e a API JS do Supabase não permite alterar senha de outro usuário a partir do cliente, vou usar uma **edge function temporária** rodando dentro do Supabase (onde `SUPABASE_SERVICE_ROLE_KEY` está disponível como `Deno.env`).

### Passos

1. **Criar** `supabase/functions/admin-reset-passwords/index.ts`:
   - Protegida por header `x-admin-token` com segredo aleatório que será gerado e mostrado apenas nesta execução.
   - Lista todos os usuários via `supabase.auth.admin.listUsers()` (paginação se necessário).
   - Para cada user: `supabase.auth.admin.updateUserById(id, { password: '123456' })`.
   - Também atualiza `profiles.must_change_password = true` para todos, forçando troca obrigatória no primeiro login (proteção mínima — senha `123456` é insegura).
   - Retorna contagem de senhas alteradas + lista de erros (se houver).

2. **Registrar** em `supabase/config.toml`: `[functions.admin-reset-passwords] verify_jwt = false`.

3. **Executar** via `supabase--curl_edge_functions` com o header `x-admin-token`.

4. **Validar** retorno (esperado: 20 senhas alteradas, 0 erros).

5. **Deletar** a edge function `admin-reset-passwords` (`supabase--delete_edge_functions`) para não deixar endpoint privilegiado exposto.

## Avisos importantes

- **Senha `123456` é extremamente fraca.** Recomendado apenas para testes/desenvolvimento. A flag `must_change_password = true` força cada usuário a trocar a senha no primeiro login (a página `/trocar-senha` já existe).
- Após o reset, qualquer pessoa que souber o email + a senha `123456` consegue entrar. Use só se o ambiente não está exposto publicamente, ou troque imediatamente.
- Não há reversão — senhas antigas não são recuperáveis.

## Arquivos afetados

- Criado e deletado ao final: `supabase/functions/admin-reset-passwords/index.ts`
- Editado temporariamente: `supabase/config.toml` (bloco da função, removido ao deletar)

Nada no frontend muda.
