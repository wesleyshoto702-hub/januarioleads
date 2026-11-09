import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  MessageCircle,
  Moon,
  Search,
  Sun,
  Target,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { isLegacyWorkspaceOwner } from "../../lib/account-storage";

export type AppView =
  | "dashboard"
  | "leads"
  | "search"
  | "maps"
  | "prospecting"
  | "opportunities"
  | "messages"
  | "finance";

const NAV_ITEMS: Array<{
  view: AppView;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { view: "leads", label: "Meus Leads", icon: Users },
  { view: "search", label: "Buscar Leads", icon: Search },
  { view: "maps", label: "Buscar via Maps", icon: MapPinned },
  { view: "prospecting", label: "Informações de Prospecção", icon: BarChart3 },
  { view: "opportunities", label: "Oportunidades", icon: Target },
  { view: "messages", label: "Mensagens", icon: MessageCircle },
  { view: "finance", label: "Financeiro", icon: WalletCards },
];

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: "Dashboard",
  leads: "Meus Leads",
  search: "Buscar Leads",
  maps: "Buscar via Maps",
  prospecting: "Informações de Prospecção",
  opportunities: "Oportunidades",
  messages: "Mensagens",
  finance: "Financeiro",
};

export function AppShell({
  activeView,
  theme,
  onNavigate,
  onToggleTheme,
  onLogout,
  children,
}: {
  activeView: AppView;
  theme: "light" | "dark";
  onNavigate: (view: AppView) => void;
  onToggleTheme: () => void;
  onLogout: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuButton = useRef<HTMLButtonElement>(null);
  const mobileDrawer = useRef<HTMLElement>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [activeView]);

  useEffect(() => {
    if (!mobileOpen) return;

    const media = window.matchMedia("(min-width: 901px)");
    if (media.matches) {
      setMobileOpen(false);
      return;
    }

    // Keep the main page from scrolling behind the mobile navigation.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    mobileDrawer.current?.querySelector<HTMLButtonElement>(".saas-mobile-close")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = mobileDrawer.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const onResize = () => {
      if (media.matches) setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    media.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      media.removeEventListener("change", onResize);
      mobileMenuButton.current?.focus();
    };
  }, [mobileOpen]);

  function navigate(view: AppView) {
    onNavigate(view);
    setMobileOpen(false);
  }

  const navigation = (
    <>
      <nav className="saas-nav" aria-label="Navegação principal">
        {NAV_ITEMS.filter((item) => item.view !== "maps" || isLegacyWorkspaceOwner()).map((item) => {
          const Icon = item.icon;
          const active = activeView === item.view;
          return (
            <button
              key={item.view}
              type="button"
              className={active ? "saas-nav-item active" : "saas-nav-item"}
              aria-current={active ? "page" : undefined}
              onClick={() => navigate(item.view)}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{item.label}</span>
              <i aria-hidden="true" />
            </button>
          );
        })}
      </nav>

      <div className="saas-sidebar-footer">
        <button
          type="button"
          className="saas-footer-action"
          onClick={onToggleTheme}
          aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
        >
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          <span>{theme === "light" ? "Tema escuro" : "Tema claro"}</span>
        </button>
        <button
          type="button"
          className="saas-footer-action"
          onClick={() => void onLogout()}
        >
          <LogOut size={17} />
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="saas-shell">
      <aside className="saas-sidebar">
        <button
          type="button"
          className="saas-brand"
          onClick={() => navigate("dashboard")}
          aria-label="Ir para o Dashboard"
        >
          <span className="saas-brand-mark">J</span>
          <span className="saas-brand-word">
            <span>Januario</span>
            <strong>Leads</strong>
          </span>
        </button>

        <div className="saas-sidebar-label">Workspace</div>
        {navigation}
      </aside>

      <header className="saas-mobile-header">
        <button
          type="button"
          className="saas-mobile-menu"
          ref={mobileMenuButton}
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={mobileOpen}
        >
          <Menu size={19} />
        </button>
        <div className="saas-mobile-title">
          <span className="saas-brand-mark small">J</span>
          <div>
            <strong>{VIEW_TITLES[activeView]}</strong>
            <span>JanuarioLeads</span>
          </div>
        </div>
        <button
          type="button"
          className="saas-mobile-theme"
          onClick={onToggleTheme}
          aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </header>

      {mobileOpen && (
        <div
          className="saas-mobile-backdrop"
          role="presentation"
          onMouseDown={() => setMobileOpen(false)}
        >
          <aside
            className="saas-mobile-drawer"
            ref={mobileDrawer}
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="saas-mobile-drawer-head">
              <div className="saas-brand compact">
                <span className="saas-brand-mark">J</span>
                <span className="saas-brand-word">
                  <span>Januario</span>
                  <strong>Leads</strong>
                </span>
              </div>
              <button
                type="button"
                className="saas-mobile-close"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu"
              >
                <X size={19} />
              </button>
            </div>
            <div className="saas-sidebar-label">Workspace</div>
            {navigation}
          </aside>
        </div>
      )}

      <div className="saas-main">
        <div className="saas-main-inner">{children}</div>
      </div>
    </div>
  );
}
