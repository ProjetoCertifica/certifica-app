import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { Setting, SettingInsert, Profile, Role } from "./database.types";

export type { Setting, Profile, Role };

export function useSettings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [profiles, setProfiles] = useState<(Profile & { role?: Role })[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, profilesRes, rolesRes] = await Promise.all([
        supabase.from("settings").select("*").order("categoria").order("chave"),
        supabase.from("profiles").select(`*, roles(*)`).eq("active", true).order("full_name"),
        supabase.from("roles").select("*").order("name"),
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      setSettings(settingsRes.data ?? []);
      setProfiles(
        (profilesRes.data ?? []).map((p: any) => ({
          ...p,
          role: p.roles ?? undefined,
        }))
      );
      setRoles(rolesRes.data ?? []);
    } catch (err: any) {
      setError(err.message ?? "Erro ao carregar configurações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getSetting = useCallback(
    (chave: string): unknown => {
      const s = settings.find((s) => s.chave === chave);
      return s?.valor ?? null;
    },
    [settings]
  );

  const upsertSetting = useCallback(
    async (chave: string, valor: unknown, categoria: Setting["categoria"] = "geral", descricao = ""): Promise<boolean> => {
      const existing = settings.find((s) => s.chave === chave);
      if (existing) {
        const { error: err } = await supabase
          .from("settings")
          .update({ valor })
          .eq("id", existing.id);
        if (err) {
          setError(err.message);
          return false;
        }
        setSettings((prev) =>
          prev.map((s) => (s.id === existing.id ? { ...s, valor } : s))
        );
      } else {
        const { data: inserted, error: err } = await supabase
          .from("settings")
          .insert({ chave, valor, categoria, descricao })
          .select()
          .single();
        if (err) {
          setError(err.message);
          return false;
        }
        setSettings((prev) => [...prev, inserted]);
      }
      return true;
    },
    [settings]
  );

  const saveAllSettings = useCallback(
    async (updates: Record<string, unknown>): Promise<boolean> => {
      const promises = Object.entries(updates).map(([chave, valor]) =>
        upsertSetting(chave, valor)
      );
      const results = await Promise.all(promises);
      return results.every(Boolean);
    },
    [upsertSetting]
  );

  const updateProfile = useCallback(
    async (id: string, data: Partial<Profile>): Promise<boolean> => {
      const { error: err } = await supabase
        .from("profiles")
        .update(data)
        .eq("id", id);
      if (err) {
        setError(err.message);
        return false;
      }
      await load();
      return true;
    },
    [load]
  );

  const deactivateProfile = useCallback(
    async (id: string): Promise<boolean> => {
      return updateProfile(id, { active: false });
    },
    [updateProfile]
  );

  return {
    settings,
    profiles,
    roles,
    loading,
    error,
    load,
    getSetting,
    upsertSetting,
    saveAllSettings,
    updateProfile,
    deactivateProfile,
  };
}
