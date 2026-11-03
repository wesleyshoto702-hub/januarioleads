import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { createCspNonce, buildCsp } from "./lib/csp";

import { renderErrorPage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// Nonce must be generated for each HTTP request, never at module load.
// TanStack Router uses this same value to stamp SSR hydration scripts.
const cspMiddleware = createMiddleware().server(({ next }) => {
  const cspNonce = createCspNonce();
  setResponseHeader("Content-Security-Policy", buildCsp(cspNonce));
  return next({ context: { cspNonce } });
});

export const startInstance = createStart(() => ({
  requestMiddleware: [cspMiddleware, errorMiddleware, csrfMiddleware],
}));
