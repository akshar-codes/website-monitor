import { useCallback, useEffect, useMemo, useState } from "react";
import { PermissionsContext } from "../contexts/PermissionsContext";
import { useAuth } from "../hooks/useAuth";
import * as plansApi from "../services/api/plans";
import { planHasFeature } from "../constants/features";

/**
 * Role-based permissions now come straight from `user.permissions` — a
 * field the backend serializes onto every user document via a Mongoose
 * virtual (see backend/src/models/User.js) that reads
 * backend/src/config/permissions.js. That means this context no longer
 * needs its own copy of the role→permission map (the old
 * frontend/src/constants/permissions.js has been removed); there's now
 * exactly one place that mapping is defined, and it can never drift
 * between frontend and backend.
 *
 * Plan-gated feature flags still require a dedicated fetch, since they're
 * derived from the plan *definition* (limits), not from the user document
 * itself — fetched ONCE at the app root so components using
 * `usePermissions()` — including many instances of <Can> or
 * <RestrictedFeature> on the same page — never trigger their own
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
    const request = setTimeout(loadPlan, 0);
    return () => clearTimeout(request);
  }, [loadPlan]);

  const value = useMemo(() => {
    const userPermissions = user?.permissions || [];

    const can = (permission) => userPermissions.includes(permission);
    const canAny = (permissions = []) => permissions.some(can);
    const canAll = (permissions = []) => permissions.every(can);
    const hasFeature = (featureKey) =>
      planHasFeature(planDefinition, featureKey);

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
