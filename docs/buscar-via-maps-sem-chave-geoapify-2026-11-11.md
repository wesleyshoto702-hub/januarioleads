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
