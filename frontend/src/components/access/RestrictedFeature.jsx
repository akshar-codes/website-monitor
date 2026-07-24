import { Lock } from "lucide-react";
import { usePermissions } from "../../hooks/usePermissions";
import Button from "../ui/Button";

/**
 * Wraps a plan-gated feature. Renders `children` when the current plan
 * includes `feature`; otherwise renders an inline locked placeholder with
 * an upgrade call-to-action, sized for use inside a card or panel. For a
 * full-page block (e.g. an entire route), use pages/UpgradeRequired.jsx
 * via <PlanProtectedRoute> instead.
 */
export default function RestrictedFeature({
  feature,
  title = "This feature isn't available on your plan",
  description = "Upgrade to unlock this feature.",
  onUpgradeClick,
  children,
}) {
  const { hasFeature, loading } = usePermissions();

  if (loading) return null;
  if (hasFeature(feature)) return children;

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-default bg-bg-elevated px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10">
        <Lock size={18} className="text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 max-w-xs text-xs text-text-muted">{description}</p>
      </div>
      {onUpgradeClick && (
        <Button variant="primary" size="sm" onClick={onUpgradeClick}>
          View plans
        </Button>
      )}
    </div>
  );
}
