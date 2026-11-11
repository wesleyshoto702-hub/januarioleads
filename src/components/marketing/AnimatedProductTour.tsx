import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  Check,
  CheckCircle2,
  Clock3,
  FolderPlus,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  Users,
  ScanSearch,
  Files,
  BriefcaseBusiness,
  FolderKanban,
  ListOrdered,
  Target,
  ClipboardList,
} from "lucide-react";
import { useEffect, useState } from "react";

/** Original, client-side simulated product tour. No Google Maps, Supabase or real users. */
const scenes = [
  {
    title: "Descubra empresas na região",
    short: "Buscar empresas",
    text: "Combine segmento e cidade para iniciar uma pesquisa comercial. No produto, você decide quais empresas merecem atenção.",
    cue: "Pesquisa guiada",
    icon: Search,
  },
  {
    title: "Selecione os contatos relevantes",
    short: "Escolher leads",
    text: "Analise os dados disponíveis, identifique os negócios interessantes e salve apenas o que fizer sentido na sua carteira.",
    cue: "Seleção consciente",
    icon: FolderPlus,
  },
  {
    title: "Tenha uma carteira organizada",
    short: "Organizar no CRM",
    text: "Acompanhe o status de cada empresa e registre atividades e anotações sem espalhar informações entre várias ferramentas.",
    cue: "CRM em contexto",
    icon: LayoutDashboard,
  },
  {
    title: "Defina o próximo passo",
    short: "Planejar follow-up",
    text: "Prepare uma mensagem, marque um retorno e saiba quem precisa de atenção. Você continua responsável por enviar suas abordagens.",
    cue: "Próxima ação visível",
    icon: CalendarCheck2,
  },
  {
    title: "Analise um site e organize uma proposta",
    short: "Análise e proposta",
    text: "Consulte indicadores técnicos disponíveis e prepare um orçamento com escopo, serviços e prévia para PDF. O envio ao cliente é manual.",
    cue: "Do diagnóstico ao orçamento",
    icon: ScanSearch,
  },
  {
    title: "Acompanhe campanhas, metas e entregas",
    short: "Gestão comercial",
    text: "Organize campanhas, sequências, agenda, objeções, metas e projetos em um fluxo de trabalho. Os registros são atualizados por você.",
    cue: "Acompanhamento comercial",
    icon: BriefcaseBusiness,
  },
] as const;

const EXAMPLE_COMPANIES = [
  { initial: "E", name: "Estúdio Exemplo", category: "Academia · Curitiba, PR", accent: "rose" },
  { initial: "P", name: "Pulse Fitness Exemplo", category: "Academia · Curitiba, PR", accent: "violet" },
  { initial: "M", name: "Movimento Exemplo", category: "Academia · Curitiba, PR", accent: "orange" },
] as const;

function ExampleLeadRows({ selection = false }: { selection?: boolean }) {
  return (
    <div className="jl-tour-results">
      {EXAMPLE_COMPANIES.map((company, index) => (
        <div
          key={company.name}
          className={"jl-tour-lead jl-tour-lead-" + (index + 1)}
        >
          <span className={"jl-tour-avatar " + company.accent}>{company.initial}</span>
          <div className="jl-tour-lead-copy">
            <strong>{company.name}</strong>
            <small>{company.category}</small>
          </div>
          {selection ? (
            <span className={"jl-tour-tick " + (index < 2 ? "chosen" : "")} aria-label={index < 2 ? "Selecionado" : "Não selecionado"}>
              {index < 2 && <Check size={13} aria-hidden="true" />}
            </span>
          ) : (
            <span className="jl-tour-lead-label">Explorar</span>
          )}
        </div>
      ))}
    </div>
  );
}

