# Buscar via Maps — recuperação sem Geoapify configurada

Data: 11/11/2026

## Diagnóstico

A tela já carregava o mapa OpenFreeMap sem chave, mas a consulta a estabelecimentos ocorria na Edge Function `geoapify-personal`, hospedada no Supabase original. A função recusava a busca com `NOT_CONFIGURED` caso `GEOAPIFY_API_KEY` estivesse ausente. Isso independe da Vercel. Além disso, o nicho "Clínica Médica" ainda não tinha categoria Geoapify associada.

## Correção

- Manter Geoapify quando a chave estiver configurada, agora com `healthcare.clinic_or_praxis` para **Clínica Médica**.
- Sem a chave, uma busca alternativa de pequeno volume usa exclusivamente OSM via **Overpass API** no próprio Supabase, em uma lista explícita de nichos com filtros de tags OSM conhecidos.
- A busca restringe primeiro a **UF** e depois a **fronteira administrativa do município**; não faz consultas nacionais irrestritas ou pesquisas por texto livre.
- Preservar autenticação do proprietário original, checagem de `private_access`, a RPC `claim_personal_geoapify_search` com teto de **10 buscas/dia**, timeout, limite de **25 resultados** e cache temporário por instância para pesquisas idênticas.
- Em caso de indisponibilidade do serviço compartilhado, informar erro sem retornar resultados inventados nem acionar Google Places.
- Identificar a origem como **OpenStreetMap / Overpass** no CRM e na interface. IDs OSM permanecem no campo de proveniência, nunca no campo Google Place ID.
- Manter OpenFreeMap, MapLibre, fallback de visualização e Google Maps opcional inalterados. Não modifica dados armazenados, autorizações, faturamento ou chaves.

## Restrições

A API pública Overpass é uma infraestrutura comunitária de melhor esforço, pode ficar lenta/indisponível e a cobertura depende dos estabelecimentos cadastrados no OpenStreetMap. Não utilizar essa modalidade para prospecção em massa nem para contas públicas. Para expansão comercial, contratar provedores com cotas/SLA, ou infraestrutura própria, antes de ampliar o acesso.

Sem a chave Geoapify, a busca sem chave oferece apenas os nichos explicitamente mapeados no arquivo `geoapify-personal/index.ts`; outros nichos exibem mensagem de não suporte. Mesmo os nichos cobertos podem retornar poucos registros. A busca por bairro depende de dados OSM de endereçamento preenchidos.

A política de atribuição do OpenStreetMap permanece visível no mapa e na lista. URLs: https://wiki.openstreetmap.org/wiki/Overpass_API e https://www.openstreetmap.org/copyright

## Verificação

Confirmar após a publicação: entrar com a conta original no Januário Leads, pesquisar **Clínica Médica / Alfenas / MG**, verificar resposta e marcadores sem configurar chave Google. Validar também um nicho não mapeado e a mensagem de quota. GitHub Actions permanece indisponível por limite de franquia, portanto execução de testes de navegador está pendente.

## Ajuste de disponibilidade em 11/11/2026

Após o primeiro fallback sem chave, o navegador mostrou `A consulta comunitária do OpenStreetMap está ocupada` em Clínica Médica / Alfenas / MG. Os logs confirmaram a função no Supabase original com HTTP 503 e a RPC de limite autenticada com HTTP 200; o código anterior não distinguia a resposta do Overpass (HTTP 400, 406, 429 etc.).

A conexão do fallback foi alterada para a instância pública **Private.coffee**, documentada na lista de instâncias do OpenStreetMap e publicada em `https://overpass.private.coffee/api/interpreter`. A instância da FOSSGIS `overpass-api.de` passou a impor restrições mais severas a aplicações e cloud workers em 2026. Usamos **uma instância por vez**, sem contornar bloqueios automaticamente enviando a mesma busca a vários serviços. A disponibilidade ainda é de melhor esforço.

Agora as respostas informam de maneira distinta quando o provedor recusa a sintaxe (400), bloqueia o acesso (403/406), atinge seu limite (429) ou fica temporariamente indisponível (5xx). O Supabase registra somente o código HTTP ou a categoria do erro do fornecedor, sem tokens, dados do usuário ou detalhes da busca. Respostas `200` contendo `remark` de erro não são consideradas sucesso.

