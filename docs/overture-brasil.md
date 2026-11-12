## Status da implementação automática — 12/11/2026

**Interface sem botões ou opções Outscraper**: no Buscar Leads, a linha de
contatos mostra o `@perfil` clicável (com indicação `possível` quando não
há evidências de oficialidade), ao lado de Maps/Site. O botão
`Ampliar com Outscraper` foi removido de Ver empresa. O suporte a
confirmar/rejeitar candidatos em Ver empresa permanece como proteção
contra atribuir perfis a empresas erradas.

**Ordem interna**: Overture/Geoapify/Google Places → até 4 verificações
gratuitas de sites oficiais → Outscraper (somente se habilitado no backend
e somente quando as verificações gratuitas não retornaram perfil).
No máximo **2 domínios por busca**, tarefas assíncronas por domínio com
cache e até 6 consultas de status em intervalos de 30 s, canceláveis
ao sair da pesquisa. A lista de leads não espera pelo Outscraper.

**Proteção financeira**: os limites
`OUTSCRAPER_INSTAGRAM_DAILY_LIMIT` e
`OUTSCRAPER_INSTAGRAM_30DAY_LIMIT` valem 0 por padrão, e a variável
`OUTSCRAPER_INSTAGRAM_AUTO_ENABLED` tem de ser `true`; chave Outscraper
permanece exclusivamente no Supabase Secrets. Não habilitar o serviço
sem revisar franquia/saldo no Outscraper e autorização do proprietário.

**Validação atual**: Edge Function `search-places` v24 **ACTIVE** no
Supabase STAGING; migração de cache e orçamento aplicada somente em STAGING.
Sem uso real da API Outscraper (0 trabalhos registrados). Não alterou
produção. A PR #140 continua como rascunho; execução de testes e
avaliação da interface em navegador ainda necessárias.

## Outscraper para ampliar a busca de Instagram — integração opcional e com custos bloqueados

Implementação na PR draft #140, exclusivamente na **homologação** até validação.

### Qual serviço foi integrado?

Usa **Outscraper Emails & Contacts Scraper** (`GET https://api.outscraper.cloud/emails-and-contacts?query=<dominio>&async=true`), que encontra emails, telefones e **redes sociais** de um **domínio/site**. **Somente perfis Instagram** são extraídos/armazenados; outros contatos são descartados. Documentação: https://docs.outscraper.com/endpoints/emails-and-contacts/.

Importante: sem site próprio reconhecido, esse produto não tem um domínio confiável a pesquisar. **Não** usa Google Maps Scraper nem Instagram scraping para empresas sem site. Outscraper não garante que o perfil encontrado seja oficial.

### Como funciona no dashboard — **sem qualquer botão Outscraper**

- A única tela de pesquisa continua sendo **Buscar Leads**. O usuário não ativa nem vê
  um controle específico do Outscraper: a descoberta acontece automaticamente nos bastidores.
- Na busca, a interface utiliza primeiro os links públicos do Overture/Geoapify/Google
  Places e verifica o site oficial de até 4 empresas. Se não aparecer um Instagram
  e o backend tiver opt-in autorizado, consulta automaticamente o Outscraper
  para **até 2 domínios por pesquisa**. A busca de leads não espera o retorno.
- O processamento assíncrono consulta o mesmo job no máximo 6 vezes com intervalos
  de 30 segundos; a tabela `outscraper_instagram_jobs` impede submissões duplicadas
  e grava candidatos para buscas futuras. O registro da empresa só recebe
  candidatos com URLs de Instagram, sem informações pessoais colaterais.
- A linha do cartão exibe diretamente `@perfil` clicável. Se a fonte é apenas
  Outscraper/um diretório de terceiros, exibe a etiqueta **possível**, não
  **confirmado**. Isso evita falsos oficiais. Usuários não precisam abrir a
  janela "Ver empresa" para descobrir ou visualizar o perfil.
