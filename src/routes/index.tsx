import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Edit3,
  Loader2,
  LogOut,
  MessageCircle,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { buildFactualBusinessDescription } from "../features/business-presence/business-description";
import { discoverBusinessPresence } from "../features/business-presence/discover-business-presence";
import { presenceFromBusiness } from "../features/business-presence/storage";
import type { BusinessPresence } from "../features/business-presence/types";
import { LeadEnrichmentModal } from "../features/lead-enrichment/LeadEnrichmentModal";
import { createLeadActivity } from "../features/lead-activities/lead-activities";
import { ChanceBadge } from "../features/lead-chance/ChanceBadge";
import {
  deleteRemoteLead,
  fetchLeadUpdates,
  fetchRemoteLeads,
  markLeadUpdatesSeen,
  migrateLocalLeads,
  saveRemoteLead,
  type LeadUpdateRecord,
  type PersistedLead,
} from "../features/leads/remote-leads";
import {
  calculateLeadChance,
  hasEnoughDataForLeadChance,
} from "../features/lead-chance/lead-chance";
import { PromptGenerator } from "../features/prompt-generator/PromptGenerator";
import { makePromptBusinessKey } from "../features/prompt-generator/storage";
import type { PromptBusinessContext } from "../features/prompt-generator/types";
import { BusinessDetailsModal } from "../features/search-leads/BusinessDetailsModal";
import { SearchLeadsView } from "../features/search-leads/SearchLeadsView";
import {
  findBusinessDuplicate,
  normalizeBrazilianPhone,
} from "../features/search-leads/identity";
import type { BusinessSearchResult } from "../features/search-leads/types";
import { getValidSession, signOut, subscribeAuthChange } from "../lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JanuarioLeads — Meus leads" },
      { name: "description", content: "Organize seus leads e contatos de prospecção no JanuarioLeads." },
      { property: "og:title", content: "JanuarioLeads — Meus leads" },
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

type Status = "waiting" | "accepted" | "rejected";

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
  status: "waiting",
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
    factualDescription: lead.factualDescription ?? null,
    googleMapsUrl: lead.googleMapsUrl ?? null,
    businessStatus: lead.businessStatus ?? null,
    latitude: lead.latitude ?? null,
    longitude: lead.longitude ?? null,
  };
}

const STATUS_LABEL: Record<Status, string> = {
  waiting: "Aguardando",
  accepted: "Aceito",
  rejected: "Recusado",
};

