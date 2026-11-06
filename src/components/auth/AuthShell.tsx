import { Link } from "@tanstack/react-router";
import {
  ArrowRight, BadgeCheck, CalendarCheck2, Compass, FolderKanban,
  Search, ShieldCheck, Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { AmbientParticles } from "../marketing/AmbientParticles";

type Props = {
  page: "login" | "cadastro";
  children: ReactNode;
};

const flow = [
  { icon: Search, title: "Descubra", copy: "Empresas por cidade e segmento." },
  { icon: FolderKanban, title: "Organize", copy: "Leads e histórico em um lugar." },
  { icon: CalendarCheck2, title: "Acompanhe", copy: "Retornos e oportunidades." },
] as const;

/** Public identity shell only: no session, auth state, data fetch or backend call. */
export function AuthShell({ page, children }: Props) {
  return (
    <main className="jl-auth-shell">
      <AmbientParticles />
      <div className="jl-auth-background" aria-hidden="true"><i /><i /><i /></div>
      <header className="jl-auth-header">
        <Link to="/" className="jl-auth-brand" aria-label="Januário Leads — página inicial">
          <span className="jl-auth-brand-symbol">J</span>
          <span>Januário<strong>Leads</strong></span>
        </Link>
        <div className="jl-auth-header-actions">
          <Link to="/" className="jl-auth-back">Conhecer a plataforma</Link>
          {page === "login"
            ? <Link to="/cadastro" className="jl-auth-top-action">Criar conta <ArrowRight size={15} aria-hidden="true" /></Link>
            : <Link to="/login" className="jl-auth-top-action">Entrar <ArrowRight size={15} aria-hidden="true" /></Link>}
        </div>
      </header>
      <div className="jl-auth-main">
        <aside className="jl-auth-story" aria-label="O que você encontra no Januário Leads">
          <span className="jl-auth-eyebrow"><Sparkles size={15} aria-hidden="true" /> SUA PROSPECÇÃO, MAIS CLARA</span>
          <h1>Um só lugar para descobrir, organizar e <em>avançar.</em></h1>
          <p className="jl-auth-story-desc">
            Encontre empresas por região e nicho, acompanhe o histórico de cada
            contato e mantenha o foco na próxima oportunidade.
          </p>
          <div className="jl-auth-workflow" aria-label="Etapas da plataforma">
            {flow.map(({ icon: Icon, title, copy }, i) => (
              <div className="jl-auth-flow-step" key={title}>
                <span className="jl-auth-flow-icon"><Icon size={18} aria-hidden="true" /></span>
                <div><small>ETAPA 0{i + 1}</small><strong>{title}</strong><p>{copy}</p></div>
                {i < flow.length - 1 && <ArrowRight size={15} className="jl-auth-flow-arrow" aria-hidden="true" />}
              </div>
            ))}
          </div>
          <div className="jl-auth-story-note">
            <BadgeCheck size={17} aria-hidden="true" /> Uma plataforma de prospecção e CRM, com recursos integrados.
          </div>
        </aside>
        <section className="jl-auth-form-card" aria-label={page === "login" ? "Acesse sua conta" : "Crie sua conta"}>
          {children}
        </section>
      </div>
      <footer className="jl-auth-footer">
        <span>© {new Date().getFullYear()} Januário Leads</span>
        <span><ShieldCheck size={14} aria-hidden="true" /> Acesso protegido</span>
        <Link to="/">Voltar ao início <Compass size={14} aria-hidden="true" /></Link>
      </footer>
    </main>
  );
}
