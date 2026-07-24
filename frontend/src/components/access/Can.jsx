import { usePermissions } from "../../hooks/usePermissions";

/**
 * Conditionally renders `children` only when the current user satisfies
 * the given role permission(s) and/or plan feature. Purely a UI-layer
 * convenience for hiding controls the user isn't allowed to use — the
 * backend (see middlewares/resourceAccess.js) remains the sole source of
 * truth and re-checks every one of these on every request.
 *
 * Usage:
 *   <Can permission="monitor:delete"><DeleteButton /></Can>
 *   <Can feature={FEATURES.TEAM_ACCESS} fallback={<UpgradeNudge />}>
 *     <TeamSettingsPanel />
 *   </Can>
 */
export default function Can({
  permission,
  anyPermission,
  feature,
  fallback = null,
  children,
}) {
  const { can, canAny, hasFeature } = usePermissions();

  if (permission && !can(permission)) return fallback;
  if (anyPermission?.length && !canAny(anyPermission)) return fallback;
  if (feature && !hasFeature(feature)) return fallback;

  return children;
}
