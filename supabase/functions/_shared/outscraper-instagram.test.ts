import {
  outscraperCompanyDomain,
  outscraperInstagramCandidates,
  outscraperResponseStatus,
} from "./outscraper-instagram.ts";

function expect(value: unknown, expected: unknown) {
  if (value !== expected) throw new Error(`Expected ${String(expected)} but received ${String(value)}`);
}

Deno.test("Outscraper accepts a real company HTTPS domain", () => {
  expect(outscraperCompanyDomain("https://www.exemplo.com.br/contato?src=maps"), "exemplo.com.br");
  expect(outscraperCompanyDomain("http://pousada-exemplo.com.br"), "pousada-exemplo.com.br");
});

Deno.test("Outscraper never enriches Instagram URL, private host or IP", () => {
  for (const value of [
    "https://www.instagram.com/pousada/",
    "https://linktr.ee/pousada",
    "http://localhost:3000",
    "http://10.0.0.1/admin",
    "https://example.local",
    "https://user:pass@empresa.com.br",
    "javascript:alert(1)",
    "https://sites.google.com/view/pousada",
    "",
  ]) expect(outscraperCompanyDomain(value), null);
});

Deno.test("Extracts only Instagram, never Outlook, LinkedIn, Facebook or email", () => {
  const payload = {
    status: "Success", id: "req-12345678",
    data: [{
      query: "empresa.com.br",
      emails: [{value:"private@example.com"}],
      socials: {
        instagram: "https://instagram.com/empresa.oficial/",
        linkedin: "https://linkedin.com/company/empresa",
        facebook: "https://facebook.com/empresa",
      },
    }],
  };
  const candidates = outscraperInstagramCandidates(payload);
  expect(candidates.length, 1);
  expect(candidates[0].confidence, "medium");
  expect(candidates[0].url, "https://www.instagram.com/empresa.oficial/");
  expect(JSON.stringify(candidates).includes("private@example.com"), false);
});

Deno.test("Nested results are parsed with duplicate, post and spoofing removal", () => {
  const payload = {status:"Success",data:[[
    {socials:{instagram:[
      "https://instagram.com/empresa/",
      "https://instagram.com/empresa/",
      "https://instagram.com/reel/ABC",
      "https://instagram.com.evil.example/perfil",
    ]}},
  ]]};
  expect(outscraperInstagramCandidates(payload).length, 1);
  expect(outscraperInstagramCandidates(payload)[0].username, "empresa");
});

Deno.test("Async statuses are safely classified", () => {
  expect(outscraperResponseStatus({status:"Pending",id:"xyz"}), "pending");
  expect(outscraperResponseStatus({status:"Success",data:[]}), "complete");
  expect(outscraperResponseStatus({status:"Failure"}), "failed");
  expect(outscraperResponseStatus({status:"Unexpected"}), "pending");
});
