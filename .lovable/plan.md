## Objetivo

O template usado por último (FPI — `a1b2c3d4-...`, com 8 dimensões e 30 itens, presente nas 5 campanhas mais recentes) já está marcado como global. Falta apenas traduzir o nome (e descrição) para português para que apareça com identidade em PT-BR para todas as empresas.

## Mudanças

1. **Renomear o template global** (data update via insert tool, sem migração de schema):
   - `name`: `Flew Psychosocial Index (FPI) v1.0` → **`Índice Psicossocial Flew (IPF) v1.0`**
   - `description`: traduzir para → **`Instrumento padronizado de avaliação de riscos psicossociais organizacionais conforme metodologia Flew. 30 itens, 8 dimensões, escala Likert de 1 a 5.`**

2. **Não alterar**:
   - `is_global = true` e `is_active = true` (já configurado).
   - Dimensões, itens, campanhas existentes e respostas — tudo continua vinculado pelo `id`, nada quebra.
   - O outro template ("Avaliação Psicossocial v1") permanece restrito ao tenant demo.

3. **Validação**: confirmar via query que o template aparece com o novo nome em PT-BR e segue acessível para qualquer tenant na tela de Campanhas.

## Observação

Se preferir outro nome em português (ex.: "Avaliação Psicossocial Flew v1.0"), é só dizer antes de aprovar.