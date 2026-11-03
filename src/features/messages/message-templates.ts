export type MessageTemplate = {
  id: string;
  title: string;
  text: string;
  favorite: boolean;
};

export const DEFAULT_MESSAGE_TEXTS = [
  "Olá! Meu nome é Wesley. Conheci um pouco do trabalho da {empresa} e gostaria de saber se teriam interesse em ter um site profissional para a empresa.",
  "Olá! Trabalho com criação de sites e landing pages para negócios e queria apresentar uma ideia que poderia fortalecer a presença online da {empresa}.",
  "Olá! Tudo bem? Trabalho desenvolvendo sites para empresas e gostaria de saber se vocês teriam interesse em conhecer uma proposta para a {empresa}.",
];

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplate[] =
  DEFAULT_MESSAGE_TEXTS.map((text, index) => ({
    id: `default-${index + 1}`,
    title: `Mensagem ${index + 1}`,
    text,
    favorite: false,
  }));

/** Reads both the old string[] format and the newer editable template format. */
export function parseSavedMessageTemplates(value: unknown): MessageTemplate[] | null {
  if (!Array.isArray(value)) return null;

  if (value.every((item) => typeof item === "string")) {
    return value.map((text, index) => ({
      id: `default-${index + 1}`,
      title: `Mensagem ${index + 1}`,
      text,
      favorite: false,
    }));
  }

  const seen = new Set<string>();
  const templates: MessageTemplate[] = [];

  for (const item of value) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !item.id.trim() ||
      seen.has(item.id) ||
      typeof item.title !== "string" ||
      typeof item.text !== "string" ||
      typeof item.favorite !== "boolean"
    ) {
      return null;
    }

    seen.add(item.id);
    templates.push({
      id: item.id,
      title: item.title,
      text: item.text,
      favorite: item.favorite,
    });
  }

  return templates;
}

/** Favorites first, preserving the order in which templates were created. */
export function orderMessageTemplates(templates: MessageTemplate[]): MessageTemplate[] {
  return [
    ...templates.filter((template) => template.favorite),
    ...templates.filter((template) => !template.favorite),
  ];
}
