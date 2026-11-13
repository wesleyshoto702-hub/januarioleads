import {
  ArrowRight, BarChart3, CalendarDays, Check, ChevronLeft, ChevronRight,
  CircleHelp, ClipboardList, FileText, MessageCircle,
  Pause, Play, Search, Settings2, Sparkles, Target,
  UsersRound, WalletCards, X, type LucideIcon,
} from "lucide-react";
import {
  useEffect, useId, useRef, useState, type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { AppView } from "./AppShell";

/**
 * Illustrative, local-only explanations of the workspace.
 * Nothing here reads user data, calls an API, or performs a commercial action.
 */
type SceneKind =
  | "search" | "leads" | "insights" | "message"
  | "calendar" | "document" | "finance" | "settings";

type Scene = {
  title: string;
  description: string;
  prompt: string;
  kind: SceneKind;
  rows: readonly [string, string, string];
};

type Guide = {
  title: string;
  subtitle: string;
  scenes: readonly [Scene, Scene, Scene];
};

function scene(
  title: string,
  description: string,
  prompt: string,
  kind: SceneKind,
  rows: [string, string, string],
): Scene {
  return { title, description, prompt, kind, rows };
}

const GUIDES: Record<AppView, Guide> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Uma visão rápida do que precisa da sua atenção.",
    scenes: [
      scene("Entenda o panorama", "Comece pelos indicadores da sua carteira: leads, atividades e resultados registrados.", "Resumo comercial", "insights", ["Leads organizados", "Próximas ações", "Resultados da carteira"]),
      scene("Priorize o dia", "Veja os retornos e acompanhamentos planejados para não esquecer uma oportunidade.", "Ações importantes", "calendar", ["Contatos para hoje", "Ações atrasadas", "Próximo follow-up"]),
      scene("Acompanhe a evolução", "Use os painéis para identificar o que avançou e decidir seus próximos passos.", "Indicadores da rotina", "insights", ["Etapas da prospecção", "Leads em andamento", "Metas acompanhadas"]),
    ],
  },
  leads: {
    title: "Meus Leads",
    subtitle: "Organize os contatos que você realmente pretende trabalhar.",
    scenes: [
      scene("Crie sua carteira", "Salve uma empresa encontrada ou cadastre um contato para manter tudo em um só lugar.", "Sua carteira comercial", "leads", ["Empresa Exemplo A", "Empresa Exemplo B", "Novo contato"]),
      scene("Atualize cada etapa", "Registre se o lead precisa de mensagem, está aguardando resposta ou já avançou.", "Situação dos contatos", "leads", ["Enviar mensagem", "Aguardando retorno", "Aceito"]),
      scene("Encontre os favoritos", "Marque as oportunidades prioritárias e filtre a lista quando precisar retomá-las.", "Seus destaques", "leads", ["Marcar favorito", "Filtrar favoritos", "Retomar negociação"]),
    ],
  },
  search: {
    title: "Buscar Leads",
    subtitle: "Pesquise empresas por segmento e localização.",
    scenes: [
      scene("Escolha um segmento", "Informe o tipo de empresa que você deseja prospectar.", "Pesquisar por nicho", "search", ["Barbearias", "Academias", "Restaurantes"]),
      scene("Defina a região", "Selecione uma cidade e um estado para direcionar a pesquisa.", "Localização da pesquisa", "search", ["Cidade: Lavras", "Estado: Minas Gerais", "Segmento selecionado"]),
      scene("Confira antes de salvar", "Analise os dados disponíveis, abra os detalhes e salve somente os contatos relevantes.", "Resultados ilustrativos", "leads", ["Revisar empresa", "Ver contatos", "Adicionar aos meus leads"]),
    ],
  },
  prospecting: {
    title: "Informações de Prospecção",
    subtitle: "Entenda melhor a distribuição da sua carteira.",
    scenes: [
      scene("Selecione o segmento", "Explore os nichos presentes nos leads que você já possui.", "Visão por segmento", "insights", ["Empresas por nicho", "Carteira atual", "Distribuição comercial"]),
      scene("Analise por localidade", "Compare estados e cidades para perceber onde há mais contatos cadastrados.", "Visão regional", "insights", ["Cidades da carteira", "Estados representados", "Comparações por região"]),
      scene("Observe o acompanhamento", "Use os registros de prospecção para planejar as próximas abordagens.", "Acompanhamento", "leads", ["Contatos identificados", "Leads trabalhados", "Próximas oportunidades"]),
    ],
  },
  opportunities: {
    title: "Oportunidades",
    subtitle: "Explore sinais e segmentos de interesse comercial.",
    scenes: [
      scene("Explore regiões e nichos", "Alterne entre os recortes por cidade e segmento para encontrar oportunidades.", "Explorar oportunidades", "search", ["Por cidade", "Por segmento", "Critérios comerciais"]),
      scene("Avalie os sinais", "Confira os dados públicos disponíveis antes de considerar uma empresa promissora.", "Detalhes disponíveis", "insights", ["Contato identificado", "Presença digital", "Informações para revisar"]),
      scene("Leve para sua carteira", "Salve os estabelecimentos relevantes e organize a abordagem em Meus Leads.", "Próxima ação", "leads", ["Revisar empresa", "Salvar na carteira", "Preparar mensagem"]),
    ],
  },
  "digital-presence": {
    title: "Análise Digital",
    subtitle: "Avalie indicadores técnicos de sites públicos.",
    scenes: [
      scene("Informe o endereço", "Escolha um lead com site ou digite o endereço de uma página pública.", "Site para analisar", "search", ["Selecionar lead", "Informar domínio", "Iniciar análise"]),
      scene("Compare indicadores", "Consulte os resultados disponíveis de desempenho, acessibilidade e boas práticas.", "Diagnóstico ilustrativo", "insights", ["Desempenho", "Acessibilidade", "Boas práticas"]),
      scene("Use dados com cuidado", "Revise possíveis melhorias antes de montar uma abordagem ou proposta comercial.", "Pontos de atenção", "document", ["Revisar observações", "Selecionar melhorias", "Preparar conversa"]),
    ],
  },
  proposals: {
    title: "Propostas",
    subtitle: "Monte orçamentos claros para seus possíveis clientes.",
    scenes: [
      scene("Selecione um cliente", "Escolha o lead associado ao orçamento que deseja preparar.", "Cliente da proposta", "leads", ["Cliente Exemplo", "Serviço solicitado", "Informações do contato"]),
      scene("Organize a oferta", "Descreva o escopo, os valores e as condições comerciais da proposta.", "Estrutura do orçamento", "document", ["Serviços incluídos", "Valor e condições", "Prazo combinado"]),
      scene("Revise antes de enviar", "Confira a apresentação e prepare o documento para compartilhar manualmente.", "Proposta pronta", "document", ["Conferir informações", "Preparar PDF", "Enviar ao cliente"]),
    ],
  },
  campaigns: {
    title: "Campanhas",
    subtitle: "Agrupe leads por objetivo comercial.",
    scenes: [
      scene("Crie a campanha", "Defina um nome, um objetivo e a meta que pretende acompanhar.", "Nova campanha", "document", ["Nome da campanha", "Objetivo definido", "Meta de contatos"]),
      scene("Selecione empresas", "Associe leads da sua carteira à campanha escolhida.", "Participantes", "leads", ["Empresa Exemplo A", "Empresa Exemplo B", "Grupo selecionado"]),
      scene("Acompanhe o progresso", "Visualize o andamento usando as situações reais registradas no CRM.", "Resultados da campanha", "insights", ["Leads participantes", "Situações atuais", "Meta acompanhada"]),
    ],
  },
  messages: {
    title: "Mensagens",
    subtitle: "Crie modelos para facilitar suas abordagens.",
    scenes: [
      scene("Prepare um modelo", "Escreva uma mensagem reutilizável para o tipo de contato que pretende fazer.", "Modelo de abordagem", "message", ["Saudação", "Apresentação comercial", "Pergunta final"]),
      scene("Organize os modelos", "Mantenha mensagens de primeiro contato e acompanhamento fáceis de encontrar.", "Biblioteca de mensagens", "message", ["Primeiro contato", "Follow-up", "Mensagem favorita"]),
      scene("Personalize antes de usar", "Adapte o texto à empresa e copie ou utilize o modelo. O envio não é automático.", "Envio sob seu controle", "message", ["Revisar destinatário", "Personalizar mensagem", "Copiar para enviar"]),
    ],
  },
  sequences: {
    title: "Sequências",
    subtitle: "Planeje contatos e follow-ups sem disparos automáticos.",
    scenes: [
      scene("Crie uma sequência", "Defina um modelo com as etapas da sua abordagem comercial.", "Plano de contatos", "document", ["Primeira abordagem", "Primeiro retorno", "Último acompanhamento"]),
      scene("Associe o lead", "Escolha a empresa e acompanhe em qual etapa do plano ela está.", "Lead acompanhado", "leads", ["Empresa Exemplo", "Etapa atual", "Próximo contato"]),
      scene("Siga os próximos passos", "Consulte as datas e copie modelos quando chegar a hora de realizar o contato.", "Acompanhamento manual", "calendar", ["Data planejada", "Modelo disponível", "Marcar etapa concluída"]),
    ],
  },
  agenda: {
    title: "Agenda",
    subtitle: "Organize a rotina e os compromissos comerciais.",
    scenes: [
      scene("Registre atividades", "Crie compromissos para acompanhar contatos, tarefas e retornos.", "Planejamento", "calendar", ["Retorno comercial", "Reunião", "Tarefa planejada"]),
      scene("Consulte suas datas", "Use a agenda para enxergar o que foi programado em cada período.", "Visão do período", "calendar", ["Próximos compromissos", "Datas importantes", "Atividades em andamento"]),
      scene("Acompanhe pendências", "Revise as atividades e mantenha o planejamento alinhado à carteira.", "Rotina organizada", "leads", ["Atividade pendente", "Ação realizada", "Próximo passo"]),
    ],
  },
  projects: {
    title: "Projetos",
    subtitle: "Acompanhe as entregas depois de fechar um negócio.",
    scenes: [
      scene("Cadastre um projeto", "Crie um projeto e, quando necessário, relacione-o ao lead da carteira.", "Novo projeto", "document", ["Nome do projeto", "Cliente relacionado", "Descrição do trabalho"]),
      scene("Organize as tarefas", "Utilize o checklist para acompanhar atividades de cada entrega.", "Checklist ilustrativo", "leads", ["Planejamento", "Execução", "Revisão"]),
      scene("Atualize o andamento", "Altere as etapas do projeto e confira o que falta entregar.", "Andamento do projeto", "insights", ["Em andamento", "Tarefas concluídas", "Entrega final"]),
    ],
  },
  finance: {
    title: "Financeiro",
    subtitle: "Acompanhe valores e recebimentos dos seus negócios.",
    scenes: [
      scene("Registre o valor", "Organize os valores negociados nos leads e projetos comerciais.", "Valor do negócio", "finance", ["Valor combinado", "Condições de pagamento", "Saldo previsto"]),
      scene("Atualize recebimentos", "Lance os pagamentos quando eles ocorrerem para manter o acompanhamento correto.", "Controle financeiro", "finance", ["Pagamento recebido", "Saldo restante", "Situação financeira"]),
      scene("Consulte o panorama", "Veja os totais e as pendências para planejar sua rotina financeira.", "Resumo de valores", "insights", ["Valores recebidos", "Valores pendentes", "Negócios acompanhados"]),
    ],
  },
  settings: {
    title: "Configurações",
    subtitle: "Adapte a área de trabalho às suas preferências.",
    scenes: [
      scene("Ajuste sua conta", "Consulte os dados de identificação e suas opções de sessão.", "Minha conta", "settings", ["Nome de exibição", "Sessões da conta", "Segurança"]),
      scene("Personalize o workspace", "Escolha a aparência e o comportamento inicial das páginas.", "Preferências", "settings", ["Cor de destaque", "Página inicial", "Modo compacto"]),
      scene("Controle o movimento", "Use a opção de reduzir animações quando preferir uma interface mais estática.", "Conforto visual", "settings", ["Reduzir animações", "Preferências visuais", "Salvar alterações"]),
    ],
  },
};

