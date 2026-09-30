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

function sourceKindLabel(
  value: DeepEnrichmentSnapshot["sources"][number]["sourceKind"],
) {
  if (value === "official_linked_platform") return "Plataforma comercial vinculada";
  if (value === "official_website") return "Site oficial";
  return "Busca pública";
}

function extractionLabel(
  value: DeepEnrichmentSnapshot["sources"][number]["extractionStatus"],
) {
  if (value === "successful") return "Bem-sucedida";
  if (value === "partial") return "Parcial";
  if (value === "inconclusive") return "Inconclusiva";
  if (value === "blocked") return "Bloqueada";
  return "Falhou";
}

function methodLabel(
  value: DeepEnrichmentSnapshot["sources"][number]["method"],
) {
  if (value === "http+browserless") return "HTTP + Browserless";
  if (value === "browserless") return "Browserless";
  if (value === "web_search") return "Web Search";
  return "HTTP";
}

function browserlessReasonLabel(value: string) {
  const labels: Record<string,string> = {
    dynamic_app_detected: "Aplicação dinâmica detectada",
    commercial_content_missing: "Conteúdo comercial possivelmente incompleto",
    spa_shell: "App shell / SPA detectada",
    js_render_required: "Renderização JavaScript necessária",
    html_insufficient: "HTML inicial insuficiente",
    sufficient_static_content: "Conteúdo estático suficiente",
    commercial_content_present: "Conteúdo comercial já presente no HTML",
    browserless_unavailable: "Browserless indisponível",
    browserless_failed: "Renderização não concluída",
    identity_mismatch: "Identidade da plataforma não correspondeu",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

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
          <div className="deep-quality-wrap">
            <span className={`deep-quality ${snapshot.quality ?? "low"}`}>
              Qualidade {qualityLabel(snapshot.quality)}
            </span>
            {snapshot.generatedWithOldEngine && (
              <small>Resultado gerado com versão anterior da pesquisa.</small>
            )}
          </div>
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
            {snapshot.summary.menuItems > 0 && (
              <div>
                <span>Itens de menu</span>
                <strong>{snapshot.summary.menuItems} encontrados</strong>
              </div>
            )}
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
            {snapshot.summary.deliveryConfirmed && (
              <div>
                <span>Delivery / pedido</span>
                <strong>Confirmado</strong>
              </div>
            )}
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
                    <article className="deep-source-item" key={source.url}>
                      <div className="deep-source-title">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span>{source.domain || source.url}</span>
                          <ExternalLink size={10} />
                        </a>
                        <small>{sourceKindLabel(source.sourceKind)}</small>
                      </div>
                      <div className="deep-source-diagnostics">
                        <span>
                          Método <b>{methodLabel(source.method)}</b>
                        </span>
                        <span>
                          Extração <b>{extractionLabel(source.extractionStatus)}</b>
                        </span>
                        <span>
                          Browserless{" "}
                          <b>
                            {source.browserlessDecision === "used"
                              ? "utilizado"
                              : source.browserlessDecision === "not_needed"
                                ? "não necessário"
                                : source.browserlessDecision === "unavailable"
                                  ? "indisponível"
                                  : "falhou"}
                          </b>
                        </span>
                      </div>
                      <small className="deep-source-reason">
                        {browserlessReasonLabel(source.browserlessReason)}
                      </small>
                      {source.found.facts > 0 && (
                        <div className="deep-source-found">
                          {source.found.products + source.found.menuItems > 0 && (
                            <span>
                              {source.found.products + source.found.menuItems} itens
                            </span>
                          )}
                          {source.found.prices > 0 && (
                            <span>{source.found.prices} preços</span>
                          )}
                          {source.found.images > 0 && (
                            <span>{source.found.images} imagens</span>
                          )}
                          {source.found.services > 0 && (
                            <span>{source.found.services} serviços</span>
                          )}
                          {source.found.channels > 0 && (
                            <span>{source.found.channels} canais</span>
                          )}
                        </div>
                      )}
                      {source.method !== "web_search" && (
                        <div className="deep-source-tech">
                          <span>{source.textLength} caracteres de texto</span>
                          <span>{source.linkCount} links</span>
                          <span>{source.scriptCount} scripts</span>
                          <span>{source.jsonLdCount} JSON-LD</span>
                          {source.frameworkSignals.length > 0 && (
                            <span>{source.frameworkSignals.join(" · ")}</span>
                          )}
                        </div>
                      )}
                    </article>
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
                  {snapshot.metrics.browserlessRenders ??
                    snapshot.metrics.browserlessCalls} renderizações Browserless
                </span>
                {snapshot.metrics.sourcesInconclusive > 0 && (
                  <span>
                    {snapshot.metrics.sourcesInconclusive} extrações inconclusivas
                  </span>
                )}
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
