# Meus Leads — cartões espaçosos e emojis por nicho

## Implementação
A apresentação da carteira segue o mockup de linhas arredondadas e espaçosas, com colunas
**Lead | Cidade/UF | Contato | Status | Acompanhamento | Valor | Último contato | Ações**.
Cada lead mostra um emoji do nicho dentro de um quadrado verde-escuro, nome,
segmento, chance e observações. Todos os dados continuam vindo do CRM real.

O catálogo canônico de Buscar Leads contém **196 nichos em 16 grupos**. Cada nicho tem
um emoji explícito, definido em `src/features/leads/lead-niche-emoji.ts`, com cobertura
validada em `src/features/leads/lead-niche-emoji.test.ts`. Exemplos:
Academia 🏋️, Chaveiro 🔑, Barbearia 🧔, Design de Sobrancelhas 👁️,
Clínica Odontológica 🦷, Restaurante 🍽️ e Pet Shop 🐕‍🦺.

O resolvedor suporta maiúsculas/minúsculas, acentuação e aliases conhecidos
do catálogo (p.ex. Odontologia → Clínica Odontológica). Para leads manuais com
nichos históricos não reconhecidos, usa sinônimos claros ou o ícone neutro 🏢;
jamais inventa uma especialidade com base em um nome de empresa.

## Organização da carteira
- Linhas visivelmente mais altas, com largura mínima adequada. As colunas não
  são comprimidas até ficarem ilegíveis.
- O chip de status contém um seletor nativo acessível, preservando
  `Enviar mensagem | Aguardando | Aceito | Recusado` e a gravação de status
  existente. Não cria o status fictício `Ativo` da imagem ilustrativa.
- O texto **Aguardando há X dias** aparece **abaixo do status**, usando o
  cálculo já existente de último contato em horário de Brasília.
- O resumo de acompanhamento fica exclusivamente na coluna de próxima ação;
  mostra sugestão, ação salva ou ausência de ação, sem sobrepor o status.
- Favorito + Ver empresa ocupam o grupo superior; Mandar mensagem, Fazer
  follow-up (quando aplicável), Editar e Excluir ocupam o grupo inferior,
  com wrapping sem sobreposição e labels acessíveis.
- A coluna `Último contato` mostra a data do último contato. Se ele não tiver
  sido registrado, mostra o primeiro contato e rotula corretamente.
- Uma janela menor (até 1740 px de viewport) utiliza cartões responsivos em
  duas colunas para não comprimir a tabela atrás do menu. Até 830 px: uma coluna.
- O mesmo emoji aparece nos cartões móveis e no Kanban.

## O que não mudou
- A lista e os cartões compartilham os mesmos dados e ações do CRM.
- Não altera leads no banco, migrações, autenticação, Google Places,
  financeiro, favoritos, status, pagamento ou funcionalidades do Buscar Leads.
- Não reintroduz Buscar via Maps, Vercel ou chaves de mapa.

## Testes e limitações
- Teste Deno incluído no comando `npm test` (`deno test`) verifica
  cobertura de 196 nichos, aliases e categorias legadas.
- Revisão estática garante presença das seis ações existentes,
  status editável, acompanhamento separado, ícones nas três apresentações
  e layout responsivo.
- Compilação completa e teste autenticado no navegador **ainda precisam ser
  executados no projeto de destino** antes da publicação. Uma sincronização de
  commit com Lovable não garante compilação e não publica o site.

Checklist de homologação:
1. Confirmar emojis diferentes em academia/chaveiro/barbearia/sobrancelhas.
2. Conferir texto `Aguardando há X dias` abaixo do chip, sem sobreposição.
3. Alterar status pela seleção e confirmar persistência após recarregar.
4. Favoritar, abrir empresa, mandar mensagem, follow-up, editar e excluir.
5. Conferir o contato/primeiro contato e acompanhamento em cada linha.
6. Conferir cartões em telas menores e Kanban com emojis.
7. Executar `npm run typecheck`, `npm run build` e testes.
