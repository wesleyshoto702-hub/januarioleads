/** A newer search owns the UI; duplicate "Load more" clicks are blocked.
 * Used by SearchLeadsView and exercised with deferred HTTP/mock cache responses.
 */
export type SearchRequestGate = {
  next(): number;
  nextPage(token:string): number|null;
  isCurrent(sequence: number): boolean;
  finish(sequence:number): void;
  invalidate(): void;
};
export function createSearchRequestGate(): SearchRequestGate {
  let latest = 0;
  let pendingPage:string|null=null;
  return {
    next() {
      pendingPage=null;
      return ++latest;
    },
    nextPage(token) {
      if(!token || pendingPage===token)return null;
      pendingPage=token;
      return ++latest;
    },
    isCurrent(sequence) { return sequence === latest; },
    finish(sequence) {
      if(sequence===latest)pendingPage=null;
    },
    invalidate() {
      pendingPage=null;
      latest++;
    },
  };
}
