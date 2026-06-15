## Problema

A aba **Consentimentos** em **Governança** mostra "Nenhum registro de consentimento" mesmo havendo registros no banco para o tenant atual (ex.: "teste campanha" tem 1 consentimento registrado).

## Causa

A consulta em `src/pages/Governanca.tsx` (linha 158) faz:

```ts
supabase.from("consent_records").select("*, survey_campaigns(id, name, status)")
```

Esse embed do PostgREST exige uma **foreign key** entre `consent_records.campaign_id` e `survey_campaigns.id`. Verifiquei via `pg_constraint` e a tabela `consent_records` tem apenas a PK — **não existe FK** para `survey_campaigns`. Resultado: PostgREST retorna erro, o `throw error` dispara, e a lista fica vazia ("Nenhum registro de consentimento").

Os demais contadores (`consent_count`, contagem por campanha em Participação) funcionam porque não usam embed.

## Plano

1. **Migration** — adicionar a FK que faltava:

```sql
ALTER TABLE public.consent_records
  ADD CONSTRAINT consent_records_campaign_id_fkey
  FOREIGN KEY (campaign_id) REFERENCES public.survey_campaigns(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_consent_records_campaign_id
  ON public.consent_records(campaign_id);
```

Isso:
- Faz o embed `survey_campaigns(...)` funcionar e a lista carregar.
- Mantém integridade referencial (limpa consentimentos órfãos se uma campanha for excluída).
- Não altera dados existentes (todos os `campaign_id` atuais já apontam para campanhas válidas — confirmado pelo `LEFT JOIN` retornar `name` em todas as linhas).

2. **Sem alterações no frontend** — a query atual passa a funcionar.

3. **Validação** — abrir Governança › Consentimentos e confirmar que o registro de "teste campanha" aparece.
