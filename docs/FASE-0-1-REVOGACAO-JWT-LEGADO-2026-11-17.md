# Fase 0.1 — Preparação final para revogar o JWT legado na HOMOLOGAÇÃO

**Data:** 17/11/2026 (BRT)
**Projeto de homologação:** `prlrxjothrslhswpkoza`
**Produção:** `czkazbianiflhldenhcj` — **não modificar**
**Estado:** `PREPARAÇÃO TÉCNICA APROVADA / REVOGAÇÃO AINDA NÃO EXECUTADA`

## Objetivo e limite

A chave `service_role` JWT antiga foi exposta e as **JWT-based API keys** foram desativadas manualmente no Supabase de homologação. O conector confirma `anon.disabled=true` e a `sb_publishable_` moderna ativa, mas **não expõe o estado da `service_role` legada, nem o estado/ID das JWT Signing Keys**. Desativação de API key não prova revogação criptográfica do JWT signing secret antigo. Nenhum JWT ou segredo antigo deve ser compartilhado.

A finalidade agora é **verificar o estado de assinatura no Dashboard e, se aplicável, revogar apenas a chave legada**. **Não realizar outra rotação às cegas:** o Auth da homologação **já emite JWT `ES256`**, comprovado sem imprimir token.

## Validações efetivamente executadas

1. `search-places` **v33 ACTIVE**, `staging-plan-preview` **v9 ACTIVE**, ambas `verify_jwt=true`. A função de planos foi corrigida para validar a sessão Supabase Auth e `private_access` **antes de analisar `plan`**, evitando respostas de plano inválido sem checagem de sessão.
2. [CI Deno — segurança do preview](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44173527586): **SUCCESS**. Inclui verificação de ordem autorização → validação do plano → mutação.
3. [Teste autenticado reforçado, execução 44174568092](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44174568092): **SUCCESS**, após a publicação v9. Conferiu:
   - Requisições sem login: as 2 funções ativas devolvem HTTP 401.
   - Bearer malformado e `sb_publishable_` indevidamente usada como Bearer: **HTTP 401 nas duas**.
   - Login real com usuário de teste via segredos protegidos do GitHub Actions: aprovado, sem imprimir credenciais.
   - Header do JWT Auth emitido: **algoritmo assimétrico `ES256`** (somente metadado, sem token).
   - Os **7 endpoints descontinuados** com `verify_jwt=true` receberam JWT válido e devolveram **HTTP 410**; fontes auditadas não contêm chamadas HTTP externas ou consulta ao banco.
   - Busca `overture:0`: HTTP 200, `provider=overture`, sem rota de Geoapify ou Google Places.
   - Preview de plano inválido com login autorizado: HTTP 400 `INVALID_PLAN` após autenticação/autorização; nenhuma alteração de assinatura.
4. Confirmação após o teste: **338.540** empresas Overture; **1.654** checkpoints; banco PostgreSQL **193.287.859 bytes**. Chave pública legada `anon` permanece `disabled=true`.
5. A suite agora **falha** caso JWT Auth de homologação volte a um algoritmo de assinatura simétrica (`HS256`), tornando retrocesso detectável em CI.

### Por que não desligamos `verify_jwt`?