function SearchScene() {
  return (
    <div className="jl-tour-scene-content">
      <div className="jl-tour-scene-heading">
        <div><span>ENCONTRAR EMPRESAS</span><h4>Buscar Leads</h4></div>
        <span className="jl-tour-scene-status"><span /> Modo demonstração</span>
      </div>
      <div className="jl-tour-search-grid">
        <div className="jl-tour-search-input">
          <small>Segmento</small>
          <span className="jl-tour-typing">Academias<span className="jl-tour-cursor" /></span>
        </div>
        <div className="jl-tour-search-input">
          <small>Localização</small>
          <span><MapPin size={14} aria-hidden="true" /> Curitiba · PR</span>
        </div>
        <div className="jl-tour-faux-search">
          <Search size={15} aria-hidden="true" /> Pesquisar
        </div>
      </div>
      <div className="jl-tour-result-top">
        <span>Empresas encontradas</span>
        <small>Exemplo fictício</small>
      </div>
      <ExampleLeadRows />
      <div className="jl-tour-search-footer">
        <span className="jl-tour-pulse"><span /> Pesquisa concluída</span>
        <span>Próximo: escolher leads <ArrowRight size={13} aria-hidden="true" /></span>
      </div>
    </div>
  );
}

function SelectScene() {
  return (
    <div className="jl-tour-scene-content">
      <div className="jl-tour-scene-heading">
        <div><span>QUALIFICAR OPORTUNIDADES</span><h4>Escolher empresas</h4></div>
        <span className="jl-tour-counter">3 exemplos</span>
      </div>
      <div className="jl-tour-info-strip">
        <Users size={16} aria-hidden="true" />
        <span>Escolha quem faz sentido para sua oferta.</span>
      </div>
      <ExampleLeadRows selection />
      <div className="jl-tour-select-bottom">
        <span className="jl-tour-selected-count"><CheckCircle2 size={16} aria-hidden="true" /> 2 empresas selecionadas</span>
        <span className="jl-tour-save-action"><FolderPlus size={15} aria-hidden="true" /> Salvar no CRM</span>
      </div>
      <div className="jl-tour-toast"><CheckCircle2 size={16} aria-hidden="true" /> Contatos adicionados à carteira</div>
    </div>
  );
}

function CrmScene() {
  return (
    <div className="jl-tour-scene-content">
      <div className="jl-tour-scene-heading">
        <div><span>CARTEIRA COMERCIAL</span><h4>Meus leads</h4></div>
        <span className="jl-tour-counter">Visão de exemplo</span>
      </div>
      <div className="jl-tour-crm-columns">
        <div className="jl-tour-crm-column">
          <div className="jl-tour-column-title"><span>Novo</span><small>1</small></div>
          <div className="jl-tour-crm-lead"><span className="jl-tour-crm-tag">Para abordar</span><strong>Estúdio Exemplo</strong><small>Academia · Curitiba</small></div>
        </div>
        <div className="jl-tour-crm-column">
          <div className="jl-tour-column-title"><span>Contato iniciado</span><small>1</small></div>
          <div className="jl-tour-crm-lead focused"><span className="jl-tour-crm-tag">Acompanhar</span><strong>Pulse Fitness Exemplo</strong><small>Próximo retorno definido</small></div>
        </div>
        <div className="jl-tour-crm-column">
          <div className="jl-tour-column-title"><span>Em conversa</span><small>1</small></div>
          <div className="jl-tour-crm-lead"><span className="jl-tour-crm-tag">Oportunidade</span><strong>Movimento Exemplo</strong><small>Contato em acompanhamento</small></div>
        </div>
      </div>
      <div className="jl-tour-crm-note"><Sparkles size={15} aria-hidden="true" /> Cada empresa mantém seu histórico de atividades registradas.</div>
    </div>
  );
}

function FollowupScene() {
  return (
    <div className="jl-tour-scene-content">
      <div className="jl-tour-scene-heading">
        <div><span>PLANEJAR A ROTINA</span><h4>Próximas ações</h4></div>
        <span className="jl-tour-counter">Exemplo</span>
      </div>
      <div className="jl-tour-followup">
        <div className="jl-tour-followup-head">
          <span className="jl-tour-avatar rose">E</span>
          <div><strong>Estúdio Exemplo</strong><small>Contato comercial · Curitiba, PR</small></div>
          <span className="jl-tour-contact-badge">Novo</span>
        </div>
        <div className="jl-tour-followup-event">
          <span className="jl-tour-followup-event-icon"><CalendarCheck2 size={18} aria-hidden="true" /></span>
          <div><small>PRÓXIMA AÇÃO</small><strong>Retomar contato</strong><span>Agendado na carteira de leads</span></div>
          <span className="jl-tour-followup-check"><Check size={17} aria-hidden="true" /></span>
        </div>
        <div className="jl-tour-message">
          <MessageCircle size={16} aria-hidden="true" />
          <span>Modelo de mensagem disponível para revisar e adaptar.</span>
        </div>
        <div className="jl-tour-followup-done"><Clock3 size={16} aria-hidden="true" /> Follow-up organizado · envio manual</div>
      </div>
    </div>
  );
}

