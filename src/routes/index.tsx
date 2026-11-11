import { MARKETING_STYLES } from "../lib/route-styles";
import { createFileRoute } from "@tanstack/react-router";
import { MarketingHome } from "../components/marketing/MarketingHome";

export const Route = createFileRoute("/")({
  head: () => ({
    links: [...MARKETING_STYLES],
    meta: [
      { title: "Januário Leads — Prospecção e gestão comercial organizada" },
      { name: "description", content: "Pesquise empresas por cidade e nicho, organize leads no CRM e conheça ferramentas para análise digital, propostas e acompanhamento comercial no Januário Leads." },
      { property: "og:title", content: "Januário Leads — Prospecção com método" },
      { property: "og:description", content: "Da pesquisa de empresas à organização de propostas e projetos, em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketingHome,
});
