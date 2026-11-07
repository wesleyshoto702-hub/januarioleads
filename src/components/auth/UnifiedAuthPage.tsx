import { useNavigate, Link } from "@tanstack/react-router";
import {
  ArrowRight, CheckCircle2, Eye, EyeOff, Loader2,
  LockKeyhole, Mail, ShieldCheck, UserRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AuroraBackdrop } from "../marketing/AuroraBackdrop";
import { getValidSession, signIn } from "../../lib/auth";
import { BETA_SIGNUP_CONFIG, requestBetaSignup } from "../../lib/beta-registration";
import { requestPublicSignup } from "../../lib/public-registration";
import { USE_HTTPONLY_SESSION } from "../../lib/supabase-config";

export type AuthMode = "login" | "signup";

/**
 * Both public routes render this exact card, with a different initial tab.
 * Switching Entrar/Criar conta changes form content locally, never the page.
 * The existing private_access check in signIn remains the CRM gatekeeper.
 */
export function UnifiedAuthPage({ initialMode }: { initialMode: AuthMode }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Do not block the card's first render while checking an existing session.
    let active = true;
    void getValidSession().then((session) => {
      if (active && session) void navigate({ to: "/app" });
    }).catch(() => {
      // Offline or expired sessions must not block a manual sign-in attempt.
    });
    return () => { active = false; };
  }, [navigate]);

  function selectMode(next: AuthMode) {
    if (busy || mode === next) return;
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
    setShowPassword(false);
    setShowConfirm(false);
    setCompleted(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || completed) return;
    setError("");
    setBusy(true);
    try {
      if (mode === "login") {
        const result = await signIn(email.trim(), password);
        if (!result.ok) {
          setError(result.message);
          return;
        }
        await navigate({ to: "/app" });
        return;
      }

      if (name.trim().length < 2) {
        setError("Informe seu nome.");
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
      setError(mode === "login"
        ? "Não foi possível conectar. Verifique sua conexão e tente novamente."
        : "Não foi possível solicitar sua conta. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="jl-auth-shell jl-signup-page jl-unified-auth">
      <AuroraBackdrop />
      <div className="jl-signup-container">
        <Link to="/" className="jl-signup-brand" aria-label="Januário Leads — página inicial">
          <span>Januário <strong>Leads</strong></span>
        </Link>
        <span className="jl-signup-safe-badge">PROSPECÇÃO ORGANIZADA, DO PRIMEIRO CONTATO AO PRÓXIMO PASSO</span>

        <section className="jl-signup-card" aria-label="Entrar ou criar conta no Januário Leads">
          <div className="jl-signup-tabs" role="tablist" aria-label="Acesso à conta">
            <button
              type="button"
              role="tab" id="jl-auth-tab-login" aria-controls="jl-auth-panel"
              className={mode === "login" ? "active" : undefined}
              aria-selected={mode === "login"}
              disabled={busy}
              onClick={() => selectMode("login")}
            >Entrar</button>
            <button
              type="button"
              role="tab" id="jl-auth-tab-signup" aria-controls="jl-auth-panel"
              className={mode === "signup" ? "active" : undefined}
              aria-selected={mode === "signup"}
              disabled={busy}
              onClick={() => selectMode("signup")}
            >Criar conta</button>
          </div>

          <div role="tabpanel" id="jl-auth-panel"
            aria-labelledby={mode === "login" ? "jl-auth-tab-login" : "jl-auth-tab-signup"}>
          {completed && mode === "signup" ? (
            <div className="jl-signup-complete">
              <span className="jl-signup-complete-icon"><CheckCircle2 size={30} aria-hidden="true" /></span>
              <h1>Cadastro solicitado</h1>
              <p role="status">
                Caso seu endereço possa ser cadastrado, confira sua caixa de entrada
                e siga as instruções de confirmação, quando exigidas.
                Depois, entre com suas credenciais. O acesso ao CRM depende de liberação separada.
              </p>
              <button type="button" className="jl-signup-primary" onClick={() => selectMode("login")}>
                Entrar na minha conta <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <div className="jl-signup-intro">
                <div>
                  <h1>{mode === "login" ? "Acesse seu espaço de trabalho." : "Crie sua conta no Januário Leads"}</h1>
                  <p>{mode === "login"
                    ? "Entre com seu e-mail e senha para continuar acompanhando seus leads e oportunidades."
                    : "Cadastre seu e-mail e crie uma senha para começar."}</p>
                </div>
              </div>
              <form className="jl-signup-form" onSubmit={(event) => void submit(event)}>
                {mode === "signup" && (
                  <label className="jl-signup-field">
                    <span>Nome</span>
                    <div className="jl-signup-control">
                      <UserRound size={17} aria-hidden="true" />
                      <input type="text" name="name" autoComplete="name" required
                        minLength={2} maxLength={100} placeholder="Seu nome completo"
                        value={name} onChange={(event) => setName(event.target.value)} />
                    </div>
                  </label>
                )}
                <label className="jl-signup-field">
                  <span>E-mail</span>
                  <div className="jl-signup-control">
                    <Mail size={17} aria-hidden="true" />
                    <input type="email" name="email" autoComplete="email" required maxLength={320}
                      placeholder={mode === "login" ? "seu@email.com" : "seuemail@empresa.com"}
                      value={email} onChange={(event) => setEmail(event.target.value)} />
                  </div>
                </label>
                <label className="jl-signup-field">
                  <span>Senha {mode === "signup" && <small>· mínimo de 12 caracteres</small>}</span>
                  <div className="jl-signup-control">
                    <LockKeyhole size={17} aria-hidden="true" />
                    <input type={showPassword ? "text" : "password"} name="password"
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      required minLength={mode === "signup" ? 12 : undefined}
                      maxLength={mode === "signup" ? 128 : undefined}
                      placeholder={mode === "login" ? "Sua senha" : "Crie uma senha forte"}
                      value={password} onChange={(event) => setPassword(event.target.value)} />
                    <button type="button" className="jl-signup-eye"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      onClick={() => setShowPassword((old) => !old)}>
                      {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                    </button>
                  </div>
                </label>
                {mode === "signup" && (
                  <label className="jl-signup-field">
                    <span>Confirmar senha</span>
                    <div className="jl-signup-control">
                      <LockKeyhole size={17} aria-hidden="true" />
                      <input type={showConfirm ? "text" : "password"} name="confirmPassword"
                        autoComplete="new-password" required minLength={12} maxLength={128}
                        placeholder="Repita sua senha" value={confirm}
                        onChange={(event) => setConfirm(event.target.value)} />
                      <button type="button" className="jl-signup-eye"
                        aria-label={showConfirm ? "Ocultar confirmação de senha" : "Mostrar confirmação de senha"}
                        onClick={() => setShowConfirm((old) => !old)}>
                        {showConfirm ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                      </button>
                    </div>
                  </label>
                )}
                {error && <p className="jl-signup-error" role="alert">{error}</p>}
                <button className="jl-signup-primary" type="submit"
                  disabled={busy || (mode === "signup" && USE_HTTPONLY_SESSION)}>
                  {busy
                    ? <Loader2 size={18} className="jl-auth-spinner" aria-hidden="true" />
                    : <LockKeyhole size={18} aria-hidden="true" />}
                  {busy ? (mode === "login" ? "Entrando..." : "Criando conta...")
                    : (mode === "login" ? "Entrar" : "Criar conta")}

                </button>
              </form>
              {mode === "signup" && USE_HTTPONLY_SESSION && (
                <p className="jl-signup-notice">
                  O cadastro está indisponível no modo de sessão do servidor.
                </p>
              )}
              <p className="jl-signup-login-prompt">
                {mode === "login" ? "Ainda não tem uma conta?" : "Já tem uma conta?"}{" "}
                <button type="button" className="jl-signup-inline-link"
                  onClick={() => selectMode(mode === "login" ? "signup" : "login")}>
                  {mode === "login" ? "Criar conta" : "Entrar"}
                </button>
              </p>
            </>
          )}

          </div>

          <div className="jl-signup-security">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>Seus leads ficam protegidos. O acesso ao CRM depende de autorização individual.</span>
          </div>
        </section>
        <Link to="/" className="jl-signup-home-link">Voltar ao Januário Leads</Link>
      </div>
    </main>
  );
}
