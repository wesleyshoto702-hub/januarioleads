# Auditoria — confirmações de exclusão do Januário Leads

Data: 11/11/2026. Escopo: código do Workspace React, sem mutações no Supabase, sem executar ferramentas da Lovable.

## Problema observado

Várias telas chamavam `window.confirm(...)`. Essa função mostra um aviso do navegador, com aparência e textos de botões definidos pelo próprio navegador, fora da identidade visual do Januário Leads. Outras remoções apagavam itens diretamente, sem confirmação.

## Solução

`ConfirmActionProvider` é montado na raiz da aplicação e utiliza `@radix-ui/react-alert-dialog` já presente nas dependências. Suporta:

- Título e descrição específicos, com o nome do registro em destaque;
- Botões **Cancelar** e **Excluir/Remover**, ou confirmação de atenção para ações importantes sem exclusão;
- Visual escuro premium, botão destrutivo em vermelho, responsividade para celular;
- Modal acessível com teclado, foco restaurado ao controle original quando possível e **Esc como cancelamento**;
- Caso o componente seja desmontado durante uma decisão, a operação é cancelada;
- Só um pedido ativo por vez — cliques repetidos não aprovam uma exclusão silenciosamente.

**Nenhuma ação de exclusão é executada antes da resposta afirmativa à confirmação.**

## Inventário de ações substituídas ou protegidas

| Local | Ação | Situação |
| --- | --- | --- |
| Campanhas | Excluir campanha | Novo aviso |
| Sequências | Excluir modelo | Novo aviso |
| Sequências | Remover acompanhamento de um lead | Novo aviso |
| Sequências | Remover etapa do modelo | **Proteção adicionada** |
| Agenda | Excluir compromisso | Novo aviso |
| Projetos | Excluir projeto | Novo aviso |
| Projetos | Marcar projeto como entregue | Aviso de atenção, não destrutivo |
| Projetos | Remover tarefa | **Proteção adicionada** |
| Metas | Excluir meta | Novo aviso |
| Objeções | Excluir registro de objeção | Novo aviso |
| Propostas | Excluir proposta | Novo aviso |
| Propostas | Descartar edições não salvas | Aviso de atenção |
| Propostas | Marcar proposta aceita | Aviso de atenção |
| Propostas | Substituir conteúdo com modelo | Aviso de atenção |
| Propostas | Remover serviço do orçamento | **Proteção adicionada** |
| Propostas | Importar backup e acrescentar registros | Aviso de atenção |
| Configurações | Encerrar outras sessões | Aviso de atenção |
| Configurações | Remover chave local do Google Maps | Novo aviso |
| Histórico do lead | Excluir anotação | Novo aviso |
| Próxima ação do lead | Remover próxima ação | **Proteção adicionada** |

### Confirmações próprias já existentes e preservadas

- **Meus Leads:** excluir um lead já abria o modal próprio do CRM, com confirmação explícita.
- **Mensagens:** excluir um modelo já abria um `AlertDialog` próprio, e o registro era enviado à lixeira local.

A seleção/desseleção de participantes de campanhas, fechamento de um modal comum e filtros de busca não foram tratados como exclusões permanentes: essas operações continuam imediatas.

## Verificação

- Inspeção estática de todas as dez áreas alteradas concluiu que não restam chamadas `window.confirm` nelas.
- Verificado vínculo de cada função ao provider, importação do CSS na raiz, uso da biblioteca Radix, indicadores acessíveis de botões e layout responsivo.
- Três testes Playwright adicionados em `tests/browser/confirm-destructive-actions.spec.ts`, com Supabase completamente simulado. Eles cobrem: campanha (Cancelar/Esc/Excluir), proposta (Cancelar/Excluir) e tarefa de projeto (Cancelar/Remover).
- **Testes de navegador, TypeScript e build ainda precisam ser executados** devido à indisponibilidade anterior do GitHub Actions. Não declarar como homologado em produção até testar um build publicado.

Nenhuma regra RLS, migration, rotina de pagamentos, Google Maps API, chave de API ou dado real do usuário foi alterado.
