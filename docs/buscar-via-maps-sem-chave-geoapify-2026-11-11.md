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
