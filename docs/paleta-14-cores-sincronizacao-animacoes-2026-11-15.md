# Januário Leads — três novas cores e animações sincronizadas (15/11/2026)

## Paleta
As 11 cores existentes permanecem. Três novas opções completam **14**:
- Verde Turquesa: código `turquoise`, destaque **#14B8A6**
- Vinho Rubi: código `ruby`, destaque **#A83F65**
- Bronze Acetinado: código `bronze`, destaque **#B88A55**

O usuário escolhe em **Configurações → Aparência** e confirma ao salvar. A preferência continua por conta, protegida pelas regras RLS existentes, sem alterar contas alheias.

## Animações e interface
- Fundo de partículas em `WorkspaceAmbientParticles.tsx`: lê o token `--primary` após mudança de `accentColor` e redesenha usando a cor salva.
- Trajetórias de luz em `HeaderLightTrails.tsx`: `stopColor` e `stroke` usam `var(--primary)`, inclusive nas 14 variações de banner.
- Botões, bordas, indicadores e respectivos estados de hover, contraste e fundos suaves usam os novos tokens em `src/styles.css`.
- A animação continua somente após login e fora da barra lateral Workspace. Preservar opções de movimento reduzido.

## Configuração de banco — alteração aplicada e conferida
`public.user_settings.accent_color` possuía CHECK limitado aos 11 identificadores originais. Uma mudança apenas no frontend impediria salvar as novas cores. Foi aplicada somente a atualização transacional da CHECK constraint **user_settings_accent_color_check** nos dois projetos:
- Homologação: `prlrxjothrslhswpkoza`
- Produção: `czkazbianiflhldenhcj`

A consulta `pg_get_constraintdef` depois da atualização confirmou a lista de **14** valores em ambos. Não foram modificados registros, sessões, importadores ou tabelas de leads. A operação foi DDL executado diretamente e **não gerou migration rastreada**. Reconciliar com o histórico de migrations em uma tarefa isolada quando a auditoria geral de migrations estiver consistente. Não rodar migrações antigas ou duplicar esta constraint sem inspeção da estrutura atual.

## Validação
- PR #152.
- Testes de mapeamento das opções, persistência frontend, swatches, partículas e SVG compartilhando a mesma cor.
- Typecheck e build aprovados no workflow focado [43735939959](https://github.com/wesleyshoto702-hub/januarioleads/actions/runs/43735939959).
- Os workflows de fundo e banner também passaram. Um workflow independente de modo HttpOnly em homologação simulada apresentou falha; investigar separadamente.
- Não foi realizado teste autenticado de persistência com uma conta real nesta etapa; sem expor dados pessoais.
