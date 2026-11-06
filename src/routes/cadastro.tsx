import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRoundPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BETA_SIGNUP_CONFIG, requestBetaSignup } from "../lib/beta-registration";
import { AuthShell } from "../components/auth/AuthShell";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Criar conta | Januário Leads" },
      { name: "description", content: "Conheça a criação de conta do Januário Leads e como funciona a liberação de acesso à plataforma." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: RegistrationPage,
});

function RegistrationPage() {
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
      setError("Use uma senha entre 12 e 128 caracteres.");
      return;
    }
    if (!acceptedTesting) {
      setError("Confirme sua participação no ambiente de homologação.");
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
    <AuthShell page="cadastro">
      {completed ? (
        <div className="jl-auth-feedback">
          <span className="jl-auth-feedback-icon"><CheckCircle2 size={26} aria-hidden="true" /></span>
          <h2>Verifique seu e-mail.</h2>
          <p role="status">Se o endereço puder ser cadastrado, você receberá as instruções de confirmação. A entrada no CRM dependerá de uma ativação de acesso separada.</p>
          <Link className="jl-auth-top-action" to="/login">Ir para o login <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      ) : (
        <>
          <span className="jl-auth-form-eyebrow"><UserRoundPlus size={16} aria-hidden="true" /> CRIAÇÃO DE CONTA</span>
          <h2>Comece sua jornada com o Januário Leads.</h2>
          <p className="jl-auth-form-intro">
            {signupConfig
              ? "Cadastre seu e-mail no ambiente de homologação. A liberação de acesso ao CRM acontece separadamente."
              : "Estamos preparando a abertura do cadastro. Enquanto isso, o acesso ao sistema continua por convite."}
          </p>
          {!signupConfig ? (
            <div className="jl-auth-feedback">
              <div className="jl-auth-state">
                <LockKeyhole size={22} aria-hidden="true" />
                <span><strong>Cadastro público em preparação.</strong> A criação de contas ainda não está aberta nesta versão. Acessos existentes continuam funcionando normalmente.</span>
              </div>
              <p>A experiência de cadastro já está estruturada. A abertura depende da confirmação de e-mail e da liberação de acesso na plataforma.</p>
              <Link className="jl-auth-bottom-link" to="/login">Já tenho uma conta <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          ) : (
            <form className="jl-auth-fields" onSubmit={(event) => void submit(event)}>
              <label className="jl-auth-field">
                <span>E-mail</span>
                <input type="email" autoComplete="email" required maxLength={320}
                  placeholder="voce@empresa.com" value={email}
                  onChange={(event) => setEmail(event.target.value)} />
              </label>
              <label className="jl-auth-field">
                <span>Senha · mínimo de 12 caracteres</span>
                <div className="jl-auth-input-password">
                  <input type={visiblePassword ? "text" : "password"} autoComplete="new-password"
                    required minLength={12} maxLength={128} value={password}
                    onChange={(event) => setPassword(event.target.value)} />
                  <button type="button" aria-label={visiblePassword ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setVisiblePassword((previous) => !previous)}>
                    {visiblePassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                  </button>
                </div>
              </label>
              <label className="jl-auth-field">
                <span>Confirme sua senha</span>
                <input type={visiblePassword ? "text" : "password"} autoComplete="new-password"
                  required minLength={12} maxLength={128} value={repeatPassword}
                  onChange={(event) => setRepeatPassword(event.target.value)} />
              </label>
              <label className="jl-auth-check">
                <input type="checkbox" checked={acceptedTesting} required
                  onChange={(event) => setAcceptedTesting(event.target.checked)} />
                <span>Estou participando da homologação e compreendo que criar uma conta não libera o CRM automaticamente.</span>
              </label>
              {error && <p className="jl-auth-error" role="alert">{error}</p>}
              <button className="jl-auth-form-submit" type="submit" disabled={submitting}>
                {submitting ? "Criando conta..." : "Criar conta de homologação"}
                {!submitting && <ArrowRight size={17} aria-hidden="true" />}
              </button>
              <p className="jl-auth-form-footnote"><Mail size={13} aria-hidden="true" /> A confirmação de e-mail depende das configurações do serviço de homologação.</p>
            </form>
          )}
        </>
      )}
      <div className="jl-auth-form-divider">SEGURANÇA E ACESSO</div>
      <span className="jl-auth-story-note"><ShieldCheck size={17} aria-hidden="true" /> O acesso aos dados de cada conta é controlado separadamente da criação de identidade.</span>
    </AuthShell>
  );
}