/**
 * Illustrative screens inspired by actual personal-workspace modules.
 * These are static, fictional examples and never query PageSpeed or a CRM.
 */
function AnalysisProposalScene() {
  return (
    <div className="jl-tour-scene-content">
      <div className="jl-tour-scene-heading">
        <div><span>DIAGNÓSTICO E ORÇAMENTO</span><h4>Da análise à proposta</h4></div>
        <span className="jl-tour-counter">Exemplo ilustrativo</span>
      </div>
      <div className="jl-tour-commercial-pair">
        <div className="jl-tour-commercial-card">
          <div className="jl-tour-commercial-card-head">
            <span className="jl-tour-commercial-icon"><ScanSearch size={17} aria-hidden="true" /></span>
            <div><strong>Análise Digital</strong><small>empresa-exemplo.com.br</small></div>
          </div>
          <div className="jl-tour-commercial-checklist">
            <span><CheckCircle2 size={14} aria-hidden="true" /> Consultar indicadores do site</span>
            <span><CheckCircle2 size={14} aria-hidden="true" /> Revisar pontos de melhoria</span>
            <span><CheckCircle2 size={14} aria-hidden="true" /> Guardar contexto comercial</span>
          </div>
          <div className="jl-tour-commercial-footnote">Dados técnicos dependem da fonte consultada</div>
        </div>
        <div className="jl-tour-commercial-card proposal">
          <div className="jl-tour-commercial-card-head">
            <span className="jl-tour-commercial-icon"><Files size={17} aria-hidden="true" /></span>
            <div><strong>Proposta Comercial</strong><small>Site institucional · exemplo</small></div>
          </div>
          <div className="jl-tour-commercial-proposal">
            <div><span>Serviço</span><strong>Criação de site</strong></div>
            <div><span>Escopo</span><strong>Definido com o cliente</strong></div>
            <div><span>Condições</span><strong>Preenchimento manual</strong></div>
          </div>
          <div className="jl-tour-commercial-file"><ClipboardList size={14} aria-hidden="true" /> Prévia pronta para salvar em PDF</div>
        </div>
      </div>
      <div className="jl-tour-commercial-summary"><CheckCircle2 size={15} aria-hidden="true" />
        Análise e proposta organizadas — sem envio automático ao cliente
      </div>
    </div>
  );
}

function CommercialManagementScene() {
  return (
    <div className="jl-tour-scene-content">
      <div className="jl-tour-scene-heading">
        <div><span>GESTÃO COMERCIAL</span><h4>Do contato à entrega</h4></div>
        <span className="jl-tour-counter">Exemplo ilustrativo</span>
      </div>
      <div className="jl-tour-commercial-journey">
        <div className="jl-tour-journey-title"><FolderKanban size={17} aria-hidden="true" />
          <strong>Campanha: empresas da região</strong><span>Organização manual</span>
        </div>
        <div className="jl-tour-journey-steps">
          <div><span className="jl-tour-journey-mark"><FolderKanban size={16} aria-hidden="true" /></span>
            <strong>Campanha</strong><small>Leads agrupados</small></div>
          <div><span className="jl-tour-journey-mark"><ListOrdered size={16} aria-hidden="true" /></span>
            <strong>Sequência</strong><small>Contatos planejados</small></div>
          <div><span className="jl-tour-journey-mark"><CalendarCheck2 size={16} aria-hidden="true" /></span>
            <strong>Agenda</strong><small>Retorno agendado</small></div>
        </div>
        <div className="jl-tour-journey-bottom">
          <div><BriefcaseBusiness size={17} aria-hidden="true" />
            <span><strong>Projetos</strong><small>Tarefas e fases de entrega</small></span></div>
          <div><Target size={17} aria-hidden="true" />
            <span><strong>Metas e objeções</strong><small>Registros da sua rotina</small></span></div>
        </div>
      </div>
      <div className="jl-tour-commercial-summary"><CheckCircle2 size={15} aria-hidden="true" />
        Acompanhamento de ponta a ponta — sem disparos automáticos
      </div>
    </div>
  );
}

