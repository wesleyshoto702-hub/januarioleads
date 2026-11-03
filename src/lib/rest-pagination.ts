/** Continue until an empty page: the server may cap pages below our requested size. */
export async function fetchAllRows<T>(
  request: (path: string) => Promise<Response>,
  path: string,
): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const response = await request(`${path}&limit=500&offset=${rows.length}`);
    if (!response.ok) throw new Error(`REST_${response.status}`);
    const page: T[] = await response.json();
    if (!Array.isArray(page)) throw new Error("INVALID_REST_PAGE");
    if (!page.length) return rows;
    rows.push(...page);
  }
}