function LeadFlowApp() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState(DEFAULT_MESSAGES);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [hydrated, setHydrated] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const [leadUpdates, setLeadUpdates] = useState<LeadUpdateRecord[]>([]);
  const [view, setView] = useState<"leads" | "search" | "messages">("leads");
  const [leadModal, setLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [form, setForm] = useState<LeadForm>(EMPTY_FORM);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Status>("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [messageLead, setMessageLead] = useState<{ id?: string; company: string; phone: string } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState(0);
  const [deleteLead, setDeleteLead] = useState<Lead | null>(null);
  const [enrichmentLead, setEnrichmentLead] = useState<Lead | null>(null);
  const [leadDetailsId, setLeadDetailsId] = useState<string | null>(null);
  const [promptBusiness, setPromptBusiness] = useState<PromptBusinessContext | null>(null);
  const [promptActivityLeadId, setPromptActivityLeadId] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

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

    async function refreshRemoteState() {
      try {
        const [remoteLeads, updates] = await Promise.all([
          fetchRemoteLeads(),
          fetchLeadUpdates(),
        ]);

        if (!active) return;
        setLeads(remoteLeads);
        setLeadUpdates(updates);
        setRemoteError("");
      } catch {
        if (!active) return;
        setRemoteError(
          "Não foi possível atualizar a cópia remota agora. O CRM continua disponível localmente.",
        );
      }
    }

    window.addEventListener("focus", refreshRemoteState);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshRemoteState);
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

  const counts = useMemo(
    () => ({
      all: leads.length,
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
      return matchesSearch && matchesStatus && matchesSegment;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      if (sort === "az") return a.company.localeCompare(b.company, "pt-BR");
      if (sort === "za") return b.company.localeCompare(a.company, "pt-BR");
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [leads, search, statusFilter, segmentFilter, sort]);

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
      setRemoteError(
        "A ação foi concluída, mas o histórico não pôde ser atualizado agora.",
      );
    });
  }

  function relevantLeadChanges(previous: Lead, next: Lead) {
    const checks: Array<[keyof Lead, string]> = [
      ["company", "Nome"],
      ["segment", "Segmento"],
      ["phone", "Telefone"],
      ["status", "Status"],
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

    if (!remoteReady) return;

    void saveRemoteLead(lead).then((ok) => {
      if (!ok) {
        setRemoteError(
          "Uma alteração ficou salva localmente, mas ainda não foi confirmada no Supabase.",
        );
        return;
      }

      recordActivity(lead.id, {
        type: "lead_added",
        title: "Empresa adicionada aos Meus Leads",
        createdAt: lead.createdAt,
      });
    });
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

      updateLeadLocally(editingLead.id, () => nextLead);

      if (changedFields.length > 0) {
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

  function openWhatsApp() {
    if (!messageLead) return;
    const phone = normalizeBrazilianPhone(messageLead.phone);
    const personalized = (messages[selectedMessage] ?? "").replaceAll("{empresa}", messageLead.company);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(personalized)}`;
    const today = new Date().toISOString().slice(0, 10);
    if (messageLead.id) {
      updateLeadLocally(messageLead.id, (lead) => ({
        ...lead,
        lastContact: today,
      }));
    }
    window.open(url, "_blank", "noopener,noreferrer");

    if (messageLead.id) {
      recordActivity(messageLead.id, {
        type: "whatsapp_opened",
        title: "WhatsApp aberto",
        metadata: {
          messageTemplate: `Mensagem ${selectedMessage + 1}`,
        },
      });
    }

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
    setPromptActivityLeadId(null);
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
      instagram: business.instagram,
      googleMapsUrl: business.googleMapsUrl,
      latitude: business.latitude,
      longitude: business.longitude,
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
      instagram: lead.instagram ?? null,
      googleMapsUrl: lead.googleMapsUrl ?? null,
      latitude: lead.latitude ?? null,
      longitude: lead.longitude ?? null,
      notes: lead.notes || null,
    });
  }

  function applyPresenceToLead(
    leadId: string,
    presence: BusinessPresence,
  ) {
    updateLeadLocally(leadId, (lead) => {
      if (
        !presence.instagramUrl &&
        lead.instagram &&
        lead.instagramConfidence === "high"
      ) {
        return lead;
      }

      return {
        ...lead,
        instagramCheckedAt: presence.instagramCheckedAt,
        ...(presence.instagramUrl
          ? {
              instagram: presence.instagramUrl,
              instagramConfidence: presence.instagramConfidence ?? "high",
              instagramSource:
                presence.instagramSource ?? "official_website",
            }
          : {}),
      };
    });
  }

  function openBusinessWhatsApp(
    business: BusinessSearchResult,
    activityLeadId?: string,
  ) {
    const value = business.phone ?? business.internationalPhone;
    if (!value) return;
    const phone = normalizeBrazilianPhone(value);
    if (!phone) return;

    window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");

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
  ) {
    const presence = await discoverBusinessPresence(business, { force });
    if (!presence) return;
    applyPresenceToLead(leadId, presence);
  }

  function applyEnrichment(leadId: string, business: BusinessSearchResult) {
    const previous = leads.find((lead) => lead.id === leadId);
    if (!previous) return;

    const googlePresence = presenceFromBusiness(business);
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
      ...(googlePresence?.instagramUrl
        ? {
            instagram: googlePresence.instagramUrl,
            instagramConfidence: googlePresence.instagramConfidence ?? "high",
            instagramSource: googlePresence.instagramSource ?? "google_places",
            instagramCheckedAt: googlePresence.instagramCheckedAt,
          }
        : {}),
      ...(business.address ? { address: business.address } : {}),
      ...(business.website ? { website: business.website } : {}),
      ...(business.googleMapsUrl ? { googleMapsUrl: business.googleMapsUrl } : {}),
        ...(business.instagram && !googlePresence?.instagramUrl
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
    };

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
    void refreshLeadPresence(leadId, business, Boolean(previous.placeId));
  }

  function addFoundLead(business: BusinessSearchResult, selectedSegment: string) {
    const foundPhone = business.phone ?? business.internationalPhone ?? "";
    const duplicate = findBusinessDuplicate(business, leads);

    if (duplicate) return;

    const details = [
      "Lead encontrado através do buscador de empresas em Lavras.",
      business.address ? `Endereço: ${business.address}` : "",
      business.website ? `Site: ${business.website}` : "",
      business.instagram ? `Instagram: ${business.instagram}` : "",
      business.googleMapsUrl ? `Google Maps: ${business.googleMapsUrl}` : "",
    ].filter(Boolean);

    const googlePresence = presenceFromBusiness(business);
    const factualDescription = buildFactualBusinessDescription(business);

    const newLead: Lead = {
      id: crypto.randomUUID(),
      company: business.name,
      segment: selectedSegment,
      phone: foundPhone,
      status: "waiting",
      firstContact: new Date().toISOString().slice(0, 10),
      notes: details.join("\n"),
      createdAt: new Date().toISOString(),
      placeId: business.placeId,
      source: "lavras-search",
      factualDescription,
      ...(googlePresence?.instagramUrl
        ? {
            instagram: googlePresence.instagramUrl,
            instagramConfidence: googlePresence.instagramConfidence ?? "high",
            instagramSource: googlePresence.instagramSource ?? "google_places",
            instagramCheckedAt: googlePresence.instagramCheckedAt,
          }
        : {}),
      ...(business.address ? { address: business.address } : {}),
      ...(business.website ? { website: business.website } : {}),
      ...(business.googleMapsUrl ? { googleMapsUrl: business.googleMapsUrl } : {}),
      ...(business.instagram && !googlePresence?.instagramUrl
        ? { instagram: business.instagram }
        : {}),
      ...(business.primaryCategory ? { primaryCategory: business.primaryCategory } : {}),
      ...(business.categories.length ? { categories: business.categories } : {}),
      ...(business.description ? { description: business.description } : {}),
      ...(business.neighborhood ? { neighborhood: business.neighborhood } : {}),
      ...(business.city ? { city: business.city } : {}),
      ...(business.state ? { state: business.state } : {}),
      ...(business.internationalPhone ? { internationalPhone: business.internationalPhone } : {}),
      ...(business.rating !== null ? { rating: business.rating } : {}),
      ...(business.reviewCount !== null ? { reviewCount: business.reviewCount } : {}),
      ...(business.isOpenNow !== null ? { isOpenNow: business.isOpenNow } : {}),
      ...(business.openingHours.length ? { openingHours: business.openingHours } : {}),
      ...(business.businessStatus ? { businessStatus: business.businessStatus } : {}),
      ...(business.latitude !== null ? { latitude: business.latitude } : {}),
      ...(business.longitude !== null ? { longitude: business.longitude } : {}),
    };

    addLeadLocally(newLead);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand" onClick={() => setView("leads")} type="button">
            <span className="brand-mark">J</span>
            <span className="brand-word"><span>Januario</span><span className="brand-accent">Leads</span></span>
          </button>

          <nav className="topnav" aria-label="Navegação principal">
            <button
              className={view === "leads" ? "nav-link active" : "nav-link"}
              onClick={() => setView("leads")}
              type="button"
            >
              Meus Leads
            </button>
            <button
              className={view === "search" ? "nav-link active" : "nav-link"}
              onClick={() => setView("search")}
              type="button"
            >
              Buscar leads
            </button>
            <button
              className={view === "messages" ? "nav-link active" : "nav-link"}
              onClick={() => setView("messages")}
              type="button"
            >
              Mensagens
            </button>
          </nav>

          <div className="topbar-actions">
            <button
              className="logout-button"
              type="button"
              onClick={async () => {
                await signOut();
                await navigate({ to: "/login", replace: true });
              }}
              title="Sair"
            >
              <LogOut size={16} />
              <span>Sair</span>
            </button>
            <button
            className="icon-button"
            onClick={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
            type="button"
            aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
            title={theme === "light" ? "Tema escuro" : "Tema claro"}
          >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </div>
      </header>

      {view === "leads" ? (
        <section className="page-wrap">
          <div className="page-heading">
            <div>
              <p className="eyebrow">PROSPECÇÃO PESSOAL</p>
              <h1>Meus leads</h1>
              <p className="subtitle">Cadastre, acompanhe e abra conversas no WhatsApp sem complicação.</p>
            </div>
            <button className="primary-button" onClick={openNewLead} type="button">
              <Plus size={17} />
              Novo lead
            </button>
          </div>

          <div className="stats-strip">
            <Stat label="Total de leads" value={counts.all} tone="neutral" />
            <Stat label="Aguardando" value={counts.waiting} tone="waiting" />
            <Stat label="Aceitos" value={counts.accepted} tone="accepted" />
            <Stat label="Recusados" value={counts.rejected} tone="rejected" />
          </div>

          <section className="recent-updates-panel" aria-label="Atualizações recentes">
            <div className="recent-updates-heading">
              <div>
                <span>ATUALIZAÇÕES RECENTES</span>
                <strong>Sincronização automática</strong>
              </div>
              <div className="auto-sync-status">
                <span className={remoteReady ? "sync-dot active" : "sync-dot"} />
                <span>{remoteReady ? "Ativada" : "Conectando"}</span>
                <small>1 vez por dia</small>
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
                  ]}
                />
              </div>
            </div>

            <div className="filter-row">
              {([
                ["all", "Todos", counts.all],
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
          onAddLead={addFoundLead}
          onMessage={(target) => {
            setSelectedMessage(0);
            setMessageLead(target);
          }}
          onGeneratePrompt={openPromptForBusiness}
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
                {(["waiting", "accepted", "rejected"] as Status[]).map((status) => (
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
        <Modal onClose={() => setMessageLead(null)} title="Mandar mensagem">
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
                >
                  <span>Mensagem {index + 1}</span>
                  <p>{message.replaceAll("{empresa}", messageLead.company)}</p>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setMessageLead(null)}>
                Cancelar
              </button>
              <button type="button" className="whatsapp-button" onClick={openWhatsApp}>
                <MessageCircle size={17} />
                Abrir no WhatsApp
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
    </main>
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

function LeadRow({
  lead,
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
      {(["waiting", "accepted", "rejected"] as Status[]).map((status) => (
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
