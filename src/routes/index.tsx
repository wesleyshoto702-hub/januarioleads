import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Edit3,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { buildFactualBusinessDescription } from "../features/business-presence/business-description";
import type { DeepEnrichmentApplied } from "../features/business-enrichment/types";
import { discoverBusinessPresence } from "../features/business-presence/discover-business-presence";
import { presenceFromBusiness } from "../features/business-presence/storage";
import type {
  BusinessPresence,
  InstagramSource,
} from "../features/business-presence/types";
import { LeadEnrichmentModal } from "../features/lead-enrichment/LeadEnrichmentModal";
import { createLeadActivity } from "../features/lead-activities/lead-activities";
import {
  fetchLeadPayments,
  FINANCIAL_STATUS_LABEL,
  formatCurrency,
  monthKey,
  summarizeLeadFinance,
  type FinancialStatus,
  type LeadFinanceSummary,
  type LeadPayment,
} from "../features/lead-finance/finance";
import { ChanceBadge } from "../features/lead-chance/ChanceBadge";
import {
  deleteRemoteLead,
  fetchLeadUpdates,
  fetchRemoteLeads,
  markLeadUpdatesSeen,
  migrateLocalLeads,
  saveRemoteLead,
  type LeadStatus,
  type LeadUpdateRecord,
  type PersistedLead,
} from "../features/leads/remote-leads";
import { STATUS_LABEL } from "../features/leads/lead-status";
import {
  calculateLeadChance,
  hasEnoughDataForLeadChance,
} from "../features/lead-chance/lead-chance";
import { PromptGenerator } from "../features/prompt-generator/PromptGenerator";
import { OpenNowNichesView } from "../features/open-now-niches/OpenNowNichesView";
import { OpportunityView } from "../features/opportunities/OpportunityView";
import { loadOpportunityData } from "../features/opportunities/opportunity-data";
import type { OpportunityRecord } from "../features/opportunities/types";
import { AppShell, type AppView } from "../components/app-shell/AppShell";
import { DashboardView } from "../components/dashboard/DashboardView";
import { FinanceView } from "../components/finance/FinanceView";
import { makePromptBusinessKey } from "../features/prompt-generator/storage";
import type { PromptBusinessContext } from "../features/prompt-generator/types";
import {
  BusinessDetailsModal,
  type BusinessAddResult,
} from "../features/search-leads/BusinessDetailsModal";
import { SearchLeadsView } from "../features/search-leads/SearchLeadsView";
import {
  findBusinessDuplicate,
  normalizeBrazilianPhone,
} from "../features/search-leads/identity";
import type { BusinessSearchResult } from "../features/search-leads/types";
import { getValidSession, signOut, subscribeAuthChange } from "../lib/auth";
import { openWhatsAppLink } from "../lib/whatsapp";
import { BRAZIL_STATES, normalizeBrazilianStateCode } from "../lib/brazil-locations";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JanuarioLeads — Dashboard" },
      { name: "description", content: "Organize seus leads e contatos de prospecção no JanuarioLeads." },
      { property: "og:title", content: "JanuarioLeads — Dashboard" },
      { property: "og:description", content: "Organize seus leads e contatos de prospecção no JanuarioLeads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivateLeadFlowApp,
});

function PrivateLeadFlowApp() {
  const navigate = useNavigate();
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function verify() {
      const session = await getValidSession();
      if (!active) return;
      if (!session) {
        await navigate({ to: "/login", replace: true });
        return;
      }
      setAuthReady(true);
    }

    void verify();
    const unsubscribe = subscribeAuthChange(() => void verify());

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  if (!authReady) {
    return (
      <main className="auth-loading" aria-live="polite">
        <Loader2 size={20} className="auth-spinner" />
        <span>Verificando acesso...</span>
      </main>
    );
  }

  return <LeadFlowApp />;
}

type Status = LeadStatus;

type Lead = PersistedLead;

type LeadForm = Omit<Lead, "id" | "createdAt" | "lastContact">;

const SEGMENTS = [
  "Açaiteria",
  "Hamburgueria",
  "Barbearia",
  "Odontologia",
  "Pastelaria",
  "Restaurante",
  "Academia",
  "Loja",
  "Imobiliária",
  "Outro",
];

const DEFAULT_MESSAGES = [
  "Olá! Meu nome é Wesley. Conheci um pouco do trabalho da {empresa} e gostaria de saber se teriam interesse em ter um site profissional para a empresa.",
  "Olá! Trabalho com criação de sites e landing pages para negócios e queria apresentar uma ideia que poderia fortalecer a presença online da {empresa}.",
  "Olá! Tudo bem? Trabalho desenvolvendo sites para empresas e gostaria de saber se vocês teriam interesse em conhecer uma proposta para a {empresa}.",
];

const EMPTY_FORM: LeadForm = {
  company: "",
  segment: "",
  phone: "",
  status: "send_message",
  firstContact: new Date().toISOString().slice(0, 10),
  notes: "",
};

const STORAGE = {
  leads: "leadflow:leads",
  messages: "leadflow:messages",
  theme: "leadflow:theme",
};

function leadToBusinessSearchResult(lead: Lead): BusinessSearchResult {
  return {
    placeId: lead.placeId ?? `lead:${lead.id}`,
    name: lead.company,
    primaryCategory: lead.primaryCategory ?? null,
    categories: lead.categories ?? [],
    description: lead.description ?? null,
    address: lead.address ?? null,
    neighborhood: lead.neighborhood ?? null,
    city: lead.city ?? null,
    state: lead.state ?? null,
    phone: lead.phone || null,
    internationalPhone: lead.internationalPhone ?? null,
    rating: lead.rating ?? null,
    reviewCount: lead.reviewCount ?? null,
    isOpenNow: lead.isOpenNow ?? null,
    openingHours: lead.openingHours ?? [],
    website: lead.website ?? null,
    instagram: lead.instagram ?? null,
    instagramConfidence: lead.instagramConfidence ?? null,
    instagramSource: lead.instagramSource ?? null,
    instagramCheckedAt: lead.instagramCheckedAt ?? null,
    instagramUsername: lead.instagramUsername ?? null,
    instagramCandidates: lead.instagramCandidates ?? [],
    instagramRejectedUrls: lead.instagramRejectedUrls ?? [],
    instagramSearchSignature: lead.instagramSearchSignature ?? null,
    instagramNeedsReview: lead.instagramNeedsReview ?? false,
    factualDescription: lead.factualDescription ?? null,
    googleMapsUrl: lead.googleMapsUrl ?? null,
    businessStatus: lead.businessStatus ?? null,
    latitude: lead.latitude ?? null,
    longitude: lead.longitude ?? null,
    verifiedContent: lead.verifiedContent ?? {},
    verifiedImages: lead.verifiedImages ?? [],
    confirmedChannels: lead.confirmedChannels ?? {},
    deepEnrichmentStatus: lead.deepEnrichmentStatus ?? null,
    deepEnrichmentQuality: lead.deepEnrichmentQuality ?? null,
    deepEnrichmentCheckedAt: lead.deepEnrichmentCheckedAt ?? null,
  };
}

const INSTAGRAM_SOURCE_LABEL: Record<InstagramSource, string> = {
  google_places: "Google Places",
  official_website: "Website oficial",
  web_search: "Busca pública",
  manual_confirmation: "Confirmação manual",
  existing_data: "Dados existentes",
};

function confirmedInstagram(
  value: string | null | undefined,
  confidence: "high" | "medium" | "low" | null | undefined,
) {
  return value && confidence !== "medium" && confidence !== "low"
    ? value
    : null;
}

