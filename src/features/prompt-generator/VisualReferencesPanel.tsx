import {
  ExternalLink,
  Eye,
  Globe2,
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  MAX_VISUAL_REFERENCES,
  optimizeVisualReference,
  visualReferenceErrorMessage,
} from "./image-processing";
import type {
  VisualReferenceItem,
  VisualReferenceSet,
} from "./visual-reference-types";
import {
  captureUrlVisualReference,
  createUrlVisualReference,
  deleteVisualReference,
  ensureVisualReferenceSet,
  fetchReferencePreview,
  fetchReferencePreviewAssets,
  normalizeVisualReferenceUrl,
  updateReferenceNote,
  updateVisualGuidance,
  uploadVisualReference,
} from "./visual-references";

function firstAvailableOrder(items: VisualReferenceItem[]) {
  const used = new Set(items.map((item) => item.sortOrder));
  for (let index = 0; index < MAX_VISUAL_REFERENCES; index += 1) {
    if (!used.has(index)) return index;
  }
  return MAX_VISUAL_REFERENCES;
}

function invalidateLocalAnalysis(set: VisualReferenceSet): VisualReferenceSet {
  return {
    ...set,
    analysis: null,
    analysisSignature: null,
    analysisModel: null,
    analyzedAt: null,
  };
}

function replaceReference(
  set: VisualReferenceSet,
  next: VisualReferenceItem,
) {
  return invalidateLocalAnalysis({
    ...set,
    references: set.references
      .map((item) => (item.id === next.id ? next : item))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  });
}

function statusLabel(reference: VisualReferenceItem) {
  if (reference.referenceType === "image") return "Analisado";
  if (reference.captureStatus === "ready") return "Analisado";
  if (reference.captureStatus === "failed") return "Falhou";
  return "Capturando";
}

