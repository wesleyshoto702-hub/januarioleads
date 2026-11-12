# Meus Leads — ações visíveis sem corte lateral

## Problema observado

A lista de Meus Leads forçava `min-width: 1270px` tanto no cabeçalho
quanto nas linhas, mesmo quando o espaço útil do navegador (descontando
menu lateral e margens) era inferior a esse valor. Isso fazia a última
coluna **Ações** ficar fora da área visível, cortando principalmente
`Ver empresa`, `Mandar mensagem`, `Fazer follow-up`,
favoritar, editar e excluir.

## Correção

Apenas o arquivo `src/features/leads/lead-portfolio-overview.css`
foi alterado. O painel `jl-portfolio-lead-panel` agora estabelece um
*CSS size container* chamado `jl-leads-table`, permitindo ajustar
as linhas à **largura real disponível no painel**, não apenas à largura
total da janela.

- **Largura útil acima de 1390 px:** mantém oito colunas horizontais
  como no layout aprovado.
- **Entre 1081 e 1390 px:** reorganiza cada lead em **uma única linha-card
  compacta com dois níveis de dados**, preservando todos os oito campos.
  A coluna Ações permanece na direita, ocupando a altura dos dois níveis
  com agrupamento de botões.
- **Entre 791 e 1080 px:** reorganiza cada lead em **três níveis
  compactos**, preservando os campos e as ações à direita.
- **Até 790 px de espaço disponível:** substitui a tabela pelo cartão
  móvel já existente em **uma única coluna**, com os mesmos botões e sem
  retomar os dois cartões grandes rejeitados na versão anterior.
- O cabeçalho é reorganizado junto com as linhas para manter rótulos e
  colunas alinhados.
- As informações usam o estado e os handlers já existentes: sem
  mudanças de funcionalidade, número de leads, integrações, Google,
  Supabase, favoritos ou temas. Os botões podem quebrar de linha **dentro**
  da coluna Ações, mas não somem no limite direito.

## Verificações recomendadas

1. Abrir Meus Leads com menu lateral aberto e inspecionar as ações no
   lado direito numa tela de 1280 px. Todos os botões devem estar
   visíveis, sem rolagem horizontal para alcançar o último.
2. Repetir em 1440 px, 1600 px, 1920 px, 1024 px e celular.
3. Conferir leads com status Aguardando e botões de follow-up, que
   aumentam o número de ações disponíveis.
4. Clicar em Favoritar, Ver empresa, Mandar mensagem, Fazer follow-up,
   Editar e Excluir, verificando os handlers originais.
5. Alternar entre os temas azul, verde, amarelo, vermelho, branco e
   grafite; as variáveis de cor devem continuar herdadas.
6. Testar Lista e Kanban sem alteração de dados.

Análise estática concluída: as oito áreas do grid aparecem em
todos os breakpoints; existem as oito legendas no cabeçalho; os seis
tipos de ações permanecem no JSX. Compilação e teste visual no navegador
ainda não foram executados.
