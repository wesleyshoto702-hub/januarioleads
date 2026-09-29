const INPUT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const MAX_VISUAL_REFERENCES = 5;
export const MAX_SOURCE_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_STORED_FILE_BYTES = 3 * 1024 * 1024;

async function sha256Hex(blob: Blob) {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("IMAGE_ENCODE_FAILED"))),
      "image/webp",
      quality,
    );
  });
}

export async function optimizeVisualReference(file: File) {
  const supportedByExtension = /\.(png|jpe?g|webp)$/i.test(file.name);
  if (!INPUT_TYPES.has(file.type) && !supportedByExtension) {
    throw new Error("REFERENCE_UNSUPPORTED_TYPE");
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    throw new Error("REFERENCE_SOURCE_TOO_LARGE");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / bitmap.width, 12000 / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("IMAGE_PROCESSING_FAILED");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob = await canvasToBlob(canvas, 0.84);
  if (blob.size > MAX_STORED_FILE_BYTES) blob = await canvasToBlob(canvas, 0.72);
  if (blob.size > MAX_STORED_FILE_BYTES) blob = await canvasToBlob(canvas, 0.6);

  if (blob.size > MAX_STORED_FILE_BYTES) {
    throw new Error("REFERENCE_OPTIMIZED_TOO_LARGE");
  }

  return {
    blob,
    hash: await sha256Hex(blob),
    width,
    height,
  };
}

export function visualReferenceErrorMessage(
  error: unknown,
  fileName?: string,
) {
  const prefix = fileName ? `${fileName}: ` : "";
  const code = error instanceof Error ? error.message : "";

  if (code === "REFERENCE_UNSUPPORTED_TYPE") {
    return `${prefix}formato não suportado. Use PNG, JPG, JPEG ou WEBP.`;
  }
  if (code === "REFERENCE_SOURCE_TOO_LARGE") {
    return `${prefix}o arquivo original excede 12 MB.`;
  }
  if (code === "REFERENCE_OPTIMIZED_TOO_LARGE") {
    return `${prefix}não foi possível reduzir a imagem para o limite seguro de 3 MB sem perda excessiva.`;
  }
  if (code === "REFERENCE_DUPLICATE") {
    return `${prefix}esta mesma referência já foi adicionada.`;
  }
  return `${prefix}não foi possível processar esta referência.`;
}
