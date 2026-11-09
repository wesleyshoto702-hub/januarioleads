import type { ProspectingSummary } from "./prospecting-progress";

type Props = {
  kind: "saved" | "results";
  segment: string;
  city: string;
  state: string;
  summary: ProspectingSummary;
  confirmationState: "loading" | "ready" | "error";
};

export function ProspectingProgressPanel({
  kind, segment, city, state, summary, confirmationState,
}: Props) {
  const isResults = kind === "results";
  const totalLabel = isResults ? "Empresas carregadas" : "Leads no seu CRM";
  const waitingForHistory = confirmationState !== "ready";
  const percent = (value: number) => `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })}%`;

  return (
    <section className="prospecting-progress" aria-label="Progresso da prospecção">
      <div className="prospecting-progress-header">
        <div>
          <span className="prospecting-progress-eyebrow">PROGRESSO DA PROSPECÇÃO</span>
          <h2>{segment} · {city} / {state}</h2>
          <p>{isResults
            ? "Cobertura dos resultados carregados nesta pesquisa, comparados ao seu CRM."
            : "Histórico salvo para este nicho e município, antes de fazer uma nova pesquisa."}</p>
        </div>
        <span className="prospecting-progress-label">{isResults ? "Nesta busca" : "Seu histórico"}</span>
      </div>

      <div className="prospecting-progress-kpis">
        <div><strong>{summary.total}</strong><span>{totalLabel}</span></div>
        {isResults && <div><strong>{summary.saved}</strong><span>Já adicionadas</span></div>}
        <div>
          <strong>{waitingForHistory ? "—" : summary.confirmed}</strong>
          <span>Envio confirmado</span>
        </div>
        <div>
          <strong>{waitingForHistory ? "—" : summary.legacy}</strong>
          <span>Contato antigo sem confirmação</span>
        </div>
      </div>

      {isResults && (
        <div className="prospecting-progress-meter">
          <div><strong>Leads adicionados</strong><span>{percent(summary.savedPercent)}</span></div>
          <div className="prospecting-progress-track" role="progressbar"
            aria-label="Empresas adicionadas aos seus leads"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.savedPercent}>
            <span className="prospecting-progress-fill saved" style={{ width: `${summary.savedPercent}%` }}/>
          </div>
        </div>
      )}
      <div className="prospecting-progress-meter">
        <div>
          <strong>Mensagens com envio confirmado</strong>
          <span>{waitingForHistory ? "—" : percent(summary.confirmedPercent)}</span>
        </div>
        <div className="prospecting-progress-track" role={waitingForHistory ? undefined : "progressbar"}
          aria-label="Empresas com envio de mensagem confirmado"
          aria-valuemin={waitingForHistory ? undefined : 0}
          aria-valuemax={waitingForHistory ? undefined : 100}
          aria-valuenow={waitingForHistory ? undefined : summary.confirmedPercent}>
          <span className="prospecting-progress-fill confirmed"
            style={{ width: `${waitingForHistory ? 0 : summary.confirmedPercent}%` }}/>
        </div>
      </div>
      <p className="prospecting-progress-note" role={confirmationState === "error" ? "status" : undefined}>
        {confirmationState === "loading"
          ? "Consultando confirmações de envio do seu histórico..."
          : confirmationState === "error"
            ? "Não foi possível consultar o histórico de confirmações. Reabra Buscar Leads para tentar novamente; a porcentagem não será estimada."
            : isResults
              ? "Uma empresa conta só uma vez. Abrir o WhatsApp não significa enviar; apenas o botão “Confirmar envio” registra a confirmação."
              : "A porcentagem usa apenas seus leads salvos como base, não todas as empresas da cidade. Os status antigos são mostrados separadamente."}
      </p>
    </section>
  );
}
