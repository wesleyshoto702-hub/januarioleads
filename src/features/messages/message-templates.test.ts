import {
  DEFAULT_MESSAGE_TEMPLATES,
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
