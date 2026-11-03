import { fetchAllRows } from "./rest-pagination.ts";
Deno.test("pagination follows actual server cap until empty, preserving every row", async () => {
  const rows = Array.from({ length: 1203 }, (_, id) => ({ id }));
  const result = await fetchAllRows<{ id: number }>(async (path) => {
    const offset = Number(new URL("https://example.test/" + path).searchParams.get("offset"));
    return Response.json(rows.slice(offset, offset + 137));
  }, "leads?order=id");
  if (JSON.stringify(result) !== JSON.stringify(rows)) throw new Error("Rows lost");
});
Deno.test("pagination rejects partial results on a failed page", async () => {
  let calls = 0;
  try {
    await fetchAllRows(
      async () => (++calls === 1 ? Response.json([1]) : new Response("", { status: 500 })),
      "leads?order=id",
    );
  } catch {
    return;
  }
  throw new Error("Partial result returned as complete");
});
