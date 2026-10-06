import {
  Clock3,
  LayoutDashboard,
  LogOut,
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
import { useEffect, useState, type ReactNode } from "react";

export type AppView =
  | "dashboard"
  | "leads"
  | "search"
  | "opportunities"
  | "open-now"
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
  { view: "opportunities", label: "Oportunidades", icon: Target },
  { view: "open-now", label: "Abertos Agora", icon: Clock3 },
  { view: "messages", label: "Mensagens", icon: MessageCircle },
  { view: "finance", label: "Financeiro", icon: WalletCards },
];

const VIEW_TITLES: Record<AppView, string> = {
  dashboard: "Dashboard",
  leads: "Meus Leads",
  search: "Buscar Leads",
  opportunities: "Oportunidades",
  "open-now": "Abertos Agora",
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

  useEffect(() => {
    setMobileOpen(false);
  }, [activeView]);

  function navigate(view: AppView) {
    onNavigate(view);
    setMobileOpen(false);
  }

  const navigation = (
    <>
      <nav className="saas-nav" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => {
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
