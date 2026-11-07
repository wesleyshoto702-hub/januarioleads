import { SIGNUP_STYLES } from "../lib/route-styles";
import { createFileRoute } from "@tanstack/react-router";
import { UnifiedAuthPage } from "../components/auth/UnifiedAuthPage";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    links: [...SIGNUP_STYLES],
    meta: [
      { title: "Criar conta | Januário Leads" },
      {
        name: "description",
        content: "Entre ou crie sua conta no Januário Leads, em um único espaço de autenticação.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: SignupRoute,
});

function SignupRoute() {
  return <UnifiedAuthPage initialMode="signup" />;
}
