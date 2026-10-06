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

A camada web reutiliza a `OPENAI_API_KEY` já existente no backend e o modelo `gpt-5.6-terra`. Ela não usa Browserless, não raspa google.com/Google Maps e não acessa Instagram com login.

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
