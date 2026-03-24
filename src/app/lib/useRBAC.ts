import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "./supabase";

interface UserProfile {
  id: string;
  nome: string;
  email: string;
  role_id: string;
  avatar_url: string | null;
  role_nome?: string;
  permissoes?: Record<string, boolean>;
}

const ROUTE_PERMISSIONS: Record<string, string> = {
  "/": "dashboard",
  "/reunioes": "reunioes",
  "/chat": "chat",
  "/clientes": "clientes",
  "/projetos": "projetos",
  "/projetos/pipeline": "pipeline",
  "/documentos": "documentos",
  "/auditorias": "auditorias",
  "/auditorias/rai": "auditorias",
  "/normas": "normas",
  "/treinamentos": "treinamentos",
  "/relatorios": "relatorios",
  "/configuracoes": "configuracoes",
  "/chatbot": "configuracoes",
};

const STORAGE_KEY = "certifica_user_profile";

// App always uses real Supabase (URL is hardcoded in supabase.ts)
const IS_REAL_SUPABASE = true;

const DEMO_PROFILE: UserProfile = {
  id: "local",
  nome: "Carlos Silva",
  email: "carlos@certifica.com",
  role_id: "admin",
  avatar_url: null,
  role_nome: "Administrador",
  permissoes: {},
};

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
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*, roles(nome, permissoes)")
          .eq("user_id", user.id)
          .single();

        if (profileData) {
          const p: UserProfile = {
            id: profileData.id,
            nome: profileData.nome,
            email: profileData.email,
            role_id: profileData.role_id,
            avatar_url: profileData.avatar_url,
            role_nome: (profileData as any).roles?.nome,
            permissoes: (profileData as any).roles?.permissoes as Record<string, boolean> ?? {},
          };
          setProfile(p);
          setNeedsLogin(false);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
          setLoading(false);
          return;
        }

        // User authenticated but no profile row yet — use email-based default
        const autoProfile: UserProfile = {
          id: user.id,
          nome: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário",
          email: user.email ?? "",
          role_id: "viewer",
          avatar_url: user.user_metadata?.avatar_url ?? null,
          role_nome: "Consultor",
          permissoes: {},
        };
        setProfile(autoProfile);
        setNeedsLogin(false);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(autoProfile));
        setLoading(false);
        return;
      }

      // No authenticated user
      if (IS_REAL_SUPABASE) {
        // Real Supabase configured — require login
        setProfile(null);
        setNeedsLogin(true);
        localStorage.removeItem(STORAGE_KEY);
      } else {
        // Demo / dev mode — use fake profile
        setProfile(DEMO_PROFILE);
        setNeedsLogin(false);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_PROFILE));
      }
    } catch {
      if (!IS_REAL_SUPABASE) {
        setProfile(DEMO_PROFILE);
        setNeedsLogin(false);
      } else {
        setProfile(null);
        setNeedsLogin(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    // Listen to auth state changes (login/logout from anywhere)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        fetchProfile();
      } else if (event === "SIGNED_OUT") {
        localStorage.removeItem(STORAGE_KEY);
        setProfile(null);
        if (IS_REAL_SUPABASE) setNeedsLogin(true);
        else setProfile(DEMO_PROFILE);
      } else if (event === "TOKEN_REFRESHED") {
        fetchProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const canAccess = useCallback(
    (path: string): boolean => {
      if (!profile) return false;
      if (profile.role_nome === "Administrador" || profile.role_id === "admin") return true;
      if (!profile.permissoes || Object.keys(profile.permissoes).length === 0) return true;

      const perm = ROUTE_PERMISSIONS[path];
      if (!perm) return true;
      return profile.permissoes[perm] !== false;
    },
    [profile]
  );

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // no active session
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("certifica_last_route");
    setProfile(null);
    if (IS_REAL_SUPABASE) {
      setNeedsLogin(true);
      window.location.href = "/login";
    } else {
      window.location.href = "/";
    }
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

  return { profile, loading, needsLogin, canAccess, logout, initials, refresh: fetchProfile };
}
