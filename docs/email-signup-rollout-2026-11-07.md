# Cadastro por e-mail — Januário Leads

Atualizado em 07/11/2026. Substitui o experimento anterior de cadastro via Google OAuth.

## O que mudou

- O login público `/login` exibe somente **e-mail e senha**.
- `/cadastro` foi restaurado com **nome, e-mail, senha e confirmação**, preservando a aurora carmesim.
- Removidos botões Google, verificação do provedor, PKCE, troca de códigos OAuth, callback `/auth/retorno` e estilos específicos do Google do aplicativo.
- O cadastro envia `POST /auth/v1/signup` com a chave **publicável** do Supabase, redirecionando para a página `/login` quando um e-mail de confirmação é utilizado.
- A resposta **nunca** grava automaticamente access/refresh tokens. Erros não exibem se um endereço já está cadastrado. Há validação de origem, nome, e-mail e tamanho da senha.
- `BETA_SIGNUP_CONFIG`, quando habilitado explicitamente, continua usando apenas o projeto staging separado, sem dar acesso ao CRM.

## Requisitos de segurança no Supabase

O frontend por si só **não pode obrigar a confirmação de e-mail**. Antes de habilitar cadastro público, revise:

1. Em [Supabase Auth Providers](https://supabase.com/dashboard/project/czkazbianiflhldenhcj/auth/providers), habilite **Email** e permita **novos cadastros por e-mail**. Se essa opção ficou desativada durante o experimento com Google, reative-a.
2. **Ative Confirm email / confirmação de e-mail**, para que ninguém consiga usar a conta sem provar a posse do endereço. A configuração é do provedor Auth do Supabase, não um atributo que o formulário pode garantir.
3. Em [URL Configuration](https://supabase.com/dashboard/project/czkazbianiflhldenhcj/auth/url-configuration), mantenha o domínio real do aplicativo e autorize `https://hello-friend-ever.lovable.app/login` como retorno de confirmação. Adicione URLs locais apenas para desenvolvimento quando necessário.
4. Verifique o envio de e-mails de confirmação e a limitação de envio/SMTP, principalmente antes de abrir cadastros para muitos visitantes.
5. Se o Google não será usado por ninguém, desabilite manualmente **Google** em Supabase Authentication → Providers. **O código de login Google foi retirado do app, mas o conector disponível não oferece edição administrativa dos provedores.** Não exclua usuários existentes.

**Identidade Auth não concede acesso ao CRM:** o login permanece protegido pela tabela `private_access` e seu RLS. Contas criadas não recebem autorização automaticamente. Essa liberação precisa ter um processo próprio quando o produto passar a aceitar clientes.

## Contas antigas e publicação

- Usuários que já têm senha continuam acessando normalmente.
- Usuários cadastrados **somente via Google** podem precisar definir uma senha pelo fluxo de recuperação/atendimento antes de usar o login com e-mail. Não migrar credenciais automaticamente e nunca armazenar senhas em texto simples.
- O site na Vercel permanece despublicado, sem mudanças.
- Testes automatizados cobrem form, validações, ausência do botão Google e não persistência de tokens. Confirmar a execução em CI e fazer testes reais de e-mail em staging antes de produção.

Documentação oficial: [Password-based Auth](https://supabase.com/docs/guides/auth/passwords) e [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
