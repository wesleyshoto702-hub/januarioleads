import { MARKETING_STYLES } from "../lib/route-styles";
import { createFileRoute } from "@tanstack/react-router";
import { MarketingHome } from "../components/marketing/MarketingHome";

/** Backwards-compatible public link from the first commercial presentation. */
export const Route = createFileRoute("/produto")({
  head: () => ({
    links: [...MARKETING_STYLES],
    meta: [
      { title: "Januário Leads — Conheça a plataforma" },
      { name: "description", content: "Conheça o Januário Leads: pesquisa por região, CRM, análises digitais, propostas e ferramentas de acompanhamento comercial." },
      { name: "robots", content: "noindex,follow" },
    ],
  }),
  component: MarketingHome,
});
