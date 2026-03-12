import React, { useState, useRef, useCallback, useEffect } from "react";
import { Outlet, NavLink, useLocation, useNavigate, Navigate } from "react-router";
import logoImg from "../../assets/logo-certifica-dark.png";
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  FolderKanban,
  GraduationCap,
  FolderOpen,
  BarChart3,
  Settings,
  ChevronRight,
  ChevronDown,
  Bell,
  Search,
  LogOut,
  Award,
  HelpCircle,
  Video,
  MessageSquare,
  CalendarDays,
  X,
  Check,
  CheckCheck,
  Keyboard,
  BookOpen,
  Loader2,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle2,
  Menu,
} from "lucide-react";
import { useGlobalSearch, type SearchResult } from "../lib/useGlobalSearch";
import { useNotifications } from "../lib/useNotifications";
import { useSmartNotifications } from "../lib/useSmartNotifications";
import { useGoogleCalendar } from "../lib/useGoogleCalendar";
import { useRBAC } from "../lib/useRBAC";
import { ErrorBoundary } from "./ErrorBoundary";
import { toast } from "sonner";

/* ── Types ── */
interface NavItem {
  path?: string;
  label: string;
  icon: React.ElementType;
  children?: { path: string; label: string }[];
}

/* ── Navigation config ── */
const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/reunioes", label: "Reuniões", icon: Video },
  { path: "/calendario", label: "Calendário", icon: CalendarDays },
  { path: "/chat", label: "Chat", icon: MessageSquare },
  { path: "/clientes", label: "Empresas", icon: Users },
  {
    label: "Projetos",
    icon: FolderKanban,
    children: [
      { path: "/projetos", label: "Visão Geral" },
      { path: "/projetos/pipeline", label: "Kanban" },
    ],
  },
  { path: "/documentos", label: "Documentos", icon: FolderOpen },
  {
    label: "Auditorias",
    icon: ClipboardCheck,
    children: [
      { path: "/auditorias", label: "Painel" },
      { path: "/auditorias/rai", label: "Relatório (RAI)" },
      { path: "/auditorias/fechamento", label: "Fechamento" },
    ],
  },
  { path: "/normas", label: "Normas", icon: Award },
  { path: "/treinamentos", label: "Treinamentos", icon: GraduationCap },
];

const bottomItems = [
  { path: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { path: "/configuracoes", label: "Configurações", icon: Settings },
];

/* ── Sidebar dimensions ── */
const COLLAPSED_W = 56;
const EXPANDED_W = 224;
const TRANSITION = "280ms cubic-bezier(0.4, 0, 0.2, 1)";

const textStyle = (open: boolean): React.CSSProperties => ({
  opacity: open ? 1 : 0,
  maxWidth: open ? 160 : 0,
  transition: `opacity ${TRANSITION}, max-width ${TRANSITION}`,
  overflow: "hidden",
  whiteSpace: "nowrap" as const,
});

/* ── Helpers ── */
const LAST_ROUTE_KEY = "certifica_last_route";

const typeIcons: Record<SearchResult["type"], React.ElementType> = {
  cliente: Users,
  projeto: FolderKanban,
  documento: FolderOpen,
  auditoria: ClipboardCheck,
  treinamento: GraduationCap,
  norma: Award,
};

const typeLabels: Record<SearchResult["type"], string> = {
  cliente: "Cliente",
  projeto: "Projeto",
  documento: "Documento",
  auditoria: "Auditoria",
  treinamento: "Treinamento",
  norma: "Norma",
};

const notifIcons: Record<string, React.ElementType> = {
  info: Info,
  alerta: AlertTriangle,
  urgente: AlertCircle,
  sucesso: CheckCircle2,
};

const notifColors: Record<string, string> = {
  info: "text-blue-500",
  alerta: "text-amber-500",
  urgente: "text-red-500",
  sucesso: "text-emerald-500",
};

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], desc: "Busca global" },
  { keys: ["Ctrl", "1"], desc: "Dashboard" },
  { keys: ["Ctrl", "2"], desc: "Empresas" },
  { keys: ["Ctrl", "3"], desc: "Projetos" },
  { keys: ["Ctrl", "4"], desc: "Documentos" },
  { keys: ["Ctrl", "5"], desc: "Auditorias" },
  { keys: ["Esc"], desc: "Fechar painel/modal" },
];

