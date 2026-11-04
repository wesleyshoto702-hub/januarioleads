/// <reference lib="deno.ns" />
import {
  DEFAULT_MESSAGE_TEMPLATES,
  DEFAULT_FOLLOW_UP_TEMPLATES,
  appendMissingFollowUpTemplates,
  messagesForKind,
  orderMessageTemplates,
  parseSavedMessageTemplates,
} from "./message-templates.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("original messages remain recoverable even when the saved list is empty", () => {
  const deletedAll = parseSavedMessageTemplates([]);
  assert(deletedAll !== null && deletedAll.length === 0, "Empty list should be readable");
  assert(DEFAULT_MESSAGE_TEMPLATES.length === 3, "Three original templates should be available");
  assert(DEFAULT_MESSAGE_TEMPLATES.every((message) => message.text.includes("{empresa}")),
    "Original messages must still support company personalization");
});

Deno.test("legacy string arrays and named custom templates can still be read", () => {
  const old = parseSavedMessageTemplates(["Olá {empresa}", "Tudo bem?"]);
  assert(old?.length === 2, "Legacy templates lost");
  assert(old[0]?.id === "default-1", "Legacy template ID changed");

  const custom = {
    id: "my-custom-message",
    title: "Oferta de landing page",
    text: "Olá {empresa}, posso ajudar com uma landing page?",
    favorite: true,
  };
  const parsed = parseSavedMessageTemplates([custom]);
  assert(parsed?.[0]?.title === custom.title, "Custom message not preserved");
  assert(parsed[0]?.text === custom.text, "Custom text changed");
});

Deno.test("deleted and favorite messages preserve ordering rules", () => {
  const messages = [
    { id: "first", title: "Primeira", text: "Texto A", favorite: false },
    { id: "second", title: "Segunda", text: "Texto B", favorite: true },
    { id: "third", title: "Terceira", text: "Texto C", favorite: false },
  ];
  const ordered = orderMessageTemplates(messages);
  assert(ordered.map((row) => row.id).join(",") === "second,first,third",
    "Favorited messages should appear first, without losing other messages");
  assert(messages[0]?.id === "first", "Original messages must not be mutated");
});

Deno.test("legacy saved messages remain initial, and follow-ups are separated", () => {
  const legacy = parseSavedMessageTemplates([
    { id: "old-one", title: "Mensagem antiga", text: "Olá {empresa}", favorite: true },
  ]);
  assert(legacy?.[0]?.kind === "initial", "Legacy messages must stay in initial category");
  const seeded = appendMissingFollowUpTemplates(legacy);
  assert(seeded.length === 4, "Three editable follow-up examples should be seeded");
  assert(messagesForKind(seeded, "initial").length === 1, "Initial messages should remain visible");
  assert(messagesForKind(seeded, "follow_up").length === 3, "Follow-ups should have their own list");
  assert(DEFAULT_FOLLOW_UP_TEMPLATES.every((item) => item.text.includes("{empresa}")),
    "Follow-up examples should retain company personalization");
});

Deno.test("follow-up favorites, edits and deletes are preserved without recreating removed messages", () => {
  const initial = { id: "initial", title: "Inicial", text: "Olá", favorite: true, kind: "initial" as const };
  const first = { ...DEFAULT_FOLLOW_UP_TEMPLATES[0]!, title: "Meu retorno", text: "Voltei {empresa}", favorite: true };
  const second = { ...DEFAULT_FOLLOW_UP_TEMPLATES[1]!, favorite: false };
  const saved = parseSavedMessageTemplates([initial, second, first]);
  assert(saved?.length === 3, "Saved follow-up templates must be readable");
  assert(messagesForKind(saved, "follow_up")[0]?.id === first.id,
    "Favorite follow-up should appear first");
  assert(messagesForKind(saved, "initial")[0]?.id === initial.id,
    "Initial favorite should remain separate");

  const deleted = saved.filter((item) => item.id !== first.id);
  assert(messagesForKind(deleted, "follow_up").every((item) => item.id !== first.id),
    "Deleted follow-up should remain removed unless explicitly restored");
  assert(parseSavedMessageTemplates([{ ...first, kind: "invalid" }]) === null,
    "Unknown template kinds must not be silently accepted");
  assert(appendMissingFollowUpTemplates(seededOnce(saved)).length === 4,
    "Seed helper should only fill missing default IDs if explicitly requested");
});

function seededOnce(templates: ReturnType<typeof parseSavedMessageTemplates>) {
  if (!templates) throw new Error("Expected valid templates");
  return appendMissingFollowUpTemplates(templates);
}
