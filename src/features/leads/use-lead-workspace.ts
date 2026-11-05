import { useEffect, useState } from "react";
import { accountLocalStorage, isLegacyWorkspaceOwner } from "../../lib/account-storage";
import { fetchLeadPayments, type LeadPayment } from "../lead-finance/finance";
import {
  fetchRemoteLeads,
  fetchLeadUpdates,
  type LeadUpdateRecord,
  type PersistedLead as Lead,
} from "./remote-leads";
import { flushPendingLeads, mergePendingLeads, leadMutationVersion } from "./pending-leads";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  appendMissingFollowUpTemplates,
  parseSavedMessageTemplates,
  type MessageTemplate,
} from "../messages/message-templates";
export const STORAGE = {
  leads: "leadflow:leads",
  messages: "leadflow:messages",
  defaultMessagesRestored: "leadflow:messages:defaults-restored:2026-11-03",
  followUpDefaultsInitialized: "leadflow:messages:followups-initialized:2026-11-04",
  theme: "leadflow:theme",
};
export function useLeadWorkspace() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState<MessageTemplate[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [hydrated, setHydrated] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);
  const [remoteError, setRemoteError] = useState("");
  const [leadUpdates, setLeadUpdates] = useState<LeadUpdateRecord[]>([]);
  const [leadPayments, setLeadPayments] = useState<LeadPayment[]>([]);
  const [financeLoaded, setFinanceLoaded] = useState(false);
  const [financeError, setFinanceError] = useState("");
  useEffect(() => {
    let active = true;
    let localLeads: Lead[] = [];

    try {
      const storedLeads = accountLocalStorage.getItem(STORAGE.leads);
      const storedMessages = accountLocalStorage.getItem(STORAGE.messages);
      const storedTheme = accountLocalStorage.getItem(STORAGE.theme) as "light" | "dark" | null;

      if (storedLeads) {
        const parsed = JSON.parse(storedLeads);
        if (Array.isArray(parsed)) localLeads = parsed as Lead[];
      }

      setLeads(mergePendingLeads(localLeads));

      // Follow-up templates are saved alongside initial messages in the same
      // per-account browser storage. Seed the original three just once, so a
      // deliberate edit or deletion is never undone when the page reloads.
      const parsed = storedMessages
        ? parseSavedMessageTemplates(JSON.parse(storedMessages))
        : [];
      if (parsed) {
        let nextMessages = parsed;
        if (
          nextMessages.length === 0 &&
          isLegacyWorkspaceOwner() &&
          !accountLocalStorage.getItem(STORAGE.defaultMessagesRestored)
        ) {
          nextMessages = DEFAULT_MESSAGE_TEMPLATES.map((item) => ({ ...item }));
          accountLocalStorage.setItem(STORAGE.defaultMessagesRestored, "1");
        }
        if (!accountLocalStorage.getItem(STORAGE.followUpDefaultsInitialized)) {
          nextMessages = appendMissingFollowUpTemplates(nextMessages);
          // Persist templates before the one-time marker. React dev StrictMode
          // can run effects twice before state updates are committed, so a
          // second initialization must read the seeded list, not overwrite it.
          accountLocalStorage.setItem(STORAGE.messages, JSON.stringify(nextMessages));
          accountLocalStorage.setItem(STORAGE.followUpDefaultsInitialized, "1");
        }
        setMessages(nextMessages);
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
        await flushPendingLeads();
        const mutationVersion = leadMutationVersion();
        const remoteLeads = await fetchRemoteLeads();
        if (!active) return;

        if (mutationVersion === leadMutationVersion()) setLeads(mergePendingLeads(remoteLeads));
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
          "Não foi possível conectar ao armazenamento online agora. Seus dados locais continuam preservados.",
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
    accountLocalStorage.setItem(STORAGE.leads, JSON.stringify(leads));
  }, [leads, hydrated]);

  useEffect(() => {
    let active = true;
    let refreshInFlight = false;

    async function refreshRemoteState() {
      if (!active || refreshInFlight) return;
      refreshInFlight = true;

      try {
        await flushPendingLeads();
        const mutationVersion = leadMutationVersion();
        const [remoteLeads, updates] = await Promise.all([fetchRemoteLeads(), fetchLeadUpdates()]);

        if (!active) return;
        if (mutationVersion === leadMutationVersion()) setLeads(mergePendingLeads(remoteLeads));
        setLeadUpdates(updates);
        setRemoteReady(true);
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

    // These listeners are intentionally registered even when the initial
    // Supabase connection fails, so a suspended mobile tab can recover later.
    window.addEventListener("focus", refreshRemoteState);
    window.addEventListener("online", refreshRemoteState);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("pageshow", refreshAfterPageRestore);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshRemoteState);
      window.removeEventListener("online", refreshRemoteState);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("pageshow", refreshAfterPageRestore);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    accountLocalStorage.setItem(STORAGE.messages, JSON.stringify(messages));
  }, [messages, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    accountLocalStorage.setItem(STORAGE.theme, theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme, hydrated]);

  return {
    leads,
    setLeads,
    messages,
    setMessages,
    theme,
    setTheme,
    hydrated,
    remoteReady,
    remoteError,
    setRemoteError,
    leadUpdates,
    setLeadUpdates,
    leadPayments,
    setLeadPayments,
    financeLoaded,
    financeError,
  };
}
