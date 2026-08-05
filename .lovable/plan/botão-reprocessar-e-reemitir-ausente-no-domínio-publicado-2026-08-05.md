# Botão "Reprocessar e reemitir" ausente no domínio publicado

## O que está acontecendo

Na tela de Relatórios do domínio `diagnostico.peoplepulse.com.br` o bloco "Gerar Novo Relatório" aparece com "Laudo Técnico" e "Rel. Executivo", mas sem "Reprocessar e reemitir".

Esses dois primeiros botões já existiam antes; o "Reprocessar e reemitir" (e as melhorias de mensagem de erro e o aviso de anonimato) foram adicionados depois, no código do preview. O domínio publicado continua servindo a versão anterior do app, porque publicar é um passo manual — alterações feitas no editor não vão ao ar automaticamente.

Não é problema de permissão: o usuário `contato@flew.com.br` consegue ver o bloco e os outros botões, o que só acontece com permissão de criação.

## Correção

1. Publicar o projeto para que o domínio publicado passe a servir a versão atual do código.
2. Depois de publicar, revalidar em `diagnostico.peoplepulse.com.br`:
   - o botão "Reprocessar e reemitir" aparece em cada campanha encerrada/arquivada;
   - campanhas abaixo do mínimo de respostas mostram o aviso "X de 7 respostas — laudo indisponível por anonimato" com os botões desabilitados;
   - uma reemissão em campanha com respostas suficientes conclui e substitui o laudo anterior.
3. Se após a publicação (e um recarregamento forçado) o botão continuar ausente, investigar cache do domínio customizado e o papel efetivo do usuário no tenant antes de qualquer mudança de código.

## Detalhes técnicos

- Nenhuma alteração de código ou de banco é necessária: `src/pages/Relatorios.tsx` já contém o botão, a leitura de `min_group_size`, a contagem exata de respostas completas e a extração da mensagem real de erro das Edge Functions.
- O bloco é renderizado quando `canCreate` é verdadeiro e existe pelo menos uma campanha `closed`/`archived` — condição já satisfeita nesse tenant.
