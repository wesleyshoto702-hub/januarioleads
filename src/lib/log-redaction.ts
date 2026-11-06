const REDACTED = "[REDACTED]";
const SECRET_KEY = /^(?:authorization|proxy[-_]?authorization|cookie|set[-_]?cookie|password|passwd|pwd|secret|client[-_]?secret|token|access[-_]?token|refresh[-_]?token|id[-_]?token|api[-_]?key|apikey|service[-_]?role[-_]?key|.*[-_]password|.*[-_]secret|.*[-_]token|.*[-_]api[-_]?key|.*[-_]key)$/i;

/** Defense in depth for diagnostics, never a reason to log request bodies. */
export function redactLogText(value: string): string {
  return value
    .replace(/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+(?::[^\s/@]*)?@/gi, "$1[REDACTED]@")
    .replace(/\b(?:Bearer|Basic)\s+[^\s,;"'<>]+/gi, REDACTED)
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
    .replace(/\b(?:sbp_|sb_secret_|sk-(?:proj-)?)[A-Za-z0-9_-]+/g, REDACTED)
    .replace(/\b(?:set-cookie|cookie)\s*:\s*[^\r\n]*/gi, `cookie: ${REDACTED}`)
    .replace(/([?&])([^=&#\s]+)=([^&#\s]*)/g, (match, prefix, key) => {
      try {
        return SECRET_KEY.test(decodeURIComponent(key)) ? `${prefix}${key}=${REDACTED}` : match;
      } catch { return `${prefix}${key}=${REDACTED}`; }
    })
    .replace(/(["']?)([a-z][a-z0-9_-]*)\1\s*[:=]\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;&}\]]+)/gi,
      (match, _quote, key) => SECRET_KEY.test(key) ? `${key}=${REDACTED}` : match);
}

export function sanitizeLogValue(value: unknown): unknown {
  const seen = new WeakSet<object>();
  function visit(item: unknown, depth: number): unknown {
    if (typeof item === "function") return "[FUNCTION]";
    if (typeof item === "string") return redactLogText(item);
    if (!item || typeof item !== "object") return item;
    if (depth > 8) return "[DEPTH LIMIT]";
    if (seen.has(item)) return "[CIRCULAR]";
    seen.add(item);
    if (item instanceof Error) {
      return { name: redactLogText(item.name), message: redactLogText(item.message),
        stack: item.stack ? redactLogText(item.stack) : undefined,
        cause: visit(item.cause, depth + 1) };
    }
    if (Array.isArray(item)) return item.map(entry => visit(entry, depth + 1));
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(item)) {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      result[redactLogText(key)] = SECRET_KEY.test(key) ? REDACTED
        : descriptor && "value" in descriptor ? visit(descriptor.value, depth + 1) : "[ACCESSOR]";
    }
    return result;
  }
  try { return visit(value, 0); } catch { return "[UNAVAILABLE DIAGNOSTIC]"; }
}
