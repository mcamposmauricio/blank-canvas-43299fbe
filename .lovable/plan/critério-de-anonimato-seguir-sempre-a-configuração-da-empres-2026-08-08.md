# Critério de anonimato: seguir sempre a configuração da empresa

## Situação atual (verificada)

O laudo **já usa** o valor configurado da empresa: a função de geração lê `min_group_size` do tenant e imprime esse número nas seções de metodologia, amostra, nota da tabela por área e limitações. O motivo de aparecer "7" no laudo da Brasiltec é que essa empresa está configurada com 7 — não é valor fixo no código.

Consulta ao banco (valor configurado por empresa):
- Brasiltec, Empresa Demo, NETPROFIT, NETPROFITBRASIL, PAC, Rodomacro, teste mauricio, Theon: 7
- People Pulse: 3

O cálculo de supressão de grupos (scoring) e a tela de Relatórios também já seguem a configuração.

## O que realmente está fixo

1. **Análises** — o texto de estado vazio dos gráficos por grupo mostra "N ≥ 7 necessário" com o número escrito no código, independente da configuração.
2. **Fallbacks frágeis** — em Governança o valor usa `|| 7`, que substitui por 7 caso a configuração seja 0; e em Configurações/Relatórios o padrão inicial é 7 escrito no código, o que pode piscar um número errado antes de carregar a empresa.

## Mudanças propostas

- Trocar o texto fixo em Análises por um texto que use o `min_group_size` da empresa logada (mesma consulta já usada em Governança/Relatórios).
- Padronizar a leitura do critério em um único hook/consulta reutilizável (`useMinGroupSize`) para Governança, Relatórios, Análises e Configurações, evitando duplicação e números escritos no código.
- Ajustar os fallbacks: usar `??` em vez de `||` e não exibir número algum enquanto o valor não carregou (mostrar o critério só depois de ter o valor real).
- Revisar o laudo para confirmar que nenhuma frase de anonimato ficou com número fixo (as seções 5, 7, 11 e 15 já são dinâmicas; a checagem cobre também o texto gerado por IA, que recebe o critério como contexto).

## Detalhes técnicos

- Arquivos: `src/pages/Analises.tsx` (linha do estado vazio), `src/pages/Governanca.tsx`, `src/pages/Relatorios.tsx`, `src/pages/Configuracoes.tsx`, novo `src/hooks/useMinGroupSize.ts`.
- Sem mudanças de banco: `tenants.min_group_size` já existe e é editável em Configurações.
- Sem mudança de comportamento no cálculo: `process-scoring` e `generate-report` continuam usando `tenant.min_group_size`.
