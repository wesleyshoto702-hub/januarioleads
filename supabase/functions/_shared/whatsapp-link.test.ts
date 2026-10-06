import {
  buildWhatsAppLinks,
  isValidWhatsAppPhone,
} from "../../../src/lib/whatsapp.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("WhatsApp message links preserve phone and encode personalized text", () => {
  const links = buildWhatsAppLinks({
    phone: "5535999999999",
    message: "Olá Barbearia Central, tudo bem?",
  });

  assert(
    links.appUrl ===
      "whatsapp://send?phone=5535999999999&text=Ol%C3%A1%20Barbearia%20Central%2C%20tudo%20bem%3F",
    `Unexpected app URL: ${links.appUrl}`,
  );
  assert(
    links.webUrl ===
      "https://wa.me/5535999999999?text=Ol%C3%A1%20Barbearia%20Central%2C%20tudo%20bem%3F",
    `Unexpected web URL: ${links.webUrl}`,
  );
});

Deno.test("WhatsApp links without message do not add an empty text query", () => {
  const links = buildWhatsAppLinks({
    phone: "5535999999999",
  });

  assert(
    links.appUrl === "whatsapp://send?phone=5535999999999",
    "App URL should contain only the phone when there is no message.",
  );
  assert(
    links.webUrl === "https://wa.me/5535999999999",
    "Web URL should contain only the phone when there is no message.",
  );
});

Deno.test("Brazilian WhatsApp phone validation requires DDI 55 and 10 or 11 local digits", () => {
  assert(isValidWhatsAppPhone("5535999999999"), "Expected mobile number to be valid.");
  assert(isValidWhatsAppPhone("553532123456"), "Expected landline-shaped number to be valid.");
  assert(!isValidWhatsAppPhone("35999999999"), "Missing DDI must be invalid.");
  assert(!isValidWhatsAppPhone("1235999999999"), "Wrong DDI must be invalid.");
  assert(!isValidWhatsAppPhone("55abc99999999"), "Non-digits must be invalid.");
});
