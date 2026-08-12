# Por que 2 dimensões aparecem "sem dados suficientes" nesse laudo

## O que foi verificado no banco

Campanha do laudo: **Avaliação NR1 - Agosto** (Theon de Moraes Toledo Piza & Associados, encerrada, 15 respostas completas, `min_group_size = 7`).

- O template da campanha tem as **8 dimensões** e 30 itens da v1.1.
- As respostas **existem** para as 8 dimensões: "Trabalho e Vida Pessoal" tem 45 respostas (15 × 3 itens) e "Sinais de Desgaste Relacionados ao Trabalho" tem 44 — todas de respostas completas.
- Porém, em `campaign_scores` e `response_scores` só existem **6 dimensões** pontuadas (as de ordem 1 a 6). As duas últimas não têm nenhuma linha de pontuação.

## Causa confirmada pelas datas

- Último cálculo de scoring da campanha "Avaliação NR1 - Agosto": **03/08/2026 19:06** (data dos alertas gravados na última execução).
- Último cálculo da campanha "Avaliação TM Associados": **03/08/2026 14:08**.
- Atualização do instrumento para a v1.1 (template com as 8 dimensões): **05/08/2026 01:11** (`survey_templates.updated_at`, `instrument_version = 1.1`).
- Laudo em questão gerado em **12/08/2026 16:55**.

Ou seja: o scoring dessas campanhas rodou **dois dias antes** da atualização do instrumento. As duas dimensões novas ("Trabalho e Vida Pessoal" e "Sinais de Desgaste Relacionados ao Trabalho") passaram a existir com IDs novos depois do cálculo, então ficaram sem pontuação gravada. O laudo de hoje leu essa pontuação antiga e apresentou as duas como sem dados suficientes — não é limite de anonimato (15 respostas, acima de 7) nem falta de respostas (as respostas dos itens 21 a 30 estão no banco).

## Sim — o laudo reemitido terá números diferentes

Recalculando as 8 dimensões a partir das respostas brutas (com as inversões da v1.1), os valores mudam bastante em relação ao que o laudo de hoje mostra:

| Dimensão | No laudo de hoje | Recalculado v1.1 |
| --- | --- | --- |
| Demandas de Trabalho | 61,33 | 65,76 |
| Autonomia e Controle | 68,27 | 65,33 |
| Clareza e Organização do Trabalho | 89,60 | 44,83 |
| Liderança e Justiça Organizacional | 71,73 | 50,67 |
| Relações Sociais no Trabalho | 71,47 | 60,33 |
| Reconhecimento, Sentido e Satisfação | 66,67 | 61,00 |
| Trabalho e Vida Pessoal | sem dados | 58,22 |
| Sinais de Desgaste Relacionados ao Trabalho | sem dados | 53,64 |

Efeitos no laudo reemitido: as 8 dimensões passam a ter escore (N = 15 em todas), o IGP muda, e as 4 dimensões hoje classificadas como risco elevado (≥ 67) deixam de ser — todas ficam na faixa de atenção. A análise, recomendações e conclusão da IA são reescritas sobre esses novos números.

## Correção proposta

1. Rodar **"Reprocessar e reemitir"** nas duas campanhas desse cliente ("Avaliação NR1 - Agosto" e "Avaliação TM Associados"), o que recalcula as 8 dimensões a partir das respostas brutas e regera o laudo.
2. Conferir, após o reprocessamento, que `campaign_scores` tem 8 linhas por campanha e que o novo laudo mostra as 8 dimensões com escore.
3. Levantar quais outras campanhas encerradas estão no mesmo estado (pontuação com menos dimensões que o template) e listá-las para você decidir se quer reemitir todas em lote.


## Detalhes técnicos

- Nenhuma mudança de código é necessária para o caso relatado: a fórmula e o tratamento de dados faltantes já cobrem as 8 dimensões; o problema é dado de pontuação legado.
- Opcional (se você quiser evitar isso de vez): em `generate-report`, bloquear a emissão quando o número de dimensões pontuadas for menor que o número de dimensões do template, forçando o reprocessamento antes de gerar o laudo. Sem isso, um laudo pode voltar a ser emitido sobre pontuação incompleta.
