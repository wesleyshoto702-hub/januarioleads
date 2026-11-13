#!/usr/bin/env node
// Read-only authenticated smoke test for the Varginha Overture pilot.
// Supply a short-lived STAGING user access token; NEVER use a service_role key.
// This file is intentionally not part of any scheduled CI workflow.

const url = "https://prlrxjothrslhswpkoza.supabase.co/functions/v1/search-places";
const apiKey = process.env.STAGING_PUBLISHABLE_KEY?.trim();
const userToken = process.env.STAGING_USER_ACCESS_TOKEN?.trim();
const body = JSON.stringify({ segment: "Hotel", city: "Varginha", state: "MG" });

if (!apiKey || !userToken) {
  console.error("SKIPPED: set STAGING_PUBLISHABLE_KEY and STAGING_USER_ACCESS_TOKEN locally.");
  console.error("The access token must be for a signed-in staging user; never paste it in chat or commit it.");
  process.exitCode = 2;
} else if (apiKey.startsWith("sb_secret_") || apiKey.split(".").length === 3 && apiKey.includes("service_role")) {
  console.error("REFUSED: the client key must be a publishable/anon key, not service_role.");
  process.exitCode = 2;
} else {
  try {
    const headers = { apikey: apiKey, "Content-Type": "application/json" };
    const denied = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(12000) });
    if (denied.status !== 401) throw new Error("Expected unauthenticated HTTP 401, got " + denied.status);
    console.log("PASS: unauthenticated search blocked (HTTP 401).");

    const response = await fetch(url, {
      method: "POST",
      headers: { ...headers, Authorization: "Bearer " + userToken },
      body,
      signal: AbortSignal.timeout(25000),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) {
      throw new Error("Authenticated search failed: HTTP " + response.status + " (" + (result?.code ?? "unknown") + ")");
    }

    const returned = Array.isArray(result.results) ? result.results : [];
    const local = returned.filter((row) => row.source === "overture" &&
      row.city?.toLowerCase() === "varginha" &&
      row.state === "MG" &&
      typeof row.name === "string");
    if (!local.length) {
      throw new Error("Search succeeded but did not return an Overture hotel in Varginha.");
    }
    console.log("PASS: authenticated search returned " + returned.length + " leads, " +
      local.length + " from Overture in Varginha.");
    console.log("Sample: " + local.slice(0, 4).map((row) => row.name).join(" | "));
  } catch (error) {
    // No token/key values or personal contact details in diagnostics.
    console.error("FAIL: " + (error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  }
}
