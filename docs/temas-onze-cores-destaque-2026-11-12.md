# Januário Leads — expansão para 11 cores de destaque

Data: novembro de 2026

## Cores disponíveis

| Nome na interface | Identificador | Cor principal |
| --- | --- | --- |
| Verde | `green` | `#34D399` |
| Amarelo | `yellow` | `#FACC15` |
| Azul | `blue` | `#60A5FA` |
| Vermelho | `red` | `#F12D46` |
| Branco | `white` | `#F2F3F6` |
| Preto grafite | `black` | `#C9CED6` |
| Roxo Ametista | `purple` | `#A78BFA` |
| Ciano Elétrico | `cyan` | `#22D3EE` |
| Laranja Âmbar | `orange` | `#FB923C` |
| Rosa Magenta | `pink` | `#F472B6` |
| Índigo Profundo | `indigo` | `#818CF8` |

## Implementação

- `src/features/settings/user-settings.ts`: tipo e lista de validação passam
  a aceitar onze valores, mantendo os anteriores e o padrão vermelho.
- `src/features/settings/SettingsView.tsx`: adiciona cinco opções na seção
  **Configurações → Aparência → Cor de destaque**.
- `src/features/settings/settings.css`: novas amostras correspondentes às
  variáveis de tema e uma grade responsiva para onze opções.
- `src/styles.css`: acrescenta cinco blocos
  `:root.dark[data-jl-accent="..."]` com tokens `--primary`,
  `--primary-hover`, `--primary-action`, `--primary-action-hover`,
  `--primary-soft`, `--primary-soft-strong` e `--primary-contrast`.
- `src/features/settings/user-settings.test.ts`: cobre os onze valores e
  continua rejeitando identificadores desconhecidos.
- `supabase/migrations/20261112031000_expand_workspace_accent_colors.sql`:
  atualiza a restrição CHECK da coluna `public.user_settings.accent_color`
  para permitir os cinco valores novos. A migração foi aplicada nos bancos
  original e de testes, sem apagar registros nem alterar permissões RLS.

## Comportamento

As telas já utilizam `var(--primary)` e tokens derivados; os componentes de
Meus Leads seguem a cor escolhida graças à implementação anterior. A seleção
é gravada na linha de configurações do usuário no Supabase e restaurada na
próxima sessão. Trocar o tema não implica alterar dados nem buscar leads.

Os fundos continuam escuros. Todas as cinco cores novas utilizam texto de
alto contraste para botões de destaque. O amarelo semântico de Aguardando, o
vermelho de Recusados e o dourado de Favoritos preservam seus significados.

## Verificação

- [x] Onze cores correspondentes no tipo, na lista da UI, no CSS e nos
  swatches da página Aparência.
- [x] Banco original e staging: restrição CHECK confirmada para onze cores.
- [x] Validação estática confirma manutenção das seis cores anteriores e do
  azul integrado `#60A5FA`.
- [x] Meus Leads continua usando `var(--primary)`.
- [ ] Executar teste Deno, typecheck e build no runner do projeto.
- [ ] Abrir a prévia e testar as onze cores, desktop e celular, salvando cada
  preferência e confirmando a persistência após recarregar.

A integração ao GitHub não substitui a homologação visual nem publica o site
automaticamente.
