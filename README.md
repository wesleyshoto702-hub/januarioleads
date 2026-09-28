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
