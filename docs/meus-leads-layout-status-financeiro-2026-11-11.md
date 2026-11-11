# Meus Leads — reorganização visual conforme mockup aprovado

Data: 11/11/2026

## Alteração visual

A tela original `Meus Leads` foi reorganizada na ordem:

1. Cabeçalho original (carteira comercial + Novo lead).
2. **Barra de pesquisa e filtros** em superfície única horizontal, adaptável para telas menores.
3. **Status dos leads** com cinco cards (Todos, Enviar mensagem, Aguardando, Aceitos e Recusados), ícone, número e destaque verde no filtro ativo.
4. Painéis separados e lado a lado de **Acompanhamento** (Todas as ações, Ações para hoje, Follow-up, Atrasadas) e **Financeiro** (Todos, Pendente, Parcial, Pago). Para telas menores, os painéis se empilham.
5. Controle **Todos os leads / Favoritos** preservado e **Lista / Kanban** isolado à direita.
6. Tabela com os oito títulos originais e a visualização móvel/kanban preservadas.

O painel `Importar / exportar contatos próprios`, com botões CSV e texto explicativo, foi removido da renderização de Meus Leads. O componente isolado `ManualLeadTransfer.tsx` e o manipulador `importManualLeads` específico da página foram removidos. **Novo lead**, Meus Leads, busca, filtros, cards de empresas e cadastro via `Buscar Leads` continuam preservados.

## Comportamento e dados

- Os novos cards continuam filtros ativos e reutilizam `statusFilter`, `actionFilter`, `financialFilter`, `actionCounts`, `financialOverview`, `counts` e `visibleLeads`; números **não são estáticos**.
- Se o carregamento financeiro falhar, os filtros financeiros dependentes são desabilitados com `—`, e a mensagem de erro existente permanece. Não se apresentam zeros falsos como se fossem dados confirmados.
- O resumo anterior de faturamento do mês e valores a receber foi removido **somente desta tela**, não do armazenamento nem das rotinas de financeiro/CRM. A seção Financeiro segue com suas informações financeiras.
- A origem dos leads, permissões por conta, favoritos, fila de sincronização e Banco Supabase permanecem inalterados.
- O mockup usa tons verde-água, cards escuros e contornos suaves, implementados no CSS separado `lead-portfolio-overview.css`, carregado por último no workspace para evitar conflitos com estilos antigos.

## Verificação recomendada

- [ ] Carregar Meus Leads no desktop e no celular: conferir ausência de CSV e novo layout.
- [ ] Clicar em cada status, ação e condição financeira e conferir lista e contadores.
- [ ] Selecionar favoritos: preservar filtro e ações de favoritar/desfavoritar.
- [ ] Alternar Lista e Kanban; abrir, editar e salvar um lead.
- [ ] Confirmar responsividade em 1440px, 1180px, 740px e 375px.
- [ ] Se dados financeiros não puderem carregar, conferir ausência de valores falsos.
- [ ] Executar `bun run typecheck`, `bun run build` e testes visuais no projeto sincronizado antes de publicar.

A alteração NÃO modifica SQL, Edge Functions, Google Places, sincronização CRM nem o recurso Buscar Leads. Publicação e compilação na Lovable são etapas separadas da integração ao GitHub.
