# Autenticação unificada — Januário Leads

Implementada em 07/11/2026 para eliminar a antiga tela de entrada com duas colunas.

## Interface

- `/login` e `/cadastro` agora montam o **mesmo componente** `src/components/auth/UnifiedAuthPage.tsx`, dentro de um único cartão carmesim com `AuroraBackdrop`.
- A URL apenas seleciona a aba **inicial**: Entrar em `/login`, Criar conta em `/cadastro`. O usuário alterna entre as abas **sem navegar para uma página diferente**.
- `Entrar`: email, senha, mostrar/ocultar senha, validação e chamada existente `signIn`, seguida de navegação ao dashboard se autorizada.
- `Criar conta`: nome, email, senha, confirmação, solicitação via Supabase Auth (ou beta isolado) e feedback de cadastro enviado. Não adota qualquer token criado no signup.
- O topo mantém apenas **Januário Leads** em texto (sem símbolo decorativo), seguido de **"PROSPECÇÃO ORGANIZADA, DO PRIMEIRO CONTATO AO PRÓXIMO PASSO"**, sem cadeado ou emoji.
- Conteúdo compacto centralizado e responsivo. O antigo `AuthShell` de duas colunas e a folha `auth-identity.css` foram removidos; ambos os caminhos carregam somente `signup-crimson.css` e `aurora-backdrop.css`.

## Segurança e compatibilidade

- O controle de permissão `private_access`, com RLS no Supabase, permanece intacto.
- Não alteramos credenciais, a política de confirmação de e-mail, SMTP, projeto Supabase ou usuários cadastrados.
- O link existente da homepage para `/login` e os redirecionamentos de usuários anônimos para `/login` permanecem válidos.
- `VITE_HTTPONLY_SESSION` continua a permitir login com backend, mas não cadastro direto sem backend específico.
- Os testes de navegador foram atualizados para ambas as rotas, alternância local, ausência dos ícones, login e signup existentes, mobile e CSS isolado.
- A Vercel permanece despublicada; **GitHub integrado não é confirmação de deploy nem de testes em navegador real**.

## Verificação antes de disponibilizar

1. Abrir `/login` e confirmar aba Entrar; clicar Criar conta e verificar o mesmo cartão, sem mudança de URL.
2. Abrir `/cadastro` e confirmar aba Criar conta; clicar Entrar sem redirecionamento.
3. Fazer login com conta autorizada e verificar acesso ao CRM e botão Sair.
4. Registrar identidade em ambiente isolado e confirmar que não recebe acesso automático ao CRM.
5. Conferir em celular, no teclado e com preferências de movimento reduzido.
6. Antes do cadastro público, habilitar **confirmação de e-mail** no Supabase Auth e validar envio, confirmação e liberação individual.
