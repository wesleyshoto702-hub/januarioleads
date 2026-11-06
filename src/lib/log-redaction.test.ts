import { redactLogText, sanitizeLogValue } from "./log-redaction.ts";
import { describeError } from "./error-capture.ts";

function ok(condition: unknown, message = "Assertion failed"): asserts condition {
  if (!condition) throw new Error(message);
}

function equal(actual: unknown, expected: unknown): void {
  if (!Object.is(actual, expected)) throw new Error("Unexpected value");
}

Deno.test("diagnostics redact credentials throughout error causes and preserve useful context", () => {
  const error = new Error("Request failed with status 503", { cause: {
    authorization: "Bearer PRIVATE_AUTH", password: "PRIVATE_PASSWORD",
    BFF_SESSION_KEY: "PRIVATE_SESSION", SUPABASE_SERVICE_ROLE_KEY: "PRIVATE_SERVICE",
    nested: [{ refresh_token: "PRIVATE_REFRESH", status: 503 }],
  }});
  const output = describeError(error);
  for (const secret of ["PRIVATE_AUTH", "PRIVATE_PASSWORD", "PRIVATE_REFRESH", "PRIVATE_SESSION", "PRIVATE_SERVICE"]) {
    ok(!output.includes(secret));
  }
  ok(output.includes("503"));
  ok(output.includes("Request failed"));
  equal((error.cause as { password: string }).password, "PRIVATE_PASSWORD");
});

Deno.test("strings redact URLs, headers, quoted values, JWTs and provider keys", () => {
  const cases = [
    ['postgresql://admin:PRIVATE_PASSWORD@localhost/db', 'PRIVATE_PASSWORD'],
    ['https://example.test/?access_token=PRIVATE_TOKEN&limit=10', 'PRIVATE_TOKEN'],
    ['https://example.test/?%61pi_key=PRIVATE_API', 'PRIVATE_API'],
    ['Authorization: Bearer PRIVATE_AUTH', 'PRIVATE_AUTH'],
    ['Authorization: Basic PRIVATE_BASIC', 'PRIVATE_BASIC'],
    ['password="PRIVATE PASSWORD WITH SPACES"', 'PRIVATE PASSWORD'],
    ["{\"password\":\"PRIVATE_JSON\"}", 'PRIVATE_JSON'],
    ['Cookie: arbitrary_session=PRIVATE_COOKIE; other=PRIVATE_OTHER', 'PRIVATE_COOKIE'],
    ['token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature', 'eyJhbGci'],
    ['upstream key sb_secret_PRIVATE_KEY', 'PRIVATE_KEY'],
  ];
  for (const [input, secret] of cases) ok(!redactLogText(input).includes(secret), input);
  equal(redactLogText('GET /leads?limit=10 status=503'), 'GET /leads?limit=10 status=503');
});

Deno.test("structured log arguments do not invoke getters or toJSON and handle cycles", () => {
  let invoked = false;
  const input: Record<string, unknown> = { password: "PRIVATE", status: 403,
    toJSON() { invoked = true; return "PRIVATE"; } };
  Object.defineProperty(input, "details", { enumerable: true, get() { invoked = true; return "PRIVATE"; } });
  input.self = input;
  const output = JSON.stringify(sanitizeLogValue(input));
  ok(!output.includes("PRIVATE"));
  ok(output.includes("CIRCULAR"));
  equal(invoked, false);
  const sanitizedArray = sanitizeLogValue(["Bearer PRIVATE", 403]);
  ok(Array.isArray(sanitizedArray));
  equal(sanitizedArray.length, 2);
  equal(sanitizedArray[0], "[REDACTED]");
  equal(sanitizedArray[1], 403);
});
