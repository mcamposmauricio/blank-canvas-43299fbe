# Simplificar a seção 5 do laudo técnico

Na seção 5 (Fundamentação Metodológica), hoje existem duas subseções: "5.1 Dimensões avaliadas" (lista as dimensões com contagem e números dos itens) e "5.2 Matriz de rastreabilidade — itens × fatores de risco" (tabela com os 30 itens, enunciados, dimensão e fator).

Mudanças:

- 5.1 passa a listar **apenas os nomes das dimensões**, sem a contagem de itens e sem os números dos itens.
- 5.2 é **removida por completo** — a tabela de rastreabilidade e a nota sobre o item 11 saem do laudo.
- O restante da seção 5 (escala, itens invertidos, fórmulas, IGP, anonimato, classificação de risco) permanece igual.

Todos os laudos técnicos gerados depois disso já saem no formato novo; laudos antigos já emitidos continuam como estão até serem reemitidos.

## Detalhes técnicos

- `supabase/functions/generate-report/index.ts`: simplificar o `map` da lista 5.1 para só `d.name`; excluir o bloco do `<h3>5.2 ...</h3>`, a tabela e o `<p class="note">` do item 11.
- Conferir a lista `expectedSections` da verificação de integridade para garantir que nenhum título removido continue sendo exigido.
