## Ajuste

Trocar qual template é o global padrão da plataforma e renomeá-lo.

### Mudanças (apenas dados, sem schema)

1. **Desmarcar FPI como global**
   - `survey_templates` id `a1b2c3d4-...`: `is_global = false`
   - Reverter o nome para o original (`Flew Psychosocial Index (FPI) v1.0`) e a descrição original.

2. **Promover "Avaliação Psicossocial v1" a template global padrão**
   - `survey_templates` id `d0000001-...`:
     - `is_global = true`
     - `is_active = true`
     - `name` = **`Avaliação de Riscos Psicossociais`**
     - `description` mantida (`Questionário baseado no modelo Demanda-Controle-Suporte com 6 dimensões psicossociais`).

3. **Sem impacto em**:
   - Campanhas, respostas, dimensões e itens existentes (vinculados por `id`).
   - Frontend: `Campanhas.tsx` já lista templates do tenant **OU** globais.

### Validação

- Query confirmando que apenas `d0000001-...` está com `is_global = true` e com o novo nome.
- Conferir na tela de Campanhas de qualquer empresa que o template aparece na lista de seleção.