A autenticação original e a franquia de 10 tentativas diárias permanecem ativas; **inclusive tentativas com falha consomem a cota** porque a função reserva um acesso antes de consultar o provedor, evitando abusos de requisições concorrentes. Mudanças no controle transacional dessa cota exigem revisão separada.

Pendente: executar uma pesquisa autenticada após o deploy para confirmar dados reais. Não confundir deployment ativo com validação de ponta a ponta. O OpenStreetMap pode não ter clínicas cadastradas para toda cidade.

## Melhoria estrutural do catálogo e da geografia (11/11/2026)

O catálogo canônico tem **196 nichos em 16 grupos**. Antes, a rota de Geoapify só aceitava aproximadamente 40 categorias por nome, enquanto nichos sem mapeamento específico falhavam; o filtro de Barbearia descartava todos os cabeleireiros sem `barber` / `barbearia` / `barbeiro` no nome, mesmo quando a fonte tinha candidatos. A API retornava 25 candidatos antes da seleção.

A solução generalizada faz:

- **Todos os 196 nichos passam a gerar um plano controlado de consulta.** Quando há categoria Geoapify específica e revisada, usa-se a categoria. Quando não há, usa-se uma categoria abrangente correspondente ao grupo do nicho, **obrigatoriamente com filtro de nome**; não se faz uma consulta genérica de todas as empresas.
- A função busca até 150 candidatos no provedor para categorias específicas e filtra **antes** de limitar a resposta ao usuário a 25 empresas. Quando a categoria retorna zero registros confiáveis, pode haver uma segunda consulta com nome, limitada a 75 candidatos. Cada busca pessoal usa no máximo **1 consulta de geocodificação e 2 consultas de estabelecimentos**, sob a cota diária já existente de **10 buscas autenticadas**. Não altera a política de Google Places nem ativa cobranças do Google.
- Resultados de `Barbearia` com termos claros no nome têm prioridade. Se a classificação aberta só informar `hairdresser`, o retorno pode incluir **estabelecimentos relacionados**, claramente sinalizados como **atividade a confirmar**, evitando apresentar salões genéricos como barbearias confirmadas.
- Resultados por **correspondência de nome**, sem categoria específica, recebem indicação de cobertura parcial e atividade a confirmar antes de serem usados para prospecção ou gravados no CRM.
- Na geocodificação, a restrição ao tipo `city` foi removida para não rejeitar automaticamente municípios classificados como `town` ou outras localidades; a validação por **nome exato, UF e país** permanece ativa para evitar misturar municípios homônimos.
- O retorno de zero empresas agora deixa explícito que isso significa **sem registro correspondente nessa fonte**, não ausência real de estabelecimentos.
- A interface identifica a atividade em linguagem natural, conserva a proveniência Geoapify/OSM e não exibe códigos técnicos de categorias no cartão do estabelecimento.

**Limites reais:** a busca aceita todo o catálogo e pode pesquisar municípios brasileiros validáveis pelo Geoapify, mas nenhuma API tem cobertura completa de todas as empresas, nichos, endereços ou cidades. Um resultado vazio após pesquisa legítima não é prova de que não haja empresas. Nichos que usam nome não conseguem encontrar nomes comerciais sem referência à atividade; para cobertura comercial ampla será necessária outra base licenciada e contratada, não uma garantia artificial de sucesso.

A busca segue restrita ao proprietário e protegida por JWT e tabela de acesso privada. A chave `GEOAPIFY_API_KEY` permanece exclusivamente no Supabase. Não altera cota nem preço de nenhum fornecedor. O serviço comunitário Overpass permanece **somente como contingência se a chave Geoapify estiver ausente**, sem ser usado nas pesquisas normais.

**Testes:** inclusão de testes Deno para o catálogo de 196 nichos, bloqueio de nichos inventados, distinção entre barbearias confirmadas e candidatos genéricos, além de busca em uma página com 120 registros. Verificar implantação no Supabase original e pesquisa autenticada com nichos e cidades distintos. O GitHub Actions ainda não executou toda a suíte, de modo que o funcionamento end-to-end em produção precisa de homologação.

Fonte da API: https://apidocs.geoapify.com/docs/places/
