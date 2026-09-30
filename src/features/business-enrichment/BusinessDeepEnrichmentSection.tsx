import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  RefreshCw,
  SearchCheck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { BusinessSearchResult } from "../search-leads/types";
import {
  deepenBusiness,
  getDeepEnrichmentStatus,
  reviewDeepEnrichmentFact,
} from "./business-enrichment";
import type {
  DeepEnrichmentApplied,
  DeepEnrichmentSnapshot,
} from "./types";

function qualityLabel(value: DeepEnrichmentSnapshot["quality"]) {
  if (value === "high") return "Alta";
  if (value === "medium") return "Média";
  if (value === "low") return "Baixa";
  return "Ainda não avaliada";
}

function factValue(value: Record<string, unknown>) {
  const candidates = [
    value.name,
    value.role,
    value.detail,
    value.price,
    value.url,
    value.imageUrl,
  ];
  return candidates
    .filter((item): item is string => typeof item === "string" && item.trim())
    .join(" · ");
}

function applied(snapshot: DeepEnrichmentSnapshot): DeepEnrichmentApplied {
  return {
    verifiedContent: snapshot.verifiedContent,
    verifiedImages: snapshot.verifiedImages,
    confirmedChannels: snapshot.confirmedChannels,
    identityUpdates: snapshot.identityUpdates,
    status: snapshot.status,
    quality: snapshot.quality,
    checkedAt: snapshot.checkedAt,
  };
}

