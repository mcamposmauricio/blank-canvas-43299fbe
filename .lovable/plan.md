## Objetivo

Executar uma bateria completa de testes funcionais no sistema restaurado, validando: autenticação, RLS, edge functions, envio de emails (Resend), geração de PDFs, fluxo de campanha (criação → convites → respostas → scoring → relatório) e exports.

## Escopo dos testes

### 1. Sanidade do banco e auth
- Verificar contagens das 23 tabelas vs manifest (já feito no restore, revalidar).
- Conferir que os 20 usuários em `auth.users` têm profile correspondente, role atribuída e `must_change_password=true`.
- Testar login via API com `123456` em um usuário admin_rh e um gestor.
- Validar RLS: query como anon não retorna dados sensíveis; query autenticada respeita tenant_id.

### 2. Edge functions — health check
Para cada uma das 10 functions, fazer chamada de validação (sem efeito colateral quando possível) e checar logs:
- `capture-consent` — POST com payload mínimo válido + inválido (validar 400).
- `create-tenant-user` — criar um usuário de teste em tenant existente.
- `delete-tenant-user` — remover o usuário de teste criado acima.
- `seed-demo-tenant` — apenas validar que responde (não executar se já há demo).
- `seed-test-data` — executar criando campanha "QA Bateria" no tenant demo, com `skip_scoring=true` primeiro.
- `process-scoring` — rodar sobre a campanha criada; validar `campaign_scores`, `group_scores`, `response_scores`, `risk_alerts`.
- `send-survey-emails` — enviar 1 email de teste (filtrando `invitation_ids` para 1 destinatário controlado) e confirmar entrega via resposta do Resend.
- `send-welcome-email` — disparar para 1 email de teste.
- `generate-report` — gerar PDF de uma campanha encerrada; baixar do bucket `reports` e verificar tamanho/MIME.
- `full-system-export` — gerar export; verificar arquivo em `platform-exports`.

### 3. Fluxo end-to-end de campanha (caminho feliz)
1. Login como admin_rh.
2. Criar nova campanha pequena (3 colaboradores) via UI/API.
3. Enviar convites por email (`send-survey-emails`) para 1 email real de teste.
4. Para os 3 convites, submeter respostas via endpoint público de `SurveyRuntime` (token).
5. Registrar consents.
6. Disparar `process-scoring`.
7. Gerar relatório PDF.
8. Validar que aparece em `/relatorios` e download funciona.

### 4. Validações de UI (browser automation)
- `/auth` → login com `123456` → redirect para `/trocar-senha`.
- Trocar senha → redirect para rota default conforme role.
- Navegar Dashboard, Analises, Relatorios, Campanhas, Colaboradores, Configurações.
- Testar gate de permissão: usuário `gestor` não vê `/usuarios`, `/configuracoes`.
- Verificar que `read-only` (diretoria/auditoria) não exibe botões de criar/editar.

### 5. PDF QA
- Converter PDF gerado em imagens (`pdftoppm`) e inspecionar: textos não cortados, gráficos renderizados, sem caixas pretas, logo do tenant presente.

### 6. Limpeza pós-testes
- Deletar campanha "QA Bateria" e dados relacionados (respostas, scores, alerts, invitations, consents).
- Deletar usuário de teste criado em (2).
- Resetar `must_change_password=true` se algum teste alterou.

## Detalhes técnicos

- Email real de teste: preciso de **1 endereço de email seu** (ex: seu próprio) para receber os emails de verificação do Resend, ou autorizo usar o domínio `flewpulse.com.br` enviando para `delivered@resend.dev` (sandbox) e `bounced@resend.dev` para testar suppressão.
- Tenant alvo dos testes: o tenant "demo" existente (vou identificar via `tenants.slug` mais relevante).
- Token admin para functions sem JWT: vou usar `SUPABASE_SERVICE_ROLE_KEY` via `supabase--curl_edge_functions`.
- Relatório de saída: tabela markdown com **function/fluxo | resultado | latência | observações**, e o PDF gerado anexado como artifact em `/mnt/documents/`.

## Riscos

- Resend pode rejeitar envio se domínio `flewpulse.com.br` não estiver verificado — nesse caso uso `onboarding@resend.dev` como `from` para validar a função.
- `generate-report` depende de templates/dados completos; se faltar dado, vai falhar e eu reporto.
- Testes criam dados reais; faço cleanup ao final mas há risco residual se algum delete falhar.

## Perguntas antes de executar

1. **Email de teste**: posso usar `delivered@resend.dev` (sandbox que sempre aceita) ou você prefere fornecer seu email pessoal para validar a entrega real na caixa?
2. **Tenant alvo**: rodar tudo no tenant "demo", ou prefere que eu use outro tenant específico?
3. **Cleanup**: confirmar que devo deletar os dados de teste ao final, ou prefere mantê-los para inspeção manual?
