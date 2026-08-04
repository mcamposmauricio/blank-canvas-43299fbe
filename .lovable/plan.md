# Correções PPI v1.1 — laudo, dimensões, scoring e anonimato

Auditoria confirmada no código e no banco. Estado atual verificado:

- O template **global** usado por todas as empresas (68 campanhas) tem apenas **6 dimensões genéricas** (Demanda de Trabalho, Controle sobre o Trabalho, Suporte Social, Reconhecimento, Equilíbrio Vida-Trabalho, **Segurança Psicológica**) — não é o instrumento de 30 itens/8 dimensões.
- Existe um segundo template, não global, "Flew Psychosocial Index (FPI) v1.0", com as **8 dimensões corretas** e 30 itens quase idênticos ao v1.1: itens 12 e 16 já estão marcados como invertidos ali, mas os **textos dos itens 20 e 23 estão desatualizados**.
- `generate-report` monta as seções 13/14/16 a partir de um texto de IA dividido por `---`; quando o modelo devolve um bloco extra (ex.: um cabeçalho de capa) todo o conteúdo desloca uma posição — é a causa do off-by-one e dos placeholders `[Nome da Empresa]` / `[Data]` sobrevivendo.
- 6 dos 9 tenants estão com `min_group_size = 3` (incluindo Brasiltec), embora o default do banco seja 7.

## 1. Template PPI v1.1 (banco)

- Adicionar em `survey_templates` a coluna de versão do instrumento; em `survey_items`, o número do item (1–30) e a flag de alerta individual.
- Criar um **novo** template global `Avaliação de Riscos Psicossociais` versão **1.1**, com as 8 dimensões (nome e ordem) e os 30 itens carregados do `questionario-v1-1.json` anexo (texto exato, `direta`/`invertida`, `alerta_individual` verdadeiro apenas no item 20).
- Marcar o template global antigo (6 dimensões) e o "FPI v1.0" como não globais e inativos: **não** são alterados nem apagados, para que as campanhas e respostas já coletadas continuem ligadas à versão que o respondente viu. A dimensão "Segurança Psicológica" deixa de existir no instrumento vigente.
- Campanhas novas passam a usar automaticamente a v1.1.
- `min_group_size = 7` em todos os tenants e default mantido em 7.

## 2. Scoring (`process-scoring`)

- Manter fórmulas: direta = resposta; invertida = 6 − resposta; score da dimensão = média × 20.
- Alertas por dimensão (score ≥ 67) passam a cobrir as 8 dimensões reais (já são dinâmicos por template).
- **Novo alerta do item 20**: contar respostas 4 ou 5 no item com flag de alerta individual e gravar um alerta próprio (`harassment_alert`) com a **contagem de ocorrências**, sem identificar respondentes, independente da média de "Relações Sociais no Trabalho".
- Supressão de grupos volta a usar N < 7 (já lê `min_group_size`, corrigido pelo item 1).

## 3. Laudo (`generate-report`)

- Pedir à IA um **JSON estruturado** (`{ analise, recomendacoes, conclusao }`) em vez de texto separado por `---`, eliminando o off-by-one. Seção 13 = Análise Interpretativa, 14 = Recomendações Técnicas, 15 = Limitações (inalterada), 16 = **Conclusão Técnica real** (síntese do IGP, dimensões críticas e parecer final) antes do disclaimer.
- Dimensões consumidas dinamicamente do template da campanha (nome e ordem), sem mapeamento fixo, e com os mesmos nomes exatos nas seções 5, 10, 13, 14 e 16.
- Seção 5: registrar "IGP — Índice Geral Psicossocial" por extenso e incluir a matriz de rastreabilidade itens × fatores de risco do arquivo anexo, com o item 11 mapeado explicitamente a "Gestão de mudanças organizacionais".
- Seção 7 e limitações: exibir o valor de anonimato efetivamente aplicado (N ≥ 7).
- Destacar o alerta do item 20 (assédio/violência) na seção de fatores críticos, apenas com a contagem.
- **Verificação de integridade pós-geração**, obrigatória em emissão e reemissão: confere que cada seção esperada tem seu título e que não resta nenhum placeholder (`[...]`). Se falhar, o laudo não é gravado e o erro aparece na tela.

## 4. Reemissão de laudos já emitidos

- Ação "Reprocessar e reemitir" nas campanhas encerradas (tela Relatórios): roda o scoring novamente (inversão corrigida) e regera o documento com as seções na ordem certa; o novo laudo substitui o anterior e registra a data de reemissão.
- Observação honesta: campanhas encerradas cujas respostas foram coletadas no instrumento antigo de 6 dimensões continuarão exibindo essas 6 dimensões — as 8 dimensões só existem para respostas coletadas com o instrumento v1.1. Para essas campanhas a reemissão corrige seções, placeholders, nomenclatura e anonimato.

## 5. Nomenclatura

- `src/lib/flew.ts` → `src/lib/ppi.ts`, com identificadores `PPI_*` (nenhum texto "Flew"/"FPI" aparece hoje na interface; a limpeza é de código e de textos gerados).
- Instrumento = "People Pulse Index (PPI) v1.1"; índice = "IGP (Índice Geral Psicossocial)" em telas, prompts de IA e laudo. Atualizar também a menção a "scoring FPI v1.0" no export do sistema.

## Detalhes técnicos

- Migração: `survey_templates.instrument_version text`, `survey_items.item_number int`, `survey_items.has_individual_alert boolean default false`; seed do novo template global a partir do JSON anexo; `update tenants set min_group_size = 7`.
- Edge functions alteradas: `process-scoring`, `generate-report`, `full-system-export` (texto).
- Frontend: `src/lib/ppi.ts` (renomeado, com as 8 dimensões v1.1), imports em Dashboard/Analises/Governanca/PlanoAcao/SurveyRuntime/AppSidebar, botão de reemissão em `Relatorios.tsx`. Sem novas telas nem mudanças de tema.
