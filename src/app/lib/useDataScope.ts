import type { UserProfile } from "./useRBAC";

const STORAGE_KEY = "certifica_user_profile";

/**
 * Lightweight hook that reads the cached RBAC profile from localStorage.
 * Use this inside data hooks (useFinanceiro, useProjetos, etc.) to filter
 * data by consultant without triggering extra Supabase auth calls.
 *
 * Reads fresh on every render (~0.1ms, synchronous).
 * The consuming useMemo in data hooks compares primitives (canSeeAllData,
 * consultorNome) so downstream recalculations only happen when values change.
 */
export function useDataScope() {
  let profile: UserProfile | null = null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    profile = stored ? JSON.parse(stored) : null;
  } catch {
    /* corrupted localStorage — treat as no profile */
  }

  const roleName = profile?.role_nome ?? "";
  const consultorNome = profile?.nome ?? "";
  const canSeeAllData = ["admin", "gestor"].includes(roleName);

  return { consultorNome, canSeeAllData, roleName, profile };
}
