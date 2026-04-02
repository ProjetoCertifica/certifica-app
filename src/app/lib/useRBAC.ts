import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabase";

/* ── Types ── */

export type PermissionLevel = "nenhum" | "leitura" | "edicao" | "admin";

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  role_id: string;
  avatar_url: string | null;
  role_nome?: string;
  permissoes?: Record<string, PermissionLevel>;
}

/* ── Modules & Route mapping ── */

export const ALL_MODULES = [
  "Dashboard",
  "Reuniões",
  "Calendário",
  "Chat",
  "Chatbot",
  "Empresas",
  "Consultores",
  "Projetos",
  "Documentos",
  "Auditorias",
  "Normas",
  "Treinamentos",
  "Financeiro",
  "Propostas",
  "Relatórios",
  "Configurações",
] as const;

export type ModuleName = (typeof ALL_MODULES)[number];

/** Maps route paths → module names (must match keys stored in roles.permissions) */
const ROUTE_MODULE: Record<string, ModuleName> = {
  "/": "Dashboard",
  "/reunioes": "Reuniões",
  "/calendario": "Calendário",
  "/chat": "Chat",
  "/chatbot": "Chatbot",
  "/clientes": "Empresas",
  "/contatos": "Empresas",
  "/perfil": "Empresas",
  "/consultores": "Consultores",
  "/projetos": "Projetos",
  "/documentos": "Documentos",
  "/auditorias": "Auditorias",
  "/normas": "Normas",
  "/treinamentos": "Treinamentos",
  "/financeiro": "Financeiro",
  "/propostas": "Propostas",
  "/relatorios": "Relatórios",
  "/configuracoes": "Configurações",
};

const STORAGE_KEY = "certifica_user_profile";

/* ── Hook ── */

export function useRBAC() {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Query profile joined with role — use correct column names
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*, roles(name, permissions)")
          .eq("id", user.id)
          .single();

        if (profileData) {
          const role = (profileData as any).roles;
          const p: UserProfile = {
            id: profileData.id,
            nome: profileData.full_name,
            email: profileData.email,
            role_id: profileData.role_id ?? "",
            avatar_url: profileData.avatar_url,
            role_nome: role?.name ?? "",
            permissoes: (role?.permissions as Record<string, PermissionLevel>) ?? {},
          };
          setProfile(p);
          setNeedsLogin(false);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
          setLoading(false);
          return;
        }

        // User authenticated but no profile row — use email-based default
        const autoProfile: UserProfile = {
          id: user.id,
          nome: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
          email: user.email ?? "",
          role_id: "",
          avatar_url: user.user_metadata?.avatar_url ?? null,
          role_nome: "viewer",
          permissoes: {},
        };
        setProfile(autoProfile);
        setNeedsLogin(false);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(autoProfile));
        setLoading(false);
        return;
      }

      // No authenticated user — require login
      setProfile(null);
      setNeedsLogin(true);
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      setProfile(null);
      setNeedsLogin(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchProfile();
      } else if (event === "SIGNED_OUT") {
        localStorage.removeItem(STORAGE_KEY);
        setProfile(null);
        setNeedsLogin(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  /**
   * Check if user can access a given route.
   * Permission levels: admin/edicao/leitura = allowed, nenhum = blocked.
   * Empty permissions (not yet configured) = full access (safe default).
   */
  const canAccess = useCallback(
    (path: string): boolean => {
      if (!profile) return false;

      // Admin always has full access
      if (profile.role_nome === "admin") return true;

      const perms = profile.permissoes;
      // If no permissions configured yet, allow everything (backwards compat)
      if (!perms || Object.keys(perms).length === 0) return true;

      // Find module for this path (exact match or prefix)
      let mod = ROUTE_MODULE[path];
      if (!mod) {
        for (const [route, m] of Object.entries(ROUTE_MODULE)) {
          if (route !== "/" && path.startsWith(route + "/")) {
            mod = m;
            break;
          }
        }
      }
      if (!mod) return true; // Unknown route → allow

      const level = perms[mod] ?? "leitura";
      return level !== "nenhum";
    },
    [profile]
  );

  /** Can the user edit data in a given module? */
  const canEdit = useCallback(
    (moduleName: ModuleName): boolean => {
      if (!profile) return false;
      if (profile.role_nome === "admin") return true;
      const perms = profile.permissoes;
      if (!perms || Object.keys(perms).length === 0) return true;
      const level = perms[moduleName] ?? "leitura";
      return level === "edicao" || level === "admin";
    },
    [profile]
  );

  const isAdmin = useMemo(() => profile?.role_nome === "admin", [profile]);

  /** Admin and gestor can see all data; consultors/auditors see only their own */
  const canSeeAllData = useMemo(() => {
    if (!profile) return false;
    return ["admin", "gestor"].includes(profile.role_nome ?? "");
  }, [profile]);

  /** The consultant name to use for data filtering */
  const consultorNome = profile?.nome ?? "";

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // no active session
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("certifica_last_route");
    setProfile(null);
    setNeedsLogin(true);
    window.location.href = "/login";
  }, []);

  const initials = useMemo(() => {
    if (!profile?.nome) return "??";
    return profile.nome
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }, [profile]);

  return {
    profile,
    loading,
    needsLogin,
    canAccess,
    canEdit,
    isAdmin,
    canSeeAllData,
    consultorNome,
    logout,
    initials,
    refresh: fetchProfile,
  };
}
