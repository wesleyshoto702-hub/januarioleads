# Januário Leads — aviso de lead já adicionado nos dois buscadores (staging)

## Comportamento

- A mesma lista de empresas já salvas no **CRM da conta autenticada** é usada por `Buscar Leads` e `Buscar via Maps`.
- **Buscar Leads:** cada resultado correspondente apresenta o aviso **"Lead já adicionado"** e não oferece novamente o botão de salvar. Ao abrir os detalhes, a interface também mantém o aviso.
- **Buscar via Maps:** a lista lateral e o cartão selecionado identificam empresas já presentes no CRM, para fontes Google Places e Geoapify/OpenStreetMap.
- A identificação é bidirecional: qualquer lead salvo no CRM pode ser reconhecido a partir de resultados de ambas as buscas, independentemente do fluxo que o gravou.
- A atualização visual acompanha as alterações em `existingLeads`, sem nova consulta de fornecedor para identificar duplicados.

## Correspondência

Ordem conservadora em `src/features/search-leads/identity.ts`:

1. Identificador de local (`placeId`) idêntico.
2. Mesmo telefone e nenhuma incompatibilidade confirmada de cidade/UF.
3. Nome normalizado idêntico **e** endereço normalizado idêntico.
4. Nome normalizado idêntico **e** coordenadas válidas separadas por no máximo 80 metros, sem incompatibilidade confirmada de cidade/UF.

Geoapify pode ter `sourceId` diferente do Google Places. Por isso, endereço/localização podem ser utilizados; nome sozinho **nunca** define duplicidade. Filiais diferentes com nome igual e local distante não são sinalizadas.

## Segurança, limites e status

- O aviso é apenas visual e usa os dados de CRM já acessíveis ao usuário da sessão. Não é necessário alterar tabelas ou funções Supabase.
- Créditos agora usam correspondência verificada **também no backend**; aliases Google/Geoapify comprovados na mesma data têm custo incremental zero. Nomes parecidos ou dados insuficientes não recebem isenção automática.
- Importação via Maps habilitada no staging para Geoapify/OSM, com atribuição, e para Google por Place ID + nome cadastrado manualmente pelo usuário; detalhes da API Google não são persistidos. Veja `docs/maps-crm-import-cross-provider-credits-staging-20261108.md`.
- Mudanças feitas somente na branch de testes `feature/maps-one-click-auto-staging-20261108`; produção não alterada.
- Os testes `src/features/search-leads/identity.test.ts` cobrem nove casos, incluindo sentido inverso, filial diferente, nome igual sem prova, cidade/UF distinta e match Google/Geoapify. Devem ser executados pela pipeline Deno. Verificar prévia Vercel por SHA antes de homologar no navegador.
