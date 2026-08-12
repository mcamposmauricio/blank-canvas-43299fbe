# Por que 2 dimensões aparecem "sem dados suficientes" nesse laudo

## O que foi verificado no banco

Campanha do laudo: **Avaliação NR1 - Agosto** (Theon de Moraes Toledo Piza & Associados, encerrada, 15 respostas completas, `min_group_size = 7`).

- O template da campanha tem as **8 dimensões** e 30 itens da v1.1.
- As respostas **existem** para as 8 dimensões: "Trabalho e Vida Pessoal" tem 45 respostas (15 × 3 itens) e "Sinais de Desgaste Relacionados ao Trabalho" tem 44 — todas de respostas completas.
- Porém, em `campaign_scores` e `response_scores` só existem **6 dimensões** pontuadas (as de ordem 1 a 6). As duas últimas não têm nenhuma linha de pontuação.

## Causa

O cálculo (`process-scoring`) dessa campanha foi executado **antes** da atualização do instrumento para a v1.1. Naquele momento o template tinha 6 dimensões, que foram atualizadas no lugar (mesmos IDs); as duas dimensões novas ("Trabalho e Vida Pessoal" e "Sinais de Desgaste Relacionados ao Trabalho") receberam IDs novos e, por isso, ficaram sem pontuação gravada.

O laudo gerado hoje leu essas pontuações antigas e, não encontrando valores para as duas dimensões novas, as apresentou como sem dados suficientes. Não é limite de anonimato (há 15 respostas, acima de 7) e não é falta de respostas — é pontuação desatualizada.

## Correção proposta

1. Rodar **"Reprocessar e reemitir"** nas duas campanhas desse cliente ("Avaliação NR1 - Agosto" e "Avaliação TM Associados"), o que recalcula as 8 dimensões a partir das respostas brutas e regera o laudo.
2. Conferir, após o reprocessamento, que `campaign_scores` tem 8 linhas por campanha e que o novo laudo mostra as 8 dimensões com escore.
3. Levantar quais outras campanhas encerradas estão no mesmo estado (pontuação com menos dimensões que o template) e listá-las para você decidir se quer reemitir todas em lote.

## Detalhes técnicos

- Nenhuma mudança de código é necessária para o caso relatado: a fórmula e o tratamento de dados faltantes já cobrem as 8 dimensões; o problema é dado de pontuação legado.
- Opcional (se você quiser evitar isso de vez): em `generate-report`, bloquear a emissão quando o número de dimensões pontuadas for menor que o número de dimensões do template, forçando o reprocessamento antes de gerar o laudo. Sem isso, um laudo pode voltar a ser emitido sobre pontuação incompleta.
