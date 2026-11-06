import {
  ArrowRight, BarChart3, Building2, CalendarCheck2, Check, CheckCircle2,
  Clock3, Compass, FolderKanban, Globe2, Layers3, MessageCircle,
  Search, ShieldCheck, Target, Users, WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Editorial marketing modules: real capability descriptions, no fabricated
 * testimonials or performance numbers. Changes are local-only UI state.
 */

const difficulties = [
  {
    title: "Pesquisa fragmentada",
    detail: "Informações de empresas espalhadas em pesquisas, abas e anotações.",
    resolution: "Busca por nicho e cidade no mesmo fluxo",
    icon: Search,
  },
  {
    title: "Carteira desorganizada",
    detail: "Histórico e situação de cada contato difíceis de acompanhar.",
    resolution: "Leads e atividades registrados no CRM",
    icon: Layers3,
  },
  {
    title: "Próxima ação indefinida",
    detail: "Retornos perdem prioridade quando não existe uma rotina clara.",
    resolution: "Lembretes de retorno e oportunidades visíveis",
    icon: Clock3,
  },
] as const;

export function ChallengeStory() {
  return (
    <section className="jl-section jl-editorial-challenge" aria-labelledby="challenge-title">
      <div className="jl-container jl-challenge-layout">
        <div className="jl-challenge-statement">
          <span className="jl-eyebrow">PROSPECÇÃO SEM ATRITO</span>
          <h2 id="challenge-title">Menos abas abertas. <span>Mais clareza sobre quem contatar.</span></h2>
          <p>
            Seu trabalho não termina quando uma empresa aparece na pesquisa.
            O Januário Leads conecta descoberta, organização e acompanhamento
            para que cada contato tenha um próximo passo.
          </p>
          <a className="jl-editorial-link" href="#recursos">
            Conheça os módulos <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
        <div className="jl-challenge-lines" aria-label="Problemas comuns e como a plataforma ajuda">
          {difficulties.map(({ title, detail, resolution, icon: Icon }, index) => (
            <div className="jl-challenge-line" key={title}>
              <span className="jl-challenge-number">0{index + 1}</span>
              <div className="jl-challenge-line-copy">
                <div className="jl-challenge-line-heading">
                  <Icon size={18} aria-hidden="true" />
                  <strong>{title}</strong>
                </div>
                <p>{detail}</p>
                <span><Check size={14} aria-hidden="true" /> {resolution}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  { title: "Explore", description: "Escolha o segmento e a cidade.", icon: Compass },
  { title: "Organize", description: "Salve os negócios que importam.", icon: FolderKanban },
  { title: "Acompanhe", description: "Registre atividades e defina retornos.", icon: CalendarCheck2 },
] as const;

export function WorkflowRibbon() {
  return (
    <section className="jl-editorial-workflow" id="como-funciona" aria-labelledby="workflow-title">
      <div className="jl-container">
        <div className="jl-editorial-workflow-head">
          <div>
            <span className="jl-eyebrow">DA PESQUISA À ROTINA</span>
            <h2 id="workflow-title">Um caminho claro para cada <span>oportunidade.</span></h2>
          </div>
          <p>Três movimentos que mantêm sua prospecção conectada. O tour acima mostra como eles se relacionam na plataforma.</p>
        </div>
        <ol className="jl-workflow-track">
          {steps.map(({ title, description, icon: Icon }, i) => (
            <li key={title}>
              <span className="jl-workflow-node"><Icon size={19} aria-hidden="true" /></span>
              <div><small>ETAPA 0{i + 1}</small><strong>{title}</strong><p>{description}</p></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const productModules = [
  {
    id: "busca", icon: Search, name: "Buscar Leads", label: "Encontre negócios por região",
    headline: "A pesquisa comercial começa pelo mercado que você escolhe.",
    description: "Selecione estado, município e segmento. Avalie os resultados disponíveis e escolha quais negócios merecem atenção.",
    bullets: ["Pesquisa por nicho e cidade", "Detalhes encontrados na fonte", "Seleção consciente de contatos"],
    visual: ["Defina uma região", "Escolha o segmento", "Revise as empresas"],
  },
  {
    id: "carteira", icon: Users, name: "Meus Leads", label: "Construa sua carteira",
    headline: "Transforme empresas encontradas em contatos acompanháveis.",
    description: "Salve leads e concentre informações, situação comercial, observações e histórico em uma carteira organizada.",
    bullets: ["Carteira centralizada", "Pesquisa e filtros", "Histórico por empresa"],
    visual: ["Lead identificado", "Dados organizados", "Histórico disponível"],
  },
  {
    id: "oportunidades", icon: Target, name: "Oportunidades", label: "Acompanhe negociações",
    headline: "Saiba o que acontece depois do primeiro contato.",
    description: "Registre o andamento comercial, visualize atividades e mantenha as oportunidades em acompanhamento.",
    bullets: ["Situação da negociação", "Atividades registradas", "Próximos passos"],
    visual: ["Novo contato", "Em conversa", "Em acompanhamento"],
  },
  {
    id: "acoes", icon: CalendarCheck2, name: "Próximas ações", label: "Planeje retornos",
    headline: "Organize a rotina sem depender de lembretes espalhados.",
    description: "Defina retornos e mantenha visíveis as ações que exigem atenção para dar continuidade a cada contato.",
    bullets: ["Retornos definidos", "Acompanhamento da rotina", "Contexto em um lugar"],
    visual: ["Preparar abordagem", "Registrar interação", "Agendar retorno"],
  },
  {
    id: "mensagens", icon: MessageCircle, name: "Mensagens", label: "Prepare abordagens",
    headline: "Personalize sua comunicação sem perder o contexto.",
    description: "Use modelos de abordagem, revise a mensagem e inicie a conversa pelo WhatsApp quando fizer sentido. O envio é manual.",
    bullets: ["Modelos reutilizáveis", "Comunicação personalizada", "Envio sempre sob seu controle"],
    visual: ["Selecionar modelo", "Personalizar texto", "Abrir conversa"],
  },
  {
    id: "financeiro", icon: WalletCards, name: "Financeiro", label: "Registre resultados",
    headline: "Mantenha os registros financeiros associados aos seus leads.",
    description: "Acompanhe informações financeiras comerciais relacionadas à sua carteira. Não se trata de cobrança de assinatura do SaaS.",
    bullets: ["Histórico comercial", "Registros por lead", "Visão de acompanhamento"],
    visual: ["Contato registrado", "Negociação anotada", "Informação reunida"],
  },
] as const;

export function FeatureExplorer() {
  const [selected, setSelected] = useState<(typeof productModules)[number]["id"]>("busca");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const active = productModules.find((mod) => mod.id === selected) ?? productModules[0];
  const ActiveIcon = active.icon;

  return (
    <div className="jl-modules" aria-label="Explore os módulos do Januário Leads">
      <div className="jl-module-menu" role="group" aria-label="Módulos da plataforma">
        {productModules.map(({ id, icon: Icon, name, label }) => (
          <button
            key={id} type="button" id={"jl-module-tab-" + id}
            aria-controls="jl-module-panel" aria-pressed={selected === id}
            disabled={!hydrated}
            className={"jl-module-tab" + (selected === id ? " active" : "")}
            onClick={() => setSelected(id)}
          >
            <span className="jl-module-tab-icon"><Icon size={19} aria-hidden="true" /></span>
            <span><strong>{name}</strong><small>{label}</small></span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="jl-module-detail" role="region" aria-live="polite" id="jl-module-panel" aria-labelledby={"jl-module-tab-" + selected}>
        <div key={selected} className="jl-module-detail-inner">
          <span className="jl-module-eyebrow"><ActiveIcon size={18} aria-hidden="true" /> MÓDULO {productModules.findIndex((x) => x.id === selected) + 1} DE {productModules.length}</span>
          <h3>{active.headline}</h3>
          <p>{active.description}</p>
          <ul className="jl-module-bullets">
            {active.bullets.map((bullet) => <li key={bullet}><CheckCircle2 size={16} aria-hidden="true" />{bullet}</li>)}
          </ul>
          <div className="jl-module-visual" aria-label="Resumo das etapas do módulo">
            <span className="jl-module-visual-top"><span /> FLUXO DO MÓDULO</span>
            <div>
              {active.visual.map((v, i) => (
                <span className="jl-module-visual-item" key={v}>
                  <small>0{i + 1}</small><strong>{v}</strong>
                  {i < active.visual.length - 1 && <ArrowRight size={13} aria-hidden="true" />}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const profiles = [
  {
    id: "agencias", title: "Agências e freelancers", icon: Globe2,
    eyebrow: "SERVIÇOS DIGITAIS",
    headline: "Prospecção com foco nos negócios que podem precisar de você.",
    text: "Encontre empresas por região, avalie sua presença digital e mantenha o acompanhamento de propostas e retornos.",
    use: ["Websites e presença digital", "Marketing, design e conteúdo", "Consultoria e serviços recorrentes"],
  },
  {
    id: "vendas", title: "Profissionais de vendas", icon: BarChart3,
    eyebrow: "ROTINA COMERCIAL",
    headline: "Uma carteira que acompanha seu processo de venda.",
    text: "Pesquise potenciais clientes, acompanhe o andamento do contato e consulte o histórico antes de retomar conversas.",
    use: ["Prospecção ativa", "Gestão de oportunidades", "Follow-up comercial"],
  },
  {
    id: "consultoria", title: "Consultores e prestadores", icon: Building2,
    eyebrow: "RELACIONAMENTO B2B",
    headline: "Menos informações soltas; mais contexto para conversar.",
    text: "Organize clientes potenciais e próximas ações em uma visão clara, mesmo quando você trabalha com diferentes nichos.",
    use: ["Serviços especializados", "Atendimento empresarial", "Carteira de contatos"],
  },
] as const;

export function AudienceSwitcher() {
  const [selected, setSelected] = useState<(typeof profiles)[number]["id"]>("agencias");
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const active = profiles.find((x) => x.id === selected) ?? profiles[0];
  const Icon = active.icon;
  return (
    <section className="jl-section jl-editorial-audience" id="para-quem" aria-labelledby="audience-title">
      <div className="jl-container jl-audience-layout">
        <div className="jl-audience-selector">
          <span className="jl-eyebrow">FEITO PARA NEGÓCIOS B2B</span>
          <h2 id="audience-title">Cada negócio prospecta de <span>um jeito.</span></h2>
          <p>Escolha um perfil e veja como o Januário Leads se encaixa na rotina.</p>
          <div className="jl-audience-options" role="group" aria-label="Perfis de profissionais">
            {profiles.map(({ id, title, icon: ProfileIcon }) => (
              <button key={id} type="button" id={"jl-audience-tab-" + id}
                aria-controls="jl-audience-panel" aria-pressed={selected === id}
                disabled={!hydrated}
                className={"jl-audience-option" + (selected === id ? " active" : "")}
                onClick={() => setSelected(id)}>
                <ProfileIcon size={19} aria-hidden="true" />
                <span>{title}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        <div className="jl-audience-detail" id="jl-audience-panel" role="region" aria-live="polite" aria-labelledby={"jl-audience-tab-" + selected}>
          <div key={selected} className="jl-audience-detail-inner">
            <span className="jl-audience-category"><Icon size={17} aria-hidden="true" /> {active.eyebrow}</span>
            <h3>{active.headline}</h3>
            <p>{active.text}</p>
            <div className="jl-audience-use">
              <strong>Aplicações no dia a dia</strong>
              {active.use.map((entry) => <span key={entry}><Check size={15} aria-hidden="true" /> {entry}</span>)}
            </div>
            <span className="jl-audience-foot"><ShieldCheck size={16} aria-hidden="true" /> Funcionalidades disponíveis conforme autorização de acesso.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
