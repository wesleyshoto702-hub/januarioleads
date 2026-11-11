# Favoritos em Meus Leads — 11/11/2026

## Comportamento
- Em **Meus Leads**, cada lead salvo recebe um botão pequeno sem rótulo visível: marcador amarelo/dourado com estrela, inspirado na imagem de referência enviada.
- Clique uma vez: marca como favorito; clique novamente: remove dos favoritos.
- O botão expõe `aria-label` e `aria-pressed` para leitores de tela.
- Aparece nas linhas do desktop, nos cartões móveis e no Kanban.
- O seletor **Todos os leads | ⭐ Favoritos (N)** no topo da carteira reúne os leads marcados.
- Ao selecionar Favoritos, filtros antigos de cidade, status, busca etc. são limpos para mostrar a coleção completa, com paginação progressiva existente.
- Caso não haja favoritos, um estado vazio explica como usá-los.
- Os favoritos são propriedade dos leads já cadastrados, não dos resultados temporários da pesquisa.

## Persistência e segurança
- Uma única coluna nova `public.leads.is_favorite boolean NOT NULL DEFAULT false`, sem tabela adicional.
- O tipo `PersistedLead` contém `isFavorite?: boolean` para aceitar dados locais legados.
- Conversão REST: `isFavorite` ↔ `is_favorite`.
- O botão reutiliza `updateLeadLocally` e `persistLeadChange`, com a fila offline existente `enqueueLead` e `flushPendingLeads`.
- Estado da marcação é armazenado no Supabase por usuário; políticas RLS existentes em `public.leads` continuam protegendo a propriedade dos registros.
- Não altera SearchLeadsView, Google Places, API de Maps, quotas, finanças, lead activities ou dados dos clientes.
- Ao excluir um lead, seu favorito é excluído junto com a própria linha, sem dados órfãos.
- Backfill de todos os leads existentes como **não favoritos**, que é o comportamento esperado para um recurso novo.

## Homologação recomendada
1. Abrir Meus Leads e confirmar o marcador dourado em uma linha.
2. Favoritar um lead e confirmar `⭐ Favoritos (1)`.
3. Ativar Favoritos e ver somente o lead marcado; remover a marcação e confirmar que desaparece.
4. Alternar para o Kanban e testar favoritar/desfavoritar um cartão.
5. Recarregar a página, entrar com a mesma conta em outro navegador e verificar sincronização.
6. Testar duas contas distintas: nenhuma pode ver ou alterar favoritos da outra, graças ao RLS.
7. Testar sem conexão e reconectar: mutação pendente deve ser sincronizada pela fila existente.
8. Rodar `bun run typecheck` e `bun run build` quando o runner estiver disponível.

Banco original e staging: migração aplicada. Testes de compilação/ navegador ainda precisam ser executados em ambiente com dependências do projeto.