- Empresas **sem domínio/site próprio** não são pesquisáveis pelo endpoint de
  Emails & Contacts. Permanecem com Instagram informado pelas fontes gratuitas
  ou `Instagram não identificado`/não pesquisado, conforme a evidência.
- A opção anterior `Ampliar com Outscraper` foi **removida do modal**:
  não a recriar em nenhuma parte da interface. Não remover o atalho Maps.

### Configuração estritamente server-side (sem expor token)

O operador cria sua chave no site do Outscraper (**Profile → API token**) e configura **somente** em **Supabase STAGING → Edge Functions → Secrets**:

- `OUTSCRAPER_API_KEY` = token secreto (nunca no código, chat, GitHub, `VITE_` ou navegador).
- `OUTSCRAPER_INSTAGRAM_AUTO_ENABLED` = **não configurado** por padrão (desligado); para habilitar explicitamente, usar `true`.
- `OUTSCRAPER_INSTAGRAM_DAILY_LIMIT` = **0** por padrão (desligado). Piloto sugerido: `2`.
- `OUTSCRAPER_INSTAGRAM_30DAY_LIMIT` = **0** por padrão. Piloto sugerido: `20`.

A variável `AUTO_ENABLED` deve ser `true` e **ambos os limites devem ser positivos** para permitir novos trabalhos. Sem essa autorização, a interface continua usando apenas fontes gratuitas. O limite máximo hardcoded é **10 domínios/dia**, **200 domínios/30 dias**. Não se destina a assegurar saldo gratuito em contas que já usaram Outscraper em outros serviços — conferir o saldo, as cobranças e a franquia do fornecedor **antes** de habilitar. A conta Outscraper, e não o banco Supabase, decide o valor final faturado. API aceita chave em header `X-API-KEY`.

### Segurança e validação

- Migração `20261112190000_outscraper_instagram_guard.sql` aplicada **somente STAGING**; RLS na tabela `public.outscraper_instagram_jobs`, sem SELECT para anon/authenticated, com execução de RPC de reserva limitada a service_role.
- Testes SQL em `ROLLBACK`: orçamento zero bloqueia, 1º domínio reservado, repetição usa cache, 2º domínio reservado e 3º excedente bloqueado; **zero trabalhos persistidos** no teste.
- A função `search-places` **v24 ACTIVE** na homologação, JWT obrigatório, apenas API de leitura e jobs opcionais.
- Testes offline Deno `deno test supabase/functions/_shared/outscraper-instagram.test.ts` adicionados, porém **ainda não executados**, GitHub Actions bloqueado por conta. Os fluxos reais de consulta/polling e UI precisam ser validados quando houver chave com quota autorizada.
- Como a PR está draft, a interface web **não foi publicada**. A descoberta automática e os `@perfis` provenientes da API nova só aparecerão após homologação e publicação; não haverá botão Outscraper.
- **Nenhuma nova chamada Outscraper, cobrança, crédito, fatura, autorização financeira ou importação Overture foi iniciada nesta mudança.**

## Instagram automático no Buscar Leads — etapa gratuita e progressiva (12/11/2026)

Implementação na branch da PR #140, ainda não publicada na homepage:

