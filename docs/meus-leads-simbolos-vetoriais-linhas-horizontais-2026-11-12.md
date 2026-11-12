# Meus Leads — símbolos por nicho e linhas horizontais

Data: 12/11/2026

## Objetivo
Correção após comparação da tela real com a imagem de referência aprovada.
A experiência desejada é uma **lista de linhas horizontais compactas**,
não uma grade de dois cartões altos.

## Implementação

- **Um lead por linha** no desktop. Mantém as oito colunas existentes:
  Lead, Cidade/UF, Contato, Status, Acompanhamento, Valor,
  Último contato e Ações.
- A tabela continua sendo horizontal nas janelas de desktop, com
  deslocamento horizontal quando a largura disponível é inferior ao
  mínimo legível de 1270 px, sem mudar para uma grade de dois blocos.
- Em smartphones (até 759 px) usa **uma única coluna** de cartões
  compactos, com as mesmas ações. Nunca usa a antiga grade 2×N.
- Reduz altura, espaçamento e a área de notas. Links longos de Google Maps
  são ocultados somente no resumo; as notas originais do CRM permanecem
  intactas para a visualização de detalhes.
- O texto "Aguardando há X dias" permanece **abaixo do status**.
  As sugestões/próximas ações continuam numa coluna própria.
- Preservados favorito, ver empresa, mensagem, follow-up, editar, excluir,
  select de status, histórico, chance, financeiro e dados de contato.

## Ícones vetoriais para os 196 nichos

- Substituídos **emojis de caracteres Unicode** por ícones profissionais
  de traço da biblioteca Lucide, todos na mesma cor verde e mesmo estilo
  da imagem de referência.
- `src/features/leads/lead-niche-symbol.ts` contém uma associação
  semântica explícita para **196/196 nichos** do catálogo canônico.
  Nichos correlatos podem compartilhar o símbolo apropriado, mas todos
  possuem uma escolha individual registrada.
- `LeadNicheIcon.tsx` renderiza um símbolo vetorial acessível em
  Lista, cartões móveis e Kanban, com a mesma aparência e sem depender
  de fontes de emoji do dispositivo.
- Exemplos: Academia → Dumbbell, Chaveiro → KeyRound, Barbearia → Scissors,
  Design de Sobrancelhas → Flower2, Clínica Odontológica → Smile.
- Aliases históricos são resolvidos pelo catálogo existente; rótulos
  desconhecidos têm um símbolo neutro Building2.
- Checagem das **112 importações de ícones** realizada contra a árvore de
  ícones da versão oficial Lucide `0.575.0`: nenhuma ausente.
- `lead-niche-symbol.test.ts` valida os 196 nichos e aliases antigos.
  O teste foi incluído no script de testes padrão.

## O que NÃO foi alterado

Não houve mudanças no Supabase, nas Edge Functions, no Google Places, no
Buscar Leads original, nos favoritos persistidos, nas funções de cobrança,
em senhas, credenciais ou nas regras do CRM.

## Homologação
1. Visualizar Meus Leads em largura grande: uma linha por lead, 8 colunas.
2. Em largura média: tabela ainda horizontal, com scroll horizontal.
3. Em celular: apenas uma coluna de cartões curtos.
4. Conferir símbolos: academia (peso), chaveiro (chave),
   sobrancelhas (flor de traço), barbearia (tesoura).
5. Confirmar que notas extensas e URLs não alongam os cartões,
   mas podem ser acessadas no detalhe do lead.
6. Testar status, espera, ações, favoritos, Kanban e filtros.
7. Executar typecheck, build e testes no runner disponível antes de
   afirmar homologação visual em produção.

Código e sincronização com Lovable podem ser confirmados no GitHub;
a execução de build na Lovable depende de ambiente próprio.