function LeadFlowApp() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hydrated, setHydrated] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const [leadUpdates, setLeadUpdates] = useState<LeadUpdateRecord[]>([]);
  const [leadPayments, setLeadPayments] = useState<LeadPayment[]>([]);
  const [financeLoaded, setFinanceLoaded] = useState(false);
  const [financeError, setFinanceError] = useState("");
  const [view, setView] = useState<AppView>("dashboard");
  const [leadModal, setLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [financialFilter, setFinancialFilter] = useState<
    "all" | FinancialStatus
  >("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [messageLead, setMessageLead] = useState<{ id?: string; company: string; phone: string } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState(0);
  const [messageActionPending, setMessageActionPending] = useState(false);
  const [messageActionError, setMessageActionError] = useState("");
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [enrichmentLead, setEnrichmentLead] = useState<Lead | null>(null);
  const [leadDetailsId, setLeadDetailsId] = useState<string | null>(null);
  const [promptBusiness, setPromptBusiness] = useState<PromptBusinessContext | null>(null);
  const [promptActivityLeadId, setPromptActivityLeadId] = useState<string | null>(null);
  const [activityError, setActivityError] = useState("");
  const [savedNotice, setSavedNotice] = useState(false);
  const [dashboardOpportunities, setDashboardOpportunities] = useState<
    OpportunityRecord[]
  >([]);
  const [dashboardOpportunitiesLoading, setDashboardOpportunitiesLoading] =
    useState(false);
  const [dashboardOpportunitiesError, setDashboardOpportunitiesError] =
    useState("");
  const [dashboardOpportunitiesLoaded, setDashboardOpportunitiesLoaded] =
    useState(false);

  useEffect(() => {
    let active = true;
    let localLeads: Lead[] = [];

    try {
      const storedLeads = localStorage.getItem(STORAGE.leads);
      const storedMessages = localStorage.getItem(STORAGE.messages);
      const storedTheme = localStorage.getItem(STORAGE.theme) as
        | "light"
        | "dark"
        | null;

      if (storedLeads) {
        const parsed = JSON.parse(storedLeads);
        if (Array.isArray(parsed)) localLeads = parsed as Lead[];
      }

      setLeads(localLeads);

      if (storedMessages) {
        const parsed = JSON.parse(storedMessages);
        if (Array.isArray(parsed) && parsed.length === 3) setMessages(parsed);
      }

      if (storedTheme === "dark" || storedTheme === "light") {
        setTheme(storedTheme);
      }
    } catch {
      // Corrupted local data never blocks access; backend migration still runs.
    } finally {
      setHydrated(true);
    }

    async function connectRemoteStorage() {
      try {
        const remoteLeads = await migrateLocalLeads(localLeads);
        if (!active) return;

        setLeads(remoteLeads);
        setLeadUpdates(await fetchLeadUpdates());
        try {
          setLeadPayments(await fetchLeadPayments());
          setFinanceLoaded(true);
          setFinanceError("");
        } catch {
          setLeadPayments([]);
          setFinanceLoaded(false);
          setFinanceError(
            "Não foi possível carregar os recebimentos agora. O restante do CRM continua disponível.",
          );
        }
        setRemoteReady(true);
        setRemoteError("");
      } catch {
        if (!active) return;
        setRemoteReady(false);
        setRemoteError(
          "Sincronização automática indisponível agora. Seus dados locais continuam preservados.",
        );
      }
    }

    void connectRemoteStorage();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE.leads, JSON.stringify(leads));
  }, [leads, hydrated]);

  useEffect(() => {
    if (!remoteReady) return;

    let active = true;
    let refreshInFlight = false;

    async function refreshRemoteState() {
      if (!active || refreshInFlight) return;
      refreshInFlight = true;

      try {
        const [remoteLeads, updates] = await Promise.all([
          fetchRemoteLeads(),
          fetchLeadUpdates(),
        ]);

        if (!active) return;
        setLeads(remoteLeads);
        setLeadUpdates(updates);
        try {
          setLeadPayments(await fetchLeadPayments());
          setFinanceLoaded(true);
          setFinanceError("");
        } catch {
          setFinanceError(
            "Não foi possível atualizar os recebimentos agora. Os dados financeiros exibidos podem estar desatualizados.",
          );
        }
        setRemoteError("");
      } catch {
        if (!active) return;
        setRemoteError(
          "Não foi possível atualizar a cópia remota agora. O CRM continua disponível localmente.",
        );
      } finally {
        refreshInFlight = false;
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refreshRemoteState();
      }
    }

    function refreshAfterPageRestore(event: PageTransitionEvent) {
      if (event.persisted) {
        void refreshRemoteState();
      }
    }

    window.addEventListener("focus", refreshRemoteState);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("pageshow", refreshAfterPageRestore);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshRemoteState);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("pageshow", refreshAfterPageRestore);
    };
  }, [remoteReady]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE.messages, JSON.stringify(messages));
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE.theme, theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme, hydrated]);

  useEffect(() => {
    setMessageActionPending(false);
    setMessageActionError("");
  }, [messageLead?.id, messageLead?.company]);

  useEffect(() => {
    if (
      view !== "dashboard" ||
      !remoteReady ||
      dashboardOpportunitiesLoaded
    ) {
      return;
    }

    let active = true;
    setDashboardOpportunitiesLoading(true);
    setDashboardOpportunitiesError("");

    void loadOpportunityData(leads)
      .then((value) => {
        if (!active) return;
        setDashboardOpportunities(value.records);
        setDashboardOpportunitiesLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setDashboardOpportunitiesError(
          "Não foi possível carregar o resumo de oportunidades agora.",
        );
      })
      .finally(() => {
        if (active) setDashboardOpportunitiesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    view,
    remoteReady,
    leads,
    dashboardOpportunitiesLoaded,
  ]);

  const counts = useMemo(
    () => ({
      all: leads.length,
      send_message: leads.filter((lead) => lead.status === "send_message").length,
      waiting: leads.filter((lead) => lead.status === "waiting").length,
      accepted: leads.filter((lead) => lead.status === "accepted").length,
      rejected: leads.filter((lead) => lead.status === "rejected").length,
    }),
    [leads],
  );

  const availableSegments = useMemo(
    () => Array.from(new Set(leads.map((lead) => lead.segment).filter(Boolean))).sort(),
    [leads],
  );

  const availableStates = useMemo(
    () =>
      BRAZIL_STATES.filter((state) =>
        leads.some(
          (lead) => normalizeBrazilianStateCode(lead.state) === state.code,
        ),
      ),
    [leads],
  );

  const availableCities = useMemo(() => {
    if (stateFilter === "all") return [] as string[];
    return Array.from(
      new Set(
        leads
          .filter(
            (lead) =>
              normalizeBrazilianStateCode(lead.state) === stateFilter &&
              Boolean(lead.city?.trim()),
          )
          .map((lead) => lead.city!.trim()),
      ),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [leads, stateFilter]);

  useEffect(() => {
    if (cityFilter !== "all" && !availableCities.includes(cityFilter)) {
      setCityFilter("all");
    }
  }, [availableCities, cityFilter]);

  const paymentsByLead = useMemo(() => {
    const map = new Map<string, LeadPayment[]>();
    for (const payment of leadPayments) {
      const current = map.get(payment.leadId) ?? [];
      current.push(payment);
      map.set(payment.leadId, current);
    }
    return map;
  }, [leadPayments]);

  const financeByLead = useMemo(() => {
    const map = new Map<string, LeadFinanceSummary>();
    if (!financeLoaded) return map;
    for (const lead of leads) {
      const summary = summarizeLeadFinance(
        lead,
        paymentsByLead.get(lead.id) ?? [],
      );
      if (summary) map.set(lead.id, summary);
    }
    return map;
  }, [leads, paymentsByLead, financeLoaded]);

  const financialOverview = useMemo(() => {
    const currentMonth = monthKey();
    const receivedThisMonth = leadPayments
      .filter((payment) => payment.paymentDate.slice(0, 7) === currentMonth)
      .reduce((total, payment) => total + payment.amount, 0);

    let receivable = 0;
    let paidProjects = 0;
    let partialProjects = 0;
    let pendingProjects = 0;

    for (const summary of financeByLead.values()) {
      if (summary.status === "paid") paidProjects += 1;
      if (summary.status === "partial") partialProjects += 1;
      if (summary.status === "pending") pendingProjects += 1;
      if (summary.status !== "paid") receivable += summary.remainingValue;
    }

    return {
      receivedThisMonth,
      receivable,
      paidProjects,
      partialProjects,
      pendingProjects,
    };
  }, [financeByLead, leadPayments]);

  const visibleLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = leads.filter((lead) => {
      const matchesSearch =
        !query ||
        lead.company.toLowerCase().includes(query) ||
        lead.segment.toLowerCase().includes(query) ||
        lead.phone.replace(/\D/g, "").includes(query.replace(/\D/g, ""));
      const matchesStatus = statusFilter === "all" || lead.status === statusFilter;
      const matchesSegment = segmentFilter === "all" || lead.segment === segmentFilter;
      const matchesState =
        stateFilter === "all" ||
        normalizeBrazilianStateCode(lead.state) === stateFilter;
      const matchesCity =
        cityFilter === "all" || lead.city?.trim() === cityFilter;
      const finance = financeByLead.get(lead.id);
      const matchesFinancial =
        financialFilter === "all" || finance?.status === financialFilter;
      return (
        matchesSearch &&
        matchesStatus &&
        matchesSegment &&
        matchesState &&
        matchesCity &&
        matchesFinancial
      );
    });

    return [...filtered].sort((a, b) => {
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "az") return a.company.localeCompare(b.company, "pt-BR");
      if (sort === "za") return b.company.localeCompare(a.company, "pt-BR");
      if (sort === "project-value") {
        return (
          (financeByLead.get(b.id)?.projectValue ?? 0) -
          (financeByLead.get(a.id)?.projectValue ?? 0)
        );
      }
      if (sort === "remaining-value") {
        return (
          (financeByLead.get(b.id)?.remainingValue ?? 0) -
          (financeByLead.get(a.id)?.remainingValue ?? 0)
        );
      }
      if (sort === "payment-recent") {
        const right = financeByLead.get(b.id)?.lastPayment?.paymentDate ?? "";
        const left = financeByLead.get(a.id)?.lastPayment?.paymentDate ?? "";
        return right.localeCompare(left) || b.createdAt.localeCompare(a.createdAt);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [
    leads,
    search,
    statusFilter,
    financialFilter,
    segmentFilter,
    stateFilter,
    cityFilter,
    sort,
    financeByLead,
  ]);

  const unseenUpdatesByLead = useMemo(() => {
    const counts = new Map<string, number>();
    for (const update of leadUpdates) {
      if (update.isSeen) continue;
      counts.set(update.leadId, (counts.get(update.leadId) ?? 0) + 1);
    }
    return counts;
  }, [leadUpdates]);

  const recentLeadUpdates = useMemo(
    () => leadUpdates.slice(0, 6),
    [leadUpdates],
  );

  function recordActivity(
    leadId: string,
    input: {
      type:
        | "lead_added"
        | "whatsapp_opened"
        | "prompt_generated"
        | "status_changed"
        | "company_updated"
        | "lead_edited";
      title: string;
      description?: string | null;
      metadata?: Record<string, unknown>;
      createdAt?: string;
    },
  ) {
    void createLeadActivity({
      leadId,
      ...input,
    }).catch(() => {
      setActivityError(
        "A ação foi concluída, mas o histórico não pôde ser atualizado agora.",
      );
      window.setTimeout(() => setActivityError(""), 5000);
    });
  }

  function relevantLeadChanges(previous: Lead, next: Lead) {
    const checks: Array<[keyof Lead, string]> = [
      ["company", "Nome"],
      ["segment", "Segmento"],
      ["phone", "Telefone"],
      ["firstContact", "Primeiro contato"],
      ["notes", "Observações"],
    ];

    return checks
      .filter(([key]) => previous[key] !== next[key])
      .map(([, label]) => label);
  }

  function enrichmentChanges(previous: Lead, next: Lead) {
    const normalizedArray = (value: string[] | undefined) =>
      JSON.stringify([...(value ?? [])].sort());

    const checks: Array<{
      field: string;
      changed: boolean;
      label: string;
    }> = [
      {
        field: "company",
        changed: previous.company !== next.company,
        label: "Nome atualizado",
      },
      {
        field: "phone",
        changed: previous.phone !== next.phone,
        label: "Telefone atualizado",
      },
      {
        field: "address",
        changed: previous.address !== next.address,
        label: "Endereço atualizado",
      },
      {
        field: "neighborhood",
        changed: previous.neighborhood !== next.neighborhood,
        label: "Bairro atualizado",
      },
      {
        field: "city",
        changed: previous.city !== next.city,
        label: "Cidade atualizada",
      },
      {
        field: "state",
        changed: previous.state !== next.state,
        label: "Estado atualizado",
      },
      {
        field: "internationalPhone",
        changed: previous.internationalPhone !== next.internationalPhone,
        label: "Telefone internacional atualizado",
      },
      {
        field: "googleMapsUrl",
        changed: previous.googleMapsUrl !== next.googleMapsUrl,
        label: previous.googleMapsUrl
          ? "Google Maps atualizado"
          : "Google Maps identificado",
      },
      {
        field: "factualDescription",
        changed: previous.factualDescription !== next.factualDescription,
        label: "Descrição atualizada",
      },
      {
        field: "website",
        changed: previous.website !== next.website,
        label: previous.website ? "Site atualizado" : "Site identificado",
      },
      {
        field: "instagram",
        changed: previous.instagram !== next.instagram,
        label: previous.instagram
          ? "Instagram atualizado"
          : "Instagram identificado",
      },
      {
        field: "rating",
        changed: previous.rating !== next.rating,
        label: "Avaliação atualizada",
      },
      {
        field: "reviewCount",
        changed: previous.reviewCount !== next.reviewCount,
        label: "Quantidade de avaliações atualizada",
      },
      {
        field: "openingHours",
        changed:
          normalizedArray(previous.openingHours) !==
          normalizedArray(next.openingHours),
        label: "Horário atualizado",
      },
      {
        field: "businessStatus",
        changed: previous.businessStatus !== next.businessStatus,
        label: "Situação da empresa atualizada",
      },
      {
        field: "primaryCategory",
        changed: previous.primaryCategory !== next.primaryCategory,
        label: "Categoria principal atualizada",
      },
      {
        field: "categories",
        changed:
          normalizedArray(previous.categories) !==
          normalizedArray(next.categories),
        label: "Categorias atualizadas",
      },
    ];

    return checks.filter((item) => item.changed);
  }

  function persistLeadChange(lead: Lead) {
    if (!remoteReady) return;
    void saveRemoteLead(lead).then((ok) => {
      if (!ok) {
        setRemoteError(
          "Uma alteração ficou salva localmente, mas ainda não foi confirmada no Supabase.",
        );
      }
    });
  }

  function updateLeadLocally(
    id: string,
    updater: (lead: Lead) => Lead,
  ) {
    setLeads((current) =>
      current.map((lead) => {
        if (lead.id !== id) return lead;
        const next = updater(lead);
        persistLeadChange(next);
        return next;
      }),
    );
  }

  function addLeadLocally(lead: Lead) {
    setLeads((current) => [lead, ...current]);
    persistLeadChange(lead);
  }

  function removeLeadLocally(id: string) {
    setLeads((current) => current.filter((lead) => lead.id !== id));
    if (remoteReady) {
      void deleteRemoteLead(id).then((ok) => {
        if (!ok) {
          setRemoteError(
            "O lead foi removido localmente, mas a exclusão remota ainda não foi confirmada.",
          );
        }
      });
    }
  }

  function openLeadDetails(lead: Lead) {
    setLeadDetailsId(lead.id);

    const hasUnseen = leadUpdates.some(
      (update) => update.leadId === lead.id && !update.isSeen,
    );
    if (!hasUnseen || !remoteReady) return;

    setLeadUpdates((current) =>
      current.map((update) =>
        update.leadId === lead.id ? { ...update, isSeen: true } : update,
      ),
    );
    void markLeadUpdatesSeen(lead.id);
  }

  function openNewLead() {
    setEditingLead(null);
    setForm({ ...EMPTY_FORM, firstContact: new Date().toISOString().slice(0, 10) });
    setLeadModal(true);
  }

  function openEditLead(lead: Lead) {
    setEditingLead(lead);
    setForm({
      company: lead.company,
      segment: lead.segment,
      phone: lead.phone,
      status: lead.status,
      firstContact: lead.firstContact,
      notes: lead.notes,
    });
    setLeadModal(true);
  }

  function saveLead(event: FormEvent) {
    event.preventDefault();
    if (!form.company.trim() || !form.segment.trim()) return;

    if (editingLead) {
      const nextLead: Lead = {
        ...editingLead,
        ...form,
        company: form.company.trim(),
        segment: form.segment.trim(),
      };
      const changedFields = relevantLeadChanges(editingLead, nextLead);
      const statusChanged = editingLead.status !== nextLead.status;
      const instagramIdentityChanged =
        editingLead.company !== nextLead.company ||
        editingLead.phone !== nextLead.phone;

      if (
        instagramIdentityChanged &&
        editingLead.instagramCheckedAt &&
        editingLead.instagramSource !== "manual_confirmation"
      ) {
        nextLead.instagramNeedsReview = true;
      }

      updateLeadLocally(editingLead.id, () => nextLead);

      if (statusChanged) {
        const previousStatus = STATUS_LABEL[editingLead.status];
        const newStatus = STATUS_LABEL[nextLead.status];
        const editedSuffix =
          changedFields.length > 0
            ? ` · Também editado: ${changedFields.join(" · ")}`
            : "";

        recordActivity(editingLead.id, {
          type: "status_changed",
          title: "Status alterado",
          description: `${previousStatus} → ${newStatus}${editedSuffix}`,
          metadata: {
            previousStatus,
            newStatus,
            ...(changedFields.length > 0 ? { changedFields } : {}),
          },
        });
      } else if (changedFields.length > 0) {
        recordActivity(editingLead.id, {
          type: "lead_edited",
          title: "Empresa editada",
          description: changedFields.join(" · "),
          metadata: { changedFields },
        });
      }
    } else {
      const newLead: Lead = {
        ...form,
        company: form.company.trim(),
        segment: form.segment.trim(),
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        source: "manual",
      };
      addLeadLocally(newLead);
    }

    setLeadModal(false);
    setEditingLead(null);
  }

  function changeStatus(id: string, status: Status) {
    const lead = leads.find((item) => item.id === id);
    if (!lead || lead.status === status) return;

    const previousStatus = STATUS_LABEL[lead.status];
    const newStatus = STATUS_LABEL[status];

    updateLeadLocally(id, (item) => ({ ...item, status }));
    recordActivity(id, {
      type: "status_changed",
      title: "Status alterado",
      description: `${previousStatus} → ${newStatus}`,
      metadata: {
        previousStatus,
        newStatus,
      },
    });
  }

  function confirmDelete() {
    if (!deleteLead) return;
    removeLeadLocally(deleteLead.id);
    setLeadUpdates((current) =>
      current.filter((update) => update.leadId !== deleteLead.id),
    );
    setDeleteLead(null);
  }

  async function openWhatsApp() {
    if (!messageLead || messageActionPending) return;

    const phone = normalizeBrazilianPhone(messageLead.phone);
    if (phone.length !== 12 && phone.length !== 13) {
      setMessageActionError(
        "Este lead não possui um telefone válido para abrir o WhatsApp.",
      );
      return;
    }

    const personalized = (messages[selectedMessage] ?? "").replaceAll(
      "{empresa}",
      messageLead.company,
    );

    setMessageActionPending(true);
    setMessageActionError("");

    // Keep the external-app navigation synchronous with the user's click.
    // Persistence happens only after the WhatsApp handoff has been triggered.
    const whatsappOpened = openWhatsAppLink({
      phone,
      message: personalized,
    });
    if (!whatsappOpened) {
      setMessageActionPending(false);
      setMessageActionError(
        "O navegador bloqueou a abertura do WhatsApp. O status não foi alterado.",
      );
      return;
    }

    if (!messageLead.id) {
      setMessageActionPending(false);
      setMessageLead(null);
      return;
    }

    const currentLead = leads.find((lead) => lead.id === messageLead.id);
    if (!currentLead) {
      setMessageActionPending(false);
      setMessageActionError(
        "O WhatsApp foi aberto, mas este lead não foi encontrado para atualizar o histórico.",
      );
      return;
    }

    const shouldAdvanceToWaiting = currentLead.status === "send_message";
    const nextLead: Lead = {
      ...currentLead,
      lastContact: new Date().toISOString().slice(0, 10),
      ...(shouldAdvanceToWaiting ? { status: "waiting" as Status } : {}),
    };

    if (!remoteReady) {
      setMessageActionPending(false);
      setMessageActionError(
        shouldAdvanceToWaiting
          ? "O WhatsApp foi aberto, mas não foi possível atualizar o status."
          : "O WhatsApp foi aberto, mas não foi possível registrar o contato agora.",
      );
      return;
    }

    let persisted = false;
    try {
      persisted = await saveRemoteLead(nextLead);
    } catch {
      persisted = false;
    }

    if (!persisted) {
      setMessageActionPending(false);
      setMessageActionError(
        shouldAdvanceToWaiting
          ? "O WhatsApp foi aberto, mas não foi possível atualizar o status."
          : "O WhatsApp foi aberto, mas não foi possível registrar o contato agora.",
      );
      return;
    }

    setLeads((current) =>
      current.map((lead) => (lead.id === nextLead.id ? nextLead : lead)),
    );
    setRemoteError("");

    recordActivity(nextLead.id, {
      type: "whatsapp_opened",
      title: "WhatsApp aberto",
      metadata: {
        messageTemplate: `Mensagem ${selectedMessage + 1}`,
      },
    });

    if (shouldAdvanceToWaiting) {
      recordActivity(nextLead.id, {
        type: "status_changed",
        title: "Status alterado",
        description: "Enviar mensagem → Aguardando",
        metadata: {
          previousStatus: "Enviar mensagem",
          newStatus: "Aguardando",
          reason: "whatsapp_opened",
        },
      });
    }

    setMessageActionPending(false);
    setMessageActionError("");
    setMessageLead(null);
  }

  function saveMessages() {
    localStorage.setItem(STORAGE.messages, JSON.stringify(messages));
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 1800);
  }

  function openPromptForBusiness(
    business: BusinessSearchResult,
    selectedSegment: string,
  ) {
    const existingLead = findBusinessDuplicate(business, leads);
    setPromptActivityLeadId(existingLead?.id ?? null);
    setPromptBusiness({
      key: makePromptBusinessKey({
        placeId: business.placeId,
        company: business.name,
        phone: business.phone,
        address: business.address,
      }),
      company: business.name,
      segment: selectedSegment || business.primaryCategory || "Empresa local",
      primaryCategory: business.primaryCategory,
      categories: business.categories,
      description:
        business.factualDescription ??
        buildFactualBusinessDescription(business),
      address: business.address,
      neighborhood: business.neighborhood,
      city: business.city,
      state: business.state,
      phone: business.phone,
      internationalPhone: business.internationalPhone,
      rating: business.rating,
      reviewCount: business.reviewCount,
      openingHours: business.openingHours,
      businessStatus: business.businessStatus,
      website: business.website,
      instagram: confirmedInstagram(
        business.instagram,
        business.instagramConfidence,
      ),
      googleMapsUrl: business.googleMapsUrl,
      latitude: business.latitude,
      longitude: business.longitude,
      verifiedImages: business.verifiedImages ?? [],
      confirmedChannels: business.confirmedChannels ?? {},
      verifiedContent: business.verifiedContent ?? {},
    });
  }

  function openPromptForLead(lead: Lead) {
    setPromptActivityLeadId(lead.id);
    setPromptBusiness({
      key: makePromptBusinessKey({
        placeId: lead.placeId,
        company: lead.company,
        phone: lead.phone,
        address: lead.address,
      }),
      company: lead.company,
      segment: lead.segment,
      primaryCategory: lead.primaryCategory ?? null,
      categories: lead.categories ?? [],
      description: lead.factualDescription ?? lead.description ?? null,
      address: lead.address ?? null,
      neighborhood: lead.neighborhood ?? null,
      city: lead.city ?? null,
      state: lead.state ?? null,
      phone: lead.phone || null,
      internationalPhone: lead.internationalPhone ?? null,
      rating: lead.rating ?? null,
      reviewCount: lead.reviewCount ?? null,
      openingHours: lead.openingHours ?? [],
      businessStatus: lead.businessStatus ?? null,
      website: lead.website ?? null,
      instagram: confirmedInstagram(
        lead.instagram,
        lead.instagramConfidence,
      ),
      googleMapsUrl: lead.googleMapsUrl ?? null,
      latitude: lead.latitude ?? null,
      longitude: lead.longitude ?? null,
      notes: lead.notes || null,
      verifiedImages: lead.verifiedImages ?? [],
      confirmedChannels: lead.confirmedChannels ?? {},
      verifiedContent: lead.verifiedContent ?? {},
    });
  }

  function applyDeepEnrichmentToLead(
    leadId: string,
    value: DeepEnrichmentApplied,
  ) {
    const previous = leads.find((lead) => lead.id === leadId);
    if (!previous) return;

    updateLeadLocally(leadId, (lead) => ({
      ...lead,
      verifiedContent: value.verifiedContent,
      verifiedImages: value.verifiedImages,
      confirmedChannels: value.confirmedChannels,
      deepEnrichmentStatus: value.status,
      deepEnrichmentQuality: value.quality ?? undefined,
      deepEnrichmentCheckedAt: value.checkedAt ?? undefined,
      ...(value.identityUpdates.website
        ? { website: value.identityUpdates.website }
        : {}),
      ...(value.identityUpdates.instagram
        ? {
            instagram: value.identityUpdates.instagram,
            instagramConfidence: "high" as const,
            instagramSource: "official_website" as const,
            instagramCheckedAt:
              value.checkedAt ?? new Date().toISOString(),
            instagramNeedsReview: false,
          }
        : {}),
    }));
  }

  function applyPresenceToLead(
    leadId: string,
    presence: BusinessPresence,
    baselineLead?: Lead,
  ) {
    const previous =
      baselineLead ?? leads.find((lead) => lead.id === leadId);
    if (!previous) return;

    const keepConfirmedInstagram =
      !presence.instagramUrl &&
      previous.instagram &&
      previous.instagramConfidence === "high";

    const nextLead: Lead = {
      ...previous,
      instagramCheckedAt: presence.instagramCheckedAt,
      instagramUsername:
        presence.instagramUsername ??
        (keepConfirmedInstagram ? previous.instagramUsername : undefined),
      instagramCandidates: presence.instagramCandidates,
      instagramRejectedUrls: presence.instagramRejectedUrls,
      instagramSearchSignature:
        presence.instagramSearchSignature ?? previous.instagramSearchSignature,
      instagramNeedsReview: presence.instagramNeedsReview,
      ...(presence.instagramUrl
        ? {
            instagram: presence.instagramUrl,
            instagramConfidence: presence.instagramConfidence ?? "high",
            instagramSource:
              presence.instagramSource ?? "official_website",
          }
        : keepConfirmedInstagram
          ? {}
          : {
              instagram: undefined,
              instagramConfidence: undefined,
              instagramSource: undefined,
              instagramUsername: undefined,
            }),
    };

    updateLeadLocally(leadId, () => nextLead);

    const becameConfirmed =
      Boolean(presence.instagramUrl) &&
      presence.instagramConfidence === "high" &&
      (
        previous.instagram !== presence.instagramUrl ||
        previous.instagramConfidence !== "high" ||
        previous.instagramSource !== presence.instagramSource
      );

    if (becameConfirmed && presence.instagramUrl) {
      const manual = presence.instagramSource === "manual_confirmation";
      recordActivity(leadId, {
        type: "company_updated",
        title: manual ? "Instagram confirmado" : "Instagram identificado",
        description: [
          presence.instagramUsername
            ? `@${presence.instagramUsername}`
            : presence.instagramUrl,
          presence.instagramSource
            ? `Fonte: ${INSTAGRAM_SOURCE_LABEL[presence.instagramSource]}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
        metadata: {
          instagramUrl: presence.instagramUrl,
          instagramUsername: presence.instagramUsername,
          confidence: "high",
          source: presence.instagramSource,
        },
      });
    }
  }

  function openBusinessWhatsApp(
    business: BusinessSearchResult,
    activityLeadId?: string,
  ) {
    const value = business.phone ?? business.internationalPhone;
    if (!value) return;
    const phone = normalizeBrazilianPhone(value);
    if (!phone) return;

    if (!openWhatsAppLink({ phone })) return;

    if (activityLeadId) {
      recordActivity(activityLeadId, {
        type: "whatsapp_opened",
        title: "WhatsApp aberto",
      });
    }
  }

  async function refreshLeadPresence(
    leadId: string,
    business: BusinessSearchResult,
    force = false,
    allowWebSearch = false,
    baselineLead?: Lead,
  ) {
    try {
      const presence = await discoverBusinessPresence(business, {
        force,
        allowWebSearch,
      });
      if (!presence) return;
      applyPresenceToLead(leadId, presence, baselineLead);
    } catch {
      setActivityError("Não foi possível buscar Instagram agora.");
      window.setTimeout(() => setActivityError(""), 5000);
    }
  }

  function applyEnrichment(leadId: string, business: BusinessSearchResult) {
    const previous = leads.find((lead) => lead.id === leadId);
    if (!previous) return;

    const discoveredPresence = presenceFromBusiness(business);
    const factualDescription = buildFactualBusinessDescription(business);
    const officialPhone =
      business.phone ?? business.internationalPhone ?? previous.phone;

    const nextLead: Lead = {
        ...previous,
      company: business.name || previous.company,
      phone: officialPhone,
      placeId: business.placeId,
      enrichedAt: new Date().toISOString(),
      source: previous.source ?? "manual",
      factualDescription,
      ...(discoveredPresence
        ? {
            instagramCheckedAt: discoveredPresence.instagramCheckedAt,
            instagramUsername:
              discoveredPresence.instagramUsername ?? undefined,
            instagramCandidates: discoveredPresence.instagramCandidates,
            instagramRejectedUrls:
              discoveredPresence.instagramRejectedUrls,
            instagramSearchSignature:
              discoveredPresence.instagramSearchSignature ?? undefined,
            instagramNeedsReview:
              discoveredPresence.instagramNeedsReview,
            ...(discoveredPresence.instagramUrl
              ? {
                  instagram: discoveredPresence.instagramUrl,
                  instagramConfidence:
                    discoveredPresence.instagramConfidence ?? "high",
                  instagramSource:
                    discoveredPresence.instagramSource ?? "existing_data",
                }
              : {}),
          }
        : {}),
      ...(business.address ? { address: business.address } : {}),
      ...(business.website ? { website: business.website } : {}),
      ...(business.googleMapsUrl ? { googleMapsUrl: business.googleMapsUrl } : {}),
        ...(business.instagram && !discoveredPresence?.instagramUrl
          ? { instagram: business.instagram }
          : {}),
      ...(business.primaryCategory
        ? { primaryCategory: business.primaryCategory }
        : {}),
      ...(business.categories.length > 0
        ? { categories: business.categories }
        : {}),
      ...(business.description ? { description: business.description } : {}),
      ...(business.neighborhood ? { neighborhood: business.neighborhood } : {}),
      ...(business.city ? { city: business.city } : {}),
      ...(business.state ? { state: business.state } : {}),
      ...(business.internationalPhone
        ? { internationalPhone: business.internationalPhone }
        : {}),
      ...(business.rating !== null ? { rating: business.rating } : {}),
      ...(business.reviewCount !== null
        ? { reviewCount: business.reviewCount }
        : {}),
      ...(business.isOpenNow !== null
        ? { isOpenNow: business.isOpenNow }
        : {}),
      ...(business.openingHours.length > 0
        ? { openingHours: business.openingHours }
        : {}),
      ...(business.businessStatus
        ? { businessStatus: business.businessStatus }
        : {}),
      ...(business.latitude !== null ? { latitude: business.latitude } : {}),
      ...(business.longitude !== null
        ? { longitude: business.longitude }
        : {}),
      ...(business.verifiedContent
        ? { verifiedContent: business.verifiedContent }
        : {}),
      ...(business.verifiedImages
        ? { verifiedImages: business.verifiedImages }
        : {}),
      ...(business.confirmedChannels
        ? { confirmedChannels: business.confirmedChannels }
        : {}),
      ...(business.deepEnrichmentStatus
        ? { deepEnrichmentStatus: business.deepEnrichmentStatus }
        : {}),
      ...(business.deepEnrichmentQuality
        ? { deepEnrichmentQuality: business.deepEnrichmentQuality }
        : {}),
      ...(business.deepEnrichmentCheckedAt
        ? { deepEnrichmentCheckedAt: business.deepEnrichmentCheckedAt }
        : {}),
    };

    const presenceIdentityChanged =
      previous.company !== nextLead.company ||
      previous.phone !== nextLead.phone ||
      previous.address !== nextLead.address ||
      previous.website !== nextLead.website;

    if (presenceIdentityChanged && previous.instagramCheckedAt) {
      nextLead.instagramNeedsReview = true;
    }

    const changed = enrichmentChanges(previous, nextLead);
    updateLeadLocally(leadId, () => nextLead);

    if (changed.length > 0) {
      const labels = changed.map((item) => item.label);
      const shown = labels.slice(0, 3);
      const remaining = Math.max(0, labels.length - shown.length);

      recordActivity(leadId, {
        type: "company_updated",
        title: "Informações da empresa atualizadas",
        description:
          shown.join(" · ") +
          (remaining > 0 ? ` · +${remaining} alterações` : ""),
        metadata: {
          changedFields: changed.map((item) => item.field),
        },
      });
    }

    setEnrichmentLead(null);

    // Keep the existing first-enrichment behavior, now with the deeper
    // discovery layer. Updates only mark old Instagram data for review.
    if (!previous.placeId) {
      void refreshLeadPresence(
        leadId,
        leadToBusinessSearchResult(nextLead),
        false,
        true,
        nextLead,
      );
    }
  }

  function buildFoundLead(
    business: BusinessSearchResult,
    selectedSegment: string,
  ): Lead {
    const foundPhone = business.phone ?? business.internationalPhone ?? "";
      const details = [
        business.city
          ? `Lead encontrado através do buscador de empresas em ${business.city}${business.state ? ` - ${business.state}` : ""}.`
          : "Lead encontrado através do buscador de empresas.",
        business.address ? `Endereço: ${business.address}` : "",
        business.website ? `Site: ${business.website}` : "",
        business.instagram ? `Instagram: ${business.instagram}` : "",
        business.googleMapsUrl ? `Google Maps: ${business.googleMapsUrl}` : "",
      ].filter(Boolean);
  
      const discoveredPresence = presenceFromBusiness(business);
      const factualDescription = buildFactualBusinessDescription(business);
  
      const newLead: Lead = {
        id: crypto.randomUUID(),
        company: business.name,
        segment: selectedSegment,
        phone: foundPhone,
        status: "send_message",
        firstContact: new Date().toISOString().slice(0, 10),
        notes: details.join("\n"),
        createdAt: new Date().toISOString(),
        placeId: business.placeId,
        source: "places-search",
        factualDescription,
        ...(discoveredPresence
          ? {
              instagramCheckedAt: discoveredPresence.instagramCheckedAt,
              instagramUsername:
                discoveredPresence.instagramUsername ?? undefined,
              instagramCandidates: discoveredPresence.instagramCandidates,
              instagramRejectedUrls:
                discoveredPresence.instagramRejectedUrls,
              instagramSearchSignature:
                discoveredPresence.instagramSearchSignature ?? undefined,
              instagramNeedsReview:
                discoveredPresence.instagramNeedsReview,
              ...(discoveredPresence.instagramUrl
                ? {
                    instagram: discoveredPresence.instagramUrl,
                    instagramConfidence:
                      discoveredPresence.instagramConfidence ?? "high",
                    instagramSource:
                      discoveredPresence.instagramSource ?? "existing_data",
                  }
                : {}),
            }
          : {}),
        ...(business.address ? { address: business.address } : {}),
        ...(business.website ? { website: business.website } : {}),
        ...(business.googleMapsUrl ? { googleMapsUrl: business.googleMapsUrl } : {}),
        ...(business.instagram && !discoveredPresence?.instagramUrl
          ? { instagram: business.instagram }
          : {}),
        ...(business.primaryCategory ? { primaryCategory: business.primaryCategory } : {}),
        ...(business.categories.length ? { categories: business.categories } : {}),
        ...(business.description ? { description: business.description } : {}),
        ...(business.neighborhood ? { neighborhood: business.neighborhood } : {}),
        ...(business.city ? { city: business.city } : {}),
        ...(business.state
          ? {
              state:
                normalizeBrazilianStateCode(business.state) || business.state,
            }
          : {}),
        ...(business.internationalPhone ? { internationalPhone: business.internationalPhone } : {}),
        ...(business.rating !== null ? { rating: business.rating } : {}),
        ...(business.reviewCount !== null ? { reviewCount: business.reviewCount } : {}),
        ...(business.isOpenNow !== null ? { isOpenNow: business.isOpenNow } : {}),
        ...(business.openingHours.length ? { openingHours: business.openingHours } : {}),
        ...(business.businessStatus ? { businessStatus: business.businessStatus } : {}),
        ...(business.latitude !== null ? { latitude: business.latitude } : {}),
        ...(business.longitude !== null ? { longitude: business.longitude } : {}),
        ...(business.verifiedContent
          ? { verifiedContent: business.verifiedContent }
          : {}),
        ...(business.verifiedImages
          ? { verifiedImages: business.verifiedImages }
          : {}),
        ...(business.confirmedChannels
          ? { confirmedChannels: business.confirmedChannels }
          : {}),
        ...(business.deepEnrichmentStatus
          ? { deepEnrichmentStatus: business.deepEnrichmentStatus }
          : {}),
        ...(business.deepEnrichmentQuality
          ? { deepEnrichmentQuality: business.deepEnrichmentQuality }
          : {}),
        ...(business.deepEnrichmentCheckedAt
          ? { deepEnrichmentCheckedAt: business.deepEnrichmentCheckedAt }
          : {}),
      };
    return newLead;
  }

  function addFoundLead(
    business: BusinessSearchResult,
    selectedSegment: string,
  ) {
    const duplicate = findBusinessDuplicate(business, leads);
    if (duplicate) return;

    addLeadLocally(buildFoundLead(business, selectedSegment));
  }

  async function addFoundLeadConfirmed(
    business: BusinessSearchResult,
    selectedSegment: string,
  ): Promise<BusinessAddResult> {
    const duplicate = findBusinessDuplicate(business, leads);
    if (duplicate?.id) {
      return { ok: true, leadId: duplicate.id };
    }

    if (!remoteReady) {
      return {
        ok: false,
        message:
          "A sincronização com o Supabase está indisponível agora. O lead não foi adicionado.",
      };
    }

    const newLead = buildFoundLead(business, selectedSegment);
    let persisted = false;
    try {
      persisted = await saveRemoteLead(newLead);
    } catch {
      persisted = false;
    }

    if (!persisted) {
      setRemoteError(
        "Não foi possível confirmar a criação deste lead no Supabase.",
      );
      return {
        ok: false,
        message:
          "Não foi possível adicionar este lead agora. Tente novamente.",
      };
    }

    setLeads((current) => [newLead, ...current]);
    setRemoteError("");

    recordActivity(newLead.id, {
      type: "lead_added",
      title: "Lead adicionado",
      description: "Empresa adicionada a Meus Leads pelo buscador.",
      metadata: {
        source: "places-search",
        placeId: newLead.placeId ?? null,
      },
    });

    return { ok: true, leadId: newLead.id };
  }

  return (
    <AppShell
      activeView={view}
      theme={theme}
      onNavigate={setView}
      onToggleTheme={() =>
        setTheme((current) => (current === "light" ? "dark" : "light"))
      }
      onLogout={async () => {
        await signOut();
        await navigate({ to: "/login", replace: true });
      }}
    >
      {view === "dashboard" ? (
        <DashboardView
          counts={counts}
          financialOverview={financialOverview}
          financeLoaded={financeLoaded}
          financeError={financeError}
          leadUpdates={leadUpdates}
          leads={leads}
          remoteReady={remoteReady}
          remoteError={remoteError}
          opportunities={dashboardOpportunities}
          opportunitiesLoading={dashboardOpportunitiesLoading}
          opportunitiesError={dashboardOpportunitiesError}
          onOpenLead={openLeadDetails}
          onNavigate={setView}
        />
      ) : view === "leads" ? (
        <section className="page-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">CARTEIRA COMERCIAL</p>
              <h1>Meus Leads</h1>
              <p className="subtitle">Organize empresas, status, contatos e andamento financeiro em um único fluxo.</p>
            </div>
            <button className="primary-button" onClick={openNewLead} type="button">
              <Plus size={17} />
              Novo lead
            </button>
          </div>

          {activityError && (
            <p className="activity-inline-error" role="status">
              {activityError}
            </p>
          )}

          <div className="stats-strip">
            <Stat label="Total de leads" value={counts.all} tone="neutral" />
            <Stat label="Enviar mensagem" value={counts.send_message} tone="send_message" />
            <Stat label="Aguardando" value={counts.waiting} tone="waiting" />
            <Stat label="Aceitos" value={counts.accepted} tone="accepted" />
            <Stat label="Recusados" value={counts.rejected} tone="rejected" />
          </div>

          {financeLoaded && (
            <section className="finance-summary-strip" aria-label="Resumo financeiro">
              <FinanceStat
                label="Recebido no mês"
                value={formatCurrency(financialOverview.receivedThisMonth)}
              />
              <FinanceStat
                label="A receber"
                value={formatCurrency(financialOverview.receivable)}
              />
              <FinanceStat
                label="Projetos pagos"
                value={String(financialOverview.paidProjects)}
                tone="paid"
              />
              <FinanceStat
                label="Pagamento parcial"
                value={String(financialOverview.partialProjects)}
                tone="partial"
              />
            </section>
          )}

          {financeError && (
            <p className="activity-inline-error finance-load-error" role="status">
              {financeError}
            </p>
          )}

          <section className="recent-updates-panel" aria-label="Atualizações recentes">
            <div className="recent-updates-heading">
              <div>
                <span>ATUALIZAÇÕES RECENTES</span>
                <strong>Sincronização automática</strong>
              </div>
              <div className="auto-sync-status">
                <span className={remoteReady ? "sync-dot active" : "sync-dot"} />
                <span>{remoteReady ? "Ativada" : "Conectando"}</span>
                <small>A cada 8 horas</small>
              </div>
            </div>

            {remoteError ? (
              <p className="sync-inline-error">{remoteError}</p>
            ) : recentLeadUpdates.length > 0 ? (
              <div className="recent-updates-list">
                {recentLeadUpdates.map((update) => {
                  const lead = leads.find((item) => item.id === update.leadId);
                  return (
                    <button
                      key={update.id}
                      type="button"
                      className={
                        update.importance === "high"
                          ? "recent-update-item important"
                          : "recent-update-item"
                      }
                      onClick={() => {
                        if (lead) openLeadDetails(lead);
                      }}
                    >
                      <span>
                        <strong>{update.message}</strong>
                        <small>{lead?.company ?? "Lead"} · {formatDateTime(update.createdAt)}</small>
                      </span>
                      {!update.isSeen && <b>Novo</b>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="recent-updates-empty">
                Nenhuma mudança automática detectada ainda.
              </p>
            )}
          </section>

          <div className="lead-panel">
            <div className="panel-toolbar">
              <div className="search-box">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar empresa..."
                  aria-label="Buscar empresa"
                />
              </div>

              <div className="toolbar-selects">
                <Select
                  value={stateFilter}
                  onChange={(value) => {
                    setStateFilter(value);
                    setCityFilter("all");
                  }}
                  ariaLabel="Filtrar por estado"
                  options={[
                    ["all", "Todos os estados"],
                    ...availableStates.map(
                      (state) =>
                        [state.code, `${state.name} (${state.code})`] as [string, string],
                    ),
                  ]}
                />
                <Select
                  value={cityFilter}
                  onChange={setCityFilter}
                  ariaLabel="Filtrar por cidade"
                  options={[
                    ["all", stateFilter === "all" ? "Selecione um estado" : "Todas as cidades"],
                    ...availableCities.map(
                      (city) => [city, city] as [string, string],
                    ),
                  ]}
                />
                <Select
                  value={segmentFilter}
                  onChange={setSegmentFilter}
                  ariaLabel="Filtrar por segmento"
                  options={[
                    ["all", "Todos os segmentos"],
                    ...availableSegments.map((segment) => [segment, segment] as [string, string]),
                  ]}
                />
                <Select
                  value={sort}
                  onChange={setSort}
                  ariaLabel="Ordenar leads"
                  options={[
                    ["recent", "Mais recentes"],
                    ["oldest", "Mais antigos"],
                    ["az", "Nome A-Z"],
                    ["za", "Nome Z-A"],
                    ["project-value", "Maior valor do projeto"],
                    ["remaining-value", "Maior valor a receber"],
                    ["payment-recent", "Recebidos recentemente"],
                  ]}
                />
              </div>
            </div>

            <div className="filter-row">
              {([
                ["all", "Todos", counts.all],
                ["send_message", "Enviar mensagem", counts.send_message],
                ["waiting", "Aguardando", counts.waiting],
                ["accepted", "Aceitos", counts.accepted],
                ["rejected", "Recusados", counts.rejected],
              ] as const).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  className={statusFilter === value ? "filter-chip active" : "filter-chip"}
                  onClick={() => setStatusFilter(value)}
                >
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>

            <div className="filter-row financial-filter-row">
              <span className="filter-row-label">Financeiro</span>
              {([
                ["all", "Todos", leads.length],
                ["pending", "Pendente", financialOverview.pendingProjects],
                ["partial", "Parcial", financialOverview.partialProjects],
                ["paid", "Pago", financialOverview.paidProjects],
              ] as const).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  className={
                    financialFilter === value
                      ? "filter-chip active"
                      : "filter-chip"
                  }
                  onClick={() => setFinancialFilter(value)}
                >
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>

            <div className="desktop-table">
              <div className="table-head">
                <span>Empresa</span>
                <span>WhatsApp</span>
                <span>Status</span>
                <span>Contato</span>
                <span>Ações</span>
              </div>
              {visibleLeads.length ? (
                visibleLeads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    finance={financeByLead.get(lead.id) ?? null}
                    onStatus={changeStatus}
                    onMessage={(item) => {
                      setSelectedMessage(0);
                      setMessageLead(item);
                    }}
                    onGeneratePrompt={openPromptForLead}
                    onDetails={openLeadDetails}
                    updateCount={unseenUpdatesByLead.get(lead.id) ?? 0}
                    onEnrich={setEnrichmentLead}
                    onEdit={openEditLead}
                    onDelete={setDeleteLead}
                  />
                ))
              ) : (
                <EmptyState onNew={openNewLead} hasLeads={leads.length > 0} />
              )}
            </div>

            <div className="mobile-list">
              {visibleLeads.length ? (
                visibleLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    finance={financeByLead.get(lead.id) ?? null}
                    onStatus={changeStatus}
                    onMessage={(item) => {
                      setSelectedMessage(0);
                      setMessageLead(item);
                    }}
                    onGeneratePrompt={openPromptForLead}
                    onDetails={openLeadDetails}
                    updateCount={unseenUpdatesByLead.get(lead.id) ?? 0}
                    onEnrich={setEnrichmentLead}
                    onEdit={openEditLead}
                    onDelete={setDeleteLead}
                  />
                ))
              ) : (
                <EmptyState onNew={openNewLead} hasLeads={leads.length > 0} />
              )}
            </div>
          </div>
        </section>
      ) : view === "search" ? (
        <SearchLeadsView
          existingLeads={leads}
          onAddLead={addFoundLeadConfirmed}
          onDeepEnrichmentApplied={applyDeepEnrichmentToLead}
          onMessage={(target) => {
            setSelectedMessage(0);
            setMessageLead(target);
          }}
          onGeneratePrompt={openPromptForBusiness}
        />
      ) : view === "open-now" ? (
        <OpenNowNichesView
          existingLeads={leads}
          onAddLead={addFoundLead}
          onDeepEnrichmentApplied={applyDeepEnrichmentToLead}
          onMessage={(target) => {
            setSelectedMessage(0);
            setMessageLead(target);
          }}
          onGeneratePrompt={openPromptForBusiness}
        />
      ) : view === "opportunities" ? (
        <OpportunityView
          existingLeads={leads}
          onAddLead={addFoundLeadConfirmed}
          onDeepEnrichmentApplied={applyDeepEnrichmentToLead}
          onMessage={(target) => {
            setSelectedMessage(0);
            setMessageLead(target);
          }}
          onGeneratePrompt={openPromptForBusiness}
          onGoSearch={() => setView("search")}
        />
      ) : view === "finance" ? (
        <FinanceView
          leads={leads}
          financeByLead={financeByLead}
          overview={financialOverview}
          loaded={financeLoaded}
          error={financeError}
          onOpenLead={openLeadDetails}
        />
      ) : (
        <MessagesView
          messages={messages}
          setMessages={setMessages}
          onSave={saveMessages}
          savedNotice={savedNotice}
        />
      )}

      {leadModal && (
        <Modal onClose={() => setLeadModal(false)} title={editingLead ? "Editar lead" : "Novo lead"}>
          <form className="lead-form" onSubmit={saveLead}>
            <label>
              <span>Nome da empresa</span>
              <input
                required
                value={form.company}
                onChange={(event) => setForm({ ...form, company: event.target.value })}
                placeholder="Ex.: Texas Burguer"
              />
            </label>

            <label>
              <span>Tipo de negócio</span>
              <input
                required
                list="segments"
                value={form.segment}
                onChange={(event) => setForm({ ...form, segment: event.target.value })}
                placeholder="Selecione ou digite"
              />
              <datalist id="segments">
                {SEGMENTS.map((segment) => (
                  <option key={segment} value={segment} />
                ))}
              </datalist>
            </label>

            <label>
              <span>Telefone / WhatsApp</span>
              <input
                inputMode="tel"
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="(35) 99999-9999"
              />
            </label>

            <label>
              <span>Data do primeiro contato</span>
              <input
                type="date"
                required
                value={form.firstContact}
                onChange={(event) => setForm({ ...form, firstContact: event.target.value })}
              />
            </label>

            <fieldset className="status-field">
              <legend>Status</legend>
              <div className="status-options">
                {(["send_message", "waiting", "accepted", "rejected"] as Status[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`status-option ${status} ${form.status === status ? "selected" : ""}`}
                    onClick={() => setForm({ ...form, status })}
                  >
                    <span className="check-box">{form.status === status && <Check size={13} />}</span>
                    {STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="full-field">
              <span>Observações</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Ex.: Visualizou e não respondeu. Mandar portfólio."
              />
            </label>

            <div className="modal-actions full-field">
              <button type="button" className="secondary-button" onClick={() => setLeadModal(false)}>
                Cancelar
              </button>
              <button type="submit" className="primary-button">
                {editingLead ? "Salvar alterações" : "Salvar lead"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {messageLead && (
        <Modal
          onClose={() => {
            if (messageActionPending) return;
            setMessageLead(null);
          }}
          title="Mandar mensagem"
        >
          <div className="message-picker">
            <p className="modal-copy">
              Escolha uma mensagem para <strong>{messageLead.company}</strong>. A conversa será aberta
              com o texto preenchido, mas nada será enviado automaticamente.
            </p>
            <div className="message-options">
              {messages.map((message, index) => (
                <button
                  key={index}
                  type="button"
                  className={selectedMessage === index ? "message-option selected" : "message-option"}
                  onClick={() => setSelectedMessage(index)}
                  disabled={messageActionPending}
                >
                  <span>Mensagem {index + 1}</span>
                  <p>{message.replaceAll("{empresa}", messageLead.company)}</p>
                </button>
              ))}
            </div>
            {messageActionError && (
              <p className="message-action-error" role="status">
                {messageActionError}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setMessageLead(null)}
                disabled={messageActionPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="whatsapp-button"
                onClick={() => void openWhatsApp()}
                disabled={messageActionPending}
              >
                <MessageCircle size={17} />
                {messageActionPending ? "Atualizando..." : "Abrir no WhatsApp"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {leadDetailsId && (() => {
        const lead = leads.find((item) => item.id === leadDetailsId);
        if (!lead) return null;

        const business = leadToBusinessSearchResult(lead);
        const chance = hasEnoughDataForLeadChance(lead)
          ? calculateLeadChance(lead, lead.segment)
          : null;

        return (
          <BusinessDetailsModal
            business={business}
            chance={chance}
            segmentLabel={lead.segment}
            lastSyncedAt={lead.lastSyncedAt ?? null}
            updates={leadUpdates.filter((update) => update.leadId === lead.id)}
            activityLeadId={lead.id}
            onClose={() => setLeadDetailsId(null)}
            onWhatsApp={(business) => openBusinessWhatsApp(business, lead.id)}
            onMessage={() => {
              setSelectedMessage(0);
              setMessageLead(lead);
            }}
            onGeneratePrompt={() => {
              setLeadDetailsId(null);
              openPromptForLead(lead);
            }}
            onPresenceUpdate={(presence) =>
              applyPresenceToLead(lead.id, presence)
            }
            onDeepEnrichmentUpdate={(value) =>
              applyDeepEnrichmentToLead(lead.id, value)
            }
            financeLead={financeLoaded ? lead : null}
            financePayments={paymentsByLead.get(lead.id) ?? []}
            onFinanceUpdate={(leadId, patch) =>
              updateLeadLocally(leadId, (current) => ({
                ...current,
                ...patch,
              }))
            }
            onPaymentSaved={(payment) =>
              setLeadPayments((current) => [payment, ...current])
            }
          />
        );
      })()}

      {enrichmentLead && (
        <LeadEnrichmentModal
          lead={enrichmentLead}
          existingLeads={leads}
          onConfirm={(business) => applyEnrichment(enrichmentLead.id, business)}
          onClose={() => setEnrichmentLead(null)}
        />
      )}

      {promptBusiness && (
        <PromptGenerator
          business={promptBusiness}
          onClose={() => {
            setPromptBusiness(null);
            setPromptActivityLeadId(null);
          }}
          onGenerated={(generation) => {
            if (!promptActivityLeadId) return;

            recordActivity(promptActivityLeadId, {
              type: "prompt_generated",
              title: generation.regenerated
                ? "Prompt de landing page gerado novamente"
                : "Prompt de landing page gerado",
              metadata: {
                promptVersion: generation.generatedAt,
                projectType: generation.projectType,
                objective: generation.objective,
              },
            });
          }}
        />
      )}

      {deleteLead && (
        <Modal onClose={() => setDeleteLead(null)} title="Excluir lead" compact>
          <p className="modal-copy">
            Tem certeza que deseja excluir <strong>{deleteLead.company}</strong>? Esta ação não pode
            ser desfeita.
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={() => setDeleteLead(null)}>
              Cancelar
            </button>
            <button type="button" className="danger-button" onClick={confirmDelete}>
              Excluir
            </button>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | Status;
}) {
  return (
    <div className="stat-item">
      <span className={`stat-dot ${tone}`} />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function FinanceStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "partial" | "paid";
}) {
  return (
    <div className={`finance-summary-item ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LeadFinanceMarker({ summary }: { summary: LeadFinanceSummary }) {
  return (
    <div className="lead-finance-marker">
      <span className={`financial-status-badge ${summary.status}`}>
        {FINANCIAL_STATUS_LABEL[summary.status]}
      </span>
      <strong>{formatCurrency(summary.projectValue)}</strong>
      {summary.status !== "paid" && (
        <small>{formatCurrency(summary.remainingValue)} restante</small>
      )}
    </div>
  );
}

function LeadRow({
  lead,
  finance,
  onStatus,
  onMessage,
  onGeneratePrompt,
  onDetails,
  updateCount,
  onEnrich,
  onEdit,
  onDelete,
}: {
  lead: Lead;
  finance: LeadFinanceSummary | null;
  onStatus: (id: string, status: Status) => void;
  onMessage: (lead: Lead) => void;
  onGeneratePrompt: (lead: Lead) => void;
  onDetails: (lead: Lead) => void;
  updateCount: number;
  onEnrich: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  const chance = hasEnoughDataForLeadChance(lead)
    ? calculateLeadChance(lead, lead.segment)
    : null;

  return (
    <article className="table-row">
      <div className="company-cell">
        <div className="lead-company-name-line">
          <strong>{lead.company}</strong>
          {chance && <ChanceBadge chance={chance} />}
        </div>
        <span>{lead.segment}</span>
        {finance && <LeadFinanceMarker summary={finance} />}
        {lead.enrichedAt && <small className="enriched-badge">Dados enriquecidos</small>}
        {updateCount > 0 && (
          <small className="lead-update-badge">
            {updateCount} {updateCount === 1 ? "atualização" : "atualizações"}
          </small>
        )}
        {lead.notes && <small title={lead.notes}>{lead.notes}</small>}
      </div>
      <div className="phone-cell">{lead.phone || "Sem telefone"}</div>
      <StatusControl lead={lead} onStatus={onStatus} />
      <div className="date-cell">
        <span>{formatDate(lead.firstContact)}</span>
        <small>
          {lead.lastContact ? `Último: ${formatDate(lead.lastContact)}` : "Sem novo contato"}
        </small>
      </div>
      <div className="actions-cell">
        <button
          className="lead-details-button"
          onClick={() => onDetails(lead)}
          type="button"
        >
          Ver empresa
        </button>
        {lead.phone && (
          <button className="message-button" onClick={() => onMessage(lead)} type="button">
            <MessageCircle size={16} />
            Mandar mensagem
          </button>
        )}
        {lead.source !== "lavras-search" && (
          <button className="enrichment-button" onClick={() => onEnrich(lead)} type="button">
            <Search size={15} />
            {lead.placeId ? "Atualizar informações" : "Buscar informações"}
          </button>
        )}
        <button className="prompt-button" onClick={() => onGeneratePrompt(lead)} type="button">
          <Sparkles size={15} />
          Gerar prompt
        </button>
        <button className="row-icon" onClick={() => onEdit(lead)} type="button" title="Editar">
          <Edit3 size={16} />
        </button>
        <button className="row-icon danger" onClick={() => onDelete(lead)} type="button" title="Excluir">
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  );
}

function LeadCard({
  lead,
  finance,
  onStatus,
  onMessage,
  onGeneratePrompt,
  onDetails,
  updateCount,
  onEnrich,
  onEdit,
  onDelete,
}: {
  lead: Lead;
  finance: LeadFinanceSummary | null;
  onStatus: (id: string, status: Status) => void;
  onMessage: (lead: Lead) => void;
  onGeneratePrompt: (lead: Lead) => void;
  onDetails: (lead: Lead) => void;
  updateCount: number;
  onEnrich: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  const chance = hasEnoughDataForLeadChance(lead)
    ? calculateLeadChance(lead, lead.segment)
    : null;

  return (
    <article className="lead-card">
      <div className="card-top">
        <div>
          <div className="lead-company-name-line">
            <strong>{lead.company}</strong>
            {chance && <ChanceBadge chance={chance} />}
          </div>
          <span>{lead.segment}</span>
          {lead.enrichedAt && <small className="enriched-badge">Dados enriquecidos</small>}
        {updateCount > 0 && (
          <small className="lead-update-badge">
            {updateCount} {updateCount === 1 ? "atualização" : "atualizações"}
          </small>
        )}
        </div>
        <span className={`status-badge ${lead.status}`}>{STATUS_LABEL[lead.status]}</span>
      </div>
      <div className="card-phone">{lead.phone || "Sem telefone disponível"}</div>
      {finance && <LeadFinanceMarker summary={finance} />}
      <StatusControl lead={lead} onStatus={onStatus} />
      <div className="card-meta">
        <span>Primeiro contato: {formatDate(lead.firstContact)}</span>
        {lead.lastContact && <span>Último contato: {formatDate(lead.lastContact)}</span>}
      </div>
      {lead.notes && <p className="card-notes">{lead.notes}</p>}
      <div className="card-actions">
        <button
          className="lead-details-button"
          onClick={() => onDetails(lead)}
          type="button"
        >
          Ver empresa
        </button>
        {lead.phone && (
          <button className="message-button" onClick={() => onMessage(lead)} type="button">
            <MessageCircle size={16} />
            Mandar mensagem
          </button>
        )}
        {lead.source !== "lavras-search" && (
          <button className="enrichment-button" onClick={() => onEnrich(lead)} type="button">
            <Search size={15} />
            {lead.placeId ? "Atualizar informações" : "Buscar informações"}
          </button>
        )}
        <button className="prompt-button" onClick={() => onGeneratePrompt(lead)} type="button">
          <Sparkles size={15} />
          Gerar prompt
        </button>
        <button className="row-icon" onClick={() => onEdit(lead)} type="button" aria-label="Editar">
          <Edit3 size={17} />
        </button>
        <button
          className="row-icon danger"
          onClick={() => onDelete(lead)}
          type="button"
          aria-label="Excluir"
        >
          <Trash2 size={17} />
        </button>
      </div>
    </article>
  );
}

function StatusControl({
  lead,
  onStatus,
}: {
  lead: Lead;
  onStatus: (id: string, status: Status) => void;
}) {
  return (
    <div className="inline-status" aria-label="Alterar status">
      {(["send_message", "waiting", "accepted", "rejected"] as Status[]).map((status) => (
        <button
          key={status}
          type="button"
          className={`status-tick ${status} ${lead.status === status ? "selected" : ""}`}
          onClick={() => onStatus(lead.id, status)}
          title={STATUS_LABEL[status]}
          aria-label={STATUS_LABEL[status]}
        >
          {lead.status === status && <Check size={11} />}
        </button>
      ))}
      <span className={`status-text ${lead.status}`}>{STATUS_LABEL[lead.status]}</span>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  ariaLabel: string;
}) {
  return (
    <label className="select-wrap">
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel}>
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
      <ChevronDown size={15} />
    </label>
  );
}

function MessagesView({
  messages,
  setMessages,
  onSave,
  savedNotice,
}: {
  messages: string[];
  setMessages: (messages: string[]) => void;
  onSave: () => void;
  savedNotice: boolean;
}) {
  return (
    <section className="page-wrap messages-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ATALHOS DE ABORDAGEM</p>
          <h1>Mensagens</h1>
          <p className="subtitle">
            Edite seus três textos fixos. Use <code>{"{empresa}"}</code> para inserir o nome do lead.
          </p>
        </div>
        <button className="primary-button" onClick={onSave} type="button">
          {savedNotice ? <Check size={17} /> : null}
          {savedNotice ? "Salvo" : "Salvar mensagens"}
        </button>
      </div>

      <div className="messages-grid">
        {messages.map((message, index) => (
          <label className="message-editor" key={index}>
            <div className="editor-heading">
              <strong>Mensagem {index + 1}</strong>
              <span>{message.length} caracteres</span>
            </div>
            <textarea
              value={message}
              onChange={(event) => {
                const next = [...messages];
                next[index] = event.target.value;
                setMessages(next);
              }}
              rows={8}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function Modal({
  children,
  onClose,
  title,
  compact = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={compact ? "modal-card compact" : "modal-card"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function EmptyState({ onNew, hasLeads }: { onNew: () => void; hasLeads: boolean }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{hasLeads ? <Search size={20} /> : <Plus size={20} />}</div>
      <strong>{hasLeads ? "Nenhum lead encontrado" : "Seu primeiro lead começa aqui"}</strong>
      <p>
        {hasLeads
          ? "Tente mudar a busca ou os filtros."
          : "Cadastre uma empresa e ela já entra como Aguardando."}
      </p>
      {!hasLeads && (
        <button className="secondary-button" type="button" onClick={onNew}>
          Adicionar lead
        </button>
      )}
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}
