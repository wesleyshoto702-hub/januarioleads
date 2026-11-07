import { SIGNUP_STYLES } from "../lib/route-styles";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, BarChart3, CheckCircle2, Eye, EyeOff,
  Loader2, LockKeyhole, Mail, ShieldCheck, UserRound, UserRoundPlus,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { AuroraBackdrop } from "../components/marketing/AuroraBackdrop";
import { BETA_SIGNUP_CONFIG, requestBetaSignup } from "../lib/beta-registration";
import { requestPublicSignup, prepareGoogleOAuth } from "../lib/public-registration";
import { USE_HTTPONLY_SESSION } from "../lib/supabase-config";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    links: [...SIGNUP_STYLES],
    meta: [
      { title: "Criar conta | Januário Leads" },
      { name: "description", content: "Crie sua identidade no Januário Leads com e-mail ou Google. A liberação do CRM é realizada separadamente." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: RegistrationPage,
});

function RegistrationPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || completed) return;
    setError("");
    if (name.trim().length < 2) {
      setError("Informe seu nome completo.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (password.length < 12 || password.length > 128) {
      setError("A senha deve ter entre 12 e 128 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const result = BETA_SIGNUP_CONFIG
        ? await requestBetaSignup(BETA_SIGNUP_CONFIG, email, password, window.location.origin)
        : await requestPublicSignup(name, email, password, window.location.origin);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setCompleted(true);
      setPassword("");
      setConfirm("");
    } catch {
      setError("Não foi possível concluir o cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    if (googleLoading) return;
    setError("");
    if (BETA_SIGNUP_CONFIG || USE_HTTPONLY_SESSION) {
      setError("O Google não está disponível no ambiente de teste ou no modo de sessão do servidor.");
      return;
    }
    setGoogleLoading(true);
    try {
      const result = await prepareGoogleOAuth(window.location.origin, sessionStorage);
      if (!result.ok || !result.url) {
        setError(result.ok ? "Não foi possível abrir o Google." : result.message);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("Não foi possível iniciar o Google. Verifique a configuração do provedor.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <main className="jl-auth-shell jl-signup-page">
      <AuroraBackdrop />
      <div className="jl-signup-container">
        <Link to="/" className="jl-signup-brand" aria-label="Januário Leads — página inicial">
          <span className="jl-signup-brand-mark"><BarChart3 size={25} aria-hidden="true" /></span>
          <span>Januário <strong>Leads</strong></span>
        </Link>
        <span className="jl-signup-safe-badge"><LockKeyhole size={13} aria-hidden="true" /> Acesso seguro à plataforma</span>

        <section className="jl-signup-card" aria-label="Crie sua conta no Januário Leads">
          <nav className="jl-signup-tabs" aria-label="Autenticação">
            <Link to="/login">Entrar</Link>
            <span aria-current="page">Criar conta</span>
          </nav>

          {completed ? (
            <div className="jl-signup-complete">
              <span className="jl-signup-complete-icon"><CheckCircle2 size={30} aria-hidden="true" /></span>
              <h1>Confira seu e-mail</h1>
              <p role="status">Se o endereço puder ser cadastrado, você receberá as instruções de confirmação. A ativação do CRM acontece separadamente.</p>
              <Link className="jl-signup-primary" to="/login">Ir para acessar conta <ArrowRight size={18} aria-hidden="true" /></Link>
            </div>
          ) : (
            <>
              <div className="jl-signup-intro">
                <UserRoundPlus size={25} aria-hidden="true" />
                <div>
                  <h1>Crie sua conta no Januário Leads</h1>
                  <p>Comece a prospectar, organizar e acompanhar seus leads em um só lugar.</p>
                </div>
              </div>

              <form className="jl-signup-form" onSubmit={(event) => void submit(event)}>
                <label className="jl-signup-field">
                  <span>Nome</span>
                  <div className="jl-signup-control">
                    <UserRound size={17} aria-hidden="true" />
                    <input type="text" name="name" autoComplete="name" required minLength={2} maxLength={100}
                      placeholder="Seu nome completo" value={name} onChange={(event) => setName(event.target.value)} />
                  </div>
                </label>
                <label className="jl-signup-field">
                  <span>E-mail</span>
                  <div className="jl-signup-control">
                    <Mail size={17} aria-hidden="true" />
                    <input type="email" name="email" autoComplete="email" maxLength={320} required
                      placeholder="seuemail@empresa.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </div>
                </label>
                <label className="jl-signup-field">
                  <span>Senha <small>· mínimo de 12 caracteres</small></span>
                  <div className="jl-signup-control">
                    <LockKeyhole size={17} aria-hidden="true" />
                    <input type={showPassword ? "text" : "password"} name="password" autoComplete="new-password"
                      required minLength={12} maxLength={128} placeholder="Crie uma senha forte"
                      value={password} onChange={(event) => setPassword(event.target.value)} />
                    <button className="jl-signup-eye" type="button"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShowPassword((current) => !current)}>
                      {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                    </button>
                  </div>
                </label>
                <label className="jl-signup-field">
                  <span>Confirmar senha</span>
                  <div className="jl-signup-control">
                    <LockKeyhole size={17} aria-hidden="true" />
                    <input type={showConfirm ? "text" : "password"} name="confirmPassword" autoComplete="new-password"
                      required minLength={12} maxLength={128} placeholder="Repita sua senha"
                      value={confirm} onChange={(event) => setConfirm(event.target.value)} />
                    <button className="jl-signup-eye" type="button"
                      aria-label={showConfirm ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                      onClick={() => setShowConfirm((current) => !current)}>
                      {showConfirm ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                    </button>
                  </div>
                </label>

                {error && <p className="jl-signup-error" role="alert">{error}</p>}
                <button className="jl-signup-primary" type="submit" disabled={loading || googleLoading || USE_HTTPONLY_SESSION}>
                  {loading ? <Loader2 size={19} className="jl-auth-spinner" aria-hidden="true" /> : null}
                  {loading ? "Criando conta..." : "Criar conta"}
                  {!loading && <ArrowRight size={18} aria-hidden="true" />}
                </button>
              </form>

              {USE_HTTPONLY_SESSION && <p className="jl-signup-notice">Cadastro indisponível neste modo de sessão. Configure o backend antes de abrir inscrições.</p>}
              <div className="jl-signup-divider"><span>Ou continue com</span></div>
              <button type="button" className="jl-signup-google" onClick={() => void googleLogin()}
                disabled={loading || googleLoading || USE_HTTPONLY_SESSION || Boolean(BETA_SIGNUP_CONFIG)}>
                <span className="jl-google-g" aria-hidden="true">G</span>
                {googleLoading ? "Conectando..." : "Continuar com Google"}
              </button>
              <p className="jl-signup-login-prompt">Já tem uma conta? <Link to="/login">Acessar conta</Link></p>
            </>
          )}

          <div className="jl-signup-security">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>Conexão criptografada. O acesso ao CRM depende de autorização separada.</span>
          </div>
        </section>
        <Link to="/" className="jl-signup-home-link">Voltar ao Januário Leads</Link>
      </div>
    </main>
  );
}
