import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "../hooks/useAuth";
import * as plansApi from "../services/api/plans";
import { roleHasPermission } from "../constants/permissions";
import { planHasFeature } from "../constants/features";

export const PermissionsContext = createContext(null);

/**
 * Fetches the current user's full plan definition (limits) ONCE at the
 * app root and derives role/plan-based access checks from it, so
 * components using `usePermissions()` — including many instances of
 * <Can> or <RestrictedFeature> on the same page — never trigger their own
 * redundant network request. Must be nested inside <AuthProvider>.
 */
export function PermissionsProvider({ children }) {
  const { user } = useAuth();
  const [planDefinition, setPlanDefinition] = useState(null);
  const [loading, setLoading] = useState(!!user);

  const loadPlan = useCallback(async () => {
    if (!user) {
      setPlanDefinition(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await plansApi.getCurrentPlan();
      setPlanDefinition(data?.definition || null);
    } catch {
      setPlanDefinition(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  const value = useMemo(() => {
    const can = (permission) =>
      !!user && roleHasPermission(user.role, permission);
    const canAny = (permissions = []) => permissions.some(can);
    const canAll = (permissions = []) => permissions.every(can);
    const hasFeature = (featureKey) => planHasFeature(planDefinition, featureKey);

    return {
      can,
      canAny,
      canAll,
      hasFeature,
      planDefinition,
      loading,
      refetchPlan: loadPlan,
    };
  }, [user, planDefinition, loading, loadPlan]);

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}
