export type StructuralVisualDNA = {
  hero: {
    relativeHeight: "compact" | "medium" | "high" | "tall" | "unknown";
    dominantAxis: "left" | "center" | "right" | "split" | "mixed" | "unknown";
    contentPosition:
      | "left"
      | "center"
      | "center_left"
      | "center_right"
      | "split"
      | "mixed"
      | "unknown";
    headlineDominance: "low" | "medium" | "high" | "very_high" | "unknown";
    layering:
      | "flat"
      | "stacked"
      | "vertical_layers"
      | "overlap"
      | "layered_overlap"
      | "mixed"
      | "unknown";
    negativeSpace: "low" | "medium" | "high" | "unknown";
    imageRelationship: string;
    supportingInfoPosition: string;
  };
  typography: {
    headlineToBodyContrast: "low" | "medium" | "high" | "extreme" | "unknown";
    headlineWidth: "narrow" | "medium" | "wide" | "unknown";
    bodyDensity: "low" | "medium" | "compact" | "unknown";
    microTypography: "absent" | "present" | "unknown";
    heroAlignment: "left" | "center" | "right" | "mixed" | "unknown";
    contentAlignment:
      | "left"
      | "center"
      | "right"
      | "alternating"
      | "mixed"
      | "unknown";
  };
  layout: {
    symmetry: "symmetric" | "asymmetric" | "mixed" | "unknown";
    gridBehavior:
      | "rigid"
      | "fluid"
      | "controlled_breaks"
      | "overlapping"
      | "mixed"
      | "unknown";
    sectionAlignmentPattern: string;
    contentWidthPattern: string;
    overlaps: string;
    elementsBreakingGrid: string;
  };
  sectionFlow: {
    backgroundSequence: string[];
    transitionFrequency: "none" | "single" | "few" | "repeated" | "unknown";
    transitionTypes: string[];
    densityPattern: string[];
  };
  cta: {
    quantity: "low" | "medium" | "high" | "unknown";
    hierarchy:
      | "single_dominant_action"
      | "primary_secondary"
      | "distributed"
      | "unknown";
    placement: string;
    shape: string;
    relativeScale: "small" | "medium" | "large" | "unknown";
  };
  decorativeSystem: {
    amount: "none" | "low" | "low_to_medium" | "medium" | "high" | "unknown";
    recurringMotifs: string[];
    texture: "none" | "subtle" | "pronounced" | "mixed" | "unknown";
  };
  imagery: {
    role: "structural" | "supporting" | "decorative" | "absent" | "mixed" | "unknown";
    cropStrategy: string;
    placementPattern: string;
    textImageRelationship: string;
  };
};

export type VisualReferenceAnalysis = {
  overallDirection: string;
  structuralVisualDNA?: StructuralVisualDNA;
  composition: {
    hero: string;
    grid: string;
    alignment: string;
    density: string;
    sectionRhythm: string;
  };
  typography: {
    style: string;
    hierarchy: string;
    scale: string;
    alignment: string;
  };
  imagery: {
    usage: string;
    crop: string;
    placement: string;
  };
  interface: {
    buttons: string;
    navigation: string;
    borders: string;
    cards: string;
  };
  commonPatterns: string[];
  meaningfulDifferences: string[];
  conflicts: string[];
  visualMechanismsToReuse: string[];
  avoidCopying: string[];
};

export type VisualReferenceType = "image" | "url";

export type VisualReferenceCaptureStatus =
  | "pending"
  | "ready"
  | "failed"
  | null;

export type VisualReferenceAsset = {
  id: string;
  referenceId: string;
  storagePath: string;
  fileHash: string;
  mimeType: "image/webp";
  byteSize: number;
  width: number;
  height: number;
  segmentKind: "full" | "hero" | "middle" | "final";
  sortOrder: number;
  createdAt: string;
};

export type VisualReferenceItem = {
  id: string;
  setId: string;
  referenceType: VisualReferenceType;
  fileHash: string | null;
  storagePath: string | null;
  originalName: string;
  mimeType: "image/webp" | null;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  note: string;
  sortOrder: number;
  createdAt: string;
  sourceUrl: string | null;
  sourceDomain: string | null;
  captureStatus: VisualReferenceCaptureStatus;
  captureError: string | null;
  captureHash: string | null;
  captureFinalUrl: string | null;
  captureTitle: string | null;
  capturedAt: string | null;
  assets: VisualReferenceAsset[];
};

export type VisualReferenceSet = {
  id: string;
  businessKey: string;
  guidance: string;
  analysis: VisualReferenceAnalysis | null;
  analysisSignature: string | null;
  analysisModel: string | null;
  analyzedAt: string | null;
  references: VisualReferenceItem[];
};

export type AnalyzeVisualReferencesResponse =
  | {
      ok: true;
      analysis: VisualReferenceAnalysis;
      signature: string;
      model: string;
      analyzedAt: string;
      cached: boolean;
    }
  | {
      ok: false;
      code:
        | "AUTH_REQUIRED"
        | "FORBIDDEN"
        | "INVALID_REQUEST"
        | "NO_REFERENCES"
        | "REFERENCE_LOAD_FAILED"
        | "NOT_CONFIGURED"
        | "PROVIDER_AUTH"
        | "PROVIDER_QUOTA"
        | "PROVIDER_FAILED"
        | "INVALID_AI_RESPONSE";
      message: string;
    };

export type CaptureUrlReferenceResponse =
  | {
      ok: true;
      reference: VisualReferenceItem;
      cached: boolean;
    }
  | {
      ok: false;
      code:
        | "AUTH_REQUIRED"
        | "FORBIDDEN"
        | "INVALID_REQUEST"
        | "NOT_CONFIGURED"
        | "URL_BLOCKED"
        | "CAPTURE_TIMEOUT"
        | "CAPTURE_FAILED"
        | "STORAGE_FAILED";
      message: string;
      fallbackToScreenshot: true;
    };
