import {
  Check,
  Copy,
  Loader2,
  RefreshCw,
  Eye,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { generateSitePrompt } from "./generate-site-prompt";
import { getSavedPrompt, savePrompt } from "./storage";
import {
  generatePreview,
  getSavedPreview,
  savePreview,
} from "../site-preview/preview-service";
import { SitePreviewViewer } from "../site-preview/SitePreviewViewer";
import {
  isPreviewCurrent,
  type SavedPreviewRecord,
} from "../site-preview/types";
import type {
  GeneratedSitePrompt,
  PromptBusinessContext,
  PromptObjective,
  PromptProjectType,
  SavedPromptRecord,
} from "./types";

const PROJECT_TYPES: PromptProjectType[] = [
  "IA decidir",
  "Landing Page",
  "Site Institucional",
];

const OBJECTIVES: PromptObjective[] = [
  "IA decidir",
  "Conseguir pedidos",
  "Conseguir agendamentos",
  "Receber contatos",
  "Solicitar orçamento",
  "Levar para o WhatsApp",
  "Apresentar serviços",
  "Levar pessoas ao estabelecimento",
];

const GENERATION_STEPS = [
  "Analisando empresa...",
  "Definindo estratégia...",
  "Preparando prompt...",
];

type ResultTab =
  | "analysis"
  | "strategy"
  | "visual"
  | "images"
  | "sections"
  | "prompt";

export function PromptGenerator({
  business,
  onClose,
  onGenerated,
}: {
  business: PromptBusinessContext;
  onClose: () => void;
  onGenerated?: (input: {
    regenerated: boolean;
    generatedAt: string;
    projectType: PromptProjectType;
    objective: PromptObjective;
  }) => void;
}) {
  const [projectType, setProjectType] =
    useState<PromptProjectType>("IA decidir");
  const [objective, setObjective] = useState<PromptObjective>("IA decidir");
  const [result, setResult] = useState<GeneratedSitePrompt | null>(null);
  const [promptRecord, setPromptRecord] = useState<SavedPromptRecord | null>(null);
  const [preview, setPreview] = useState<SavedPreviewRecord | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [activeTab, setActiveTab] = useState<ResultTab>("analysis");
  const [loading, setLoading] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    const saved = getSavedPrompt(business.key);

    setPreview(null);
    setPreviewOpen(false);
    setPreviewError("");

    if (!saved) {
      setProjectType("IA decidir");
      setObjective("IA decidir");
      setResult(null);
      setPromptRecord(null);
      setActiveTab("analysis");
    } else {
      setProjectType(saved.projectType);
      setObjective(saved.objective);
      setResult(saved.result);
      setPromptRecord(saved);
      setActiveTab("analysis");
    }

    void getSavedPreview(business.key).then((storedPreview) => {
      if (active) setPreview(storedPreview);
    });

    return () => {
      active = false;
    };
  }, [business.key]);

  const availableFacts = useMemo(
    () =>
      [
        business.segment,
        business.address,
        business.phone,
        business.website,
        business.instagram,
        business.rating !== null && business.rating !== undefined
          ? `Avaliação ${business.rating.toFixed(1)}`
          : null,
      ].filter(Boolean).length,
    [business],
  );

  async function handleGenerate() {
    if (loading) return;

    const regenerated = Boolean(result);

    if (
      result &&
      !window.confirm(
        "Gerar uma nova versão substituirá o último prompt salvo para esta empresa. Continuar?",
      )
    ) {
      return;
    }

    setLoading(true);
    setError("");
    setCopied(false);
    setGenerationStep(0);

    const timer = window.setInterval(() => {
      setGenerationStep((current) =>
        Math.min(current + 1, GENERATION_STEPS.length - 1),
      );
    }, 1700);

    const response = await generateSitePrompt({
      business,
      projectType,
      objective,
    });

    window.clearInterval(timer);
    setLoading(false);

    if (!response.ok) {
      setError(response.message);
      return;
    }

    setResult(response.result);
    setActiveTab("analysis");

    const nextPrompt: SavedPromptRecord = {
      businessKey: business.key,
      company: business.company,
      generatedAt: new Date().toISOString(),
      projectType,
      objective,
      result: response.result,
    };

    savePrompt(nextPrompt);
    setPromptRecord(nextPrompt);
    onGenerated?.({
      regenerated,
      generatedAt: nextPrompt.generatedAt,
      projectType,
      objective,
    });
  }

  async function handleGeneratePreview(force = false) {
    if (!promptRecord || previewLoading) return;

    if (!force && isPreviewCurrent(preview, promptRecord)) {
      setPreviewOpen(true);
      return;
    }

    setPreviewLoading(true);
    setPreviewError("");

    const response = await generatePreview({
      business,
      prompt: promptRecord,
    });

    setPreviewLoading(false);

    if (!response.ok) {
      setPreviewError(response.message);
      return;
    }

    setPreview(response.preview);
    setPreviewOpen(true);

    const persisted = await savePreview(response.preview);
    if (!persisted) {
      setPreviewError(
        "A prévia foi criada, mas o cache remoto não pôde ser confirmado. Você ainda pode visualizá-la agora.",
      );
    }
  }

  async function copyPrompt() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.lovablePrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <div className="modal-backdrop prompt-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-card prompt-generator-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Gerar prompt para ${business.company}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header prompt-generator-header">
          <div>
            <span className="detail-kicker">ESTRATÉGIA DE SITE</span>
            <h2>Gerar prompt</h2>
            <p>{business.company}</p>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="prompt-generator-content">
          <section className="prompt-config">
            <div className="prompt-config-intro">
              <div>
                <Sparkles size={17} />
                <strong>Análise baseada nos dados reais disponíveis</strong>
              </div>
              <span>{availableFacts} sinais principais encontrados</span>
            </div>

            <div className="prompt-config-grid">
              <label>
                <span>Tipo de projeto</span>
                <select
                  value={projectType}
                  onChange={(event) =>
                    setProjectType(event.target.value as PromptProjectType)
                  }
                  disabled={loading}
                >
                  {PROJECT_TYPES.map((item) => (
                    <option value={item} key={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Objetivo principal</span>
                <select
                  value={objective}
                  onChange={(event) =>
                    setObjective(event.target.value as PromptObjective)
                  }
                  disabled={loading}
                >
                  {OBJECTIVES.map((item) => (
                    <option value={item} key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="prompt-source-summary">
              <Fact label="Segmento" value={business.segment || "Não identificado"} />
              <Fact label="Localização" value={business.address || business.city || "Não identificada"} />
              <Fact label="Site" value={business.website ? "Identificado" : "Não identificado"} />
              <Fact label="Instagram" value={business.instagram ? "Identificado" : "Não identificado"} />
            </div>

            <div className="prompt-generate-row">
              <p>
                Lacunas continuam explícitas no briefing, mas não viram seções vazias ou
                placeholders grandes na landing page.
              </p>
              <button
                className="primary-button prompt-generate-button"
                type="button"
                disabled={loading}
                onClick={() => void handleGenerate()}
              >
                {loading ? <Loader2 size={16} className="auth-spinner" /> : result ? <RefreshCw size={16} /> : <Sparkles size={16} />}
                {loading
                  ? GENERATION_STEPS[generationStep]
                  : result
                    ? "Gerar nova versão"
                    : "Gerar análise e prompt"}
              </button>
            </div>

            {error && <div className="prompt-error">{error}</div>}
          </section>

          <section className="prompt-preview-panel">
            <div className="prompt-preview-heading">
              <div>
                <span className="detail-kicker">PREVIEW</span>
                <strong>
                  {!promptRecord
                    ? "Gere o prompt primeiro."
                    : !preview
                      ? "Ainda não gerado"
                      : isPreviewCurrent(preview, promptRecord)
                        ? "Preview atualizado"
                        : "Preview baseado em uma versão anterior do prompt"}
                </strong>
                {preview && (
                  <small>
                    Gerado em {new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(preview.generatedAt))}
                  </small>
                )}
              </div>

              <div className="prompt-preview-actions">
                {preview && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Eye size={15} />
                    Visualizar
                  </button>
                )}

                <button
                  type="button"
                  className="primary-button"
                  disabled={!promptRecord || previewLoading}
                  onClick={() =>
                    void handleGeneratePreview(
                      Boolean(preview && isPreviewCurrent(preview, promptRecord)),
                    )
                  }
                >
                  {previewLoading ? (
                    <Loader2 size={15} className="auth-spinner" />
                  ) : (
                    <Sparkles size={15} />
                  )}
                  {previewLoading
                    ? "Criando prévia da landing page..."
                    : preview && isPreviewCurrent(preview, promptRecord)
                      ? "Gerar novamente"
                      : "Gerar preview"}
                </button>
              </div>
            </div>

            {previewLoading && (
              <p className="prompt-preview-loading">
                Isso pode levar alguns segundos. O restante do CRM continua disponível.
              </p>
            )}
            {previewError && <div className="prompt-error">{previewError}</div>}
          </section>

          {result && (
            <section className="prompt-result">
              <div className="prompt-tabs" role="tablist" aria-label="Resultado da análise">
                {([
                  ["analysis", "Análise"],
                  ["strategy", "Estratégia"],
                  ["visual", "Direção visual"],
                  ["images", "Imagens"],
                  ["sections", "Estrutura"],
                  ["prompt", "Prompt Lovable"],
                ] as [ResultTab, string][]).map(([tab, label]) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    className={activeTab === tab ? "prompt-tab active" : "prompt-tab"}
                    onClick={() => setActiveTab(tab)}
                    key={tab}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="prompt-tab-content">
                {activeTab === "analysis" && <AnalysisTab result={result} />}
                {activeTab === "strategy" && <StrategyTab result={result} />}
                {activeTab === "visual" && <VisualTab result={result} />}
                {activeTab === "images" && <ImagesTab result={result} />}
                {activeTab === "sections" && <SectionsTab result={result} />}
                {activeTab === "prompt" && (
                  <div className="lovable-prompt-view">
                    <div className="prompt-copy-heading">
                      <div>
                        <strong>Prompt estratégico para Lovable</strong>
                        <span>Direção forte, adaptativa e pronta para implementação.</span>
                      </div>
                      <button className="primary-button" type="button" onClick={() => void copyPrompt()}>
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? "Copiado" : "Copiar prompt"}
                      </button>
                    </div>
                    <pre>{result.lovablePrompt}</pre>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </section>

      {previewOpen && preview && (
        <SitePreviewViewer
          preview={preview}
          stale={!isPreviewCurrent(preview, promptRecord)}
          onClose={() => setPreviewOpen(false)}
          onRegenerate={() => {
            setPreviewOpen(false);
            void handleGeneratePreview(true);
          }}
        />
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="prompt-fact">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AnalysisTab({ result }: { result: GeneratedSitePrompt }) {
  return (
    <div className="prompt-result-grid">
      <ResultBlock title="Empresa">
        <p><strong>{result.analysis.company}</strong></p>
        <p>{result.analysis.segment} · {result.analysis.nicheClassification}</p>
      </ResultBlock>
      <ResultList title="Fatos encontrados" items={result.analysis.facts} />
      <ResultList title="Presença digital encontrada" items={result.analysis.digitalPresence} />
      <ResultList title="Oportunidades observadas" items={result.analysis.opportunities} />
      <ResultList title="Informações a confirmar" items={result.analysis.missingInformation} />
      <ResultList title="Limitações dos dados" items={result.analysis.dataLimitations} />
    </div>
  );
}

function StrategyTab({ result }: { result: GeneratedSitePrompt }) {
  return (
    <div className="prompt-result-grid two-columns">
      <Fact label="Projeto recomendado" value={result.strategy.projectType} />
      <Fact label="Objetivo principal" value={result.strategy.mainObjective} />
      <Fact label="CTA principal" value={result.strategy.primaryCta} />
      <ResultBlock title="Estratégia de conversão">
        <p>{result.strategy.conversionStrategy}</p>
      </ResultBlock>
      <ResultBlock title="Por que essa estratégia">
        <p>{result.strategy.rationale}</p>
      </ResultBlock>
    </div>
  );
}

function VisualTab({ result }: { result: GeneratedSitePrompt }) {
  return (
    <div className="prompt-result-grid">
      <ResultBlock title="Direção">
        <p>{result.visualDirection.style}</p>
      </ResultBlock>
      <ResultList title="Personalidade" items={result.visualDirection.personality} />
      <ResultBlock title="Tipografia">
        <p><strong>Títulos:</strong> {result.visualDirection.typography.headings}</p>
        <p><strong>Corpo:</strong> {result.visualDirection.typography.body}</p>
        <p>{result.visualDirection.typography.rationale}</p>
      </ResultBlock>
      <div className="result-block">
        <h3>Paleta proposta</h3>
        <div className="palette-list">
          {result.visualDirection.palette.map((color) => (
            <div className="palette-row" key={color.hex + color.name}>
              <span className="palette-swatch" style={{ background: color.hex }} />
              <div>
                <strong>{color.name} · {color.hex}</strong>
                <span>{color.role} — {color.reason}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ResultList title="Fotografia" items={result.visualDirection.photography} />
      <ResultBlock title="Composição">
        <p>{result.visualDirection.composition}</p>
      </ResultBlock>
      <ResultBlock title="Ritmo">
        <p>{result.visualDirection.rhythm}</p>
      </ResultBlock>
      <ResultBlock title="Detalhe assinado">
        <p>{result.visualDirection.signatureDetail}</p>
      </ResultBlock>
    </div>
  );
}

function ImagesTab({ result }: { result: GeneratedSitePrompt }) {
  if (result.images.length === 0) {
    return (
      <div className="prompt-result-grid">
        <ResultBlock title="Uso de imagens">
          <p>
            Nenhuma imagem real foi confirmada para este briefing. A composição deve
            funcionar sem imagem e sem placeholder visual dominante.
          </p>
        </ResultBlock>
      </div>
    );
  }

  return (
    <div className="prompt-items-list">
      {result.images.map((image, index) => (
        <article className="prompt-item-card" key={index}>
          <span>{image.use}</span>
          <h3>{image.image}</h3>
          <p><strong>Enquadramento:</strong> {image.framing}</p>
          <p><strong>Proporção:</strong> {image.ratio}</p>
          <p><strong>Objetivo:</strong> {image.purpose}</p>
          <p><strong>Origem:</strong> {image.sourceGuidance}</p>
        </article>
      ))}
    </div>
  );
}

function SectionsTab({ result }: { result: GeneratedSitePrompt }) {
  return (
    <div className="prompt-sections-list">
      {result.sections.map((section, index) => (
        <article className="prompt-section-row" key={section.name + index}>
          <span>{String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3>{section.name}</h3>
            <p>{section.purpose}</p>
            <small>{section.content}</small>
            {section.cta && <strong>CTA: {section.cta}</strong>}
          </div>
        </article>
      ))}
    </div>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="result-block">
      <h3>{title}</h3>
      {items.length ? (
        <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
      ) : (
        <p>Nenhum item identificado.</p>
      )}
    </div>
  );
}

function ResultBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="result-block">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
