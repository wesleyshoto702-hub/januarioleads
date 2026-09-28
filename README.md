# JanuarioLeads

oi

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


## Busca de empresas em Lavras

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

- pesquisa somente em Lavras, Minas Gerais, Brasil;
- usa Text Search da Places API (New);
- usa Field Masks;
- devolve `nextPageToken` para o botão **Carregar mais**;
- trata CORS e requisições `OPTIONS`;
- não retorna nem registra a chave do Google;
- mantém o mesmo formato de dados já esperado pela interface atual.

A função está configurada em `supabase/config.toml`.


## Gerar prompt

A ferramenta **Gerar prompt** analisa os dados reais disponíveis de uma empresa e produz uma estratégia estruturada de site/landing page e um prompt pronto para uso no Lovable.

Fluxo:

```text
JanuarioLeads -> Supabase Edge Function generate-site-prompt -> OpenAI Responses API
```

A Edge Function exige a sessão autenticada do JanuarioLeads e a mesma allowlist privada utilizada pela busca. Chamadas sem usuário autorizado não chegam ao provedor de IA.

### Provedor

Modelo atual: `gpt-5.6-terra`.

A resposta usa Structured Outputs com JSON Schema e é dividida em análise, estratégia, direção visual, imagens, estrutura e prompt Lovable.

### Secret privado

Configure somente em **Supabase -> Edge Function Secrets**:

```sh
OPENAI_API_KEY=...
```

Nunca coloque essa chave no frontend, GitHub ou em variável `VITE_*`.

### Persistência

O último prompt de cada empresa é salvo localmente no navegador em `januarioleads:generated-prompts`. Isso preserva a arquitetura atual do CRM em `localStorage` e não migra leads para o banco.


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
3. nome + Lavras, Minas Gerais, Brasil;
4. nome + segmento + Lavras, Minas Gerais, Brasil.

O nível de confiança é calculado sem IA, usando correspondência de telefone, semelhança do nome, localização em Lavras e compatibilidade de segmento. Nenhum resultado altera o lead sem confirmação.

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

A descoberta está centralizada e atualmente usa duas camadas seguras:

1. Instagram já retornado pelo Google Places quando `websiteUri` aponta diretamente para um perfil do Instagram;
2. site oficial identificado pelo Google Places, procurando links públicos diretos para perfis do Instagram na página principal e, quando disponível, na página de contato.

Somente URLs no formato de perfil `instagram.com/usuario` são aceitas. Links para posts, reels, stories ou caminhos reservados são descartados.

A descoberta não faz scraping do Instagram, não faz login, não acessa páginas privadas e não usa OpenAI.

### Cache

Resultados de presença online ficam no `localStorage` em `januarioleads:business-presence` por 7 dias. Abrir **Ver empresa** novamente usa o cache e evita nova verificação automática dentro desse período. A ação manual **Buscar Instagram novamente** força uma nova verificação quando existe site oficial.

Quando um lead manual é enriquecido por **Buscar informações/Atualizar informações**, a mesma lógica é reutilizada. Instagram de alta confiança já salvo não é apagado se uma atualização posterior não encontrar o perfil.

### Camada de busca web

A camada 3 de busca pública na web não está ativada porque o projeto não possui hoje um provedor de busca web. Ativá-la exige uma integração externa adicional e um novo Secret. Nenhum provedor foi adicionado silenciosamente.


## Atualização automática dos leads

O JanuarioLeads agora possui sincronização periódica dos leads que têm `placeId` confirmado.

### Arquitetura

```text
Supabase Cron (1x por dia)
-> pg_net
-> Edge Function sync-leads
-> Google Places Place Details (New)
-> comparação campo a campo
-> public.leads
-> public.lead_updates
-> JanuarioLeads
```

O job ativo é `sync-leads-daily`, configurado para `0 6 * * *` (06:00 UTC / 03:00 em America/Sao_Paulo).

### Persistência e migração

Antes desta funcionalidade, os leads do CRM existiam somente em `localStorage`. Isso não permitiria atualização com o navegador fechado.

A aplicação agora mantém:

- `localStorage` como fallback local;
- `public.leads` como cópia persistente usada pelo backend;
- `public.lead_updates` como histórico das mudanças detectadas.

No primeiro acesso autenticado após esta versão:

1. os leads locais são lidos normalmente;
2. o frontend consulta os leads remotos do usuário;
3. somente IDs locais ausentes no Supabase são inseridos;
4. a cópia remota passa a alimentar o CRM;
5. o `localStorage` continua sendo mantido como fallback.

Nenhum lead local é apagado antes da confirmação remota.

### Segurança

As tabelas `leads` e `lead_updates` usam RLS e só permitem acesso ao próprio `user_id`, desde que o usuário também exista em `private_access`.

`anon` não possui acesso às tabelas.

A função `sync-leads` não usa a sessão do navegador. Ela é protegida por um token interno aleatório:

- plaintext somente no Supabase Vault;
- SHA-256 somente em `sync_internal_config`;
- `sync_internal_config` não possui grants para `anon` nem `authenticated`;
- a função compara o token antes de ler leads ou chamar o Google.

`GOOGLE_PLACES_API_KEY` continua somente no backend.

### Place Details

A sincronização usa:

```text
GET https://places.googleapis.com/v1/places/{PLACE_ID}?languageCode=pt-BR&regionCode=BR
```

Field Mask:

```text
id,
displayName,
primaryType,
primaryTypeDisplayName,
types,
editorialSummary,
formattedAddress,
addressComponents,
nationalPhoneNumber,
internationalPhoneNumber,
rating,
userRatingCount,
businessStatus,
currentOpeningHours,
regularOpeningHours,
websiteUri,
googleMapsUri,
location
```

A função não solicita texto completo das avaliações.

### Mudanças monitoradas

O histórico registra, quando aplicável:

- nome da empresa;
- endereço;
- site identificado, alterado ou removido;
- telefone, preservando `previous_phone`;
- nota;
- quantidade de avaliações, incluindo mensagens como `+3 novas avaliações`;
- horários;
- situação da empresa;
- categoria principal;
- categorias relacionadas.

Também são mantidos atualizados, sem criar notificação desnecessária em todos os casos: telefone internacional, Google Maps, descrição, bairro, cidade, estado, coordenadas, status aberto/agora e descrição factual.

A comparação de categorias é independente da ordem retornada pelo Google para evitar falsos positivos.

### Falhas e retry

Cada lead é processado isoladamente. Uma falha não interrompe os demais.

Erros de rede, HTTP 429 e HTTP 5xx recebem retry moderado com backoff limitado. Falhas são gravadas em `last_sync_error` e também no histórico como `sync_error`.

O processamento usa lotes de até 50 leads, concorrência máxima de 3 e pequeno intervalo entre itens.

### Interface

Em **Meus Leads** existe uma área compacta **Atualizações recentes**.

Leads com novidades não vistas mostram um contador discreto. Ao abrir **Ver empresa**, as mudanças daquele lead são marcadas como vistas e o mesmo modal compartilhado mostra:

- Última atualização;
- histórico recente;
- demais dados atuais da empresa.

### Chance e Gerar prompt

Chance continua sendo calculado em tempo de execução a partir dos dados atuais. Nenhum score antigo é persistido como definitivo.

Gerar prompt continua usando o estado atual do lead e não apaga prompts já salvos quando a sincronização detecta mudanças.

### Custos

A sincronização automática usa somente Supabase + Google Places.

Ela não chama `generate-site-prompt`, não lê `OPENAI_API_KEY` e não consome créditos da OpenAI.