O [guia de JWT Signing Keys](https://supabase.com/docs/guides/auth/signing-keys) alerta que versões/integrações de Edge Functions com `verify_jwt` podem exigir mudança na rotação. A [referência atual de Authorization Headers](https://supabase.com/docs/guides/functions/auth-headers) declara que o gateway também valida JWTs assimétricos. **No nosso ambiente os nove endpoints funcionaram com o token `ES256` usando `verify_jwt=true`**, então não há motivo demonstrado para desligar a camada globalmente. As duas funções ativas verificam usuário autorizado no próprio código, mantendo defesa em profundidade.

## Único passo manual necessário agora

1. Abrir **somente HOMOLOGAÇÃO**, na seção [JWT Signing Keys](https://supabase.com/dashboard/project/prlrxjothrslhswpkoza/settings/jwt).
2. **Inspecionar, sem copiar o valor de nenhuma chave:** as linhas de assinatura `Current`/`In use`, `Previously used`, `Standby` e `Revoked`. A emissão atual de `ES256` **não comprova** que a chave legada esteja revogada, apenas que a nova assinatura de usuários já está funcionando.
3. Se a chave **legada** aparecer em `Previously used` e não estiver revogada, revisar a existência de tokens HS256 em uso e o risco de sessões antigas; em seguida usar o controle oficial de **revogação da chave previamente utilizada** — **nunca** revogar a chave moderna `Current/In use`. Uma vez revogada, voltar a rodar o smoke; se a chave legada já estiver `Revoked`, não repetir a operação.
4. Se o painel mostrar apenas `Current` legado, estado inesperado ou pedir `Rotate`/`Migrate`, **PARAR e revisar** antes de qualquer clique. Não assumir que o token ES256 deriva de um estado específico no painel.
5. **Não usar** `Rotate JWT secret`, não desativar o projeto, não apagar chaves, não desabilitar `verify_jwt` nas nove funções sem justificativa e testes.
6. Após a revogação, repetir o [GitHub Actions smoke autenticado](https://github.com/wesleyshoto702-hub/januarioleads/actions/workflows/fase0-staging-authenticated-smoke.yml), confirmar o estado no Dashboard e, por canal protegido, realizar um teste negativo com a JWT antiga **apenas se a credencial já estiver disponível fora do chat**. Nunca inserir JWT antigo em logs, issues ou arquivos. Acesso negado comprovado é o portão final da Fase 0.1.

**Não foi possível executar a revogação pelo conector Supabase** porque não existe ação de gerenciamento de JWT Signing Keys; é preciso intervenção no Dashboard. O projeto de produção e a Fase 0.2 (backup/restauração real) permanecem sem alterações. As Colabs continuam pausadas até o fechamento dos portões.

## Evidências

- [Plano Mestre](PLANO-MESTRE-JANUARIO-LEADS.md)
- [Relatório principal Fase 0](FASE-0-SEGURANCA-BACKUP-2026-11-15.md)
- [Workflow de smoke](../.github/workflows/fase0-staging-authenticated-smoke.yml)
- [Script de smoke](../scripts/fase0-staging-authenticated-smoke.py)
- [Testes offline das funções](../tests/staging-modern-secret-key.test.ts)


## 17/11/2026 — revogação HS256 informada pelo proprietário e teste pós-operação

**Usuário confirmou “pronto” após orientações para revogar EXCLUSIVAMENTE a chave Previous — HS256 (Shared Secret)** no Dashboard de JWT Signing Keys da **HOMOLOGAÇÃO**. O conector disponível não lê o status das chaves de assinatura JWT; registrar a revogação como **informada pelo proprietário**, e não verificada no plano criptográfico.

**Teste real de homologação posterior:** GitHub Actions [44174568092 — tentativa 2](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/44174568092), concluído em **SUCCESS** (~21:07 UTC / 18:07 BRT), com segredos da conta de teste mantidos no ambiente protegido GitHub. Logs comprovam:
- 401 nas duas funções ativas para chamadas sem sessão, Bearer malformado e chave pública indevidamente usada como Bearer.
- Login real de staging aprovado, JWT Auth com algoritmo **assimétrico ES256** (header inspecionado sem exposição de token).
- Sete endpoints descontinuados respondem **410** com JWT de usuário válido.
- Busca pela função `search-places` com `pageToken=overture:0` retorna HTTP 200 e `provider=overture`, sem chamar Geoapify/Google.
- Simulador de planos verifica autenticação e `private_access` e recusa plano inválido HTTP 400 sem escrita.
- Chaves publicáveis listadas: `anon` legada `disabled=true`; `sb_publishable_` moderna ativa. Funções implantadas na consulta: `search-places` v34 e `staging-plan-preview` v10, ambas ACTIVE com `verify_jwt=true`.
- Dados persistidos: **338.540 empresas Overture**, **1.654 checkpoints**, **193.287.859 bytes** de PostgreSQL. Produção: **212 leads** e aproximadamente **22,85 MB**, sem alteração planejada.

**Limite da prova:** o teste **não** enviou a JWT `service_role` comprometida para confirmar 401, nem pôde consultar diretamente se HS256 aparece como `Revoked` no Dashboard. Assim, o funcionamento com a assinatura nova foi validado, mas falta confirmação independente da revogação da assinatura antiga. Se necessário, confirmar visualmente a linha HS256 em **Revoked**, sem compartilhar segredo; nunca reutilizar a credencial antiga. Não rodar novamente `Rotate`.

**Próximo trabalho — Fase 0.2:** backup cifrado da produção, dos objetos Storage e **teste de restauração real em ambiente isolado**, antes de importar mais empresas ou mover dados de homologação para produção.
