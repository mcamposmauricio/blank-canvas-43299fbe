# Teste end-to-end das correções PPI v1.1

Objetivo: validar em dados reais que scoring, alertas, anonimato e laudo saíram corretos após as correções — sem tocar em código de produção, a não ser que o teste encontre falha.

Estado já verificado no banco:

- Template global tem **8 dimensões** e **30 itens**, com **1 item marcado como alerta individual** (item 20).
- **Todos os tenants** estão com `min_group_size = 7`.
- Existem 50 campanhas encerradas/arquivadas e 88 laudos já emitidos (versões antigas).
- Campanha com mais respostas completas para teste: **"UNIDADE 166 - 2026" (Brasiltec, encerrada, 59 respostas)**.

## Roteiro do teste

### 1. Scoring
Reprocessar a campanha de teste e conferir:
- 8 dimensões pontuadas, scores na faixa 20–100.
- Itens invertidos aplicados (12 e 16 entre eles) — conferir por recálculo manual de uma resposta contra o valor gravado em `response_scores`.
- Alertas por dimensão apenas onde a média ≥ 67.
- Alerta `harassment_alert` com contagem de respostas 4/5 no item 20, comparada à contagem direta em `survey_answers`.
- Grupos com N < 7 gravados como suprimidos.

### 2. Laudo técnico
Emitir um laudo técnico novo e conferir no HTML gerado:
- Seções 13 (Análise Interpretativa), 14 (Recomendações Técnicas), 15 (Limitações) e 16 (Conclusão Técnica) com o conteúdo certo em cada uma — o off-by-one resolvido.
- Nenhum placeholder do tipo `[Nome da Empresa]` / `[Data]`.
- As 8 dimensões do template nas seções 5, 10 e nos textos de IA, com os mesmos nomes.
- Matriz de rastreabilidade itens × fatores com 30 linhas e o item 11 apontando "Gestão de mudanças organizacionais".
- "IGP — Índice Geral Psicossocial" por extenso e anonimato exibido como N ≥ 7.
- Alerta do item 20 na seção de fatores críticos, apenas com a contagem.

### 3. Verificação de integridade
Forçar uma falha controlada (ex.: chamar a geração de uma campanha sem respostas processadas) e confirmar que o laudo **não** é gravado e que a mensagem de erro chega na tela.

### 4. Reemissão
Rodar "Reprocessar e reemitir" na campanha de teste pela tela de Relatórios e conferir:
- Novo laudo com versão incrementada e o anterior substituído.
- Log de auditoria `reissue_report` registrado.
- Laudo reemitido passa nas mesmas checagens do item 2.

### 5. Fluxo de resposta (regressão)
Abrir o link de um convite não usado da campanha ativa, responder o questionário e confirmar: 30 itens exibidos, 8 dimensões, consentimento registrado e resposta marcada como completa.

### 6. Marca
Confirmar que nenhuma tela, prompt ou laudo menciona "Flew" ou "FPI", e que o instrumento aparece como "People Pulse Index (PPI) v1.1".

## Detalhes técnicos

- Scoring e geração de laudo chamados via edge functions `process-scoring` e `generate-report`; validações feitas com consultas SQL de leitura e leitura do HTML gravado no bucket `reports`.
- Fluxo de resposta e reemissão testados no preview com Playwright (login na tela `/auth`, tela Relatórios).
- Dados de produção: o teste usa a campanha Brasiltec já encerrada. A reemissão **substitui** o laudo atual dessa campanha por uma versão nova e correta — nenhum outro tenant é tocado.
- Se alguma checagem falhar, o retorno inclui a causa e a correção proposta antes de qualquer alteração de código.
