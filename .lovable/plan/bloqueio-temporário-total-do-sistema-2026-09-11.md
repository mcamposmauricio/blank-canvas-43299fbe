# Bloqueio temporário total do sistema

## Resultado esperado

- Ativar um modo de indisponibilidade global, sem exceção de usuário.
- Quem estiver com o painel aberto será desconectado automaticamente.
- Novas tentativas de entrada não criarão sessão e exibirão exatamente: **“Encontramos um erro. Contato o suporte.”**
- Links de convite e questionários também ficarão bloqueados.
- A liberação poderá ser feita depois, quando solicitada aqui, sem apagar ou alterar dados operacionais.

## Implementação

1. Criar uma configuração central de disponibilidade no banco, inicialmente marcada como bloqueada.
2. Adicionar uma verificação global antes de exibir qualquer área do sistema.
3. Enquanto o bloqueio estiver ativo:
   - encerrar sessões existentes;
   - impedir o envio do formulário de login e de criação de conta;
   - impedir acesso ao painel, recuperação de senha e questionários públicos;
   - mostrar a mensagem genérica solicitada na tentativa de entrada.
4. Manter a tela de entrada visível para que o usuário receba a mensagem ao tentar acessar, sem revelar detalhes técnicos.
5. Fazer o navegador verificar periodicamente o estado do bloqueio, para desconectar também quem já estava com uma tela aberta.
6. Validar em janela anônima e com uma sessão previamente autenticada que painel e pesquisas ficam inacessíveis.

## Liberação futura

Ao receber sua autorização aqui, a configuração será alterada para liberada. O fluxo normal volta sem recriar usuários, campanhas, convites ou respostas.

## Detalhes técnicos

- A configuração terá somente leitura pública e alteração restrita ao ambiente administrativo.
- O bloqueio será aplicado no nível central de navegação, evitando depender de cada tela individual.
- Nenhum registro de negócio será removido e nenhuma senha será modificada.