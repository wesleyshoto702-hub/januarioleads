# JanuárioLeads — Plano operacional de liberação (NÃO EXECUTADO)
**Preparado em 09/11/2026 | Status: NO-GO**  
Ambientes: Supabase staging prlrxjothrslhswpkoza; Supabase produção identificado de forma somente leitura; repositório privado wesleyshoto702-hub/januarioleads. Nenhuma ação de alteração foi executada em produção. Não realizar deploy Vercel sem nova aprovação.

## 1. Pré-condições
- [ ] PR #94 permanece draft e não deve ser mesclada até CI/Deno/Playwright, revisão visual e jurídica.
- [ ] Revisão de branches: a PR #94 baseia-se em feature/maps-provider-choice-staging-20261108, que por sua vez depende de geoapify-google-hybrid, free-three-searches, places-cost-guardrails, maps-pro-advanced e saas-entitlements, que dependem de mudanças de preços e planos. Fazer revisão de toda a cadeia e evitar cherry-pick isolado sem dependências.
- [ ] Confirmar divergência real entre main, ambiente staging e migrações do Supabase antes de considerar merge; não inferir a sequência somente pela data do arquivo.
- [ ] Executar em ambiente local seguro: npm ci, npm run typecheck, npm run lint, npm test, npm run build e npm run test:browser. Não marcar pronto enquanto não houver relatórios aprovados.
- [ ] Conferir experiência de login com Gmail+senha confirmado (não é OAuth Google exclusivo), autenticação, isolamento de contas, limites diários, despesas de APIs e erros de busca.
- [ ] Verificar 375px, 430px, 768px, 1280px, teclado/foco, reduced motion e contraste, em múltiplos navegadores.
- [ ] Rever resultados Google exibidos em mapas/sem mapa, logos e atribuições; conteúdo Places não deve ser armazenado automaticamente em CRM/caches. Conferir atendimento dos termos OSM/Geoapify.
- [ ] Publicar Termos de Uso e Política de Privacidade somente depois de preencher dados reais e aprovar com assessoria jurídica.

## 2. Backup verificável (pendente — NÃO FOI CRIADO)
A organização Supabase está no plano **Free**. A documentação oficial informa que backups diários automáticos são para Pro/Team/Enterprise; para Free recomenda-se exportação lógica regular. O backup do banco não inclui os objetos efetivos do Storage, somente metadados.

**Procedimento manual seguro (ainda não executado):**
1. Obter autorização explícita para uma leitura de backup da produção; validar projeto de origem, data, janela, volume e destino privado. Não transferir credenciais para chat, GitHub ou logs.
2. Instalar e conferir versão suportada do Supabase CLI/pg_dump conforme a documentação corrente; atenção a alterações de comportamento da CLI v3.
3. No terminal local seguro, configurar as credenciais do banco por mecanismo de segredo, não inserir password em comando que apareça no histórico nem enviar dump ao repositório.
4. Criar uma exportação lógica cifrada em destino **fora do GitHub** usando procedimento documentado (Supabase CLI db dump / pg_dump); incluir schema, dados e objetos complementares necessários ao serviço. Registrar data, hash, tamanho, PostgreSQL, ferramenta utilizada e responsável.
5. Fazer inventário separado de buckets e objetos Supabase Storage e de qualquer outro arquivo externo.
6. Restaurar a exportação para banco **isolado e descartável**, nunca sobre produção. Validar schema, linhas, RLS, funções, chaves estrangeiras e arquivos por amostragem.
7. Documentar prazo de retenção, controle de acesso e procedimento de destruição segura do dump.

**Critério de sucesso:** relatório de backup + checksum + teste de restauração aprovado. Apenas geração de arquivo não comprova recuperação.

## 3. Revisão do Supabase
- [ ] Verificar RLS e grants no projeto de produção em auditoria somente leitura, com autorização; staging já passou em testes básicos.
- [ ] Confirmar ordem de migrações: catálogo Free/Pro/Advanced; quotas; Google/Geoapify; créditos/aliases; CRM e índices; ajustes de permissões. Separar scripts staging-only que jamais devem ir a produção sem revisão.
- [ ] Confirmar políticas de Auth e **proteção contra senhas vazadas**; no staging, Advisor ainda indica proteção desligada. Ativar no painel se suportado e apropriado ao fluxo de senhas, sem alterar usuários indevidamente.
- [ ] Configurar/validar URL pública, domínio, callbacks, SMTP, CORS, JWT, políticas de custo, disponibilidade das APIs e expiração de sessões.
- [ ] Reconfirmar que chaves de serviço não estão em VITE_*, repositório, HTML ou logs de browser.

## 4. Janela de liberação futura (NÃO AUTORIZADA NESTA ETAPA)
1. Confirmar aprovações técnica, jurídica, de backup e de orçamento API; congelar versão e identificar commit SHA.
2. Programar rollback e monitoramento, definir comunicação de manutenção e responsável de plantão.
3. Publicar preview Vercel apenas após autorização do usuário e fim do limite, executar fluxos reais com contas distintas em staging.
4. Aprovar merge/integração da cadeia de branches; manter main protegida até os testes passarem.
5. Aplicar migrações/Edge Functions em produção somente com autorização, checando ordem e parâmetros; não copiar indiscriminadamente recursos exclusivos do staging.
6. Publicar frontend e verificar CRM/buscas/planos no domínio oficial, monitorando logs, custo de API, taxa de erro, cotas e reclamações.
7. Se houver falhas, suspender o recurso (quando possível via feature flag), reverter frontend usando versão aprovada e avaliar separadamente dados/migrações. **Nunca rodar rollback destrutivo automático no banco**.
8. Pagamentos permanecem fora do escopo.

## 5. Matriz de critérios de decisão

| Critério | Situação atual | Exigência para GO |
| --- | --- | --- |
| Unitários de deduplicação Google/Geoapify | 19/19 isolados, adaptação JS | Rodar suite Deno nativa e registrar resultado |
| SQL de créditos e RLS em staging | Aprovado | Reexecutar em versão final |
| Typecheck, build, lint | Não homologados | Passar local e CI |
| Playwright desktop/mobile | Ainda não executado integralmente | Testes automatizados e exploração real |
| Atribuições/termos de provedores | Revisão técnica preliminar | Validar UI e licenciamento |
| Termos e Privacidade públicos | Rascunhos com campos pendentes | Documentos completos e aprovados |
| Proteção de senhas vazadas | Advisor WARN no staging | Ajustar/verificar |
| Backup de produção | NÃO REALIZADO | Exportação e restauração testada |
| Promoção para produção | NÃO AUTORIZADA | Nova autorização expressa |

## 6. Referências
- Supabase Backups: https://supabase.com/docs/guides/platform/backups
- Checklist de produção: https://supabase.com/docs/guides/deployment/going-into-prod
- Políticas Google Places: https://developers.google.com/maps/documentation/places/web-service/policies
- Geoapify: https://www.geoapify.com/terms-and-conditions/
- OpenStreetMap: https://www.openstreetmap.org/copyright

**Regra final:** não realizar restore, migração produtiva, merge para main ou deploy Vercel a partir deste documento sem aprovação explícita.