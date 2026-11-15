/** A newer search always owns the UI.
 * Used by SearchLeadsView and exercised with controlled deferred responses.
 */
export type SearchRequestGate = {
  next(): number;
  isCurrent(sequence: number): boolean;
  invalidate(): void;
};
export function createSearchRequestGate(): SearchRequestGate {
  let latest = 0;
  return {
    next() { return ++latest; },
    isCurrent(sequence) { return sequence === latest; },
    invalidate() { latest++; },
  };
}
