import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createIsomorphicFn, getGlobalStartContext } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";

// On the server the nonce comes from request middleware; on the client
// TanStack Router embeds it in a meta element during SSR.
const getCspNonce = createIsomorphicFn()
  .server(() => getGlobalStartContext()?.cspNonce as string | undefined)
  .client(() =>
    document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.content
  );

export const getRouter = () => {
  const queryClient = new QueryClient();
  const cspNonce = getCspNonce();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(cspNonce ? { ssr: { nonce: cspNonce } } : {}),
  });

  return router;
};
