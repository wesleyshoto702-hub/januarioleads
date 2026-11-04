# Migração de sessões para HttpOnly — plano seguro (JanuarioLeads)

## Estado atual

- O frontend usa diretamente a API Supabase para login, REST e Edge Functions.
- `src/lib/auth.ts` armazena access/refresh tokens em
  `localStorage`; a proteção adicional da CSP com nonce e a validação de
  sessões reduzem riscos, mas **não isolam** esses tokens de JavaScript.
- Alterar apenas o armazenamento para cookies não funciona: o navegador
  ainda precisa enviar `Authorization: Bearer` às APIs cross-origin do
  Supabase e uma credencial HttpOnly não pode ser lida por JS.
- O Lovable sincroniza código da `main`; publicar código em Lovable é etapa
  separada, ainda não testada em produção.

## Desenho do destino

1. Implementar backend-for-frontend (BFF) **same-origin** em TanStack Start,
   com rotas `/api/session` para login, logout, refresh, estado de sessão.
2. Usar um cookie de sessão opaco com prefixo `__Host-`, flags
   `HttpOnly; Secure; SameSite=Lax; Path=/`, com expiração limitada e
   rotação/revogação no servidor. Não incluir access/refresh tokens nem
   dados pessoais no conteúdo legível do cookie.
3. Guardar tokens do Supabase somente no backend, em storage criptografado
   com chave mantida nos secrets do hosting (não `VITE_*`). Fazer rotação
   e validar a sessão/usuário antes de cada operação sensível.
4. Proxificar as rotas REST e Edge Functions necessárias ao frontend; validar
   a conta autorizada, a identidade da linha/tenant e manter as políticas
   RLS como última defesa. Nunca expor `service_role` ao navegador.
5. Proteger mutações com comparação estrita de `Origin` e middleware
   anti-CSRF existente, validar payloads e aplicar rate limiting.
6. Após instalar e testar o BFF, migrar o frontend por flag de implantação
   **somente em homologação**. Exigir reautenticação explícita quando
   necessário, sem copiar tokens antigos em endpoints inseguros.
7. Quando estável, aposentar o uso de `localStorage` para tokens,
   limpar dados legados na autenticação e habilitar logs sem credenciais.

## Testes obrigatórios para ativar a nova arquitetura

- Login/logout, reload, múltiplas abas, refresh/expiração/revogação e
  recuperação após queda de rede com contas de teste.
- Conta A não acessa, altera ou apaga registros da conta B por API direta
  nem pelo BFF; teste de bloqueio de contas fora da allowlist.
- CSRF por origem externa, session fixation, token replay, cookie flags,
  CORS, CSP, erro 401/403 e limites de requisição.
- Enriquecimento, buscas, pagamentos, histórico e integração Lovable
  com backend real de homologação e APIs de terceiros com quotas.
- Validar a URL efetiva e cabeçalhos no ambiente publicado (não apenas
  GitHub Actions ou navegador com backend simulado).

## Reversão e operação

- Não alterar Auth de produção, secrets ou credenciais durante elaboração.
- Criar backup/restauração verificada, plano de implantação e janela
  controlada antes de habilitar feature flag.
- Se o rollout falhar em homologação, desabilitar a nova rota sem mudar
  sessões nem banco de produção.
- O ambiente de produção atual mantém o formato de sessão existente
  para compatibilidade. **Este documento é o desenho, não a implantação.**
