import { qualifyDigitalOpportunity } from "./digital-opportunity.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw Error(message);
}

Deno.test("classifies unverified no-site contacts as website prospect without guaranteeing need", () => {
  const item = qualifyDigitalOpportunity({ website: null, phone: "(35) 99999-9999" });
  assert(item.kind === "website-prospect", "Phone and no site is a prospect");
  assert(item.summary.includes("Verifique"), "No-site is not proven absence");
  assert(item.signals.some(x=>x.includes("WhatsApp não confirmado")), "Do not claim WhatsApp ownership");
  assert(qualifyDigitalOpportunity({ email: "atendimento@empresa.com.br" }).kind === "website-prospect",
    "Unverified email can enable an approach");
});
Deno.test("does not interpret provider Instagram candidates as confirmed", () => {
  const lead = qualifyDigitalOpportunity({
    website:"https://empresa.com.br", phone:"35999999999",
    instagramCandidates:[{url:"https://instagram.com/qualquer"}],
    instagramConfidence:"medium",
  });
  assert(lead.kind==="channel-review", "Candidate is not official Instagram");
  assert(lead.signals.some(x=>x.includes("conferência")), "Show verification needed");
  assert(qualifyDigitalOpportunity({
    website:"https://empresa.com.br",phone:"35999999999",
    instagram:"https://instagram.com/empresa",instagramConfidence:null,
  }).kind==="channel-review",
    "Instagram without explicit high-confidence verification is not confirmed");
  const unverified = qualifyDigitalOpportunity({
    website:"https://empresa.com.br",phone:"35999999999",
    instagram:"https://instagram.com/empresa",instagramConfidence:null,
  });
  assert(unverified.signals.includes("Possível Instagram para conferência"),
    "Unverified direct Instagram should appear as a candidate, not disappear");
  assert(!unverified.signals.includes("Instagram identificado"),
    "Unverified direct Instagram must never be presented as identified");
  assert(qualifyDigitalOpportunity({
    website:"https://empresa.com.br", phone:"35999999999",
    instagram:"https://instagram.com/empresa", instagramConfidence:"high",
    instagramNeedsReview:true,
  }).kind==="channel-review","Unreviewed social link must not be confirmed");
});
Deno.test("multichannel and research groups use only factual presence signals", () => {
  assert(qualifyDigitalOpportunity({
    website:"https://empresa.com",phone:"35999999999",
    instagram:"https://instagram.com/empresa",instagramConfidence:"high",
    instagramNeedsReview:false,
  }).kind==="multichannel","Confirmed channels and site");
  assert(qualifyDigitalOpportunity({website:null,email:null,phone:null}).kind==="contact-research",
    "No contact needs research, not a cold outreach recommendation");
  assert(qualifyDigitalOpportunity({website:"https://empresa.com"}).kind==="channel-review",
    "Existing site is not an automatic website sales opportunity");
  assert(!qualifyDigitalOpportunity({email:"mailto:bad@site.com"}).signals.some(x=>x.includes("E-mail")),
    "Malformed directory emails must not be treated as contacts");
});