- **Fonte pública Overture**: `overture_places.instagram` é normalizada como **possível perfil**, com origem Overture; não fica automaticamente "confirmado".
- **Fonte pública Geoapify / OSM**: campos `contact.instagram`, `contact:instagram`, `social:instagram`, `instagram` e links sociais podem originar um **possível perfil**; um endereço instagram.com não é tratado como site próprio.
- **Google Places**: quando o cadastro usa Instagram como `websiteUri`, o link é mostrado como **possível perfil**, não como site empresarial nem como confirmação automática.
- **Confirmação automática**: na interface Buscar Leads, após carregar resultados, faz checagem **somente no site público da própria empresa** para no máximo **4 empresas com site por pesquisa/página**, usando dois workers. Não faz a busca pública/IA paga. Quando o site publica um único perfil, a verificação existente no backend marca alta confiança com fonte `official_website`. Vários perfis ficam como candidatos a revisar.
- **Estados visíveis**: `@usuario` confirmado, `Possível Instagram · Conferir` (precisa validar), `Verificando Instagram…`, ou `Instagram não identificado`.
- **Preservar decisão humana**: confirmação manual de um perfil não é sobrescrita por checagem automática; candidatos rejeitados não reaparecem. Os resultados ficam cacheados por até 7 dias quando confirmados, e por até 24 horas quando inconclusivos.
- **Desempenho e segurança**: sites externos passam pela proteção do backend contra URLs não públicas, DNS/endereço privado, redirects e HTML excessivo; erros não quebram a busca. A API `search-places` continua autenticada, e cada verificação respeita o `claim_api_request_for_user` já existente.
- **Custos**: nenhuma chamada automática Google Places adicional nem ao serviço pago de pesquisa pública/IA. Verificação de sites públicos consome apenas recursos normais da Edge Function (que também têm limites).
- **Cobertura real**: dos 30 registros Overture de Lavras já importados, **0 têm instagram armazenado**. A cobertura não é 100% e só poderá ser estimada após testar vários segmentos. Um link em cadastro público ou site não garante atualidade.
- **Testes**: `supabase/functions/_shared/public-instagram-candidate.test.ts` verifica URLs válidas/inválidas e nível de confiança. O deploy **v20** de `search-places` foi confirmado ativo com JWT na **homologação**. Testes Deno automatizados e UI ponta a ponta ainda pendentes (Actions bloqueado), portanto não publicar/mesclar antes dessa validação.

## Atalho Google Maps em todos os leads encontrados

A interface **Buscar Leads** mantém uma única busca, mas cada cartão agora exibe um atalho
**Google Maps** com ícone à esquerda, independente da origem Overture/Geoapify/Google
Places. O mesmo atalho fica disponível na janela **Ver empresa**.

- Google Places: respeita URL direta do Google Maps, quando fornecida, ou combina nome + Google Place ID válido.
- Geoapify e Overture: monta `https://www.google.com/maps/search/?api=1&query=...`
  com nome e endereço/cidade. Isso é uma **pesquisa pelo estabelecimento**, não
  significa que o Google confirmou ficha própria daquele local.
- Nenhuma chamada adicional ao Google Places é feita: é apenas um link HTTPS
  aberto pelo navegador. Não altera limites de créditos nem dados persistidos.
- `src/lib/google-maps-url.ts` constrói URLs e impede redirecionamento para
  endereços falsos; `src/features/search-leads/GoogleMapsLink.tsx` renderiza ícone
  + texto em todos os segmentos, com CSS acessível e responsivo.
- Testes: `deno test src/lib/google-maps-url.test.ts` (GitHub Actions está bloqueado
  por faturamento, por isso a validação automatizada ainda precisa de execução local).

**Atribuição ≠ atalho:** os créditos de origem Overture/Geoapify/Google continuam
separados e corretos no rodapé. O atalho **Google Maps** não muda a procedência
dos dados. Código permanece na PR draft até validação do preview staging.

## Melhorias sequenciais — busca unificada, leads, custos, dashboard, Brasil (12/11/2026)

As cinco melhorias estão **em desenvolvimento na PR draft**, não publicadas em produção.

