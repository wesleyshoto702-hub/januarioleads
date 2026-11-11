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
| 6 | Histórico de objeções | Próxima |
| 7 | Gestão de projetos | Pendente |
| 8 | Metas e produtividade | Pendente |

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

Próxima implementação após validação: **Campanhas de Prospecção**.
