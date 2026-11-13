# Januário Leads — CNPJ, contatos e WhatsApp (homologação)

Status: **implantado em homologação**, com pesquisa por CNPJ manual e enriquecimento assistido. A verificação real da conta no WhatsApp permanece **desabilitada** até integração autorizada.

## Como funciona

1. No projeto STAGING do Januário Leads, abra **Meus Leads** e depois os detalhes de um **lead salvo no Supabase**.
2. Na seção **Verificar empresa**, informe um CNPJ e clique em **Consultar CNPJ**.
3. A função `verify-lead-company` autentica o usuário, verifica que ele é dono do lead, consulta **somente aquele CNPJ** na BrasilAPI e guarda um resumo separado na tabela `public.lead_company_checks`.
4. Os campos nome fantasia, razão social, status, município e UF aparecem com fonte e data. Divergências de nome/localidade exigem revisão manual.
5. A seção **Enriquecimento de contatos** apresenta os telefones e e-mail públicos *quando existirem*. O usuário pode copiá-los. Se o lead estiver sem telefone e houver correspondência de identidade, poderá preencher o telefone manualmente.
6. **Verificação real do WhatsApp**: o estado começa como `not_verified`. O botão de disponibilidade informa que nenhum provedor autorizado foi conectado. Não existe promessa de que o número tem WhatsApp ativo.

## Separação da importação Overture

- Nenhuma leitura/gravação é feita nas tabelas `overture_places` ou `overture_import_city_progress` pela nova função.
- Não há cron, worker, fila, timer ou atualização em massa.
- O banco é o Supabase de homologação, projeto `prlrxjothrslhswpkoza`. O projeto de produção não recebeu tabelas nem Edge Functions novas.
- A tela só faz chamadas de verificação quando `SUPABASE_URL` aponta para essa homologação; fora desse ambiente informa que o recurso está em testes.
- CNPJ é consultado individualmente, com cache de 12 horas por CNPJ+lead, espera para troca de CNPJ e limite de 12 registros recentes por usuário/hora (não é uma contagem completa de requisições).

## Segurança e limites

- A nova tabela tem **RLS**. Usuários só podem ler seus próprios registros, atrelados a leads da própria conta. Inserções e atualizações são reservadas ao backend autenticado.
- A função exige JWT válido e verifica a propriedade do lead antes de consultar a BrasilAPI.
- Dados públicos podem estar desatualizados. Para MEIs e pequenos negócios, contatos públicos também podem ser dados pessoais; revise antes de utilizar.
- Não altere contatos já preenchidos automaticamente nem trate correspondência de CNPJ como garantida quando a identidade foi marcada para revisão.
- Não é feita validação de conta WhatsApp pela sintaxe de um telefone nem por tentativa de acesso indevido.
- BrasilAPI é uma fonte comunitária, sem garantia de disponibilidade. A consulta pode falhar e o usuário deve poder tentar mais tarde.

## Como validar manualmente

- [ ] Entrar no **STAGING** com uma conta autorizada e salvar um lead de teste.
- [ ] Abrir os detalhes do lead e verificar se aparece `Verificar empresa`.
- [ ] Informar um CNPJ público conhecido e confirmar nome, situação, data e fonte.
- [ ] Conferir a leitura do resultado persistido fechando e reabrindo os detalhes.
- [ ] Testar a divergência entre CNPJ e lead e confirmar que **não** oferece preenchimento automático.
- [ ] Em um lead sem telefone e com identificação compatível, usar **Preencher telefone ausente** e confirmar no CRM.
- [ ] Clicar em **Consultar disponibilidade** no WhatsApp e confirmar que mostra **não configurado**, não "ativo".
- [ ] Testar em outro usuário: não deve ler o registro da conta anterior.
- [ ] Verificar que a importação Colab continua salvando municípios e empresas.

## Arquivos

- `supabase/migrations/20261113170000_lead_company_checks_manual_only.sql`
- `supabase/functions/verify-lead-company/index.ts`
- `src/features/lead-verification/LeadCompanyCheckSection.tsx`
- `src/features/lead-verification/lead-company-check.css`
- `src/features/search-leads/BusinessDetailsModal.tsx`
- `src/routes/app.tsx`
- `src/lib/route-styles.ts`

## Próxima fase — WhatsApp

O estado `whatsapp_status`, o nome do provedor e a data de evidência estão reservados na tabela. A verificação real precisa de uma integração legítima com política de consentimento, fonte de verificação auditável, custo conhecido e tratamento de respostas de entrega. **Nenhum provedor foi configurado ou acionado nesta fase.**
