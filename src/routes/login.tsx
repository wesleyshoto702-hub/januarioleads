import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole, Moon, Sun } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { getValidSession, signIn } from "../lib/auth";

export const Route = createFileRoute("/login")({
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
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("leadflow:theme");
    const current = stored === "dark" ? "dark" : "light";
    setTheme(current);
    document.documentElement.classList.toggle("dark", current === "dark");

    void getValidSession().then((session) => {
      if (session) {
        void navigate({ to: "/" });
        return;
      }
      setChecking(false);
    });
  }, [navigate]);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      localStorage.setItem("leadflow:theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    const result = await signIn(email.trim(), password);
    if (!result.ok) {
      setError(result.message);
      setLoading(false);
      return;
    }

    await navigate({ to: "/" });
  }

  if (checking) {
    return (
      <main className="auth-loading" aria-live="polite">
        <Loader2 size={20} className="auth-spinner" />
        <span>Verificando acesso...</span>
      </main>
    );
  }

  return (
    <main className="login-shell">
      <button
        className="icon-button login-theme"
        onClick={toggleTheme}
        type="button"
        aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
      >
        {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <section className="login-panel">
        <div className="login-brand">
          <span className="brand-mark">J</span>
          <div>
            <strong>JanuarioLeads</strong>
            <span>Acesso privado</span>
          </div>
        </div>

        <div className="login-copy">
          <p className="eyebrow">ÁREA RESTRITA</p>
          <h1>Entre para acessar seus leads.</h1>
          <p>Use a conta privada cadastrada no Supabase Auth.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu@email.com"
            />
          </label>

          <label>
            <span>Senha</span>
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Sua senha"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          {error && <div className="login-error">{error}</div>}

          <button className="primary-button login-submit" type="submit" disabled={loading}>
            {loading ? <Loader2 size={17} className="auth-spinner" /> : <LockKeyhole size={17} />}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
