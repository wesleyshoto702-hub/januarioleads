import { AUTH_STYLES } from "../../lib/route-styles";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AuroraBackdrop } from "../../components/marketing/AuroraBackdrop";
import { exchangeGoogleCode } from "../../lib/public-registration";
import { acceptExternalSession } from "../../lib/auth";

export const Route = createFileRoute("/auth/retorno")({
  head: () => ({
    links: [...AUTH_STYLES],
    meta: [
      { title: "Verificar Google | Januário Leads" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OAuthReturn,
});

function OAuthReturn() {
  const navigate = useNavigate();
  const started = useRef(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const location = window.location.href;
    // Strip auth code and state from browser history before exchanging.
    window.history.replaceState(window.history.state, "", "/auth/retorno");

    void (async () => {
      try {
        const exchanged = await exchangeGoogleCode(location, sessionStorage);
        if (!exchanged.ok) {
          setMessage(exchanged.message);
          return;
        }
        const accepted = await acceptExternalSession(exchanged.tokens);
        if (!accepted.ok) {
          setMessage(accepted.message);
          return;
        }
        await navigate({ to: "/app" });
      } catch {
        setMessage("O Google não conseguiu concluir a autenticação. Tente novamente.");
      } finally {
        setBusy(false);
      }
    })();
  }, [navigate]);

  return (
    <main className="jl-auth-shell jl-signup-page">
      <AuroraBackdrop />
      <div className="jl-signup-container">
        <Link className="jl-signup-brand" to="/">Januário <strong>Leads</strong></Link>
        <section className="jl-signup-card jl-oauth-return" aria-live="polite">
          {busy ? (
            <div className="jl-signup-complete">
              <Loader2 className="jl-auth-spinner" size={30} aria-hidden="true" />
              <h1>Verificando acesso...</h1>
              <p>Conferindo sua conta e as permissões do Januário Leads.</p>
            </div>
          ) : (
            <div className="jl-signup-complete">
              <CheckCircle2 size={28} aria-hidden="true" />
              <h1>Verificação concluída</h1>
              <p role="status">{message || "Seu acesso está sendo confirmado."}</p>
              <Link to="/login" className="jl-signup-primary">Voltar para acessar conta</Link>
              <Link to="/cadastro" className="jl-signup-home-link">Criar conta com e-mail</Link>
            </div>
          )}
          <div className="jl-signup-security"><ShieldCheck size={17} aria-hidden="true" /> O acesso ao CRM é verificado separadamente da identidade Google.</div>
        </section>
      </div>
    </main>
  );
}
