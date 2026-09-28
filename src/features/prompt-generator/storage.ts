import type { SavedPromptRecord } from "./types";

const STORAGE_KEY = "januarioleads:generated-prompts";

function readAll(): Record<string, SavedPromptRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SavedPromptRecord>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function getSavedPrompt(key: string) {
  return readAll()[key] ?? null;
}

export function savePrompt(record: SavedPromptRecord) {
  const all = readAll();
  all[record.businessKey] = record;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function makePromptBusinessKey(input: {
  placeId?: string | null;
  company: string;
  phone?: string | null;
  address?: string | null;
}) {
  if (input.placeId?.trim()) return `place:${input.placeId.trim()}`;

  const normalize = (value: string | null | undefined) =>
    (value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .replace(/\s+/g, " ")
      .trim();

  const phone = (input.phone ?? "").replace(/\D/g, "");
  return `business:${normalize(input.company)}|${phone}|${normalize(input.address)}`;
}
