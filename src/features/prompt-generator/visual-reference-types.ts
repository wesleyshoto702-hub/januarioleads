export type VisualReferenceAnalysis = {
  overallDirection: string;
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
