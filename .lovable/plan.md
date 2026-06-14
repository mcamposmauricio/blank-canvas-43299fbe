## Problema

Quando uma nova empresa (tenant) é criada, ela não recebe nenhum template de pesquisa, então o usuário não consegue criar campanhas. Hoje, os templates "Flew Psychosocial Index (FPI)" e "Avaliação Psicossocial v1" existem apenas vinculados ao tenant "Empresa Demo".

A página de Campanhas já está preparada para listar templates do tenant **OU** templates globais (`is_global = true`), mas atualmente nenhum template está marcado como global.

## Solução

Tornar o template **FPI (Flew Psychosocial Index)** o template padrão global da plataforma, disponível automaticamente para qualquer tenant — novo ou existente.

### Passos

1. **Marcar o FPI como template global**
   - Atualizar `survey_templates` setando `is_global = true` e `is_active = true` no registro `a1b2c3d4-...` (FPI v1.0).
   - As dimensões e itens já estão vinculados a esse template e ficarão acessíveis via as policies "Public read" existentes.

2. **Garantir leitura para todos os tenants**
   - Conferir/ajustar policy de `survey_templates` para que usuários autenticados de qualquer tenant também enxerguem templates com `is_global = true` (hoje a policy "Public read" já cobre, mas vamos adicionar uma policy explícita para `authenticated` por segurança caso a Public read seja removida no futuro).
   - Fazer o mesmo para `survey_dimensions` e `survey_items` (permitir leitura quando o template pai for global).

3. **Sem mudanças no frontend**
   - `src/pages/Campanhas.tsx` já filtra `tenant_id = X OR is_global = true`. Nenhuma alteração necessária.

4. **Validação**
   - Após a migração: confirmar via query que o tenant recém-criado consegue listar o template FPI.
   - Testar criação de campanha na empresa nova.

## Observações

- O template "Avaliação Psicossocial v1" permanece exclusivo do tenant demo (não vira global).
- Nenhuma alteração em edge functions ou dados de campanhas existentes.
- Nada é duplicado por tenant — todos compartilham o mesmo template global (mais limpo e fácil de manter).