1. **Overture → Geoapify → Google Places**: a função `search-places` agora retorna dados Overture sem consultar a Geoapify quando tem 10 ou mais resultados com qualidade de telefone suficiente e pelo menos dois negócios sem site identificado. Se faltar cobertura, consulta Geoapify; se ainda faltar, o Google é fallback **somente quando autorizado pelo orçamento**.
2. **Qualidade dos leads**: importação prioriza contatos úteis e reserva até 40% das vagas por cidade para estabelecimentos com telefone/e-mail e sem site identificado. Os links WhatsApp/Instagram/Facebook/linktr.ee/encurtadores não são tratados como site empresarial. Filtros da UI usam a mesma regra; não afirmar que um negócio realmente não possui website.
3. **Proteção de custos**: migração `20261112130000_search_provider_daily_usage.sql` cria contador diário atômico e privativo. Nova busca `search-places` reserva créditos **antes** de chamar a Geoapify ou Google. Default `GEOAPIFY_SEARCH_DAILY_CAP=120` e `GOOGLE_PLACES_SEARCH_DAILY_CAP=0` — Google desligado para novas pesquisas até habilitação expressa; máximos permitidos 300/dia Geoapify, 20/dia Google. Orçamento zero é condição de segurança; não mudar sem estimar preços. Abrange chamadas Google Text Search e Place Details desta função, inclusive enriquecimento, mas **não** cobre outros produtos, funções independentes ou o faturamento global da conta Google Cloud. A restrição por usuário `claim_api_request_for_user` continua ativa.
4. **Dashboard Buscar Leads**: única seção de pesquisa; inclui filtro `Com e-mail`, atalho `Sem site + e-mail`, contadores de leads visíveis com/sem site, telefone, e-mail e origem por provedor. Filtros são locais, sem novas chamadas externas; CSS com wrapping no celular. Nunca recriar `Buscar via Maps`.
5. **Expansão brasileira planejada, não executada**: `python scripts/plan_overture_expansion.py --states MG,SP,RJ` lista um piloto por cidade, com `--dry-run` e teto de 30 registros/cidade e 100 MiB de banco. `--states ALL` gera um plano para **27 UFs** sem baixar Overture nem escrever no banco. O roteiro começa no Sul de Minas, depois outras localidades; validar cobertura IBGE antes de usar qualquer comando.

### Verificações feitas / pendentes

- **Staging**: 30 estabelecimentos de Lavras/MG continuam no banco, segurança RLS vigente. Migração de orçamento aplicada e função RPC testada sob transação com `ROLLBACK`: duas reservas com teto 2 autorizadas e a terceira negada; orçamento Google zero negado. Nenhum contador real gasto nos testes.
- **Staging implantado**: a Edge Function `search-places` foi atualizada para a versão **19**, com JWT obrigatório e as regras novas de prioridade e orçamento. Os contadores continuam zerados até chamadas reais; nenhum fallback pago foi invocado nesta implantação.
- **Pendente**: validar login, segmentos, paginação, atribuição Overture e apresentação de filtros na UI local `bash scripts/preview-buscar-leads-staging.sh`. A interface Lovable na main continua no Supabase de PRODUÇÃO e não é um teste válido do Overture.
- **Testes offline**: `python -m unittest discover -s tests/overture -v`. Novos casos cobrem classificação de links sociais, cota de empresas sem site, planejamento das 27 UFs e limites municipais. **Ainda não executados nesta revisão**: GitHub Actions segue bloqueado pela conta; não inferir teste CI aprovado.
- **Produção**: não migrar nem mesclar até os testes ponta a ponta passarem. Todo custo novo requer confirmação deliberada do limite.

## Validar Buscar Leads no STAGING (não confundir com Lovable/produção)

**Diagnóstico confirmado em 12/11/2026:** a interface acessada para o teste Hotel/Lavras fez chamadas em `https://czkazbianiflhldenhcj.supabase.co/functions/v1/search-places` (produção), enquanto os 30 Overture importados estão exclusivamente no `https://prlrxjothrslhswpkoza.supabase.co` (staging). O preview do projeto Lovable ainda apontava para a branch `main`, sem a PR #140. Por isso não aparecia a atribuição Overture nos resultados. Não é evidência de falha na tabela nem do importador.

Para testar a busca integrada corretamente com interface web **sem GitHub Actions**:

