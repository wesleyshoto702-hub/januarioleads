import {
  Eye,
  ImagePlus,
  Loader2,
  Trash2,
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
  deleteVisualReference,
  ensureVisualReferenceSet,
  fetchReferencePreview,
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

function ReferenceThumbnail({
  reference,
  disabled,
  onNote,
  onRemove,
}: {
  reference: VisualReferenceItem;
  disabled: boolean;
  onNote: (value: string) => void;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    void fetchReferencePreview(reference).then((url) => {
      if (!active || !url) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url;
      setPreviewUrl(url);
    });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [reference.id, reference.storagePath]);

  return (
    <article className="visual-reference-card">
      <div className="visual-reference-thumb">
        {previewUrl ? (
          <img src={previewUrl} alt={reference.originalName} />
        ) : (
          <div className="visual-reference-thumb-loading">
            <Loader2 size={15} className="auth-spinner" />
          </div>
        )}
        <button
          type="button"
          className="visual-reference-remove"
          aria-label={`Remover ${reference.originalName}`}
          title="Remover referência"
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="visual-reference-meta">
        <strong title={reference.originalName}>{reference.originalName}</strong>
        <small>
          {reference.width}×{reference.height} ·{" "}
          {Math.max(1, Math.round(reference.byteSize / 1024))} KB
        </small>
      </div>
      <input
        type="text"
        maxLength={500}
        disabled={disabled}
        value={reference.note}
        onChange={(event) => onNote(event.target.value)}
        placeholder="Opcional: o que você gostou nesta imagem?"
      />
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
  const [uploadError, setUploadError] = useState("");

  async function addFiles(files: FileList | null) {
    if (!files?.length || disabled || uploading) return;

    const remaining = MAX_VISUAL_REFERENCES - (value?.references.length ?? 0);
    const selected = Array.from(files).slice(0, Math.max(0, remaining));
    if (selected.length === 0) {
      setUploadError("Você já adicionou o limite de 5 referências.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      let current = value ?? (await ensureVisualReferenceSet(businessKey));

      for (const file of selected) {
        try {
          const optimized = await optimizeVisualReference(file);

          if (
            current.references.some(
              (reference) => reference.fileHash === optimized.hash,
            )
          ) {
            setUploadError(
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
          setUploadError(visualReferenceErrorMessage(error, file.name));
        }
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeReference(reference: VisualReferenceItem) {
    if (!value || disabled) return;
    if (!window.confirm(`Remover a referência "${reference.originalName}"?`)) {
      return;
    }

    const ok = await deleteVisualReference(reference);
    if (!ok) {
      setUploadError("Não foi possível remover esta referência agora.");
      return;
    }

    onChange(
      invalidateLocalAnalysis({
        ...value,
        references: value.references.filter((item) => item.id !== reference.id),
      }),
    );
  }

  const count = value?.references.length ?? 0;

  return (
    <section className="visual-references-panel" aria-label="Referências visuais">
      <div className="visual-references-heading">
        <div>
          <span className="detail-kicker">REFERÊNCIAS VISUAIS · OPCIONAL</span>
          <strong>
            {count > 0
              ? `${count} ${count === 1 ? "imagem adicionada" : "imagens adicionadas"}`
              : "Use screenshots como direção de design"}
          </strong>
          <p>
            Adicione screenshots de sites cuja direção visual você gostaria de
            usar como referência.
          </p>
        </div>

        <div className="visual-reference-heading-actions">
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
          <button
            type="button"
            className="secondary-button"
            disabled={
              disabled || uploading || count >= MAX_VISUAL_REFERENCES
            }
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 size={14} className="auth-spinner" />
            ) : (
              <ImagePlus size={14} />
            )}
            {uploading ? "Processando..." : "+ Adicionar referências"}
          </button>
        </div>

        <input
          ref={inputRef}
          className="visual-reference-file-input"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          multiple
          disabled={disabled || uploading}
          onChange={(event) => void addFiles(event.target.files)}
        />
      </div>

      {uploadError && <p className="visual-reference-error">{uploadError}</p>}

      {value && value.references.length > 0 && (
        <>
          <div className="visual-reference-grid">
            {value.references.map((reference) => (
              <ReferenceThumbnail
                key={reference.id}
                reference={reference}
                disabled={disabled}
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
              placeholder="Ex.: gostei principalmente da Hero, da tipografia grande e da distribuição das seções. Não quero copiar as cores."
            />
          </label>

          <div className="visual-reference-footnote">
            <span>PNG, JPG, JPEG ou WEBP · máximo 5 imagens</span>
            <span>
              As referências orientam mecanismos visuais; conteúdo e marca não
              são copiados.
            </span>
          </div>
        </>
      )}
    </section>
  );
}