const DOCS = [
  { title: "Guia de Início Rápido", desc: "Primeiros passos com a plataforma" },
  { title: "Gestão de Empresas", desc: "Como cadastrar e gerenciar empresas" },
  { title: "Pipeline Kanban", desc: "Organizando o fluxo de projetos" },
  { title: "Auditorias e RAI", desc: "Conduzindo auditorias internas" },
  { title: "Normas e Certificações", desc: "Referência de normas ISO/NR" },
  { title: "Relatórios", desc: "Gerando relatórios personalizados" },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : false
  );
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Hooks ── */
  const globalSearch = useGlobalSearch();
  const { notifications: supabaseNotifs, markAsRead: supabaseMarkAsRead, markAllAsRead: supabaseMarkAllAsRead } = useNotifications();
  const { connected: gcalConnected, meetings: calMeetings, fetchMeetings: fetchCalMeetings } = useGoogleCalendar();
  const { notifications, markSmartRead, markAllSmartRead } = useSmartNotifications(supabaseNotifs, calMeetings);
  const unreadCount = notifications.filter((n) => !n.lida).length;
  const { profile, loading: rbacLoading, needsLogin, canAccess, logout, initials } = useRBAC();

  /* ── UI state ── */
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchSelectedIdx, setSearchSelectedIdx] = useState(-1);
  const [notifOpen, setNotifOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  /* ── Computed ── */
  const effectivelyOpen = isMobile ? true : isOpen;

  /* ── Reset search selection when results change ── */
  useEffect(() => {
    setSearchSelectedIdx(-1);
  }, [globalSearch.results.length, globalSearch.query]);

  /* ── Route persistence ── */
  useEffect(() => {
    localStorage.setItem(LAST_ROUTE_KEY, location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const saved = localStorage.getItem(LAST_ROUTE_KEY);
    if (saved && saved !== "/" && saved !== location.pathname) {
      navigate(saved, { replace: true });
    }
    // only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Google Calendar: auto-fetch meetings on mount if connected ── */
  useEffect(() => {
    if (gcalConnected) fetchCalMeetings(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gcalConnected]);

  /* ── Unified mark-as-read handlers ── */
  const handleMarkAsRead = useCallback((id: string) => {
    if (id.startsWith("smart:")) markSmartRead(id);
    else supabaseMarkAsRead(id);
  }, [markSmartRead, supabaseMarkAsRead]);

  const handleMarkAllAsRead = useCallback(() => {
    const smartIds = notifications.filter((n) => n.id.startsWith("smart:") && !n.lida).map((n) => n.id);
    if (smartIds.length > 0) markAllSmartRead(smartIds);
    supabaseMarkAllAsRead();
  }, [notifications, markAllSmartRead, supabaseMarkAllAsRead]);

  /* ── Mobile detection ── */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (!e.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* ── Close mobile menu on route change ── */
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSearchFocused(false);
        setSearchSelectedIdx(-1);
        setNotifOpen(false);
        setHelpOpen(false);
        setMobileOpen(false);
        globalSearch.clear();
        searchRef.current?.blur();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchFocused(true);
        setSearchSelectedIdx(-1);
        return;
      }

      // ── Search result navigation (↑↓ Enter) ──
      const showResults = searchFocused && globalSearch.query.length >= 2 && globalSearch.results.length > 0;
      if (showResults) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSearchSelectedIdx((i) => Math.min(i + 1, globalSearch.results.length - 1));
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSearchSelectedIdx((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === "Enter" && searchSelectedIdx >= 0) {
          e.preventDefault();
          const selected = globalSearch.results[searchSelectedIdx];
          if (selected) {
            navigate(selected.path);
            globalSearch.clear();
            setSearchFocused(false);
            setSearchSelectedIdx(-1);
            searchRef.current?.blur();
          }
          return;
        }
      }

      if (e.ctrlKey || e.metaKey) {
        const routeMap: Record<string, string> = {
          "1": "/",
          "2": "/clientes",
          "3": "/projetos",
          "4": "/documentos",
          "5": "/auditorias",
        };
        if (routeMap[e.key]) {
          e.preventDefault();
          navigate(routeMap[e.key]);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, globalSearch, searchFocused, searchSelectedIdx]);

  /* ── Click outside ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Sidebar hover (desktop only) ── */
  const handleMouseEnter = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setIsOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimer.current = setTimeout(() => setIsOpen(false), 200);
  }, []);

  /* Section expand logic */
  const getExpandedSections = () => {
    const expanded = new Set(expandedSections);
    navItems.forEach((item) => {
      if (item.children?.some((c) => location.pathname === c.path || location.pathname.startsWith(c.path + "/"))) {
        expanded.add(item.label);
      }
    });
    return [...expanded];
  };

  const activeExpanded = getExpandedSections();

  const toggleSection = (label: string) => {
    setExpandedSections((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const isChildActive = (item: NavItem) =>
    item.children?.some((c) => location.pathname === c.path || location.pathname.startsWith(c.path + "/"));

  /* ── RBAC filtering ── */
  const filteredNavItems = navItems.filter((item) => {
    if (item.path) return canAccess(item.path);
    if (item.children) return item.children.some((c) => canAccess(c.path));
    return true;
  });

  const filteredBottomItems = bottomItems.filter((item) => canAccess(item.path));

  /* ── Search result click ── */
  const handleSearchSelect = (result: SearchResult) => {
    navigate(result.path);
    globalSearch.clear();
    setSearchFocused(false);
    searchRef.current?.blur();
  };

  /* ── Render helpers ── */
  const renderNavItem = (item: NavItem) => {
    if (item.children) {
      const visibleChildren = item.children.filter((c) => canAccess(c.path));
      if (visibleChildren.length === 0) return null;

      const sectionOpen = activeExpanded.includes(item.label);
      const showChildren = sectionOpen && effectivelyOpen;
      const hasActiveChild = isChildActive(item);
      return (
        <div key={item.label} className="mb-px relative group/parent">
          <button
            onClick={() => effectivelyOpen && toggleSection(item.label)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[4px] cursor-pointer transition-colors duration-150 ${
              hasActiveChild
                ? "text-certifica-accent-dark"
                : "text-certifica-500 hover:text-certifica-dark hover:bg-certifica-100/70"
            }`}
          >
            <item.icon className="w-[15px] h-[15px] flex-shrink-0" strokeWidth={1.5} />
            <span
              className="text-[12.5px] flex-1 text-left"
              style={{ ...textStyle(effectivelyOpen), fontWeight: hasActiveChild ? 500 : 400 }}
            >
              {item.label}
            </span>
            <ChevronDown
              className={`w-3 h-3 flex-shrink-0 ${sectionOpen ? "" : "-rotate-90"}`}
              strokeWidth={1.5}
              style={{
                opacity: effectivelyOpen ? 0.3 : 0,
                maxWidth: effectivelyOpen ? 12 : 0,
                transition: `opacity ${TRANSITION}, max-width ${TRANSITION}, transform 200ms ease`,
                overflow: "hidden",
              }}
            />
            <span
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-certifica-accent rounded-r-full"
              style={{
                opacity: !effectivelyOpen && hasActiveChild ? 1 : 0,
                transition: `opacity ${TRANSITION}`,
              }}
            />
          </button>
          <div
            className="overflow-hidden"
            style={{
              maxHeight: showChildren ? `${visibleChildren.length * 36}px` : 0,
              opacity: showChildren ? 1 : 0,
              transition: `max-height ${TRANSITION}, opacity ${TRANSITION}`,
            }}
          >
            <div className="ml-[22px] border-l border-certifica-200 mt-px mb-1">
              {visibleChildren.map((child) => {
                const isActive = location.pathname === child.path;
                return (
                  <NavLink
                    key={child.path}
                    to={child.path}
                    className={`flex items-center pl-3 py-[6px] rounded-r-[3px] whitespace-nowrap transition-colors duration-150 ${
                      isActive
                        ? "text-certifica-accent-dark bg-certifica-accent-light"
                        : "text-certifica-500 hover:text-certifica-dark hover:bg-certifica-50"
                    }`}
                  >
                    <span className="text-[12px]" style={{ fontWeight: isActive ? 500 : 400 }}>
                      {child.label}
                    </span>
                  </NavLink>
                );
              })}
            </div>
          </div>
          {!effectivelyOpen && (
            <div
              className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-certifica-dark text-white text-[11px] rounded-[4px] whitespace-nowrap opacity-0 pointer-events-none group-hover/parent:opacity-100 z-50 shadow-lg"
              style={{ fontWeight: 400, transition: `opacity 150ms ease` }}
            >
              {item.label}
            </div>
          )}
        </div>
      );
    }

    const isActive = location.pathname === item.path;
    return (
      <div key={item.path} className="relative group/item mb-px">
        <NavLink
          to={item.path!}
          className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-[4px] transition-colors duration-150 ${
            isActive
              ? "bg-certifica-accent-light text-certifica-accent-dark"
              : "text-certifica-500 hover:text-certifica-dark hover:bg-certifica-100/70"
          }`}
        >
          <item.icon className="w-[15px] h-[15px] flex-shrink-0" strokeWidth={1.5} />
          <span
            className="text-[12.5px]"
            style={{ ...textStyle(effectivelyOpen), fontWeight: isActive ? 500 : 400 }}
          >
            {item.label}
          </span>
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-certifica-accent rounded-r-full"
            style={{
              opacity: !effectivelyOpen && isActive ? 1 : 0,
              transition: `opacity ${TRANSITION}`,
            }}
          />
        </NavLink>
        {!effectivelyOpen && (
          <div
            className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-certifica-dark text-white text-[11px] rounded-[4px] whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 z-50 shadow-lg"
            style={{ fontWeight: 400, transition: `opacity 150ms ease` }}
          >
            {item.label}
          </div>
        )}
      </div>
    );
  };

  const showSearchResults = searchFocused && globalSearch.query.length >= 2;

  /* ── Auth guard ── */
  if (rbacLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center" style={{ background: "#0E2A47", fontFamily: "'Inter', sans-serif" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-[#2B8EAD] animate-spin" strokeWidth={1.5} />
          <span className="text-[12px] text-white/40">Verificando sessão...</span>
        </div>
      </div>
    );
  }

  if (needsLogin) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Mobile backdrop ── */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        onMouseEnter={!isMobile ? handleMouseEnter : undefined}
        onMouseLeave={!isMobile ? handleMouseLeave : undefined}
        className="bg-white border-r border-certifica-200 flex flex-col overflow-hidden"
        style={{
          position: isMobile ? "fixed" : "relative",
          top: isMobile ? 0 : undefined,
          left: isMobile ? 0 : undefined,
          bottom: isMobile ? 0 : undefined,
          zIndex: isMobile ? 40 : undefined,
          flexShrink: isMobile ? undefined : 0,
          width: isMobile ? EXPANDED_W : (isOpen ? EXPANDED_W : COLLAPSED_W),
          transform: isMobile ? (mobileOpen ? "translateX(0)" : "translateX(-100%)") : "none",
          transition: isMobile ? `transform ${TRANSITION}` : `width ${TRANSITION}`,
        }}
      >
        {/* Logo area */}
        <div className="h-[52px] flex items-center border-b border-certifica-200 overflow-hidden flex-shrink-0 px-2.5 gap-2">
          <div
            className="overflow-hidden flex-shrink-0 pl-[3px]"
            style={{
              width: effectivelyOpen ? 160 : 24,
              transition: `width ${TRANSITION}`,
            }}
          >
            <img src={logoImg} alt="Certifica Gestão de Sistemas" className="h-[30px] w-auto max-w-none" />
          </div>
          {isMobile && (
            <button
              onClick={() => setMobileOpen(false)}
              className="ml-auto p-1 text-certifica-500/40 hover:text-certifica-500 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2">
          {filteredNavItems.map(renderNavItem)}

          <div className="mt-3 pt-3 border-t border-certifica-200">
            {filteredBottomItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <div key={item.path} className="relative group/bottom mb-px">
                  <NavLink
                    to={item.path}
                    className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-[4px] transition-colors duration-150 ${
                      isActive
                        ? "bg-certifica-accent-light text-certifica-accent-dark"
                        : "text-certifica-500 hover:text-certifica-dark hover:bg-certifica-100/70"
                    }`}
                  >
                    <item.icon className="w-[15px] h-[15px] flex-shrink-0" strokeWidth={1.5} />
                    <span
                      className="text-[12.5px]"
                      style={{ ...textStyle(effectivelyOpen), fontWeight: 400 }}
                    >
                      {item.label}
                    </span>
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-certifica-accent rounded-r-full"
                      style={{
                        opacity: !effectivelyOpen && isActive ? 1 : 0,
                        transition: `opacity ${TRANSITION}`,
                      }}
                    />
                  </NavLink>
                  {!effectivelyOpen && (
                    <div
                      className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-certifica-dark text-white text-[11px] rounded-[4px] whitespace-nowrap opacity-0 pointer-events-none group-hover/bottom:opacity-100 z-50 shadow-lg"
                      style={{ fontWeight: 400, transition: `opacity 150ms ease` }}
                    >
                      {item.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* User area */}
        <div className="border-t border-certifica-200 flex-shrink-0">
          <div className="flex items-center overflow-hidden px-2.5 py-2.5 gap-2">
            <div
              className="w-7 h-7 rounded-full bg-certifica-accent-light flex items-center justify-center text-[10px] text-certifica-accent-dark flex-shrink-0"
              style={{ fontWeight: 600 }}
            >
              {initials}
            </div>
            <div
              className="flex-1 min-w-0"
              style={{
                opacity: effectivelyOpen ? 1 : 0,
                maxWidth: effectivelyOpen ? 120 : 0,
                transition: `opacity ${TRANSITION}, max-width ${TRANSITION}`,
                overflow: "hidden",
              }}
            >
              <div className="text-[11.5px] text-certifica-dark truncate" style={{ fontWeight: 500 }}>
                {profile?.nome ?? "Carregando..."}
              </div>
              {profile?.role_nome && (
                <div className="text-[9.5px] text-certifica-500/60 truncate">{profile.role_nome}</div>
              )}
            </div>
            <button
              onClick={logout}
              title="Sair"
              className="text-certifica-500/40 hover:text-red-500 p-1 cursor-pointer flex-shrink-0 transition-colors duration-150"
              style={{
                opacity: effectivelyOpen ? 1 : 0,
                maxWidth: effectivelyOpen ? 28 : 0,
                transition: `opacity ${TRANSITION}, max-width ${TRANSITION}`,
                overflow: "hidden",
              }}
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-[44px] flex-shrink-0 bg-white border-b border-certifica-200 flex items-center px-4 justify-between relative z-40">
          <div className="flex items-center gap-1.5 text-[12px] min-w-0">
            {isMobile && (
              <button
                onClick={() => setMobileOpen((p) => !p)}
                className="p-1.5 text-certifica-500/60 hover:text-certifica-dark transition-colors mr-1 flex-shrink-0"
                aria-label="Abrir menu"
              >
                <Menu className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
            <span className="text-certifica-accent flex-shrink-0" style={{ fontWeight: 500 }}>Certifica</span>
            <ChevronRight className="w-3 h-3 text-certifica-500/40 flex-shrink-0" strokeWidth={1.5} />
            <span className="text-certifica-dark truncate" style={{ fontWeight: 500 }}>
              {getBreadcrumb(location.pathname)}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* ── Global Search ── */}
            <div ref={searchContainerRef} className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-certifica-500/40 z-10" strokeWidth={1.5} />
              <input
                ref={searchRef}
                className={`h-7 pl-7 pr-8 bg-certifica-50 border rounded-[3px] text-[11.5px] text-certifica-dark placeholder:text-certifica-500/40 focus:outline-none focus:ring-1 focus:ring-certifica-accent/30 focus:border-certifica-accent/30 transition-all duration-200 ${
                  searchFocused ? "w-[200px] sm:w-[280px] border-certifica-accent/30" : "w-[100px] sm:w-[160px] border-certifica-200"
                }`}
                placeholder={isMobile ? "Buscar..." : "Buscar... (Ctrl+K)"}
                style={{ fontWeight: 400 }}
                value={globalSearch.query}
                onChange={(e) => globalSearch.search(e.target.value)}
                onFocus={() => setSearchFocused(true)}
              />
              {globalSearch.query && (
                <button
                  onClick={() => {
                    globalSearch.clear();
                    searchRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-certifica-500/40 hover:text-certifica-500 z-10 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              {/* Search Results Dropdown */}
              {showSearchResults && (
                <div className="absolute top-full right-0 mt-1 w-[280px] sm:w-[400px] bg-white border border-certifica-200 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  {globalSearch.loading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-certifica-500/60">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-[12px]">Buscando...</span>
                    </div>
                  ) : globalSearch.results.length === 0 ? (
                    <div className="py-6 text-center text-[12px] text-certifica-500/60">
                      Nenhum resultado para "{globalSearch.query}"
                    </div>
                  ) : (
                    <div className="max-h-[360px] overflow-y-auto">
                      <div className="px-3 py-2 text-[10px] text-certifica-500/50 border-b border-certifica-100 flex items-center justify-between">
                        <span className="uppercase tracking-wider">{globalSearch.results.length} resultado{globalSearch.results.length !== 1 ? "s" : ""}</span>
                        <span className="flex items-center gap-1.5 normal-case tracking-normal">
                          <kbd className="px-1 py-0.5 bg-certifica-100 border border-certifica-200 rounded text-[9px]">↑↓</kbd>
                          <span>navegar</span>
                          <kbd className="px-1 py-0.5 bg-certifica-100 border border-certifica-200 rounded text-[9px]">↵</kbd>
                          <span>abrir</span>
                          <kbd className="px-1 py-0.5 bg-certifica-100 border border-certifica-200 rounded text-[9px]">Esc</kbd>
                          <span>fechar</span>
                        </span>
                      </div>
                      {globalSearch.results.map((r, idx) => {
                        const Icon = typeIcons[r.type];
                        const isHighlighted = idx === searchSelectedIdx;
                        return (
                          <button
                            key={`${r.type}-${r.id}`}
                            onClick={() => handleSearchSelect(r)}
                            onMouseEnter={() => setSearchSelectedIdx(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left cursor-pointer ${
                              isHighlighted ? "bg-certifica-accent-light" : "hover:bg-certifica-50"
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
                              isHighlighted ? "bg-certifica-accent/20" : "bg-certifica-accent-light"
                            }`}>
                              <Icon className="w-3.5 h-3.5 text-certifica-accent-dark" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-[12px] truncate ${isHighlighted ? "text-certifica-accent-dark" : "text-certifica-dark"}`} style={{ fontWeight: isHighlighted ? 600 : 500 }}>
                                {r.title}
                              </div>
                              <div className="text-[10.5px] text-certifica-500/60 truncate">{r.subtitle}</div>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded flex-shrink-0 ${
                              isHighlighted ? "bg-certifica-accent/20 text-certifica-accent-dark" : "bg-certifica-100 text-certifica-500/70"
                            }`}>
                              {typeLabels[r.type]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Notifications ── */}
            <div ref={notifRef} className="relative">
              <button
                onClick={() => { setNotifOpen((p) => !p); setHelpOpen(false); }}
                className="relative p-1.5 text-certifica-500/60 hover:text-certifica-dark transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" strokeWidth={1.5} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center" style={{ fontWeight: 600 }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {notifOpen && (
                <div className="absolute top-full right-0 mt-1 w-[300px] sm:w-[380px] bg-white border border-certifica-200 rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-certifica-100">
                    <span className="text-[13px] text-certifica-dark" style={{ fontWeight: 600 }}>
                      Notificações
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="flex items-center gap-1 text-[11px] text-certifica-accent hover:text-certifica-accent-dark transition-colors cursor-pointer"
                      >
                        <CheckCheck className="w-3 h-3" />
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-10 text-center text-[12px] text-certifica-500/60">
                        Nenhuma notificação
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const NIcon = notifIcons[n.tipo] || Info;
                        const color = notifColors[n.tipo] || "text-gray-500";
                        return (
                          <div
                            key={n.id}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-certifica-50 transition-colors border-b border-certifica-50 ${
                              !n.lida ? "bg-blue-50/40" : ""
                            }`}
                          >
                            <NIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`} strokeWidth={1.5} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[12px] text-certifica-dark" style={{ fontWeight: n.lida ? 400 : 500 }}>
                                  {n.titulo}
                                </span>
                                {!n.lida && (
                                  <button
                                    onClick={() => handleMarkAsRead(n.id)}
                                    className="text-certifica-500/40 hover:text-certifica-accent flex-shrink-0 cursor-pointer transition-colors"
                                    title="Marcar como lida"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                              <div className="text-[11px] text-certifica-500/60 mt-0.5 line-clamp-2">{n.mensagem}</div>
                              <div className="text-[9.5px] text-certifica-500/40 mt-1">
                                {formatRelativeTime(n.created_at)}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Help Button ── */}
            <button
              onClick={() => { setHelpOpen((p) => !p); setNotifOpen(false); }}
              className={`p-1.5 transition-colors cursor-pointer ${
                helpOpen ? "text-certifica-accent" : "text-certifica-500/40 hover:text-certifica-500"
              }`}
            >
              <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {/* ── Help Panel (slide-over) ── */}
        {helpOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/20 z-40 transition-opacity"
              onClick={() => setHelpOpen(false)}
            />
            <div className="fixed top-0 right-0 h-full w-[320px] sm:w-[380px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between px-5 py-4 border-b border-certifica-200">
                <span className="text-[14px] text-certifica-dark" style={{ fontWeight: 600 }}>
                  Central de Ajuda
                </span>
                <button
                  onClick={() => setHelpOpen(false)}
                  className="p-1 text-certifica-500/40 hover:text-certifica-500 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Shortcuts */}
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Keyboard className="w-4 h-4 text-certifica-accent" strokeWidth={1.5} />
                    <span className="text-[12.5px] text-certifica-dark" style={{ fontWeight: 600 }}>
                      Atalhos de Teclado
                    </span>
                  </div>
                  <div className="space-y-2">
                    {SHORTCUTS.map((s) => (
                      <div key={s.desc} className="flex items-center justify-between">
                        <span className="text-[11.5px] text-certifica-500">{s.desc}</span>
                        <div className="flex items-center gap-1">
                          {s.keys.map((k) => (
                            <kbd
                              key={k}
                              className="px-1.5 py-0.5 bg-certifica-100 border border-certifica-200 rounded text-[10px] text-certifica-500 min-w-[24px] text-center"
                              style={{ fontWeight: 500, fontFamily: "'Inter', monospace" }}
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-certifica-200 mx-5" />

                {/* Documentation */}
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-certifica-accent" strokeWidth={1.5} />
                    <span className="text-[12.5px] text-certifica-dark" style={{ fontWeight: 600 }}>
                      Documentação
                    </span>
                  </div>
                  <div className="space-y-1">
                    {DOCS.map((d) => (
                      <button
                        key={d.title}
                        onClick={() => {
                          toast.info(`"${d.title}" será disponibilizado em breve.`);
                        }}
                        className="w-full text-left px-3 py-2.5 rounded-md hover:bg-certifica-50 transition-colors cursor-pointer"
                      >
                        <div className="text-[12px] text-certifica-dark" style={{ fontWeight: 500 }}>
                          {d.title}
                        </div>
                        <div className="text-[10.5px] text-certifica-500/60 mt-0.5">{d.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-certifica-200 mx-5" />

                {/* Version / Support */}
                <div className="px-5 py-4">
                  <div className="text-[11px] text-certifica-500/50 space-y-1">
                    <p>Certifica v2.0.0</p>
                    <p>Suporte: suporte@certifica.com.br</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Content */}
        <main id="certifica-main" className="flex-1 overflow-y-auto bg-certifica-50">
          <ErrorBoundary fallbackMessage="Ocorreu um erro ao carregar esta página. Tente novamente.">
            <div key={location.pathname} className="certifica-fade-in h-full">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function getBreadcrumb(pathname: string): string {
  const map: Record<string, string> = {
    "/": "Dashboard",
    "/reunioes": "Reuniões",
    "/chat": "Chat",
    "/clientes": "Empresas",
    "/projetos": "Projetos",
    "/projetos/pipeline": "Kanban",
    "/documentos": "Documentos",
    "/normas": "Normas",
    "/auditorias": "Auditorias",
    "/auditorias/rai": "Relatório de Auditoria",
    "/treinamentos": "Treinamentos",
    "/relatorios": "Relatórios",
    "/configuracoes": "Configurações",
  };
  return map[pathname] || "Certifica";
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Agora mesmo";
  if (mins < 60) return `Há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Há ${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}
