## Problema

Ao clicar em "Gerar convites" em uma campanha, o Supabase retorna erro porque o código (`src/pages/Campanhas.tsx`, linha 183) executa:

```ts
supabase.from("survey_invitations").upsert(invites, {
  onConflict: "campaign_id,employee_id",
  ignoreDuplicates: true,
})
```

mas a tabela `survey_invitations` só possui a PRIMARY KEY em `id` — **não existe** UNIQUE em `(campaign_id, employee_id)`. Sem essa constraint, o Postgres rejeita o `ON CONFLICT` com erro `42P10: there is no unique or exclusion constraint matching the ON CONFLICT specification`.

Também é uma falha de integridade: nada hoje impede criar dois convites para o mesmo colaborador na mesma campanha.

## Correção

Migration única que:

1. Remove duplicatas existentes em `survey_invitations` mantendo a linha mais antiga por `(campaign_id, employee_id)` (preserva o token já enviado, se houver).
2. Cria `UNIQUE (campaign_id, employee_id)` em `survey_invitations`.

Nenhuma alteração de código é necessária — o `upsert` atual passa a funcionar.

## Verificação após aplicar

- Abrir campanha "a" → clicar em "Gerar convites" → toast "N convites gerados".
- Clicar de novo → não duplica (ignoreDuplicates atua).
- Conferir `select count(*), campaign_id, employee_id from survey_invitations group by 2,3 having count(*)>1` → 0 linhas.
