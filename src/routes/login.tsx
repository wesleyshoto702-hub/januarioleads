import { SIGNUP_STYLES } from "../lib/route-styles";
import { createFileRoute } from "@tanstack/react-router";
import { UnifiedAuthPage } from "../components/auth/UnifiedAuthPage";

export const Route = createFileRoute("/login")({
  head: () => ({
    links: [...SIGNUP_STYLES],
    meta: [
      { title: "Entrar | Januário Leads" },
      {
        name: "description",
        content: "Entre ou crie sua conta no Januário Leads, em um único espaço de autenticação.",
      },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: LoginRoute,
});

function LoginRoute() {
  return <UnifiedAuthPage initialMode="login" />;
}