export function AnimatedProductTour() {
  const [current, setCurrent] = useState(0);
  const [pageVisible, setPageVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(media.matches);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => setPageVisible(document.visibilityState === "visible");
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const isRunning = pageVisible && !reducedMotion;
  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => setCurrent((step) => (step + 1) % scenes.length), 4900);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const currentScene = scenes[current] ?? scenes[0];
  const Icon = currentScene.icon;
  return (
    <div className="jl-tour-grid">
      <div className="jl-tour-side">
        <p className="jl-tour-side-overline">SEU FLUXO, EM MOVIMENTO</p>
        <h3>Não é só uma lista. <span>É um processo.</span></h3>
        <p>Veja como os módulos se conectam: da busca de empresas ao acompanhamento de propostas e projetos, em uma simulação com dados fictícios.</p>
        <ul className="jl-tour-step-buttons" aria-label="Etapas da demonstração automática">
          {scenes.map(({ icon: StepIcon, short }, index) => (
            <li
              key={short}
              className={"jl-tour-step-indicator " + (current === index ? "active" : "")}
              aria-current={current === index ? "step" : undefined}
            >
              <StepIcon size={17} aria-hidden="true" />
              <span>{short}</span>
            </li>
          ))}
        </ul>
        {reducedMotion && <p className="jl-tour-reduced-note">Movimento reduzido ativado: o exemplo permanece estático e as seis etapas estão descritas acima.</p>}
      </div>
      <div className="jl-tour-stage" data-stage={current} data-playing={isRunning} data-reduced={reducedMotion}>
        <div className="jl-tour-player-topbar">
          <span className="jl-tour-player-dots" aria-hidden="true"><i /><i /><i /></span>
          <span>Januário Leads <span className="jl-tour-window-divider">/</span> Tour do produto</span>
          <small>Simulação ilustrativa</small>
        </div>
        <div className="jl-tour-viewport">
          <div className="jl-tour-mini-sidebar" aria-hidden="true">
            <span className="jl-tour-sidebar-brand">J</span>
            <Search size={16} />
            <Users size={16} />
            <LayoutDashboard size={16} />
            <CalendarCheck2 size={16} />
            <ScanSearch size={16} />
            <BriefcaseBusiness size={16} />
          </div>
          <div className="jl-tour-viewport-content" key={current}>
            {current === 0 && <SearchScene />}
            {current === 1 && <SelectScene />}
            {current === 2 && <CrmScene />}
            {current === 3 && <FollowupScene />}
            {current === 4 && <AnalysisProposalScene />}
            {current === 5 && <CommercialManagementScene />}
          </div>
        </div>
        <div className="jl-tour-progress">
          <div className="jl-tour-progress-track" style={{gridTemplateColumns:`repeat(${scenes.length}, minmax(0, 1fr))`}}>
            {scenes.map((scene, index) => (
              <span key={scene.short} className={index < current ? "completed" : index === current ? "current" : ""}>
                {index === current && <span key={current} className="jl-tour-progress-fill" />}
              </span>
            ))}
          </div>
        </div>
        <div className="jl-tour-player-footer">
          <span className="jl-tour-player-icon"><Icon size={19} aria-hidden="true" /></span>
          <div className="jl-tour-player-caption">
            <span>{currentScene.cue}</span>
            <strong>{currentScene.title}</strong>
            <p>{currentScene.text}</p>
          </div>
        </div>
        <div className="jl-tour-truth">
          <CheckCircle2 size={14} aria-hidden="true" />
          Demonstração automática com dados simulados — sem consultas ou envios reais.
        </div>
      </div>
    </div>
  );
}