function ReferenceThumbnail({
  reference,
  disabled,
  recapturing,
  onNote,
  onRemove,
  onView,
  onRecapture,
  onScreenshotFallback,
}: {
  reference: VisualReferenceItem;
  disabled: boolean;
  recapturing: boolean;
  onNote: (value: string) => void;
  onRemove: () => void;
  onView: () => void;
  onRecapture: () => void;
  onScreenshotFallback: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    void fetchReferencePreview(reference)
      .then((url) => {
        if (!active || !url) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setPreviewUrl(url);
      })
      .catch(() => {
        if (active) setPreviewUrl(null);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [
    reference.id,
    reference.storagePath,
    reference.captureHash,
    reference.assets,
  ]);

  const isUrl = reference.referenceType === "url";
  const dimensions = isUrl
    ? reference.assets.length > 1
      ? `${reference.assets.length} capturas`
      : reference.assets[0]
        ? `${reference.assets[0].width}×${reference.assets[0].height}`
        : "Sem captura"
    : reference.width && reference.height
      ? `${reference.width}×${reference.height}`
      : "Screenshot";

  return (
    <article className="visual-reference-card">
      <button
        type="button"
        className="visual-reference-thumb visual-reference-thumb-button"
        disabled={!previewUrl}
        onClick={onView}
        title={previewUrl ? "Visualizar referência" : "Captura ainda indisponível"}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={
              isUrl
                ? `Captura de ${reference.sourceDomain ?? reference.originalName}`
                : reference.originalName
            }
          />
        ) : (
          <div className="visual-reference-thumb-loading">
            {recapturing || reference.captureStatus === "pending" ? (
              <Loader2 size={15} className="auth-spinner" />
            ) : isUrl ? (
              <Globe2 size={16} />
            ) : (
              <ImagePlus size={16} />
            )}
          </div>
        )}
      </button>

      <button
        type="button"
        className="visual-reference-remove"
        aria-label={`Remover ${reference.originalName}`}
        title="Remover referência"
        disabled={disabled || recapturing}
        onClick={onRemove}
      >
        <Trash2 size={13} />
      </button>

      <div className="visual-reference-meta">
        <div className="visual-reference-name-row">
          {isUrl ? <Globe2 size={12} /> : <ImagePlus size={12} />}
          <strong title={reference.sourceUrl ?? reference.originalName}>
            {isUrl
              ? reference.sourceDomain ?? reference.originalName
              : reference.originalName}
          </strong>
        </div>
        <small>
          {dimensions} ·{" "}
          <span
            className={
              reference.captureStatus === "failed"
                ? "visual-reference-status failed"
                : "visual-reference-status"
            }
          >
            {recapturing ? "Capturando" : statusLabel(reference)}
          </span>
        </small>
        {isUrl && reference.captureTitle && (
          <small title={reference.captureTitle} className="visual-reference-title">
            {reference.captureTitle}
          </small>
        )}
      </div>

      <input
        type="text"
        maxLength={500}
        disabled={disabled || recapturing}
        value={reference.note}
        onChange={(event) => onNote(event.target.value)}
        onBlur={(event) => {
          void updateReferenceNote(reference.id, event.target.value);
        }}
        placeholder={
          isUrl
            ? "Opcional: ex. gostei principalmente da Hero"
            : "Opcional: o que você gostou nesta imagem?"
        }
      />

      {isUrl && (
        <div className="visual-reference-card-actions">
          {reference.captureStatus === "ready" && (
            <button
              type="button"
              disabled={disabled || recapturing}
              onClick={onRecapture}
            >
              <RefreshCw size={12} />
              Analisar novamente
            </button>
          )}
          {reference.captureStatus === "failed" && (
            <button
              type="button"
              disabled={disabled || recapturing}
              onClick={onScreenshotFallback}
            >
              <ImagePlus size={12} />
              Enviar screenshot
            </button>
          )}
          {reference.sourceUrl && (
            <a href={reference.sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={12} />
              Abrir site
            </a>
          )}
        </div>
      )}

      {isUrl && reference.captureError && (
        <p className="visual-reference-inline-error">
          {reference.captureError}
        </p>
      )}
    </article>
  );
}

export function VisualReferencesPanel({
  businessKey,
  value,
  onChange,
  disabled,
  onViewAnalysis,
}: {
  businessKey: string;
  value: VisualReferenceSet | null;
  onChange: (value: VisualReferenceSet | null) => void;
  disabled: boolean;
  onViewAnalysis: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [recapturingId, setRecapturingId] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [previewReference, setPreviewReference] =
    useState<VisualReferenceItem | null>(null);
  const [previewAssets, setPreviewAssets] = useState<
    Array<{ label: string; url: string }>
  >([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function addFiles(files: FileList | null) {
    if (!files?.length || disabled || uploading || urlLoading) return;

    const remaining = MAX_VISUAL_REFERENCES - (value?.references.length ?? 0);
    const selected = Array.from(files).slice(0, Math.max(0, remaining));
    if (selected.length === 0) {
      setUploadErrors(["Você já adicionou o limite de 5 referências."]);
      return;
    }

    setUploading(true);
    setUploadErrors([]);
    const errors: string[] = [];

    try {
      let current = value ?? (await ensureVisualReferenceSet(businessKey));

      for (const file of selected) {
        try {
          const optimized = await optimizeVisualReference(file);

          if (
            current.references.some(
              (reference) =>
                reference.referenceType === "image" &&
                reference.fileHash === optimized.hash,
            )
          ) {
            errors.push(
              visualReferenceErrorMessage(
                new Error("REFERENCE_DUPLICATE"),
                file.name,
              ),
            );
            continue;
          }

          const reference = await uploadVisualReference({
            set: current,
            blob: optimized.blob,
            hash: optimized.hash,
            originalName: file.name,
            width: optimized.width,
            height: optimized.height,
            sortOrder: firstAvailableOrder(current.references),
          });

          if (reference) {
            current = invalidateLocalAnalysis({
              ...current,
              references: [...current.references, reference].sort(
                (a, b) => a.sortOrder - b.sortOrder,
              ),
            });
            onChange(current);
          }
        } catch (error) {
          errors.push(visualReferenceErrorMessage(error, file.name));
        }
      }

      if (files.length > selected.length) {
        errors.push(
          `Apenas ${selected.length} arquivo(s) foram considerados porque o limite é de 5 referências.`,
        );
      }
    } catch {
      errors.push(
        "Não foi possível preparar o armazenamento das referências agora.",
      );
    } finally {
      setUploadErrors(errors);
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function addUrl() {
    if (disabled || uploading || urlLoading) return;
    const count = value?.references.length ?? 0;
    if (count >= MAX_VISUAL_REFERENCES) {
      setUploadErrors(["Você já adicionou o limite de 5 referências."]);
      return;
    }

    setUploadErrors([]);

    let normalized: { url: string; domain: string };
    try {
      normalized = normalizeVisualReferenceUrl(urlInput);
    } catch {
      setUploadErrors([
        "Informe uma URL válida começando com http:// ou https://.",
      ]);
      return;
    }

    if (
      value?.references.some(
        (reference) =>
          reference.referenceType === "url" &&
          reference.sourceUrl === normalized.url,
      )
    ) {
      setUploadErrors(["Este site já foi adicionado como referência."]);
      return;
    }

    setUrlLoading(true);
    try {
      let current = value ?? (await ensureVisualReferenceSet(businessKey));
      const pending = await createUrlVisualReference({
        set: current,
        url: normalized.url,
        sortOrder: firstAvailableOrder(current.references),
      });

      if (!pending) throw new Error("REFERENCE_URL_CREATE_FAILED");

      current = invalidateLocalAnalysis({
        ...current,
        references: [...current.references, pending].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        ),
      });
      onChange(current);
      setUrlInput("");

      const captured = await captureUrlVisualReference(pending.id, false);
      if (!captured.ok) {
        const failed = {
          ...pending,
          captureStatus: "failed" as const,
          captureError: captured.message,
        };
        onChange(replaceReference(current, failed));
        setUploadErrors([
          captured.code === "NOT_CONFIGURED"
            ? "A captura por URL ainda não está configurada. Você pode enviar um screenshot por enquanto."
            : captured.message,
        ]);
        return;
      }

      onChange(replaceReference(current, captured.reference));
    } catch (error) {
      const message =
        error instanceof Error && error.message === "REFERENCE_URL_DUPLICATE"
          ? "Este site já foi adicionado como referência."
          : "Não foi possível adicionar esta URL agora.";
      setUploadErrors([message]);
    } finally {
      setUrlLoading(false);
    }
  }

  async function recapture(reference: VisualReferenceItem) {
    if (disabled || reference.referenceType !== "url" || recapturingId) return;

    setRecapturingId(reference.id);
    setUploadErrors([]);
    try {
      const response = await captureUrlVisualReference(reference.id, true);
      if (!response.ok) {
        setUploadErrors([response.message]);
        return;
      }

      if (value) onChange(replaceReference(value, response.reference));
    } catch {
      setUploadErrors([
        "Não foi possível analisar automaticamente este site. Envie um screenshot.",
      ]);
    } finally {
      setRecapturingId(null);
    }
  }

  async function openPreview(reference: VisualReferenceItem) {
    setPreviewReference(reference);
    setPreviewLoading(true);
    setPreviewAssets([]);
    try {
      setPreviewAssets(await fetchReferencePreviewAssets(reference));
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    for (const asset of previewAssets) URL.revokeObjectURL(asset.url);
    setPreviewAssets([]);
    setPreviewReference(null);
  }

  async function removeReference(reference: VisualReferenceItem) {
    if (!value || disabled || recapturingId) return;
    if (
      !window.confirm(
        `Remover a referência "${
          reference.sourceDomain ?? reference.originalName
        }"?`,
      )
    ) {
      return;
    }

    let ok = false;
    try {
      ok = await deleteVisualReference(reference);
    } catch {
      ok = false;
    }
    if (!ok) {
      setUploadErrors(["Não foi possível remover esta referência agora."]);
      return;
    }

    onChange(
      invalidateLocalAnalysis({
        ...value,
        references: value.references.filter(
          (item) => item.id !== reference.id,
        ),
      }),
    );
  }

  const count = value?.references.length ?? 0;
  const busy = disabled || uploading || urlLoading || Boolean(recapturingId);

  return (
    <section className="visual-references-panel" aria-label="Referências visuais">
      <div className="visual-references-heading">
        <div>
          <span className="detail-kicker">REFERÊNCIAS VISUAIS · OPCIONAL</span>
          <strong>
            {count > 0
              ? `${count} ${count === 1 ? "referência adicionada" : "referências adicionadas"}`
              : "Use sites ou screenshots como direção de design"}
          </strong>
          <p>
            Use sites que você considera boas referências de design. A análise
            extrai princípios visuais; conteúdo e identidade não são copiados.
          </p>
        </div>

        {value?.analysis && (
          <button
            type="button"
            className="secondary-button"
            onClick={onViewAnalysis}
          >
            <Eye size={14} />
            Ver análise
          </button>
        )}
      </div>

      <div className="visual-reference-source-grid">
        <div className="visual-reference-source-block">
          <span>REFERÊNCIA POR SITE</span>
          <div className="visual-reference-url-row">
            <input
              type="url"
              value={urlInput}
              disabled={busy || count >= MAX_VISUAL_REFERENCES}
              onChange={(event) => setUrlInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addUrl();
                }
              }}
              placeholder="https://site-referencia.com"
            />
            <button
              type="button"
              className="secondary-button"
              disabled={
                busy || count >= MAX_VISUAL_REFERENCES || !urlInput.trim()
              }
              onClick={() => void addUrl()}
            >
              {urlLoading ? (
                <Loader2 size={14} className="auth-spinner" />
              ) : (
                <Globe2 size={14} />
              )}
              {urlLoading ? "Capturando..." : "Analisar site"}
            </button>
          </div>
        </div>

        <div className="visual-reference-or" aria-hidden="true">
          <span>OU</span>
        </div>

        <div className="visual-reference-source-block">
          <span>REFERÊNCIA POR IMAGEM</span>
          <button
            type="button"
            className="secondary-button visual-reference-upload-button"
            disabled={busy || count >= MAX_VISUAL_REFERENCES}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 size={14} className="auth-spinner" />
            ) : (
              <ImagePlus size={14} />
            )}
            {uploading ? "Processando..." : "Enviar screenshot"}
          </button>
          <input
            ref={inputRef}
            className="visual-reference-file-input"
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            multiple
            disabled={busy}
            onChange={(event) => void addFiles(event.target.files)}
          />
        </div>
      </div>

      {uploadErrors.length > 0 && (
        <div className="visual-reference-errors" role="status">
          {uploadErrors.map((message) => (
            <p className="visual-reference-error" key={message}>
              {message}
            </p>
          ))}
        </div>
      )}

      {value && value.references.length > 0 && (
        <>
          <div className="visual-reference-grid">
            {value.references.map((reference) => (
              <ReferenceThumbnail
                key={reference.id}
                reference={reference}
                disabled={disabled}
                recapturing={recapturingId === reference.id}
                onView={() => void openPreview(reference)}
                onRecapture={() => void recapture(reference)}
                onScreenshotFallback={() => inputRef.current?.click()}
                onRemove={() => void removeReference(reference)}
                onNote={(note) =>
                  onChange(
                    invalidateLocalAnalysis({
                      ...value,
                      references: value.references.map((item) =>
                        item.id === reference.id ? { ...item, note } : item,
                      ),
                    }),
                  )
                }
              />
            ))}
          </div>

          <label className="visual-reference-guidance">
            <span>
              O que você gostou nessas referências? <small>Opcional</small>
            </span>
            <textarea
              rows={3}
              maxLength={1200}
              disabled={disabled}
              value={value.guidance}
              onChange={(event) =>
                onChange(
                  invalidateLocalAnalysis({
                    ...value,
                    guidance: event.target.value,
                  }),
                )
              }
              onBlur={(event) => {
                void updateVisualGuidance(value.id, event.target.value);
              }}
              placeholder="Ex.: Quero principalmente a Hero, a tipografia grande e o ritmo das seções. Não quero copiar as cores."
            />
          </label>

          <div className="visual-reference-footnote">
            <span>Até 5 referências no total · URLs e screenshots podem ser combinados</span>
            <span>
              Sites protegidos por login, CAPTCHA, Cloudflare ou paywall não são contornados.
            </span>
          </div>
        </>
      )}

      {previewReference && (
        <div
          className="visual-reference-preview-backdrop"
          role="presentation"
          onMouseDown={closePreview}
        >
          <section
            className="visual-reference-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Visualizar referência"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <strong>
                  {previewReference.sourceDomain ??
                    previewReference.originalName}
                </strong>
                <small>
                  {previewReference.referenceType === "url"
                    ? "Captura renderizada do site"
                    : "Screenshot enviado"}
                </small>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Fechar"
                onClick={closePreview}
              >
                <X size={17} />
              </button>
            </header>

            {previewLoading ? (
              <div className="visual-reference-preview-loading">
                <Loader2 size={18} className="auth-spinner" />
                Carregando captura...
              </div>
            ) : previewAssets.length === 0 ? (
              <p className="visual-reference-preview-empty">
                Nenhuma captura visual disponível.
              </p>
            ) : (
              <div className="visual-reference-preview-assets">
                {previewAssets.map((asset, index) => (
                  <figure key={asset.url}>
                    {previewAssets.length > 1 && (
                      <figcaption>
                        {asset.label === "hero"
                          ? "Início / Hero"
                          : asset.label === "middle"
                            ? "Parte intermediária"
                            : asset.label === "final"
                              ? "Parte final"
                              : `Captura ${index + 1}`}
                      </figcaption>
                    )}
                    <img src={asset.url} alt="" />
                  </figure>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
