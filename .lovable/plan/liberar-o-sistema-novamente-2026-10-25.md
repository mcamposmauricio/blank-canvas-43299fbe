# Liberar o sistema novamente

## Resultado esperado

- Login, cadastro, recuperação de senha, painel e questionários públicos voltam a funcionar normalmente.
- Quem estiver com a tela aberta poderá entrar de novo em até 10 segundos, sem precisar recarregar.
- Nenhum dado, usuário, campanha, convite ou resposta é alterado.

## Implementação

1. Alterar a configuração central de disponibilidade para "liberado".
2. Manter o mecanismo de bloqueio instalado e inativo, para poder bloquear de novo rapidamente se você pedir.
3. Validar que a tela de entrada aceita login e que um link de pesquisa volta a carregar.

## Detalhes técnicos

- Atualizar `system_settings` (id `global`) para `is_locked = false`.
- Nenhuma alteração de código: as verificações no app e no banco passam a liberar o acesso sozinhas.
