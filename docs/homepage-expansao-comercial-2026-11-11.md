# Homepage — apresentação da expansão comercial

Data: 11 de novembro de 2026.

## Objetivo

Atualizar a homepage existente sem acrescentar novas seções, preservando o hero animado e a identidade visual dark/aurora. O conteúdo agora reflete os oito recursos comerciais criados para o uso pessoal e a futura liberação pública do Januário Leads.

## Mudanças

1. **Hero:** comunica a busca e o acompanhamento da jornada comercial, não apenas pesquisa de empresas. A animação `SearchDemo` permanece intacta.
2. **Como funciona:** o tour existente foi ampliado de quatro para seis cenas. As duas novas cenas ilustram análise técnica de site com preparação de proposta e o acompanhamento de campanhas/sequências/agenda/projetos/metas. Conteúdo fictício, sem rede ou operações reais. Cada etapa do tour agora é selecionável por mouse ou teclado, reiniciando o contador automático.
3. **Trilha de trabalho:** descrição ajustada para incluir propostas e entregas, mantendo a mesma seção de três fundamentos.
4. **Funcionalidades:** o explorador original de seis módulos agora oferece dois grupos dentro da mesma seção:
   - *Prospecção e CRM*: Dashboard, Meus Leads, Buscar Leads, Oportunidades, Mensagens, Financeiro.
   - *Gestão Comercial*: Análise Digital, Propostas, Campanhas, Sequências, Agenda, Objeções, Projetos, Metas.
5. **Spotlight e comparação:** mais contexto do processo de análise, proposta e entrega, sem promessas de automação.
6. **FAQ e metadados:** explicações sobre funções novas, cadastro, autorização de acesso e disponibilidade limitada do Maps. `/produto` permanece apontando para a mesma homepage.

## Limites comerciais explícitos

- O tour **não realiza consultas a Google Maps, PageSpeed nem ao Supabase**.
- `Buscar via Maps` continua privado, restrito ao proprietário no Workspace; **não é anunciado como função geral pública**.
- Cadastro não concede acesso automático. As funcionalidades novas ainda dependem de autorização e validação de funcionamento e publicação.
- WhatsApp, criação de propostas, aceite, cobrança e envio de relatórios **não são descritos como automáticos**.
- Métricas simuladas não são apresentadas como resultados reais, percentuais ou benefícios comprovados.

## Verificação pendente

- Quatro cenários Playwright adicionados para alternância de módulos, cenas acessíveis do tour, clareza de acesso e overflow em 360 px.
- Inspeção estática de integridade dos módulos, conteúdo comercial, CSS responsivo e alterações exclusivas da homepage.
- TypeScript, build, Playwright e teste visual real do site publicado **ainda precisam ser executados** em ambiente funcional. Não tratar um merge como comprovação de deploy.

Nenhuma alteração em Auth, CRM, Supabase, Google Maps, tabelas, preços ou configurações da Lovable.
