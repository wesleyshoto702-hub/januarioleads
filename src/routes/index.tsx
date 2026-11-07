import { MARKETING_STYLES } from "../lib/route-styles";
import { createFileRoute } from "@tanstack/react-router";
import { MarketingHome } from "../components/marketing/MarketingHome";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [...MARKETING_STYLES],
    meta: [
      { title: "Januário Leads — Encontre empresas e organize sua prospecção" },
      { name: "description", content: "Pesquise empresas por nicho e cidade, organize leads no CRM, planeje retornos e acompanhe oportunidades com o Januário Leads." },
      { property: "og:title", content: "Januário Leads — Prospecção com método" },
      { property: "og:description", content: "Da pesquisa de empresas ao próximo contato, em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketingHome,
});
