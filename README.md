# JanuarioLeads

Plataforma de prospecção comercial: busca de empresas por nicho e cidade, CRM, mensagens, oportunidades e acompanhamento financeiro dos leads.

## Evolução para SaaS

- **Página inicial pública:** `/` — hero com animação Buscar Leads sem CTAs repetidos, tour original, seções editoriais e explorador interativo dos seis módulos. [Mudanças da reformulação](docs/reformulacao-home-auth-2026-11-06.md).
- **Compatibilidade:** `/produto` continua exibindo a apresentação do produto.
- **Área de trabalho privada:** `/app`; `/login` valida a conta e encaminha o usuário autorizado ao CRM.
- **Demonstrações do produto:** a animação **Buscar Leads** fica agora no **hero** à direita do título, em `/#demonstracao`, com digitação, pesquisa, resultados e seleção para o CRM (controles de pausa, reinício e nicho). O tour "Como funciona o Januário Leads? Veja na prática" continua logo depois em `/#tour`, com quatro etapas e navegação manual. A seção duplicada de busca foi removida para deixar a homepage mais compacta. Tudo com empresas fictícias, sem chamadas ao Supabase ou Google Places. [Adaptação da réplica HTML](docs/hero-buscar-leads-animado-2026-11-06.md).
- **Login e criação de conta:** `/login` e `/cadastro` agora compartilham identidade exclusiva do Januário Leads. O formulário de cadastro segue desativado por padrão na produção e só funciona no staging separado; criar identidade **não** ativa acesso ao CRM. [Guia](docs/cadastro-beta-staging-2026-11-06.md).
- **Assinaturas:** ainda não disponíveis comercialmente; veja [roadmap SaaS](docs/roadmap-saas-2026-11-06.md).
- **Acesso:** atualmente concedido por convite, sem preços ou planos públicos definidos.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cfc45a7b-7f48-4b0a-82fc-daf876974a6f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Vercel: dependências TanStack corrigidas (CVE-2026-102989)

O `@tanstack/react-start` foi atualizado para `1.168.61`, e o lockfile
`bun.lock` foi regenerado no GitHub Actions. A versão resolvida de
`@tanstack/start-server-core` agora é `1.169.40`. Ambas incorporam a
correção para a vulnerabilidade XSS. O build `bun run build` foi aprovado.

Para publicar, a Vercel deve construir **o commit mais recente da branch
`main`**, e não executar *Redeploy* de um commit antigo que ainda contém a
versão vulnerável. Não configure a variável
`DANGEROUSLY_DEPLOY_VULNERABLE_TANSTACK_START_XSS`; ela contorna a
proteção sem corrigir a falha.

## Busca de empresas no Brasil

A área **Buscar leads** usa **Google Places API (New)** por meio da Supabase Edge Function `search-places`.

Fluxo:

```text
JanuarioLeads -> Supabase Edge Function -> Google Places API (New)
```

### Frontend

O navegador utiliza somente as credenciais públicas do Supabase:

```sh
VITE_SUPABASE_URL=https://czkazbianiflhldenhcj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Essas credenciais servem para identificar o projeto Supabase e invocar a Edge Function. O código também possui um fallback com a URL e a publishable key públicas desse mesmo projeto para ambientes Lovable sem Build Secrets. Nenhuma chave privada do Google é enviada ao navegador.

### Secret privado

`GOOGLE_PLACES_API_KEY` deve ser configurada somente em **Supabase -> Edge Function Secrets**.

A Edge Function acessa a chave através de:

```ts
Deno.env.get("GOOGLE_PLACES_API_KEY")
```

A chave real não deve existir no GitHub, no frontend, em variáveis `VITE_*`, localStorage, sessionStorage, URLs ou query strings.

### Edge Function

Código: `supabase/functions/search-places/index.ts`

A função:

- pesquisa por estado + cidade + segmento em todo o Brasil, mantendo Lavras/MG como padrão inicial;
- usa Text Search da Places API (New);
- usa Field Masks;
- devolve `nextPageToken` para o botão **Carregar mais**;
- trata CORS e requisições `OPTIONS`;
- não retorna nem registra a chave do Google;
- mantém o mesmo formato de dados já esperado pela interface atual.

A função está configurada em `supabase/config.toml`.

### Cobertura nacional em Meus Leads

- **Buscar Leads** oferece as 27 unidades federativas e carrega os municípios de cada UF pela API do IBGE. Lavras/MG continua sendo apenas o ponto de partida padrão.
- O cadastro manual em **Meus Leads** aceita estado e município; novos leads manuais precisam informar ambos. A lista do IBGE auxilia a escolha e, se estiver indisponível, é possível preencher a cidade manualmente.
- Tabela e cartões de **Meus Leads** apresentam segmento, cidade e UF; a pesquisa local também permite filtrar por esses campos.
- Leads obtidos em **Buscar Leads**, **Oportunidades** e **Abertos Agora** preservam a cidade/UF da pesquisa quando o Google omite algum desses campos individuais.
- Leads antigos sem cidade/UF não recebem uma localização presumida: aparecem como **Localização não informada**, e a cidade/UF pode ser preenchida usando **Editar**.
- Cobertura nacional não significa execução automática de buscas em todos os municípios: a prospecção continua por cidade/nicho, respeitando limites e custos da API do Google Places.


## Contas independentes e proteção de dados

O mesmo projeto Supabase pode atender várias contas: **não se deve criar um projeto
Supabase separado por assinante**. Cada usuário tem seu UUID em `auth.users`,
e os dados remotos (leads, atualizações, pagamentos, atividades, oportunidades,
pré-visualizações e caches) são protegidos por **Row Level Security (RLS)** usando
`auth.uid() = user_id`. O frontend nunca deve usar um ID de usuário enviado
arbitrariamente por outra conta para ler os dados.

Os dados persistidos no navegador usam `accountLocalStorage` e
`accountSessionStorage` (em `src/lib/account-storage.ts`), com um namespace
diferente para cada usuário autenticado. A versão antiga possuía chaves globais
`leadflow:...`; seus dados legados são migrados **exclusivamente para a conta
original**, preservando os leads já presentes no Supabase. A migração automática
de leads locais para uma conta nova foi desativada; o Supabase é a fonte de
verdade para o CRM. O estado do aplicativo é recriado quando a conta muda, sem
carregar mensagens ou pesquisas da conta anterior. Contas novas começam com
**zero leads, zero mensagens próprias e zero histórico local**. Os três modelos
antigos de mensagens podem ser restaurados apenas pela conta original.

### Como testar uma nova conta criada no Supabase

1. No **Authentication > Users** do Supabase, adicione um usuário de teste
   com outro e-mail e senha. Não reutilize o mesmo `user_id`.
2. O JanuarioLeads atualmente exige autorização explícita em
   `public.private_access`. No SQL Editor (como administrador), autorize
   somente o UUID do novo usuário:
   `insert into public.private_access (user_id) values ('UUID-DO-NOVO-USUARIO') on conflict do nothing;`
3. Saia da conta original e entre com a conta de teste. Verifique o dashboard,
   CRM, mensagens, oportunidades, pesquisas recentes e favoritos: os dados
   pessoais da conta original não devem aparecer.
4. Crie um lead e uma mensagem **somente na nova conta**. Saia e entre
   novamente na conta original; verifique que os seus registros ainda existem.
   Volte à conta de teste para confirmar que os dados são independentes.
5. Nunca rode `DELETE` ou `TRUNCATE` no banco para «zerar» uma nova conta:
   uma nova conta já nasce com tabelas sem registros daquele `user_id`.

**Cadastro comercial futuro:** a tela de cadastro e a assinatura ainda
precisam ser implementadas. Não conceda `private_access` automaticamente
para qualquer e-mail antes de existir uma política de ativação/assinatura,
limites de uso e verificação de e-mail. A área de autenticação deve vincular
cada login ao seu UUID, e todas as novas tabelas devem ter RLS por proprietário.

**Limitação atual de segurança local:** os templates de mensagens e alguns
caches ainda são guardados no próprio navegador, separados por namespace.
Um dispositivo compartilhado **não é um cofre contra alguém com acesso às
ferramentas de desenvolvedor do navegador**. Antes de vender o SaaS
publicamente, mover as mensagens personalizadas para tabelas Supabase com RLS
e reduzir o armazenamento local de dados sensíveis. Use perfis de navegador
separados durante os testes de contas até essa etapa.

Teste automatizado: `deno test src/lib/account-storage.test.ts`.

## Catálogo nacional de nichos

**Buscar Leads** e **Nichos Abertos Agora** compartilham o mesmo catálogo central:
**196 nichos distintos em 16 categorias**, incluindo construção e reformas,
turismo/hospedagem, serviços empresariais, casa e decoração, pets e agronegócio.
Cada nicho possui uma família comercial para o planejamento de páginas e
prospecção, evitando categorias novas sem estratégia definida.

Categorias semelhantes foram consolidadas sem apagar leads ou históricos:
- `Dentista` e `Odontologia` agora aparecem como `Clínica Odontológica`.
- `Hamburgueria Artesanal` agora aparece como `Hamburgueria`.
- `Restaurante de Bairro` agora aparece como `Restaurante`.
- `Barbeiro Especializado` agora aparece como `Barbearia`.
- `Assistência Técnica Automotiva` agora aparece como `Mecânica Automotiva`.
- `Instalador de Painel Solar` agora aparece como `Energia Solar`.

Os nomes antigos continuam funcionando como **sinônimos** nas caixas de busca
do catálogo, nas pesquisas recentes e na validação do backend. Especialidades
distintas, como restaurantes fine dining, odontologia, veterinárias, pet shops
e clínicas especializadas, continuam selecionáveis individualmente. O Google
Places utiliza uma única consulta textual por ação, com expressões ajustadas
para alguns nichos, sem prometer cobertura completa de toda empresa na cidade.
As informações de leads já persistidos não são regravadas automaticamente.

A cobertura e os sinônimos podem ser validados com
`deno test supabase/functions/_shared/niche-catalog.test.ts`.

## Busca de Instagram (cobertura ampliada)

Ao abrir **Ver empresa** e clicar em **Buscar Instagram na web**, o JanuarioLeads:

1. Usa o perfil que já foi confirmado manualmente, caso exista.
2. Consulta o site oficial, incluindo links HTML/JSON-LD, páginas de contato/redes sociais e páginas de link na bio que sejam apontadas pelo próprio site.
3. Se não encontrar um perfil inequívoco, consulta fontes públicas indexadas usando a API da OpenAI (busca web), combinando nome, nicho, cidade, UF e telefone.
4. Confere sinais de identidade e possíveis conflitos de localidade. Perfis duvidosos são apresentados como **candidatos**, nunca como confirmação automática.
5. Oferece **Pesquisar no Google** e **Informar perfil manualmente**, para o usuário confirmar a conta oficial quando a busca automática não conseguir.

### Instagram sob demanda nos cartões e em Ver empresa

A pesquisa de **Buscar Leads** não inicia investigações de Instagram automaticamente, evitando consultas caras, espera e estouro de cotas. O cartão mostra somente o **`@usuario`** quando existe um perfil já confirmado, inclusive quando ele foi salvo anteriormente em **Meus Leads**. Perfis candidatos podem ser conferidos em **Ver empresa**.

Para procurar um Instagram ainda desconhecido, abra **Ver empresa → Buscar Instagram na web**. Essa ação consulta os sites oficiais e, se necessário, utiliza a pesquisa pública complementar. Você também pode abrir a busca no Google ou **informar/confirmar o @perfil manualmente**. O resultado confirmado é salvo e pode aparecer diretamente nos cartões nas próximas consultas.

A função `search-places` e os limites separados do Supabase para consulta a sites e pesquisa web continuam disponíveis **somente sob demanda**. Resultados inconclusivos possuem cache de 24 horas; perfis confirmados são reaproveitados para reduzir requisições. Não há garantia de encontrar todas as empresas no Instagram, especialmente quando não possuem perfil público.

### Implantação no Supabase

O workflow [Validar banco e publicar funções sob demanda](.github/workflows/deploy-search-places.yml)
é configurado para o projeto Supabase do Januário Leads. **Pushes na branch `main` que
afetem os caminhos monitorados executam apenas validações**; publicação efetiva de
Edge Functions ocorre somente por `workflow_dispatch` (iniciada manualmente no
GitHub Actions) ou por tag `deploy/supabase-*`.

Quando a publicação é explicitamente iniciada, o workflow executa testes e
verificações de migrações, autorização e segurança antes de publicar as três
funções versionadas neste fluxo:

- `search-places`
- `deep-enrich-business`
- `open-now-niches`

O workflow também consulta as versões das funções publicadas e verifica CORS.
Ele **não publica `sync-leads`**, não executa indiscriminadamente migrations
históricas e **não cadastra automaticamente as chaves do Google ou da OpenAI**
como secrets do Supabase.

Para publicar com autorização específica:

1. Confirme que o código, as migrations e os testes do ambiente alvo foram
   revisados. Verifique a divergência histórica entre migrations locais e remotas
   em [`docs/database-recovery.md`](docs/database-recovery.md).
2. Configure **`SUPABASE_ACCESS_TOKEN`** exclusivamente nos *GitHub Actions
   secrets*, com as permissões mínimas necessárias para as funções autorizadas.
   Não envie o token pelo chat e não grave sua cópia no repositório.
3. Quando necessário, configure `GOOGLE_PLACES_API_KEY` e `OPENAI_API_KEY`
   **diretamente nos secrets privados de Edge Functions do Supabase**,
   segundo as funções e cotas escolhidas. Não use variáveis públicas
   `VITE_*` para credenciais. Não é necessário criar chaves ou custos novos
   somente para rodar o workflow de validação.
4. Depois de obter autorização para a publicação, execute o workflow por
   `workflow_dispatch` na branch revisada, ou use o processo controlado de tag.
   Confira os testes, as verificações de banco e a lista de funções publicadas.
5. Somente depois, valide em ambiente de homologação os fluxos necessários,
   incluindo **Ver empresa → Buscar Instagram na web** se a integração com a
   OpenAI estiver habilitada. Evite testes de API paga contra produção.

**Atenção:** uma assinatura ChatGPT não é uma chave de API da OpenAI. As
consultas Google Places e OpenAI podem gerar custos, mesmo que a hospedagem
esteja no plano gratuito. Nenhuma funcionalidade paga deve ser ativada sem
um orçamento e limites de consumo aprovados.

O modelo de pesquisa complementar de Instagram é configurável pelo secret
`OPENAI_INSTAGRAM_MODEL`. Consulte o modelo e a disponibilidade efetiva
na API antes de modificar seu valor. A implantação de Edge Functions não
publica automaticamente o frontend (Vercel/Lovable).

O fluxo de Instagram utiliza fontes públicas, não exige login na rede social
e apresenta perfis ambíguos como candidatos para conferência.

## Buscar informações

A ação **Buscar informações** enriquece leads adicionados manualmente com dados reais do Google Places, reutilizando a Edge Function `search-places` e a mesma `GOOGLE_PLACES_API_KEY`.

Fluxo:

```text
Lead manual
-> search-places (mode: lead-enrichment)
-> Google Places API (New)
-> candidatos + confiança determinística
-> confirmação manual
-> enriquecimento do lead no localStorage
```

A busca usa, nesta ordem:

1. `placeId` já confirmado, para **Atualizar informações**;
2. telefone normalizado em contexto brasileiro;
3. nome + cidade + estado real do lead;
4. nome + segmento + cidade + estado real do lead.

O nível de confiança é calculado sem IA, usando correspondência de telefone, semelhança do nome, localização do próprio lead e compatibilidade de segmento. Leads legados sem localização continuam com o fallback histórico de Lavras/MG. Nenhum resultado altera o lead sem confirmação.

O enriquecimento preserva status, observações, histórico e mensagens. Campos públicos do Google são adicionados somente quando retornados.

A funcionalidade não usa OpenAI e não consome créditos de IA.


## Chance

O **Chance** é um score interno de priorização comercial de 1 a 100. Ele não representa probabilidade estatística de fechamento e é calculado localmente, sem OpenAI.

A fórmula fica centralizada em `src/features/lead-chance/lead-chance.ts`.

Pesos atuais:

- base: 20;
- site não identificado: +28;
- site identificado: -10;
- telefone identificado: +12;
- telefone/WhatsApp não identificado: -18;
- Instagram identificado: +6;
- Instagram identificado + site não identificado: +8 adicionais;
- avaliações: +1 (1–9), +4 (10–39), +7 (40–99), +10 (100+);
- avaliação >= 4.2 com pelo menos 10 avaliações: +2;
- avaliação < 3.5 com pelo menos 10 avaliações: -2;
- empresa operacional: +5;
- temporariamente fechada: -12;
- permanentemente fechada: score final limitado a no máximo 7.

Não existe bônus separado de WhatsApp porque o Google Places atualmente fornece telefone, mas não um campo independente confirmando que aquele número possui WhatsApp. Isso evita contabilizar o mesmo sinal duas vezes.

O resultado é sempre limitado entre 1 e 100 e recalculado a partir dos dados atuais. O score não é persistido no lead.

Faixas visuais:

- 1–20: cinza discreto;
- 21–40: cinza claro;
- 41–60: neutro/off-white;
- 61–80: vermelho suave;
- 81–100: vermelho forte.

A tela **Buscar leads** permite ordenar por **Maior Chance** e **Menor Chance** sem alterar os filtros existentes.


## Ver empresa: descrição e Instagram

A tela **Ver empresa** agora possui uma seção **Sobre a empresa** gerada deterministicamente com dados públicos já disponíveis. A descrição não usa OpenAI.

Fontes usadas, em ordem:
- editorial summary do Google Places quando disponível;
- categoria principal e categorias relacionadas;
- cidade/estado;
- situação do estabelecimento;
- horários;
- avaliação e quantidade de avaliações.

O texto é curto, factual e não inventa serviços, diferenciais, história, equipe, preços ou especializações.

### Descoberta de Instagram

A descoberta continua centralizada no fluxo de presença online e usa camadas com parada antecipada:

1. Instagram já confirmado nos dados existentes/Google Places;
2. site oficial identificado, procurando links públicos diretos para perfis do Instagram na página principal e, quando disponível, na página de contato;
3. busca pública complementar pela OpenAI Responses API com a ferramenta hospedada `web_search`, somente quando uma ação de descoberta profunda é solicitada e as camadas anteriores não confirmaram o perfil.

A camada web reutiliza a `OPENAI_API_KEY` já existente no backend e o modelo `gpt-6.1-terra`. Ela não usa Browserless, não raspa google.com/Google Maps e não acessa Instagram com login.

O backend limita a busca a poucos resultados, coleta no máximo três candidatos e valida sinais como:

- telefone;
- endereço;
- website;
- nome comercial;
- nome profissional;
- cidade/estado;
- categoria;
- username.

Um candidato só entra na avaliação se o perfil tiver sido retornado diretamente como fonte da busca ou se uma página pública realmente recuperada mencionar aquele username/Instagram. Perfis com cidade conflitante são descartados.

Resultados possíveis:

- `high`: Instagram identificado e persistido;
- `medium`: Instagram provável / possíveis Instagrams, exigindo confirmação manual;
- `low`: não é vinculado automaticamente;
- nenhum candidato: Instagram não identificado, sem tratar isso como erro.

Quando dois candidatos fortes ficam próximos, nenhum é escolhido arbitrariamente. A interface mostra os candidatos com sinais e permite **Abrir perfil**, **Confirmar** e **Não é este**.

Confirmação manual usa `instagram_source = manual_confirmation` e tem prioridade sobre pesquisas automáticas futuras.

### Cache

Resultados positivos, negativos e candidatos usam `instagramCheckedAt` e uma assinatura SHA-256 baseada nos dados que afetam a descoberta:

- nome;
- telefone;
- endereço;
- cidade/estado;
- website;
- categoria principal.

O cache normal dura 7 dias. Abrir **Ver empresa** não executa pesquisa. **Status**

Somente quando o valor realmente muda:

```text
Status alterado
Aguardando → Aceito
```

O metadata guarda `previousStatus` e `newStatus`.

**Atualização de informações**

Depois de confirmar Buscar/Atualizar informações, os dados antigos e novos são comparados.

Somente quando campos públicos realmente mudaram é criado:

```text
Informações da empresa atualizadas
```

A descrição mostra um resumo curto das primeiras mudanças e o metadata guarda `changedFields`.

**Edição manual**

Uma operação de salvar gera no máximo um evento.

Se apenas campos da empresa mudarem:

```text
Empresa editada
```

Se o status também mudar, o único evento da operação é:

```text
Status alterado
Aguardando → Aceito
```

e os demais campos editados ficam resumidos na descrição/metadata.

Nenhum evento é criado quando o formulário é salvo sem mudança relevante.

A pontuação Chance não gera eventos nesta primeira versão.

### Anotações

A aba Histórico possui **Adicionar anotação**.

Anotações manuais podem ser:

- criadas;
- editadas;
- excluídas após confirmação.

Somente registros `manual_note` expõem essas ações.

### Carregamento e paginação

O histórico não é carregado ao abrir Meus Leads.

Ele é buscado somente quando a aba **Histórico** é efetivamente montada dentro de **Ver empresa**.

A consulta usa:

```text
created_at DESC, id DESC
```

e carrega 20 eventos por página. Quando existem mais registros, aparece **Carregar anteriores**.

### Leads antigos

Nenhum passado comercial foi inventado.

Para leads existentes antes da funcionalidade, o único backfill executado foi `lead_added`, porque `leads.created_at` já é uma data persistida e confiável.

WhatsApp, prompts, status, edições ou outras interações antigas não foram reconstruídos.

### Falhas secundárias

Registrar histórico é uma operação secundária.

Se a ação principal funcionar e a gravação do histórico falhar, a ação principal não é desfeita. A interface exibe um aviso discreto e não adiciona uma atividade falsa no estado local.

Anotações, por outro lado, só aparecem na timeline depois que a persistência foi confirmada.
