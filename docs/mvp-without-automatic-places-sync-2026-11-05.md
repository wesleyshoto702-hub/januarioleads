# Januário Leads — MVP comercial sem sincronização automática Google Places

Data: 05/11/2026

## Decisão

A versão comercial inicial não promete atualizações periódicas dos dados
públicos de todos os leads. O produto concentra-se em:

- Buscar empresas (ainda sujeito a franquias, limites e termos do Google Places).
- Salvar e gerenciar leads e oportunidades no CRM.
- Registrar status, tarefas, próximos contatos, mensagens e recebimentos.
- Mostrar atividade comercial e leads cadastrados recentemente.

## Ambiente de produção

A tarefa Supabase pg_cron `sync-leads-daily` foi mantida registrada,
mas desativada com `cron.alter_job(active := false)`. O resultado foi
confirmado com `select ... from cron.job`, retornando `active=false`.

O arquivo `scripts/disable-auto-places-sync.sql` documenta e reproduz a
operação em outros ambientes. **Não execute os migrations anteriores de
agendamento em um ambiente novo sem aplicar essa desativação após o setup.**

O código original de `supabase/functions/sync-leads/index.ts` fica
preservado para reavaliação futura; esta etapa não aciona a função.

## Experiência de produto

- O indicador do Dashboard passa a representar conexão do CRM com o
  armazenamento remoto, não um serviço de consulta automática ao Google.
- O resumo de atualizações externas dá lugar aos leads cadastrados recentemente.
- O painel de sincronização agendada é removido de Meus Leads.
- O carregamento de `lead_updates` exclui `sync_error` das listas
  comerciais, mantendo os eventos históricos intactos no banco.
- Leads novos passam a ser gravados com `auto_sync_enabled=false` por padrão.

## O que **não** foi removido

- Nenhum lead, status, pagamento, mensagem ou histórico foi excluído.
- CRM e armazenamento remoto continuam com sincronização de dados entre
  dispositivo e banco; isso não é a antiga consulta periódica ao Google.
- Buscar Leads, Oportunidades, Abertos Agora e enriquecimentos podem fazer
  consultas externas. **O orçamento do Google ainda depende de controlar
  todas as funcionalidades que utilizam a API**, e de verificar os termos
  de uso e armazenamento comercial dos dados.

## Para reintroduzir atualização de dados públicos

Só considerar depois de confirmar licenciamento, franquias gratuitas,
orçamento, limites por usuário e mecanismo de fila. Uma alteração do
`cron.job.active` sozinha não é suficiente para oferecer serviço
comercial estável: devem existir controle de custos, observabilidade
e plano de recuperação ante respostas 429.

## Verificação rápida

1. `select jobname, active from cron.job where jobname='sync-leads-daily';` deve retornar `false`.
2. Dashboard não deve anunciar periodicidade de oito horas.
3. Meus Leads deve continuar navegável e editável.
4. O histórico de dados da tabela `lead_updates` deve permanecer intacto.
