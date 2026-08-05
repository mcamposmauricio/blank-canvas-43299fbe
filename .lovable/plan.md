# Corrigir a mensagem de erro na reemissão do laudo

## O que realmente aconteceu

O botão "Reprocessar e reemitir" falhou porque a campanha **"teste campanha"** tem apenas **1 resposta completa**, e o limite de anonimato do tenant exige **no mínimo 7**. Confirmado no banco: 1 resposta completa, `min_group_size = 7`.

A função `generate-report` respondeu corretamente com HTTP 400 e a explicação:

> "Não é possível emitir o laudo: a campanha possui 1 resposta(s) completa(s) e 8 dimensão(ões) apurada(s). São necessárias no mínimo 7 respostas completas e o processamento do scoring (Reprocessar) antes da emissão."

O problema é de interface: a tela de Relatórios não consegue ler o corpo da resposta de erro (o cliente Supabase não preenche `res.data` em respostas não-2xx), então cai numa mensagem genérica sobre "verificação de integridade", que confunde. Não há bug no scoring nem no laudo.

## Correções

1. **Mostrar o motivo real do erro** em `src/pages/Relatorios.tsx`: nas duas mutações (gerar e reemitir), extrair o JSON do erro da função (`FunctionsHttpError` → `error.context.json()`) e exibir a mensagem do backend no toast. Manter a mensagem genérica apenas quando o backend não retornar nada.
2. **Evitar o erro antes do clique**: buscar a contagem de respostas completas por campanha e o `min_group_size` do tenant; quando abaixo do mínimo, desabilitar os botões de emissão/reemissão e exibir um aviso na linha da campanha ("X de 7 respostas — laudo indisponível por anonimato").
3. **Não criar registro órfão**: no fluxo de reemissão, validar a contagem antes de inserir a nova versão em `reports`, para não inserir e apagar em seguida.

## Detalhes técnicos

- Arquivo alterado: `src/pages/Relatorios.tsx` (apenas frontend).
- Leitura do erro: `import { FunctionsHttpError } from "@supabase/supabase-js"`, com `await err.context.json()` protegido por try/catch.
- Contagem: uma query por campanha com `head: true, count: "exact"` sobre `survey_responses` filtrando `is_complete = true` (mesmo padrão já usado em Campanhas para evitar o limite de 1000 linhas).
- Nenhuma mudança nas Edge Functions nem no banco — a validação de 7 respostas permanece como está, por ser regra de anonimato.
