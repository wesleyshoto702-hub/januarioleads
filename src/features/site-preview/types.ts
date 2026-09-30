import type {
  GeneratedSitePrompt,
  PromptBusinessContext,
  SavedPromptRecord,
} from "../prompt-generator/types";

export const PREVIEW_ENGINE_VERSION = "2026-09-30.1";

export type PreviewViewport = "desktop" | "mobile";

export type PreviewTheme = {
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
};

export type PreviewTypography = {
  headingProfile: string;
  bodyProfile: string;
  headingScale: "compact" | "balanced" | "expressive";
  bodyScale: "compact" | "balanced";
};

export type PreviewSectionKind =
  | "hero"
  | "proof"
  | "info"
  | "location"
  | "contact"
  | "services"
  | "gallery"
  | "content"
  | "footer";

export type PreviewSection = {
  id: string;
  // New previews bind each visual section to the Page Planner section that
  // authorized it. Optional keeps already-saved legacy previews compatible.
  sourceSectionType?: string;
  kind: PreviewSectionKind;
  variant:
    | "text"
    | "split"
    | "editorial"
    | "compact"
    | "full"
    | "stats"
    | "stack"
    | "grid";
  tone: "background" | "surface" | "accent" | "inverse";
  eyebrow: string;
  title: string;
  body: string;
  items: string[];
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  emphasize: string;
  imageUrl: string;
  imageAlt: string;
};

export type PreviewSpec = {
  theme: PreviewTheme;
  typography: PreviewTypography;
  density: "compact" | "balanced" | "airy";
  contrast: "soft" | "strong";
  primaryAction: {
    label: string;
    href: string;
  };
  sections: PreviewSection[];
  footerNote: "Prévia conceitual";
};

export type SavedPreviewRecord = {
  businessKey: string;
  company: string;
  promptVersion: string;
  previewVersion: string;
  previewEngineVersion?: string | null;
  generatedAt: string;
  spec: PreviewSpec;
};

export type GeneratePreviewResponse =
  | {
      ok: true;
      preview: SavedPreviewRecord;
    }
  | {
      ok: false;
      code:
        | "AUTH_REQUIRED"
        | "FORBIDDEN"
        | "NOT_CONFIGURED"
        | "INVALID_REQUEST"
        | "PROVIDER_AUTH"
        | "PROVIDER_QUOTA"
        | "PROVIDER_FAILED"
        | "INVALID_AI_RESPONSE";
      message: string;
    };

export type GeneratePreviewInput = {
  business: PromptBusinessContext;
  prompt: SavedPromptRecord;
};

export function promptVersionOf(prompt: SavedPromptRecord) {
  return prompt.generatedAt;
}

export function isPreviewCurrent(
  preview: SavedPreviewRecord | null,
  prompt: SavedPromptRecord | null,
) {
  return Boolean(
    preview &&
      prompt &&
      preview.promptVersion === promptVersionOf(prompt) &&
      preview.previewEngineVersion === PREVIEW_ENGINE_VERSION,
  );
}

export type PreviewMaterializationContext = {
  business: PromptBusinessContext;
  promptResult: GeneratedSitePrompt;
  lovablePrompt: string;
};