export function BusinessDeepEnrichmentSection({
  business,
  segment,
  leadId,
  onApply,
}: {
  business: BusinessSearchResult;
  segment: string;
  leadId?: string | null;
  onApply?: (value: DeepEnrichmentApplied) => void;
}) {
  const [snapshot, setSnapshot] = useState<DeepEnrichmentSnapshot | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [researching, setResearching] = useState(false);
  const [reviewingId, setReviewingId] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [error, setError] = useState("");
  const [pollTimedOut, setPollTimedOut] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingStatus(true);
    setSnapshot(null);
    setError("");
    setDetailsOpen(false);
    setPollTimedOut(false);

    void getDeepEnrichmentStatus({ business, segment, leadId })
      .then((result) => {
        if (!active) return;
        setSnapshot(result.snapshot);
        if (result.snapshot.runId) onApply?.(applied(result.snapshot));
      })
      .catch(() => {
        if (!active) return;
        // Status lookup is intentionally quiet. It never starts research.
        setSnapshot(null);
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });

    return () => {
      active = false;
    };
  }, [business.placeId, leadId, segment]);

  useEffect(() => {
    if (snapshot?.status !== "researching" || researching) return;

    let active = true;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (attempts > 36) {
        window.clearInterval(timer);
        if (active) setPollTimedOut(true);
        return;
      }

      void getDeepEnrichmentStatus({ business, segment, leadId })
        .then((result) => {
          if (!active) return;
          setSnapshot(result.snapshot);
          if (
            result.snapshot.status === "completed" ||
            result.snapshot.status === "needs_review" ||
            result.snapshot.status === "failed"
          ) {
            window.clearInterval(timer);
            if (result.snapshot.runId) {
              onApply?.(applied(result.snapshot));
            }
          }
        })
        .catch(() => {
          // Keep polling within the bounded window.
        });
    }, 5_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [snapshot?.status, researching, business.placeId, leadId, segment]);

    async function run(force: boolean) {
    if (researching) return;
    setResearching(true);
    setError("");
    try {
      const result = await deepenBusiness({
        business,
        segment,
        leadId,
        force,
      });
      setSnapshot(result.snapshot);
      onApply?.(applied(result.snapshot));
      if (result.snapshot.status === "failed") {
        setError(
          result.snapshot.errorSummary ||
            "A pesquisa terminou sem dados utilizáveis. Tente novamente mais tarde.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Não foi possível concluir a pesquisa aprofundada.",
      );
    } finally {
      setResearching(false);
    }
  }

  async function review(factId: string, decision: "confirm" | "reject") {
    if (reviewingId) return;
    setReviewingId(factId);
    setError("");
    try {
      const result = await reviewDeepEnrichmentFact({ factId, decision });
      setSnapshot(result.snapshot);
      onApply?.(applied(result.snapshot));
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Não foi possível revisar esta informação.",
      );
    } finally {
      setReviewingId("");
    }
  }

  const notStarted =
    !snapshot || snapshot.status === "not_started";
  const hasPriceToReview =
    snapshot?.reviewFacts.some((fact) => fact.type === "price") ?? false;
  const done =
    snapshot &&
    (snapshot.status === "completed" ||
      snapshot.status === "needs_review");

  return (
    <div className="detail-section deep-enrichment-section">
      <div className="deep-enrichment-heading">
        <div>
          <span>PESQUISA APROFUNDADA</span>
          <strong>Aprofundar empresa</strong>
          <small>
            Pesquisa manual de fontes públicas com evidência e validação de identidade.
          </small>
        </div>
        {done && (
          <span className={`deep-quality ${snapshot.quality ?? "low"}`}>
            Qualidade {qualityLabel(snapshot.quality)}
          </span>
        )}
      </div>

      {loadingStatus ? (
        <div className="deep-enrichment-loading">
          <Loader2 size={15} className="auth-spinner" />
          <span>Verificando pesquisa anterior...</span>
        </div>
      ) : notStarted ? (
        <div className="deep-enrichment-empty">
          <p>Ainda não realizada.</p>
          <button
            type="button"
            className="secondary-button deep-enrichment-run"
            disabled={researching}
            onClick={() => void run(false)}
          >
            {researching ? (
              <Loader2 size={14} className="auth-spinner" />
            ) : (
              <SearchCheck size={14} />
            )}
            {researching ? "Pesquisando..." : "Aprofundar empresa"}
          </button>
        </div>
      ) : snapshot?.status === "failed" ? (
        <div className="deep-enrichment-empty">
          <p>
            A pesquisa não pôde ser concluída.
            {snapshot.errorSummary ? ` ${snapshot.errorSummary}` : ""}
          </p>
          <button
            type="button"
            className="secondary-button deep-enrichment-run"
            disabled={researching}
            onClick={() => void run(true)}
          >
            <RefreshCw size={14} />
            Tentar novamente
          </button>
        </div>
      ) : done ? (
        <>
          <div className="deep-enrichment-summary">
            <div>
              <span>Serviços</span>
              <strong>{snapshot.summary.services} encontrados</strong>
            </div>
            <div>
              <span>Profissionais</span>
              <strong>{snapshot.summary.professionals} encontrados</strong>
            </div>
            <div>
              <span>Portfólio</span>
              <strong>
                {snapshot.summary.portfolioImages > 0
                  ? "Disponível"
                  : "Não encontrado"}
              </strong>
            </div>
            <div>
              <span>Imagens verificadas</span>
              <strong>{snapshot.summary.verifiedImages}</strong>
            </div>
            <div>
              <span>Agendamento</span>
              <strong>
                {snapshot.summary.bookingConfirmed
                  ? "Confirmado"
                  : "Não confirmado"}
              </strong>
            </div>
            <div>
              <span>WhatsApp</span>
              <strong>
                {snapshot.summary.whatsappConfirmed
                  ? "Confirmado"
                  : "Não confirmado"}
              </strong>
            </div>
            <div>
              <span>Preços</span>
              <strong>
                {snapshot.summary.prices > 0
                  ? `${snapshot.summary.prices} encontrados`
                  : hasPriceToReview
                    ? "Parcialmente encontrados"
                    : "Não encontrados"}
              </strong>
            </div>
            <div>
              <span>Qualidade dos dados</span>
              <strong>{qualityLabel(snapshot.quality)}</strong>
            </div>
          </div>

          {snapshot.status === "needs_review" &&
            snapshot.reviewFacts.length > 0 && (
              <div className="deep-review-notice">
                <strong>
                  {snapshot.reviewFacts.length}{" "}
                  {snapshot.reviewFacts.length === 1
                    ? "informação precisa"
                    : "informações precisam"}{" "}
                  de revisão
                </strong>
                <span>
                  Dados MEDIUM não entram automaticamente no Gerar Prompt.
                </span>
              </div>
            )}

          <div className="deep-enrichment-actions">
            <button
              type="button"
              onClick={() => setDetailsOpen((current) => !current)}
            >
              {detailsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {detailsOpen ? "Ocultar detalhes" : "Ver detalhes"}
            </button>
            <button
              type="button"
              disabled={researching}
              onClick={() => void run(true)}
            >
              <RefreshCw size={13} />
              {researching ? "Pesquisando..." : "Pesquisar novamente"}
            </button>
          </div>

          {detailsOpen && (
            <div className="deep-enrichment-details">
              {snapshot.reviewFacts.length > 0 && (
                <div className="deep-review-list">
                  <span className="deep-detail-label">REVISAR INFORMAÇÕES</span>
                  {snapshot.reviewFacts.map((fact) => (
                    <article className="deep-review-item" key={fact.id}>
                      <div>
                        <strong>{fact.label}</strong>
                        {factValue(fact.value) && (
                          <span>{factValue(fact.value)}</span>
                        )}
                        {fact.evidenceSummary && (
                          <small>{fact.evidenceSummary}</small>
                        )}
                        {fact.sourceUrl && (
                          <a
                            href={fact.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ver fonte <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <div className="deep-review-actions">
                        <button
                          type="button"
                          disabled={Boolean(reviewingId)}
                          onClick={() => void review(fact.id, "confirm")}
                        >
                          <Check size={12} />
                          Confirmar
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(reviewingId)}
                          onClick={() => void review(fact.id, "reject")}
                        >
                          <X size={12} />
                          Ignorar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              <div className="deep-source-list">
                <span className="deep-detail-label">FONTES CONSULTADAS</span>
                {snapshot.sources.length > 0 ? (
                  snapshot.sources.slice(0, 12).map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span>{source.domain || source.type}</span>
                      <small>{source.type.replaceAll("_", " ")}</small>
                      <ExternalLink size={10} />
                    </a>
                  ))
                ) : (
                  <small>Nenhuma fonte adicional utilizável foi registrada.</small>
                )}
              </div>

              <div className="deep-enrichment-metrics">
                <span>
                  {snapshot.metrics.pagesAnalyzed} páginas analisadas
                </span>
                <span>
                  {snapshot.metrics.webSearchCalls} buscas públicas
                </span>
                <span>
                  {snapshot.metrics.browserlessCalls} renderizações Browserless
                </span>
                {snapshot.summary.conflicts > 0 && (
                  <span>{snapshot.summary.conflicts} conflitos registrados</span>
                )}
              </div>
            </div>
          )}
        </>
      ) : pollTimedOut ? (
        <div className="deep-enrichment-empty">
          <p>
            A pesquisa está demorando mais que o esperado. Verifique o estado
            novamente antes de iniciar outra.
          </p>
          <button
            type="button"
            className="secondary-button deep-enrichment-run"
            onClick={() => {
              setPollTimedOut(false);
              setSnapshot(null);
              setLoadingStatus(true);
              void getDeepEnrichmentStatus({ business, segment, leadId })
                .then((result) => {
                  setSnapshot(result.snapshot);
                  if (result.snapshot.runId) onApply?.(applied(result.snapshot));
                })
                .catch(() => setError("Não foi possível verificar o estado da pesquisa."))
                .finally(() => setLoadingStatus(false));
            }}
          >
            <RefreshCw size={14} />
            Verificar novamente
          </button>
        </div>
      ) : (
        <div className="deep-enrichment-loading">
          <Loader2 size={15} className="auth-spinner" />
          <span>Pesquisa em andamento...</span>
        </div>
      )}

      {error && (
        <p className="deep-enrichment-error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
