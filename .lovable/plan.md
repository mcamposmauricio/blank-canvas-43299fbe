## Mudança

Restringir o botão "Enviar por Email" para aparecer apenas quando a campanha estiver **ativa**.

### Arquivo
`src/pages/Campanhas.tsx` (linha 462)

### Antes
```tsx
{(c.status === "draft" || c.status === "active" || c.status === "scheduled") && pendingInvites > 0 && (
```

### Depois
```tsx
{c.status === "active" && pendingInvites > 0 && (
```

Os botões "Copiar Links" e "Exportar CSV" continuam disponíveis em todos os status (úteis para distribuição alternativa). Apenas o envio por email fica condicionado à campanha ativa.