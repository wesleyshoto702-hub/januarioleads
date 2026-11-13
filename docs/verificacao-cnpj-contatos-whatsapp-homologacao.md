# Januário Leads — pesquisa assistida de CNPJ e contatos (homologação)

Status: **implementado no GitHub e implantado apenas no Supabase de homologação**. Sem importação em massa, sem mudanças em produção, sem automação de WhatsApp.

## Fluxo para um usuário

Abra **Meus Leads → Ver empresa → Enriquecer empresa**. A seção só está habilitada quando o frontend aponta para a homologação `https://prlrxjothrslhswpkoza.supabase.co`.

1. **Encontrar CNPJ pelo nome**: pesquisa manual pelo nome da empresa. O backend usa a cidade e UF do lead para **filtrar estritamente** candidatos retornados pela [Consulta Data Stone](https://www.datastone.com.br/consulta), cuja [API pública permite uso comercial mediante atribuição](https://www.datastone.com.br/consulta/api-publica). Mostra até cinco candidatos plausíveis e seus links de origem. O serviço externo pode limitar a 10 os resultados da busca: não encontrar um candidato **não significa que a empresa não exista**.
2. **Selecionar e consultar CNPJ**: o usuário escolhe um candidato ou informa um CNPJ manualmente. A consulta individual à [BrasilAPI](https://brasilapi.com.br/) retorna razão social, situação cadastral, localização e contatos **quando presentes**. Divergências de nome, cidade ou UF exigem revisão; a interface não disponibiliza os contatos cadastrais nesse caso.
3. **Enriquecer apenas os contatos ausentes**: telefones/e-mails vindos do CNPJ são rotulados como cadastrais. Se a empresa tem website HTTPS informado e falta telefone ou e-mail, o usuário pode pedir uma única consulta da **página registrada**. O backend procura *links explícitos* `mailto:` e `tel:`, sem navegar para outras páginas. As sugestões do website são mostradas com fonte e sem inserção automática no CRM.
4. **Verificar WhatsApp**: a integração com um provedor autorizado permanece desabilitada. Um telefone com formato válido não é uma confirmação de conta ativa.

A aplicação jamais altera um telefone já preenchido. O usuário pode, manualmente, usar o telefone cadastral num campo vazio do CRM **somente quando os nomes e a localidade correspondem**.

## Custos e controle de acesso

- As tabelas `lead_company_checks`, `lead_cnpj_name_searches`, `lead_official_site_contacts` e `lead_company_request_quota` são separadas das tabelas Overture.
- **12 solicitações externas por usuário por hora.** A função `claim_lead_company_request` usa uma operação PostgreSQL `INSERT .. ON CONFLICT .. UPDATE` atômica. Conta uma tentativa *antes* do pedido, inclusive falhas, limites e erros do provedor. O usuário não consegue executar essa RPC pelo frontend.
- Cache de **24h** para buscas de nome (por lead e assinatura da consulta), **12h** para um CNPJ já verificado e **7 dias** para dicas do mesmo site oficial. Reutilizar cache não faz outra chamada ao provedor.
- Apenas uma consulta manual usa a rede por clique. Não há cron, filas, varredura nacional, recursão de páginas ou processamento em background.
- As tabelas têm **RLS**; somente o dono do lead tem acesso de leitura. Escrever exige a função do servidor com chave secreta, nunca o navegador.
- A verificação do website exige HTTPS, hostname público, verificação prévia de DNS e redirecionamentos desabilitados. Se não puder confirmar o endereço público, falha com segurança. Esse bloqueio não é garantia absoluta contra DNS rebinding; monitorar o recurso antes de habilitá-lo em produção.

## Limitações importantes

- A fonte de busca de nome retorna uma amostra curta de candidatos. Nomes comuns podem exigir que o usuário informe o CNPJ manualmente ou refine a pesquisa.
- A confiança por texto/UF/cidade serve **somente para ordenar hipóteses**, não para validar identidade nem dar permissão de contato.
- CNPJ pode conter dados pessoais de MEI ou empresário individual. Use os dados com base legal, respeitando LGPD e oposição dos titulares; contatos podem estar desatualizados ou pertencer a pessoas físicas.
- A consulta de site não roda JavaScript, não procura páginas de contato adicionais e não garante encontrar todos os e-mails ou telefones da empresa.
- A BrasilAPI e a Consulta Data Stone são fontes públicas independentes; não há garantia contratual de disponibilidade.
- Nenhum dado é enviado a serviços de verificação de WhatsApp.

## Testes

- `supabase/functions/verify-lead-company/matching.test.ts`: 6 casos para CNPJ, nomes, falsos positivos, cidade/UF, URLs não públicas e contatos ausentes.
- `tests/browser/company-enrichment.spec.ts`: 3 casos com Supabase simulado (inclui busca assistida, divergência, contato no site e layout móvel), isolados pelo workflow `company-verification-staging-check.yml`. **Não** realizam chamadas externas.
- `.github/workflows/niche-catalog-check.yml`: integra `deno check` da Edge Function e os testes puros de correspondência no pipeline existente.
- Na homologação, execução de transação de teste com **12 consultas aceitas e 13ª recusada**, seguida de `ROLLBACK` confirmado pelo retorno do contador a zero.
- Sem navegador autenticado real nesta execução: validar o endpoint externo em uma sessão de teste antes de promover à produção.

## Pontos de implementação

- `supabase/functions/verify-lead-company/index.ts`
- `supabase/functions/verify-lead-company/matching.ts`
- `supabase/migrations/20261113170000_lead_company_checks_manual_only.sql`
- `supabase/migrations/20261113181500_manual_lead_discovery_cache_and_atomic_quota.sql`
- `src/features/lead-verification/LeadCompanyCheckSection.tsx`
- `src/features/lead-verification/lead-company-check.css`
- `src/features/search-leads/BusinessDetailsModal.tsx`
- `src/routes/app.tsx`
- `src/lib/route-styles.ts`
