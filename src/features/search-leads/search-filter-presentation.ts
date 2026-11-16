/** Fase 2.3a: exact filter names/claims displayed by Buscar Leads.
 * "No site/Instagram" means NOT IDENTIFIED, never verified absence.
 * WhatsApp is an unverified format check, not a live-account assertion.
 */
import { DEFAULT_RESULT_FILTERS, type ResultFilter, type ResultFilterState,
  type LeadStatusFilter } from "./search-result-filters.ts";

export type SmartFilterId =
  | "no-site-phone"
  | "no-site-whatsapp"
  | "high-chance-no-site"
  | "not-contacted"
  | "waiting"
  | "instagram-no-site";

export type SmartFilterPreset = {
  id: SmartFilterId;
  label: string;
  title: string;
  resultFilters: ResultFilterState;
  leadStatusFilter: LeadStatusFilter;
};

export const RESULT_FILTER_OPTIONS: ReadonlyArray<readonly [ResultFilter, string, string]> = [
  ["all", "Todos", "Mostrar os resultados carregados nesta pesquisa."],
  ["phone", "Telefone informado", "Telefone presente no cadastro; número não necessariamente ativo."],
  ["email", "E-mail com formato válido", "Formato básico identificado; entrega não verificada."],
  ["whatsapp", "Número compatível com WhatsApp", "Formato brasileiro compatível; não confirma conta ativa no WhatsApp."],
  ["with-site", "Site identificado", "Site informado pela fonte; não comprova que a página funcione ou pertença à empresa."],
  ["without-site", "Site não identificado", "Não há site informado nesta fonte; a empresa pode ter um site."],
  ["with-instagram", "Instagram com alta confiança", "Perfil marcado com alta confiança; não comprova titularidade oficial."],
  ["without-instagram", "Instagram não confirmado", "Inclui perfis candidatos, não pesquisados e sem confirmação; não prova ausência de Instagram."],
];

export const SMART_FILTERS: ReadonlyArray<SmartFilterPreset> = [
  {
    id: "no-site-phone",
    label: "Site não identificado + telefone",
    title: "Empresas sem site informado e com telefone cadastrado, sem verificação de atividade.",
    resultFilters: {
      ...DEFAULT_RESULT_FILTERS,
      contact: "phone",
      website: "without-site",
    },
    leadStatusFilter: "all",
  },
  {
    id: "no-site-whatsapp",
    label: "Site não identificado + formato WhatsApp",
    title: "Empresas sem site informado e telefone com formato compatível; conta WhatsApp não verificada.",
    resultFilters: {
      ...DEFAULT_RESULT_FILTERS,
      contact: "whatsapp",
      website: "without-site",
    },
    leadStatusFilter: "all",
  },
  {
    id: "high-chance-no-site",
    label: "Pontuação alta + site não identificado",
    title: "Pontuação heurística alta ou muito alta e site não identificado na fonte.",
    resultFilters: {
      ...DEFAULT_RESULT_FILTERS,
      website: "without-site",
      chance: "high",
    },
    leadStatusFilter: "all",
  },
  {
    id: "not-contacted",
    label: "Não contatados",
    title: "Empresas já salvas com status Enviar mensagem.",
    resultFilters: DEFAULT_RESULT_FILTERS,
    leadStatusFilter: "send_message",
  },
  {
    id: "waiting",
    label: "Aguardando",
    title: "Empresas já salvas com status Aguardando.",
    resultFilters: DEFAULT_RESULT_FILTERS,
    leadStatusFilter: "waiting",
  },
  {
    id: "instagram-no-site",
    label: "Instagram com alta confiança + site não identificado",
    title: "Perfil de Instagram com alta confiança e site não informado; não comprova titularidade oficial.",
    resultFilters: {
      ...DEFAULT_RESULT_FILTERS,
      website: "without-site",
      instagram: "with-instagram",
    },
    leadStatusFilter: "all",
  },
];

