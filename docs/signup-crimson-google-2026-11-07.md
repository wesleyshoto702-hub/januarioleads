# Cadastro carmesim e acesso Google — 07/11/2026

## Interface implementada

Referência visual aprovada pelo responsável: mockup da tela "Criar conta" Januário Leads, adaptado da estrutura de cadastro da Clonefy **sem copiar identidade, logo ou textos comerciais de terceiros**.

- `/cadastro`: marca central, indicação de acesso seguro, abas Entrar/Criar conta, nome, e-mail, senha e confirmação, botão carmesim, botão Continuar com Google, navegação para login e nota de segurança.
- O fundo usa o componente `AuroraBackdrop` já empregado pela homepage e login, sem outro motor ou dependência de animação.
- Design responsivo em `src/styles/signup-crimson.css`, carregado somente em cadastro e retorno de Google.
- `/login` também tem link de criação de conta e opção Google.
- `/auth/retorno` conclui o código OAuth usando PKCE, valida a identidade e consulta a **autorização existente** antes de gravar a sessão.

## Funcionalidade de cadastro por e-mail

`src/lib/public-registration.ts` chama `POST /auth/v1/signup` com a chave **publicável**, nome apenas em `user_metadata.full_name`, e senha forte de 12–128 caracteres. Não armazena tokens retornados durante o cadastro e não faz nenhuma escrita em `private_access`.

Valida email, nome, senhas e origem do redirect, não transmite valores inválidos, não ecoa erros do backend que possam revelar se o e-mail existe, e trata limites de tentativas e falhas de rede. A confirmação por e-mail e a disponibilidade do endpoint dependem das configurações do Supabase Auth. Quando a confirmação por e-mail estiver desativada, uma sessão poderá ser retornada pelo servidor; ela não é adotada pelo frontend, e o usuário deverá entrar com suas credenciais após o cadastro.

**Cadastro de identidade ≠ acesso comercial:** o banco existente usa RLS de `private_access`, limitado ao próprio usuário `auth.uid() = user_id`. A função `acceptExternalSession` também exige essa mesma autorização e revoga o token de OAuth em caso de ausência. Nenhum mecanismo de auto-ativação do CRM foi implementado. Este fluxo **não** gera assinatura, cobrança nem concede dados privados.

## Integração Google

Implementado cliente OAuth com **PKCE S256** (verifier e challenge de criptografia aleatória), nonce por tentativa guardado em `sessionStorage`, redirecionamento local validado e troca única de código por tokens. A autenticação Google não pula a autorização do CRM.

Antes de redirecionar, o navegador consulta `/auth/v1/settings` para verificar se `external.google` está habilitado; se não estiver, mostra uma mensagem clara, sem redirecionar a uma tela de erro externa.

### Configuração externa obrigatória para funcionar no ar

1. No Google Auth Platform, configurar OAuth Consent Screen, branding, públicos e scopes básicos (`openid`, e-mail e perfil), registrar um OAuth **Web application** e obter Client ID/Client Secret.
2. Na página de [provedor Google do Supabase](https://supabase.com/dashboard/project/czkazbianiflhldenhcj/auth/providers), habilitar Google e informar os dados gerados. **Não inserir Client Secret no frontend, GitHub ou `VITE_*`.**
3. No OAuth Client do Google, autorizar o callback Supabase: `https://czkazbianiflhldenhcj.supabase.co/auth/v1/callback`.
4. Em Supabase Authentication → URL Configuration, permitir o domínio **real de publicação** e os redirects `https://<DOMINIO>/login` e `https://<DOMINIO>/auth/retorno?state=*` (usar padrão wildcard compatível com a URL allow list; verificar a configuração efetiva). Inclua localhost apenas para desenvolvimento.
5. Configurar confirmação de e-mail, SMTP com limite apropriado, política de senhas, CAPTCHA/limites de abuso quando abrir ao público e política de privacidade/termos publicados.
6. Testar cadastro, recebimento de e-mail, login, conta sem aprovação, conta aprovada, Google cancelado e bloqueios em mobile/desktop antes de divulgar.

**Limitação atual:** não foram habilitados provedores Google ou SMTP no projeto hospedado, nem enviada mensagem real ou criada uma conta real durante esta implementação. Não há domínio público funcional enquanto Vercel estiver despublicada.

**BFF experimental**: `VITE_HTTPONLY_SESSION=true` desabilita este cadastro direto e o botão Google; é necessária uma implementação específica de backend para manter tokens em cookies HttpOnly.

**Beta isolado**: quando `BETA_SIGNUP_CONFIG` está explicitamente configurado para staging, o formulário de e-mail mantém a chamada beta isolada; Google fica indisponível em staging para não misturar identidades de projetos.

## Fluxo público "Da pesquisa à rotina"

O modelo mantém a sequência Explore → Organize → Acompanhe, mas os conectores ficam apenas **entre os cards**, sem passar por trás das legendas. Ícones e texto estão alinhados verticalmente no mesmo eixo; em telas de até 900px o fluxo vira uma coluna com conectores verticais. A revelação de texto só começa após a conclusão do respectivo segmento. `prefers-reduced-motion` apresenta tudo sem animação.

## Testes

Atualizados Playwright para cadastro responsivo, validação de senha, chamada Auth simulada, não persistência de tokens em signup, Google desabilitado, fluxo PKCE com identidade sem autorização, links no login, alinhamento da linha sem sobrepor os textos. Testes unitários do novo módulo cobrem validação de dados e criação do challenge PKCE. Nenhum deles envia e-mail ou toca em usuários reais.

Referências: [Sign in with Google](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
