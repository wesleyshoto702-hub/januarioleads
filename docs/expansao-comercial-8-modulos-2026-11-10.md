# Januário Leads — Pacote de expansão comercial (8 módulos)

Data: 10/11/2026. Desenvolvimento por módulos independentes no GitHub; sem ações que consumam créditos da Lovable.

## Sequência aprovada

| Etapa | Módulo | Situação |
|---|---|---|
| 1 | Analisador de presença digital | Implementado no código principal (PR #110); validar no navegador |
| 2 | Gerador de propostas comerciais | Implementado nesta branch; validar no navegador |
| 3 | Campanhas de prospecção | Implementada no código principal (etapa 3/8); validar no navegador |
| 4 | Sequências de prospecção | Implementada no código principal; validar no navegador |
| 5 | Agenda comercial | Implementada no código principal; validar no navegador |
| 6 | Histórico de objeções | Implementado no código principal; validar no navegador |
| 7 | Gestão de projetos | Implementada no código principal; validar no navegador |
| 8 | Metas e produtividade | Implementada no código principal; validar no navegador |

## Módulo 2 — Propostas comerciais

Esta etapa **não é uma plataforma pública de propostas nem um gateway de pagamento**. Ela oferece um editor para a conta autenticada com:

- Propostas vinculadas por ID ao lead já existente ou propostas avulsas;
- Modelos iniciais para site institucional, landing page e manutenção, sem valores fictícios;
- Responsável, cliente, apresentação, escopo, itens com quantidade/preço, total em BRL, prazos, validade, condições e observações;
- Estados manuais `draft`, `sent`, `accepted`, `rejected`. Nenhum estado envia mensagem, gera fatura, muda o status de um lead ou lança recebimentos;
- Revisão incrementada ao salvar alterações de conteúdo, número de proposta estável, copiar, editar e excluir;
- Prévia A4 em tempo real. O botão **Imprimir / Salvar PDF** abre o diálogo nativo do navegador; o usuário seleciona o destino PDF;
- Uso opcional dos resultados **reais e recentes** do PageSpeed guardados na conta do navegador (não cria diagnósticos automaticamente nem inventa resultados);
- Persistência local isolada por conta em `accountLocalStorage`, recuperação temporária da edição corrente em `accountSessionStorage` e exportação/importação manual JSON com checagem de formato e IDs duplicados.

### Limitações explícitas

- A sincronização entre dispositivos **não existe**. Propostas salvas permanecem apenas no navegador onde foram criadas. O usuário deve exportar backup JSON para recuperar dados editáveis ou imprimir PDF para apresentar ao cliente.
- Impressão PDF depende do navegador e da escolha manual do destino. Não é anexada nem transmitida automaticamente.
- Não há assinatura eletrônica, aceitação digital do cliente, links públicos, envio por e-mail/WhatsApp ou cobrança.
- Não usar valores das propostas como pagamentos reais nem alterar `lead_payments`.
- Evitar inserir segredos nos campos; os documentos podem conter informações comerciais que requerem guarda privada.
- Não houve DDL, migrações, políticas RLS ou nova Edge Function no Supabase, pela pendência conhecida de conciliação de migrações e backup/restore antes de novas mudanças em produção.

### Para o lançamento público futuro

Somente após revisão de schema, backup/restauração e homologação com contas fictícias, criar entidades `proposals` e `proposal_items` no backend com `user_id`, permissões RLS de propriedade, revisão/versionamento, limites validados no servidor, auditoria de mudanças, segurança de exportação e eventual fluxo de aceite. Propostas não devem depender do localStorage para usuários pagantes.

### Critérios mínimos de aceite da entrega atual

- A navegação apresenta **Propostas** no desktop e no mobile;
- Editar uma proposta não altera dados financeiros dos leads nem os dados deles;
- Criar, salvar, selecionar, editar, duplicar, excluir, importar e exportar funcionam sem cruzar dados de contas;
- O total usa aritmética de centavos; modelos começam com preço zero; estados não efetuam ações externas;
- Imprimir oculta o Workspace, preserva somente o papel A4 e não inclui botões;
- Testes de tipos, build, navegadores e impressão ainda precisam rodar em ambiente com runner disponível.

Próximo passo: executar build, testes Deno e homologação visual. As seis etapas seguintes foram integradas em PRs sequenciais #112 a #117.

## Entregas sequenciais — módulos 3 a 8

- **3. Campanhas (#112):** criação por objetivo/meta, associação de IDs de leads existentes, progresso e status reais do CRM, arquivamento, seleção de participantes, exportação de backup JSON. Não altera o CRM.
- **4. Sequências (#113):** modelos com até 12 etapas, atrasos a partir do início, escolha de mensagens cadastradas, início/pausa de acompanhamento, conclusão manual, cópia de texto personalizada para o lead. Nenhum envio automático, nenhuma consulta paga.
- **5. Agenda (#114):** calendário mensal/semanal/diário, compromissos pessoais com data, hora e link opcional ao lead, leitura agregada de `nextActionDate` do CRM e próximas etapas das sequências. Apenas os compromissos pessoais podem ser concluídos nesta tela; ações de CRM e sequências são editadas nas áreas de origem.
- **6. Objeções (#115):** formulário e histórico por lead na ficha já existente, categoria, observação, data opcional de retorno, resolução manual e exclusão. Agregação real de motivos em Informações de Prospecção, com filtro por nicho.
- **7. Projetos (#116):** Kanban das fases (briefing, planejamento, desenvolvimento, revisão, entregue, pausado), tarefas marcáveis, progresso por checklist, data estimada, briefing, vínculo a lead/proposta aceita e atalhos para Financeiro/Propostas. Marcar entrega não registra pagamento.
- **8. Metas (#117):** configuração semanal/mensal no Dashboard com contagem por datas reais de criação de leads, propostas e compromissos e data de entrega de projetos; objetivos personalizados por indicador, sem previsões inventadas.
- **Navegação:** novas ferramentas agrupadas em **Gestão Comercial** recolhível no desktop/mobile, mantendo Mensagens, CRM, Financeiro e restante do menu existentes.

### Persistência e liberação comercial

As seis novas funções foram implementadas como **MVPs de uso pessoal**, com armazenamento por conta no mesmo navegador (`accountLocalStorage`). Isso NÃO oferece sincronização automática entre aparelhos, retenção garantida após limpar cache, acesso compartilhado por equipe, logs auditáveis no servidor, cotas por conta em produção ou isolamento RLS provado para esses módulos.

Antes do lançamento comercial, os dados devem migrar para um esquema Supabase revisado e testado em staging, com RLS por proprietário e equipe, backup/restauração, auditoria de migrações, validação de licenças de APIs e proteção de custos. A produção não recebeu DDL, alteração de autenticação ou cobrança nesta expansão.

### Verificação restante

Os testes Deno foram escritos para as funções puras. A inspeção estática de imports, fluxos, integração e conteúdo do GitHub não substitui a execução de TypeScript, build, Playwright, teste visual, impressão ou testes de isolamento real. GitHub Actions segue falhando antes da execução dos steps devido a indisponibilidade/franquia do runner; não declarar testes aprovados enquanto esses gates não rodarem.

### Compatibilidade

- Cinco telas premium e o menu existente são preservados; o componente de metas é adicionado abaixo do Dashboard original.
- Mensagens continuam manuais. Sequências não simulam envio, confirmação de WhatsApp ou respostas recebidas.
- Google Maps e seus limites/chaves permanecem independentes deste pacote.
- Propostas, projetos e campanhas **não** atualizam o Financeiro sem ação explícita no módulo Financeiro.
