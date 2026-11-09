# Relatório de validação — 4 etapas do JanuárioLeads
**Data:** 09/11/2026  
**Ambiente:** branch feature/maps-one-click-auto-staging-20261108, Supabase staging prlrxjothrslhswpkoza.  
**Sem operações em:** Vercel, main, Supabase produção, gateways de pagamento.

## Etapa 1 — Testes e correções
**Resultado: 19/19 PASS em execução de lógica isolada.**  
Arquivos-fonte: src/features/search-leads/identity.ts, identity.test.ts, google-crm-save.ts, google-crm-save.test.ts. O conteúdo TypeScript teve tipos/anotações removidos mecanicamente para avaliação em um executor JavaScript isolado; auxiliares de normalização/localidade foram reproduzidos segundo as implementações consultadas. O método exercita as mesmas regras de função e os corpos dos testes, porém **NÃO é uma execução Deno nativa, não compila todo o projeto e não constitui homologação E2E**.

Cenários: equivalência Google/Geoapify nos dois sentidos; Place ID igual; filial distante; nome divergente; telefones compartilhados em cidades diferentes; nome insuficiente; endereço normalizado; uso no cartão tradicional; recepção comum; coordenadas contraditórias; candidatos ambíguos; alias validado; ausência de provas geográficas; cadastro Google com nome manual; rejeição de nome inválido; não converter fonte Geoapify para Google.

**CI indisponível para confirmação:** jobs recentes no GitHub Actions concluídos com falha antes de gerar evidência confiável de execução da suíte; build, lint, typecheck e Playwright aguardam repetição em runner/local.

## Etapa 2 — Segurança no Supabase Staging
- 100% das tabelas públicas base consultadas tinham RLS habilitado na auditoria.
- 6 funções SECURITY DEFINER no esquema público, sem acesso EXECUTE direto pelos papéis anon/authenticated na verificação.
- Migração staging_least_privilege_internal_tables: role anon não tem INSERT nas tabelas de CRM revisadas; authenticated pode continuar inserindo leads próprios, não pode criar acesso privado; service_role mantém permissão operacional.
- 5 índices de FK de enriquecimento já aplicados e validados anteriormente.
- Supabase Advisor continua exibindo aviso de proteção contra senhas vazadas desabilitada; o recurso exige revisão/configuração externa.
- Observações 'RLS sem policy' em tabelas internas service-only são informativas; sua intenção de negar acesso direto deve ser preservada.

## Testes SQL executados com sucesso (4/4)
1. supabase/staging/tests/20261108_cross_provider_credit_aliases.sql — PASS com ROLLBACK; cobrança Pro, bloqueio Free, aliases e créditos.
2. supabase/staging/tests/20261108_crm_cross_provider_history.sql — PASS com ROLLBACK; histórico de identidades Google e Geoapify.
3. supabase/staging/tests/20261109_release_readiness.sql — PASS; auditoria de catálogo, unicidade e cache de conteúdo.
4. supabase/staging/tests/20261109_acl_security_assertions.sql — PASS; RLS, concessões, SECURITY DEFINER e políticas de propriedade.

## Etapa 3 — Documentação legal
Criados rascunhos não publicáveis:
- docs/legal/politica-de-privacidade-rascunho.md
- docs/legal/termos-de-uso-rascunho.md
- docs/legal/checklist-publicacao.md

Campos de pessoa/empresa, contato LGPD, retenção e base legal pendentes. Requer revisão jurídica. Não criamos informações empresariais fictícias.

## Etapa 4 — Operações
- docs/operacoes/plano-preparacao-producao-20261109.md
- scripts/validar-homologacao-local.sh
- Organização Supabase confirmada no plano Free somente por leitura de metadados; **nenhum backup de produção criado** e nenhuma tentativa de restauração.
- Nova publicação Vercel, merge e testes visuais reais explicitamente não executados; não há autorização para produção.

## Critérios externos para GO
1. Executar/verificar Deno nativo, lint, TypeScript, build, Playwright e testes visuais mobile/desktop.
2. Preencher documentos legais e aprovar obrigações Google/Geoapify/OSM (logo, atribuições, dados e retenção).
3. Verificar proteção de senhas vazadas no Auth e política de contas.
4. Criar backup de produção seguro e provar recuperação em banco isolado; Storage deve ser considerado separadamente.
5. Autorizar explicitamente eventual preview/deploy e migrações de produção após documentação e testes.

**Decisão técnica:** NO-GO para produção.