const KIND_ICONS: Record<SceneKind, LucideIcon> = {
  search: Search,
  leads: UsersRound,
  insights: BarChart3,
  message: MessageCircle,
  calendar: CalendarDays,
  document: FileText,
  finance: WalletCards,
  settings: Settings2,
};

const STEPS = [0, 1, 2] as const;
const STEP_DURATION = 5700;

function AnimatedExample({ scene: current, label, play }: {
  scene: Scene;
  label: string;
  play: boolean;
}) {
  const Icon = KIND_ICONS[current.kind];
  const showChart = current.kind === "insights" || current.kind === "finance";
  return (
    <div className="jl-help-demo" data-playing={play ? "true" : "false"} data-kind={current.kind}>
      <div className="jl-help-demo-grid" aria-hidden="true" />
      <div className="jl-help-demo-glow" aria-hidden="true" />
      <div className="jl-help-window">
        <div className="jl-help-window-top">
          <span className="jl-help-window-dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="jl-help-window-app">Januário Leads <span>/</span> {label}</span>
          <span className="jl-help-window-demo">DEMONSTRAÇÃO</span>
        </div>
        <div className="jl-help-window-content">
          <div className="jl-help-mini-heading">
            <span className="jl-help-mini-icon"><Icon size={19} aria-hidden="true" /></span>
            <div>
              <span className="jl-help-mini-label">{current.prompt}</span>
              <strong>{current.title}</strong>
            </div>
            <span className="jl-help-mini-live"><span /> EXEMPLO</span>
          </div>
          {showChart ? (
            <div className="jl-help-chart" aria-hidden="true">
              <div className="jl-help-chart-summary">
                <span>VISUALIZAÇÃO ILUSTRATIVA</span>
                <strong>Panorama</strong>
              </div>
              <svg className="jl-help-chart-svg" viewBox="0 0 460 104" role="presentation" preserveAspectRatio="none">
                <path className="jl-help-chart-guide" d="M0 21 H460 M0 52 H460 M0 83 H460" />
                <path className="jl-help-chart-area" d="M0 84 C80 79 108 59 160 65 S246 27 304 39 S378 26 460 11 V104 H0 Z" />
                <path className="jl-help-chart-line" d="M0 84 C80 79 108 59 160 65 S246 27 304 39 S378 26 460 11" />
                <circle className="jl-help-chart-point" cx="460" cy="11" r="5" />
              </svg>
            </div>
          ) : (
            <div className="jl-help-demo-input">
              <Icon size={17} aria-hidden="true" />
              <span>{current.prompt}</span>
              <span className="jl-help-demo-cursor" aria-hidden="true" />
              <span className="jl-help-demo-input-check"><Check size={14} aria-hidden="true" /></span>
            </div>
          )}
          <div className="jl-help-demo-rows">
            {current.rows.map((row, index) => (
              <div
                className="jl-help-demo-row"
                key={row}
                style={{ "--jl-help-index": index } as CSSProperties}
              >
                <span className="jl-help-demo-row-mark">
                  {index === 2 ? <Target size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                </span>
                <span className="jl-help-demo-row-label">{row}</span>
                <span className="jl-help-demo-row-line" aria-hidden="true" />
                <ArrowRight size={15} aria-hidden="true" />
              </div>
            ))}
          </div>
          <div className="jl-help-demo-finish">
            <Sparkles size={15} aria-hidden="true" />
            <span>Exemplo ilustrativo · sem executar ações reais</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceGuide({
  activeView,
  reduceMotion,
}: {
  activeView: AppView;
  reduceMotion: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const openingButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const summaryId = useId();
  const guide = GUIDES[activeView];
  const current = guide.scenes[stepIndex] ?? guide.scenes[0];
  const motionDisabled = reduceMotion || prefersReducedMotion;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (motionDisabled) setPlaying(false);
  }, [motionDisabled]);

  useEffect(() => {
    if (!open || motionDisabled || !playing) return;
    const id = window.setTimeout(() => {
      if (stepIndex >= 2) {
        setPlaying(false);
      } else {
        setStepIndex((value) => value + 1);
      }
    }, STEP_DURATION);
    return () => window.clearTimeout(id);
  }, [open, stepIndex, playing, motionDisabled]);

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onKeyDown);
      openingButton.current?.focus();
    };
  }, [open]);

  function openGuide() {
    setStepIndex(0);
    setPlaying(!motionDisabled);
    setOpen(true);
  }

  function navigateStep(index: number) {
    setStepIndex(index);
    setPlaying(false);
  }

  function togglePlayback() {
    if (motionDisabled) return;
    if (!playing && stepIndex === 2) setStepIndex(0);
    setPlaying((value) => !value);
  }

  return (
    <>
      <button
        className="jl-help-open"
        type="button"
        ref={openingButton}
        onClick={openGuide}
        aria-haspopup="dialog"
        aria-label={"Como funciona: " + guide.title}
        aria-expanded={open}
        title={"Como funciona: " + guide.title}
      >
        <CircleHelp size={17} strokeWidth={2} aria-hidden="true" />
        <span>Como funciona</span>
      </button>

      {open && createPortal(
        <div
          className={"jl-help-backdrop" + (motionDisabled ? " jl-help-no-motion" : "")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            className="jl-help-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={summaryId}
            ref={dialog}
          >
            <div className="jl-help-modal-head">
              <div className="jl-help-modal-brand">
                <span className="jl-help-brand-icon">J</span>
                <span>JANUÁRIO LEADS <span className="jl-help-head-divider">/</span> GUIA DO WORKSPACE</span>
              </div>
              <button className="jl-help-close" ref={closeButton} type="button" onClick={() => setOpen(false)} aria-label="Fechar tutorial">
                <X size={19} aria-hidden="true" />
              </button>
            </div>

            <div className="jl-help-dialog-content">
              <div className="jl-help-copy">
                <p className="jl-help-overline"><Sparkles size={15} aria-hidden="true" /> APRENDA EM TRÊS ETAPAS</p>
                <h2 id={titleId}>Como funciona <span>{guide.title}</span></h2>
                <p id={summaryId} className="jl-help-subtitle">{guide.subtitle}</p>

                <div className="jl-help-steps" aria-label="Etapas do tutorial">
                  {guide.scenes.map((item, index) => (
                    <button
                      key={item.title}
                      type="button"
                      className={"jl-help-step" + (index === stepIndex ? " is-active" : "")}
                      aria-current={index === stepIndex ? "step" : undefined}
                      onClick={() => navigateStep(index)}
                    >
                      <span className="jl-help-step-number">{"0" + (index + 1)}</span>
                      <span className="jl-help-step-copy">
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                      </span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </div>

                {motionDisabled && <p className="jl-help-motion-note">Animações reduzidas: use as etapas para avançar.</p>}
              </div>

              <div className="jl-help-screen">
                <div className="jl-help-screen-top">
                  <span className="jl-help-screen-overline">APRESENTAÇÃO ILUSTRATIVA</span>
                  <span className="jl-help-scene-count">{"0" + (stepIndex + 1)} / 03</span>
                </div>
                <AnimatedExample
                  key={activeView + "-" + stepIndex}
                  scene={current}
                  label={guide.title}
                  play={!motionDisabled && playing}
                />
                <div className="jl-help-screen-progress" aria-label={"Etapa " + (stepIndex + 1) + " de 3"}>
                  {STEPS.map((index) => (
                    <button
                      key={index}
                      type="button"
                      aria-label={"Ir para a etapa " + (index + 1)}
                      aria-current={index === stepIndex ? "step" : undefined}
                      className={"jl-help-progress-segment" + (index < stepIndex ? " is-finished" : "") + (index === stepIndex ? " is-active" : "")}
                      onClick={() => navigateStep(index)}
                    >
                      {index === stepIndex && playing && !motionDisabled ? (
                        <span key={stepIndex + "-progress"} className="jl-help-progress-fill" />
                      ) : null}
                    </button>
                  ))}
                </div>
                <div className="jl-help-controls">
                  <button className="jl-help-control-secondary" type="button" onClick={() => navigateStep(Math.max(0, stepIndex - 1))} disabled={stepIndex === 0}>
                    <ChevronLeft size={16} aria-hidden="true" /> Anterior
                  </button>
                  <div className="jl-help-controls-right">
                    {!motionDisabled && (
                      <button className="jl-help-play" type="button" onClick={togglePlayback}>
                        {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                        {playing ? "Pausar" : stepIndex === 2 ? "Rever" : "Reproduzir"}
                      </button>
                    )}
                    <button className="jl-help-control-primary" type="button" onClick={() => {
                      if (stepIndex === 2) setOpen(false);
                      else navigateStep(stepIndex + 1);
                    }}>
                      {stepIndex === 2 ? "Concluir" : "Próxima"}
                      {stepIndex !== 2 && <ChevronRight size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="jl-help-modal-footer">
              <span><ClipboardList size={14} aria-hidden="true" /> Tutorial demonstrativo — não altera seus dados</span>
              <span>Disponível em todas as seções</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
