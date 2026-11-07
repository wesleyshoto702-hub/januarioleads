import { SIGNUP_STYLES } from "../lib/route-styles";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight, BadgeCheck, BarChart3, Loader2, LockKeyhole,
  ShieldCheck, UserRoundPlus,
} from "lucide-react";
import { useState } from "react";
import { AuroraBackdrop } from "../components/marketing/AuroraBackdrop";
import { BETA_SIGNUP_CONFIG } from "../lib/beta-registration";
import { googleProviderStatus, prepareGoogleOAuth } from "../lib/public-registration";
import { USE_HTTPONLY_SESSION } from "../lib/supabase-config";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    links: [...SIGNUP_STYLES],
    meta: [
      { title: "Criar conta com Google | Januário Leads" },
      {
        name: "description",
        content: "Crie uma identidade Januário Leads com uma conta Google verificada. O acesso ao CRM depende de autorização.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: RegistrationPage,
});

function RegistrationPage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  async function googleSignup() {
    if (googleLoading) return;
    setError("");
    if (BETA_SIGNUP_CONFIG || USE_HTTPONLY_SESSION) {
      setError("O cadastro pelo Google precisa de um ambiente com autenticação OAuth habilitada.");
      return;
    }
    setGoogleLoading(true);
    try {
      const availability = await googleProviderStatus();
      if (!availability.ok) {
        setError(availability.message);
        return;
      }
      const result = await prepareGoogleOAuth(window.location.origin, sessionStorage);
      if (!result.ok || !result.url) {
        setError(result.ok ? "Não foi possível conectar ao Google." : result.message);
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("Não foi possível iniciar a verificação com Google. Tente novamente.");
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
        <span className="jl-signup-safe-badge">
          <LockKeyhole size={13} aria-hidden="true" /> Acesso seguro à plataforma
        </span>

        <section className="jl-signup-card" aria-label="Crie sua conta no Januário Leads">
          <nav className="jl-signup-tabs" aria-label="Autenticação">
            <Link to="/login">Entrar</Link>
            <span aria-current="page">Criar conta</span>
          </nav>

          <div className="jl-signup-intro">
            <UserRoundPlus size={25} aria-hidden="true" />
            <div>
              <h1>Crie sua conta no Januário Leads</h1>
              <p>Um cadastro protegido, com verificação da sua conta Google.</p>
            </div>
          </div>

          <div className="jl-signup-google-only">
            <span className="jl-signup-verified-icon">
              <BadgeCheck size={28} aria-hidden="true" />
            </span>
            <h2>Seu e-mail, confirmado pelo Google.</h2>
            <p>
              Para evitar cadastros com endereços inventados, a criação de
              novas contas exige autenticação direta com o Google.
              Você escolhe sua conta na tela oficial do Google — não basta digitar um e-mail.
            </p>
          </div>

          {error && <p className="jl-signup-error" role="alert">{error}</p>}
          <button
            type="button"
            className="jl-signup-google jl-signup-google-primary"
            disabled={googleLoading || USE_HTTPONLY_SESSION || Boolean(BETA_SIGNUP_CONFIG)}
            onClick={() => void googleSignup()}
          >
            {googleLoading
              ? <Loader2 size={19} className="jl-auth-spinner" aria-hidden="true" />
              : <span className="jl-google-g" aria-hidden="true">G</span>}
            {googleLoading ? "Conectando ao Google..." : "Criar conta com Google"}
            {!googleLoading && <ArrowRight size={18} aria-hidden="true" />}
          </button>

          {(USE_HTTPONLY_SESSION || BETA_SIGNUP_CONFIG) && (
            <p className="jl-signup-notice">
              O Google está indisponível neste modo de autenticação. É necessário
              configurar um ambiente OAuth compatível antes de abrir cadastros.
            </p>
          )}

          <p className="jl-signup-login-prompt">
            Já tem uma conta? <Link to="/login">Acessar conta</Link>
          </p>
          <div className="jl-signup-security">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              O Google confirma a identidade. O acesso aos dados do CRM
              depende de liberação separada.
            </span>
          </div>
        </section>
        <Link to="/" className="jl-signup-home-link">Voltar ao Januário Leads</Link>
      </div>
    </main>
  );
}
