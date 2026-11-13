import { ArrowLeft, ArrowRight, Check, CircleHelp, Pause, Play, RotateCcw, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { AppView } from "./AppShell";
import { WORKSPACE_FILMS, WorkspaceGuideFilm } from "./WorkspaceGuideFilm";

const PHASE_MS = 4800;
const PHASE_COUNT = 4;

/** The scene stays mounted across the four moments; only the modeled UI changes. */
export function WorkspaceGuide({ activeView, reduceMotion }: {
  activeView: AppView;
  reduceMotion: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const opener = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const script = WORKSPACE_FILMS[activeView];
  const scene = script.scenes[phase] ?? script.scenes[0];
  const reduced = reduceMotion || systemReduced;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const update = () => setTabVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (reduced) setPlaying(false);
  }, [reduced]);

  useEffect(() => {
    if (!open || !playing || reduced || !tabVisible) return;
    const timeout = window.setTimeout(() => {
      if (phase === PHASE_COUNT - 1) setPlaying(false);
      else setPhase((value) => value + 1);
    }, PHASE_MS);
    return () => window.clearTimeout(timeout);
  }, [open, playing, phase, reduced, tabVisible]);

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
      if (event.key !== "Tab") return;
      const focusables = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onKey);
      opener.current?.focus();
    };
  }, [open]);

  function start() { setPhase(0); setPlaying(!reduced); setOpen(true); }
  function seek(step: number, pausePlayback = false) {
    setPhase(Math.max(0, Math.min(PHASE_COUNT - 1, step)));
    // Jumping directly on the timeline pauses playback. Previous/Next
    // preserve playback so the film continues after the user advances it.
    if (pausePlayback) setPlaying(false);
  }
  function replay() { setPhase(0); setPlaying(!reduced); }
  function toggle() {
    if (reduced) return;
    if (!playing && phase === 3) { replay(); return; }
    setPlaying((v) => !v);
  }

  return <>
    <button
      type="button"
      ref={opener}
      className="jl-help-open"
      aria-label={"Como funciona: " + script.title}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={"Como funciona: " + script.title}
      onClick={start}
    ><CircleHelp size={17} aria-hidden="true"/><span>Como funciona</span></button>
    {open && createPortal(
      <div className={"jlf-overlay" + (reduced ? " jlf-reduced" : "")}
        onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div className="jlf-modal" role="dialog" aria-modal="true" aria-labelledby={headingId} ref={dialog}>
          <div className="jlf-modal-head">
            <div className="jlf-brand"><span>J</span><strong>JANUÁRIO LEADS</strong><i>/</i><small>COMO FUNCIONA</small></div>
            <button type="button" ref={closeButton} className="jlf-close"
              onClick={() => setOpen(false)} aria-label="Fechar tutorial"><X size={19}/></button>
          </div>
          <div className="jlf-modal-content">
            <div className="jlf-overline"><span className="jlf-live-dot"/> DEMONSTRAÇÃO GUIADA · 4 MOMENTOS</div>
            <div className="jlf-intro"><div><h2 id={headingId}>{script.title}</h2><p>{script.subtitle}</p></div></div>
            <div className="jlf-player">
              <div className="jlf-player-bar"><div className="jlf-window-dots"><i/><i/><i/></div><span>januarioleads / workspace / {activeView}</span><small>SIMULAÇÃO ILUSTRATIVA</small></div>
              <div className={"jlf-stage" + (playing && !reduced && tabVisible ? " is-playing" : "")}
                data-view={activeView} data-phase={phase}>
                <WorkspaceGuideFilm key={activeView} view={activeView} phase={phase} motionDisabled={reduced} />
                <div className="jlf-stage-corner">EXEMPLO · NÃO ALTERA DADOS</div>
              </div>
              <div className="jlf-player-bottom">
                <div className="jlf-timeline" aria-label="Momentos da demonstração">
                  {script.scenes.map((item, index) => (
                    <button key={index} type="button"
                      className={"jlf-timeline-step" + (index < phase ? " completed" : "") + (index === phase ? " active" : "")}
                      aria-label={"Ir para o momento " + (index + 1) + ": " + item.action}
                      aria-current={index === phase ? "step" : undefined}
                      onClick={() => seek(index, true)}>
                      {index === phase && playing && tabVisible && !reduced &&
                        <i key={phase + "-bar"} className="jlf-timeline-fill"/>}
                    </button>
                  ))}
                </div>
                <div className="jlf-narration" aria-live="polite" aria-atomic="true">
                  <div><small>ETAPA {phase + 1} DE {PHASE_COUNT}</small><strong>{scene.action}</strong><p>{scene.narration}</p></div>
                  <span>{phase + 1} / {PHASE_COUNT}</span>
                </div>
                <div className="jlf-actions">
                  <div className="jlf-player-actions">
                    <button type="button" onClick={() => seek(phase - 1)} disabled={phase === 0}><ArrowLeft size={15}/> Anterior</button>
                    {!reduced && <button type="button" onClick={toggle}>
                      {playing ? <Pause size={15}/> : phase === 3 ? <RotateCcw size={15}/> : <Play size={15}/>}
                      {playing ? "Pausar" : phase === 3 ? "Rever" : "Reproduzir"}
                    </button>}
                  </div>
                  {phase === 3 ? <button type="button" className="jlf-action-primary" onClick={() => setOpen(false)}><Check size={15}/> Entendi</button>
                    : <button type="button" className="jlf-action-primary" onClick={() => seek(phase + 1)}>Próximo <ArrowRight size={15}/></button>}
                </div>
              </div>
            </div>
            <div className="jlf-disclaimer">Simulação com dados fictícios. Nenhuma busca, mensagem, proposta ou pagamento é executado.</div>
          </div>
        </div>
      </div>, document.body,
    )}
  </>;
}