1. Baixar/atualizar a branch `feat/overture-brasil-nacional` (o ZIP antigo não recebe arquivos novos automaticamente).
2. Abrir Ubuntu/WSL na raiz da branch e rodar `bash scripts/preview-buscar-leads-staging.sh`.
3. O script obriga `VITE_DEPLOY_TARGET=staging`, `VITE_HTTPONLY_SESSION=false`, URL e **chave pública** do Supabase staging; nunca usa `service_role`.
4. Instala dependências (Bun ou Node 22+ com npm, se já disponíveis) e inicia Vite no localhost. Abra o endereço localhost exibido no terminal e entre com conta do *staging*.
5. Em **Buscar Leads** (única seção), pesquise **Hotel**, **Lavras/MG**. Confirme `Serema Palace Hotel`, `Lavras Apart Hotel` ou `Hotel Ouro Lavras` e atribuição Overture no rodapé, quando houver registros Overture na resposta.
6. Os sites de produção permanecem intactos. Não confunda esse preview local com o preview Lovable sincronizado à branch `main`.

Se não aparecer Overture neste preview, inspecionar logs da função `search-places` do Supabase staging antes de qualquer merge. **Não criar outra tela Buscar via Maps.**

# Overture Places — Integração para o Brasil inteiro

**Status (2026-11-12):** código da busca preparado; função `search-places` implantada somente na homologação; esquema privado migrado e validado; **nenhum dado Overture importado ainda**. Não declarar cobertura nacional como concluída até conferir o relatório por UF e por município.

## Objetivo e limites

- As 27 unidades federativas são suportadas pelo importador, sem usar serviços de raspagem ou Google para copiar dados.
- O Overture não é uma API de pesquisa em tempo real. É um conjunto de dados mensal que precisa de atualização.
- O primeiro plano usa até **20 estabelecimentos por município** (ajustável entre 1 e 100), com prioridade para contatos úteis, distribuindo o orçamento de armazenamento e não prometendo cobertura exaustiva.
- O importador interrompe novas inserções quando o banco alcança o teto configurado (400 MB por padrão). O tamanho da última transação e índices podem produzir pequena margem, portanto monitore o limite real no provedor.
- A infraestrutura do Supabase, downloads e GitHub Actions consomem recursos sujeitos a cotas. **R$ 0 não é garantido em qualquer escala.**
- O código da busca usa Overture antes do Geoapify e do Google Places, e mantém os resultados de cada provedor separados para respeitar suas licenças.
- Atribuição Overture é exibida no resultado. Consulte sempre os avisos de licenças por fonte em https://docs.overturemaps.org/attribution/

## Bancos

- Homologação: Supabase `prlrxjothrslhswpkoza`.
- Produção: Supabase `czkazbianiflhldenhcj` — **não alterar até revisão e aprovação dos testes.**
- Migration `20261112080000_overture_national_places.sql` cria `overture_places`, `overture_import_progress` e a guarda `overture_storage_bytes()`.
- Migration `20261112083000_overture_national_progress.sql` cadastra 27 UFs com estado `pending`.
- As tabelas Overture possuem RLS e não são acessíveis diretamente a `anon` ou `authenticated`. O adaptador `_shared/overture-search.ts` lê no servidor usando chave privada.
- A função `search-places` mantém autenticação de usuário, limites e CORS existentes.

## Alternativa sem GitHub Actions — Windows

O orçamento GitHub Actions desta conta está bloqueado. Para não cadastrar cartão nem gerar cobrança de execução, existem dois arquivos `.cmd` na raiz do repositório:

1. `TESTAR-OVERTURE.cmd` — instala dependências Python em `.venv-overture`, executa testes offline e valida o recorte IBGE de **Lavras/MG**, sem gravar no Supabase.
2. `IMPORTAR-OVERTURE-STAGING.cmd` — pede confirmação e chave privada **somente do projeto de homologação**, importa no máximo **30 estabelecimentos de Lavras** e imprime bytes de banco antes/depois. Não executa no projeto de produção.

