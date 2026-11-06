import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BETA_SIGNUP_CONFIG, requestBetaSignup } from "../lib/beta-registration";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Januário Leads — Acesso ao beta" },
      {
        name: "description",
        content: "Conheça como funcionará o cadastro e a ativação no beta do Januário Leads.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: BetaRegistrationPage,
});

function BetaRegistrationPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [acceptedTesting, setAcceptedTesting] = useState(false);
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const signupConfig = BETA_SIGNUP_CONFIG;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signupConfig || submitting || completed) return;
    setError("");
    if (password !== repeatPassword) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setError("Sua senha deve ter entre 12 e 128 caracteres.");
      return;
    }
    if (!acceptedTesting) {
      setError("Confirme que você está participando do teste beta.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await requestBetaSignup(signupConfig, email, password, window.location.origin);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCompleted(true);
      setPassword("");
      setRepeatPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="jl-beta-page">
      <header className="jl-beta-header">
        <Link to="/" className="jl-beta-brand" aria-label="Voltar para a página inicial">
          <span>J</span>
          Januário<strong>Leads</strong>
        </Link>
        <Link to="/login" className="jl-beta-header-link">Já tenho conta <ArrowRight size={16} aria-hidden="true" /></Link>
      </header>
      <div className="jl-beta-layout">
        <div className="jl-beta-intro">
          <span className="jl-beta-eyebrow"><Sparkles size={15} aria-hidden="true" /> PRÓXIMA ETAPA DO PRODUTO</span>
          <h1>Um jeito mais simples de começar a <em>prospectar.</em></h1>
          <p>
            Estamos preparando a abertura do Januário Leads para novos usuários.
            A experiência de cadastro, ativação e primeiro acesso está sendo construída por etapas.
          </p>
          <div className="jl-beta-points">
            <span><CheckCircle2 size={18} aria-hidden="true" /> Crie sua identidade no ambiente de teste</span>
            <span><Mail size={18} aria-hidden="true" /> Confirme seu e-mail</span>
            <span><ShieldCheck size={18} aria-hidden="true" /> Aguarde a ativação antes de usar o CRM</span>
          </div>
          <Link to="/" className="jl-beta-back"><ArrowLeft size={16} aria-hidden="true" /> Voltar ao início</Link>
        </div>
        <section className="jl-beta-card" aria-labelledby="beta-card-title">
          {!signupConfig ? (
            <>
              <span className="jl-beta-status">CADASTRO COMERCIAL EM PREPARAÇÃO</span>
              <h2 id="beta-card-title">O beta ainda está fechado.</h2>
              <p>
                Por enquanto, não estamos recebendo cadastros pela plataforma.
                O acesso continua sendo concedido por convite, e nenhum pagamento está disponível.
              </p>
              <div className="jl-beta-message">
                <LockKeyhole size={18} aria-hidden="true" />
                <span>Essa tela não cria contas nem envia dados ao Supabase de produção.</span>
              </div>
              <Link className="jl-beta-submit-link" to="/login">
                Entrar com uma conta existente <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </>
          ) : completed ? (
            <>
              <span className="jl-beta-success-icon"><CheckCircle2 size={26} aria-hidden="true" /></span>
              <h2 id="beta-card-title">Cadastro encaminhado.</h2>
              <p role="status">
                Se o e-mail informado puder ser cadastrado, você receberá as
                instruções de confirmação. Após confirmar, a liberação do CRM
                ainda depende de ativação pela equipe.
              </p>
              <Link className="jl-beta-submit-link" to="/login">
                Ir para o login <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </>
          ) : (
            <>
              <span className="jl-beta-status">CADASTRO BETA · AMBIENTE DE TESTE</span>
              <h2 id="beta-card-title">Crie sua conta de teste.</h2>
              <p>Esta etapa registra somente uma identidade. O acesso ao CRM depende de aprovação separada.</p>
              <form className="jl-beta-form" onSubmit={(event) => void submit(event)}>
                <label htmlFor="beta-email">E-mail</label>
                <input
                  id="beta-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={320}
                  placeholder="voce@exemplo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <label htmlFor="beta-password">Senha (mínimo de 12 caracteres)</label>
                <div className="jl-beta-password-row">
                  <input
                    id="beta-password"
                    type={visiblePassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={12}
                    maxLength={128}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    aria-label={visiblePassword ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setVisiblePassword((previous) => !previous)}
                  >
                    {visiblePassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
                <label htmlFor="beta-confirm-password">Confirmar senha</label>
                <input
                  id="beta-confirm-password"
                  type={visiblePassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  value={repeatPassword}
                  onChange={(event) => setRepeatPassword(event.target.value)}
                />
                <label className="jl-beta-check">
                  <input
                    type="checkbox"
                    checked={acceptedTesting}
                    onChange={(event) => setAcceptedTesting(event.target.checked)}
                    required
                  />
                  <span>Estou participando do teste beta e entendo que o cadastro não libera o CRM automaticamente.</span>
                </label>
                {error && <p className="jl-beta-error" role="alert">{error}</p>}
                <button className="jl-beta-submit" disabled={submitting} type="submit">
                  {submitting ? "Criando conta..." : "Cadastrar no ambiente de teste"}
                  {!submitting && <ArrowRight size={17} aria-hidden="true" />}
                </button>
                <small>Não utilize dados reais de clientes neste ambiente de teste.</small>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
