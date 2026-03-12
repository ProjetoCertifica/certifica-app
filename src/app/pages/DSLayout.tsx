import React from "react";
import { Outlet, NavLink, useLocation } from "react-router";
import {
  Palette,
  Type,
  MousePointerClick,
  FormInput,
  Tag,
  Table2,
  LayoutGrid,
  Shield,
  FileText,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { path: "/", label: "Visao Geral", icon: Shield },
  { path: "/tokens", label: "Tokens", icon: Palette },
  { path: "/tipografia", label: "Tipografia", icon: Type },
  { path: "/botoes", label: "Botoes", icon: MousePointerClick },
  { path: "/inputs", label: "Inputs", icon: FormInput },
  { path: "/badges", label: "Badges", icon: Tag },
  { path: "/tabelas", label: "Tabelas", icon: Table2 },
  { path: "/cards", label: "Cards", icon: LayoutGrid },
  { path: "/formularios", label: "Formularios", icon: FileText },
];

export default function DSLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <aside className="w-[240px] flex-shrink-0 bg-certifica-900 flex flex-col border-r border-certifica-800 overflow-y-auto">
        {/* Logo area */}
        <div className="px-5 py-5 border-b border-certifica-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/10 rounded-[3px] flex items-center justify-center">
              <Shield className="w-4.5 h-4.5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <div className="text-[14px] text-white tracking-[0.02em]" style={{ fontWeight: 600 }}>
                CERTIFICA
              </div>
              <div className="text-[10px] text-certifica-200/50 tracking-[0.08em] uppercase" style={{ fontWeight: 400 }}>
                Design System
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3">
          <div className="mb-2 px-2">
            <span className="text-[10px] tracking-[0.1em] uppercase text-certifica-200/40" style={{ fontWeight: 600 }}>
              Componentes
            </span>
          </div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-[3px] mb-0.5 transition-colors duration-150 group ${
                  isActive
                    ? "bg-certifica-800 text-white"
                    : "text-certifica-200/60 hover:bg-certifica-800/50 hover:text-certifica-200/90"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                <span className="text-[13px] flex-1" style={{ fontWeight: isActive ? 500 : 400 }}>
                  {item.label}
                </span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-40" strokeWidth={1.5} />}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-certifica-800/60">
          <div className="text-[10px] text-certifica-200/30 tracking-[0.04em]" style={{ fontWeight: 400 }}>
            v1.0.0 &middot; Fev 2026
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-[48px] flex-shrink-0 bg-white border-b border-certifica-200 flex items-center px-6 justify-between">
          <div className="flex items-center gap-2 text-[12px] text-certifica-500" style={{ fontWeight: 400 }}>
            <span>CERTIFICA</span>
            <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
            <span className="text-certifica-dark" style={{ fontWeight: 500 }}>
              {navItems.find((n) => n.path === location.pathname)?.label || "Design System"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] tracking-[0.04em] uppercase text-certifica-500 bg-certifica-50 border border-certifica-200 rounded-[2px] px-2 py-0.5" style={{ fontWeight: 600 }}>
              ISO 9001
            </span>
            <span className="text-[11px] tracking-[0.04em] uppercase text-certifica-500 bg-certifica-50 border border-certifica-200 rounded-[2px] px-2 py-0.5" style={{ fontWeight: 600 }}>
              ISO 14001
            </span>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-certifica-50">
          <div className="max-w-[1080px] mx-auto px-8 py-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
