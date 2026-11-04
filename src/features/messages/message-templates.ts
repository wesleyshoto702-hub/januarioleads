export type MessageKind = "initial" | "follow_up";

export type MessageTemplate = {
  id: string;
  title: string;
  text: string;
  favorite: boolean;
  // Old browser messages without a kind belong to "Mensagem inicial".
  kind?: MessageKind;
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
    kind: "initial",
  }));

export const DEFAULT_FOLLOW_UP_TEXTS = [
  "Olá! Tudo bem? Passando para dar continuidade à mensagem que enviei sobre a possibilidade de criar um site profissional para a {empresa}. Conseguiu dar uma olhada?",
  "Oi! Estou retomando o contato sobre a ideia de um site para a {empresa}, caso tenha interesse.",
  "Olá! Só passando mais uma vez para saber se existe interesse em conversar sobre um site para a {empresa}. Se agora não for o momento, sem problema — fico à disposição caso queira falar sobre isso mais pra frente.",
];

export const DEFAULT_FOLLOW_UP_TEMPLATES: MessageTemplate[] =
  DEFAULT_FOLLOW_UP_TEXTS.map((text, index) => ({
    id: `follow-up-${index + 1}`,
    title: `Follow-up ${index + 1}`,
    text,
    favorite: false,
    kind: "follow_up",
  }));

export function templateKind(template: MessageTemplate): MessageKind {
  return template.kind === "follow_up" ? "follow_up" : "initial";
}

export function messagesForKind(
  templates: MessageTemplate[],
  kind: MessageKind,
): MessageTemplate[] {
  return orderMessageTemplates(templates.filter((template) => templateKind(template) === kind));
}

/** First run only: preserve custom texts and seed editable follow-ups once. */
export function appendMissingFollowUpTemplates(templates: MessageTemplate[]): MessageTemplate[] {
  const savedIds = new Set(templates.map((template) => template.id));
  return [
    ...templates,
    ...DEFAULT_FOLLOW_UP_TEMPLATES
      .filter((template) => !savedIds.has(template.id))
      .map((template) => ({ ...template })),
  ];
}

/** Reads both the old string[] format and the newer editable template format. */
export function parseSavedMessageTemplates(value: unknown): MessageTemplate[] | null {
  if (!Array.isArray(value)) return null;

  if (value.every((item) => typeof item === "string")) {
    return value.map((text, index) => ({
      id: `default-${index + 1}`,
      title: `Mensagem ${index + 1}`,
      text,
      favorite: false,
      kind: "initial",
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
      typeof item.favorite !== "boolean" ||
      (item.kind !== undefined && item.kind !== "initial" && item.kind !== "follow_up")
    ) {
      return null;
    }

    seen.add(item.id);
    templates.push({
      id: item.id,
      title: item.title,
      text: item.text,
      favorite: item.favorite,
      kind: item.kind ?? "initial",
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
