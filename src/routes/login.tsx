import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole, LogIn } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { getValidSession, signIn } from "../lib/auth";
import { AuthShell } from "../components/auth/AuthShell";
import { BETA_SIGNUP_CONFIG } from "../lib/beta-registration";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar | Januário Leads" },
      { name: "description", content: "Entre na sua conta Januário Leads e acompanhe suas oportunidades de prospecção." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void getValidSession()
      .then((session) => {
        if (session) {
          void navigate({ to: "/app" });
          return;
        }
        setChecking(false);
      })
      .catch(() => {
        setChecking(false);
        setError("Não foi possível verificar sua sessão. Tente novamente.");
      });
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn(email.trim(), password);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      await navigate({ to: "/app" });
    } catch {
      setError("Não foi possível conectar. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="auth-loading" aria-live="polite">
        <Loader2 size={20} className="auth-spinner" aria-hidden="true" />
        <span>Verificando acesso...</span>
      </main>
    );
  }

  return (
    <AuthShell page="login">
      <span className="jl-auth-form-eyebrow"><LogIn size={15} aria-hidden="true" /> BEM-VINDO DE VOLTA</span>
      <h2>Acesse seu espaço de trabalho.</h2>
      <p className="jl-auth-form-intro">Entre com suas credenciais para continuar acompanhando seus leads, contatos e oportunidades.</p>
      <form className="jl-auth-fields" onSubmit={(event) => void handleSubmit(event)}>
        <label className="jl-auth-field">
          <span>E-mail</span>
          <input
            type="email" autoComplete="email" maxLength={320} required
            value={email} onChange={(event) => setEmail(event.target.value)}
            placeholder="seu@email.com"
          />
        </label>
        <label className="jl-auth-field">
          <span>Senha</span>
          <div className="jl-auth-input-password">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password" required
              value={password} onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
            />
            <button type="button" onClick={() => setShowPassword((old) => !old)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
              {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </div>
        </label>
        {error && <p className="jl-auth-error" role="alert">{error}</p>}
        <button className="jl-auth-form-submit" type="submit" disabled={loading}>
          {loading ? <Loader2 className="jl-auth-spinner" size={18} aria-hidden="true" /> : <LockKeyhole size={18} aria-hidden="true" />}
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
      {BETA_SIGNUP_CONFIG ? (
        <>
          <div className="jl-auth-form-divider">AMBIENTE DE HOMOLOGAÇÃO</div>
          <Link className="jl-auth-bottom-link" to="/cadastro">
            Cadastro de homologação
          </Link>
        </>
      ) : (
        <p className="jl-auth-form-footnote">
          Acesso para contas já autorizadas. Novos cadastros não estão disponíveis neste ambiente.
        </p>
      )}
    </AuthShell>
  );
}