Pré-requisitos: Windows 10/11, Python 3.11+ (com `py` ou `python` disponível no PATH), internet e uma cópia local desta **branch**. Clique em **Code → Download ZIP** após selecionar a branch `feat/overture-brasil-nacional`. Alternativamente, `git clone -b feat/overture-brasil-nacional https://github.com/wesleyshoto702-hub/januarioleads.git`.

Segredo: na área do projeto staging em Supabase, copie a **chave LEGACY service_role** (JWT, não a `anon` e não a `publishable`), insira apenas no prompt protegido do PowerShell, e **nunca** compartilhe a chave em capturas de tela, chats ou repositórios. O script descarta a variável de ambiente ao terminar. Se não quiser fornecer a chave nem mesmo localmente, rode só `TESTAR-OVERTURE.cmd` (sem gravação).

**Nota:** a execução local depende da conexão com o IBGE e o repositório Overture; ambientes de avaliação sem acesso de rede podem validar o código, mas não conseguem importar estabelecimentos reais. O primeiro teste de dados deve ser exclusivamente na homologação.

## Como executar uma importação (operador do projeto)

1. Revise e integre a PR após os testes. O workflow manual de importação deve estar na branch padrão para o botão **Run workflow** aparecer.
2. No GitHub, configure dois environments com proteção adequada: `homologacao` e `producao`. Cada um terá os secrets `OVERTURE_SUPABASE_URL` e `OVERTURE_SUPABASE_SERVICE_ROLE_KEY`, pertencentes **ao projeto correto**. Não cole essa chave no código, no chat ou no frontend.
3. Acesse **Actions > Importar Overture Places Brasil (manual, com limite) > Run workflow**. Primeiro rode em `homologacao`, `states=MG` ou um conjunto pequeno, com `max_records_per_city=20` e `max_records_per_state=0`.
4. Confira tabela `overture_import_progress`, total de linhas, cidades presentes e tamanho do banco. O importador agora registra os bytes antes/depois e a média de bytes consumidos por registro em cada UF. Não interprete `partial` como concluído; `complete` significa que a seleção configurada daquela UF foi varrida, não que todos os POIs possíveis foram importados.
5. Quando validado, rode outras UFs em lotes, sem ultrapassar o teto, e faça testes reais do dashboard com usuários autorizados. Como o workflow é manual, nenhuma execução é iniciada automaticamente.
6. Só depois de validação, aprove migrações em produção, publique a Edge Function no projeto de produção e use os **segredos de produção** protegidos para importação controlada.

**Comando local equivalente** (não envie segredos pelo terminal compartilhado):
```bash
python -m pip install overturemaps geopandas shapely pyogrio
python scripts/import_overture_br.py \
  --states AC,AL,AP,AM,BA,CE,DF,ES,GO,MA,MT,MS,MG,PA,PB,PR,PE,PI,RJ,RN,RS,RO,RR,SC,SP,SE,TO \
  --max-records-per-city 20 --database-max-mb 400
```

A malha municipal base utilizada é o arquivo público `BR_Municipios_2024.zip` do IBGE. O importador baixa apenas a malha municipal de cada UF para `data/ibge/`, conforme necessário. Ex.: MG tem cerca de 29 MB, evitando os 199 MB do arquivo nacional. Não versione os arquivos.

## Checklist de liberação

- [x] Código da função e importador preparados na PR.
- [x] Tabelas privadas criadas em staging com RLS e grants verificados.
- [x] Edge Function em staging publicada com Overture opcional.
- [ ] Teste de importação real em município e UF, verificar contagens e contatos.
- [ ] Verificar qualidade do mapeamento das categorias para os nichos brasileiros.
- [ ] Confirmar limites de banco, execução e mensalidades gratuitas.
- [ ] Testes automáticos TypeScript, build, browser e ingestão passando. GitHub Actions está encerrando jobs quase imediatamente; verificar o bloqueio antes de merge.
- [ ] Migração e deploy aprovados em produção.
- [ ] Importar as 27 UFs e avaliar cobertura efetiva (não presumir 100%).
