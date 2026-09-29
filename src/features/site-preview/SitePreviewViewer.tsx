import {
  ExternalLink,
  Monitor,
  Printer,
  RefreshCw,
  Smartphone,
  X,
} from "lucide-react";
import { useRef, useState, type CSSProperties } from "react";
import type {
  PreviewSection,
  PreviewViewport,
  SavedPreviewRecord,
} from "./types";

function safeHref(value: string) {
  if (/^tel:\+?[0-9]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return "";
  }
  return "";
}

function safeColor(value: string, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

function headingFont(profile: string) {
  const normalized = profile.toLocaleLowerCase("pt-BR");
  if (normalized.includes("serif") || normalized.includes("editorial")) {
    return 'Georgia, "Times New Roman", serif';
  }
  if (normalized.includes("condens")) {
    return '"Arial Narrow", "Roboto Condensed", Arial, sans-serif';
  }
  if (normalized.includes("mono")) {
    return '"Courier New", monospace';
  }
  return 'Arial, "Helvetica Neue", sans-serif';
}

function bodyFont(profile: string) {
  const normalized = profile.toLocaleLowerCase("pt-BR");
  if (normalized.includes("serif")) {
    return 'Georgia, "Times New Roman", serif';
  }
  return 'Arial, "Helvetica Neue", sans-serif';
}

async function waitForAssets(root: HTMLElement | null) {
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined);
  }

  if (!root) return;
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const finish = () => resolve();
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        window.setTimeout(finish, 5000);
      });
    }),
  );
}

export function SitePreviewViewer({
  preview,
  stale,
  onClose,
  onRegenerate,
}: {
  preview: SavedPreviewRecord;
  stale: boolean;
  onClose: () => void;
  onRegenerate: () => void;
}) {
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const [printing, setPrinting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  async function printPreview() {
    if (printing) return;
    setPrinting(true);
    await waitForAssets(rootRef.current);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    window.print();
    setPrinting(false);
  }

  const theme = preview.spec.theme;
  const variables = {
    "--preview-bg": safeColor(theme.background, "#101010"),
    "--preview-surface": safeColor(theme.surface, "#191919"),
    "--preview-text": safeColor(theme.text, "#F4F4F2"),
    "--preview-muted": safeColor(theme.muted, "#A5A5A0"),
    "--preview-accent": safeColor(theme.accent, "#C82832"),
    "--preview-accent-text": safeColor(theme.accentText, "#FFFFFF"),
    "--preview-border": safeColor(theme.border, "#343434"),
    "--preview-heading-font": headingFont(preview.spec.typography.headingProfile),
    "--preview-body-font": bodyFont(preview.spec.typography.bodyProfile),
  } as CSSProperties;

  return (
    <div className="site-preview-overlay">
      <header className="site-preview-toolbar">
        <div>
          <strong>{preview.company}</strong>
          <span>
            {stale
              ? "Preview baseado em uma versão anterior do prompt"
              : "Preview gerado em " + formatDate(preview.generatedAt)}
          </span>
        </div>

        <div className="site-preview-toolbar-actions">
          <div className="preview-viewport-switch" aria-label="Modo de visualização">
            <button
              type="button"
              className={viewport === "desktop" ? "active" : ""}
              onClick={() => setViewport("desktop")}
            >
              <Monitor size={15} />
              Desktop
            </button>
            <button
              type="button"
              className={viewport === "mobile" ? "active" : ""}
              onClick={() => setViewport("mobile")}
            >
              <Smartphone size={15} />
              Mobile
            </button>
          </div>

          <button className="secondary-button" type="button" onClick={onRegenerate}>
            <RefreshCw size={15} />
            Gerar novamente
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={printing}
            onClick={() => void printPreview()}
          >
            <Printer size={15} />
            {printing ? "Preparando PDF..." : "Baixar PDF"}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Fechar preview"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="site-preview-stage">
        <div
          className={
            viewport === "mobile"
              ? "site-preview-frame mobile"
              : "site-preview-frame desktop"
          }
        >
          <div
            ref={rootRef}
            className={[
              "site-preview-print-root",
              "density-" + preview.spec.density,
              "heading-" + preview.spec.typography.headingScale,
              "body-" + preview.spec.typography.bodyScale,
              "contrast-" + preview.spec.contrast,
            ].join(" ")}
            style={variables}
          >
            {preview.spec.sections.map((section, index) => (
              <PreviewSectionView
                key={section.id + "-" + index}
                section={section}
                isFirst={index === 0}
              />
            ))}

            <footer className="preview-concept-footer">
              <span>{preview.spec.footerNote}</span>
              <span>{preview.company}</span>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewSectionView({
  section,
  isFirst,
}: {
  section: PreviewSection;
  isFirst: boolean;
}) {
  const image = section.imageUrl ? (
    <figure className="preview-section-image">
      <img src={section.imageUrl} alt={section.imageAlt || ""} />
    </figure>
  ) : null;

  const content = (
    <div className="preview-section-content">
      {section.eyebrow && <p className="preview-eyebrow">{section.eyebrow}</p>}
      {section.emphasize && (
        <strong className="preview-emphasize">{section.emphasize}</strong>
      )}
      {section.title &&
        (isFirst ? (
          <h1>{section.title}</h1>
        ) : (
          <h2>{section.title}</h2>
        ))}
      {section.body && <p className="preview-body-copy">{section.body}</p>}

      {section.items.length > 0 && (
        <div
          className={
            section.variant === "stats"
              ? "preview-items preview-stats"
              : "preview-items"
          }
        >
          {section.items.map((item, index) => (
            <div className="preview-item" key={section.id + "-item-" + index}>
              {item}
            </div>
          ))}
        </div>
      )}

      {(section.primaryCtaLabel || section.secondaryCtaLabel) && (
        <div className="preview-cta-row">
          <PreviewLink
            label={section.primaryCtaLabel}
            href={section.primaryCtaHref}
            primary
          />
          <PreviewLink
            label={section.secondaryCtaLabel}
            href={section.secondaryCtaHref}
          />
        </div>
      )}
    </div>
  );

  return (
    <section
      className={[
        "preview-section",
        "kind-" + section.kind,
        "variant-" + section.variant,
        image ? "has-image" : "no-image",
      ].join(" ")}
    >
      <div className="preview-section-inner">
        {section.variant === "split" && image ? (
          <>
            {content}
            {image}
          </>
        ) : section.variant === "full" && image ? (
          <>
            {image}
            <div className="preview-full-overlay">{content}</div>
          </>
        ) : (
          <>
            {content}
            {image}
          </>
        )}
      </div>
    </section>
  );
}

function PreviewLink({
  label,
  href,
  primary = false,
}: {
  label: string;
  href: string;
  primary?: boolean;
}) {
  if (!label) return null;
  const safe = safeHref(href);

  if (!safe) {
    return (
      <span className={primary ? "preview-cta primary" : "preview-cta"}>
        {label}
      </span>
    );
  }

  const external = /^https?:/.test(safe);
  return (
    <a
      className={primary ? "preview-cta primary" : "preview-cta"}
      href={safe}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {label}
      {external && <ExternalLink size={13} />}
    </a>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
