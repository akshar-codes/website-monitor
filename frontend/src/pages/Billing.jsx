import { useState, useCallback } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import CurrentPlanSummary from "../features/plans/CurrentPlanSummary";
import UpgradePrompt from "../features/plans/UpgradePrompt";
import PlanChangeModal from "../features/plans/PlanChangeModal";
import PendingUpgradeBanner from "../features/plans/PendingUpgradeBanner";
import PlanRequestHistory from "../features/plans/PlanRequestHistory";
import UsageDashboard from "../components/usage/UsageDashboard";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import {
  useCurrentPlan,
  usePlanCatalog,
  usePlanChange,
} from "../hooks/usePlans";
import {
  useMyPlanUpgradeRequest,
  useRequestPlanUpgrade,
} from "../hooks/usePlanUpgradeRequests";
import { useUsage } from "../hooks/useUsage";
import { useAuth } from "../hooks/useAuth";
import { getPlanChangeType } from "../utils/planCompare";

/**
 * There is no payment gateway wired up yet, so plan changes split into two
 * flows here:
 *   - Downgrades apply immediately via POST /api/plans/change (no revenue
 *     concern — see usePlans.js#usePlanChange).
 *   - Upgrades submit a PlanUpgradeRequest for admin review instead of
 *     changing the plan directly (see hooks/usePlanUpgradeRequests.js).
 *     Only one pending request is allowed at a time; while one exists,
 *     every plan-change action is disabled and a banner explains why.
 */
export default function Billing() {
  const { refetchUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [actionPlanId, setActionPlanId] = useState(null);
  const [pendingDowngrade, setPendingDowngrade] = useState(null);
  const [pendingUpgrade, setPendingUpgrade] = useState(null);

  const {
    data: currentPlanData,
    loading: currentPlanLoading,
    refetch: refetchCurrentPlan,
  } = useCurrentPlan();
  const { data: catalogData, loading: catalogLoading } = usePlanCatalog();
  const {
    data: usageData,
    loading: usageLoading,
    refetch: refetchUsage,
  } = useUsage();
  const {
    data: upgradeRequestData,
    loading: upgradeRequestLoading,
    refetch: refetchUpgradeRequest,
  } = useMyPlanUpgradeRequest();

  const currentPlan = currentPlanData?.data;
  const plans = catalogData?.data || [];
  const usage = usageData?.data;
  const pendingRequest = upgradeRequestData?.data?.pending || null;
  const requestHistory = upgradeRequestData?.data?.history || [];

  const handleDowngradeSuccess = async () => {
    setActionPlanId(null);
    setModalOpen(false);
    await Promise.all([refetchCurrentPlan(), refetchUser(), refetchUsage()]);
  };

  const handleUpgradeRequestSuccess = async () => {
    setActionPlanId(null);
    setPendingUpgrade(null);
    setModalOpen(false);
    await refetchUpgradeRequest();
  };

  const { changePlan } = usePlanChange(handleDowngradeSuccess);
  const { requestUpgrade } = useRequestPlanUpgrade(handleUpgradeRequestSuccess);

  const handleSelectPlan = useCallback(
    async (planId) => {
      const targetPlan = plans.find((p) => p.id === planId);
      const changeType = getPlanChangeType(
        currentPlan?.plan,
        targetPlan,
        plans,
      );

      if (changeType === "downgrade") {
        setPendingDowngrade(planId);
        return;
      }

      if (changeType === "upgrade") {
        setPendingUpgrade(planId);
        return;
      }

      setActionPlanId(planId);

      const result =
        changeType === "upgrade"
          ? await requestUpgrade(planId)
          : await changePlan(planId);

      if (!result) {
        setActionPlanId(null);
      }
    },
    [plans, currentPlan, requestUpgrade, changePlan],
  );

  const handleModalClose = () => {
    if (!actionPlanId && !pendingDowngrade && !pendingUpgrade)
      setModalOpen(false);
  };

  const handleConfirmUpgrade = async () => {
    if (!pendingUpgrade) return;
    setActionPlanId(pendingUpgrade);
    const result = await requestUpgrade(pendingUpgrade);
    if (!result) setActionPlanId(null);
    setPendingUpgrade(null);
  };

  const handleConfirmDowngrade = async () => {
    if (!pendingDowngrade) return;
    setActionPlanId(pendingDowngrade);
    const result = await changePlan(pendingDowngrade);
    if (!result) {
      setActionPlanId(null);
    }
    setPendingDowngrade(null);
  };

  const handleRefresh = () => {
    refetchCurrentPlan();
    refetchUsage();
    refetchUpgradeRequest();
  };

  const pendingPlanName =
    pendingRequest &&
    (plans.find((p) => p.id === pendingRequest.requestedPlan)?.name ||
      pendingRequest.requestedPlan);

  return (
    <PageContainer>
      <PageHeader
        title="Billing & Plan"
        subtitle="Manage your subscription plan and view your current usage"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        }
        className="mb-6"
      />

      {!upgradeRequestLoading && pendingRequest && (
        <div className="mb-6">
          <PendingUpgradeBanner planName={pendingPlanName} />
        </div>
      )}

      {!upgradeRequestLoading && requestHistory.length > 0 && (
        <PlanRequestHistory
          requests={requestHistory}
          getPlanName={(planId) =>
            plans.find((plan) => plan.id === planId)?.name || planId
          }
        />
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CurrentPlanSummary
          currentPlan={currentPlan}
          loading={currentPlanLoading}
        />
        <UsageDashboard usage={usage} loading={usageLoading} />
      </div>

      {currentPlan?.plan && (
        <div className="mb-6">
          <UpgradePrompt
            plan={currentPlan.plan}
            onUpgradeClick={() => setModalOpen(true)}
          />
        </div>
      )}

      <div className="rounded-xl border border-border-subtle bg-bg-surface p-6">
        <div className="mb-1 flex items-center gap-2">
          <CreditCard size={16} className="text-text-secondary" />
          <p className="text-sm font-semibold text-white">Available plans</p>
        </div>
        <p className="mb-5 text-xs text-text-muted">
          Downgrades apply immediately. Upgrades require admin approval since no
          payment gateway is connected yet.
        </p>
        <Button variant="primary" size="md" onClick={() => setModalOpen(true)}>
          Compare & change plan
        </Button>
      </div>

      <PlanChangeModal
        open={modalOpen}
        onClose={handleModalClose}
        plans={plans}
        currentPlanId={currentPlan?.plan}
        loading={catalogLoading}
        changingPlan={actionPlanId}
        pendingRequest={pendingRequest}
        onSelectPlan={handleSelectPlan}
        getChangeType={(targetId) => {
          const targetPlan = plans.find((p) => p.id === targetId);
          return getPlanChangeType(currentPlan?.plan, targetPlan, plans);
        }}
      />

      <ConfirmDialog
        open={!!pendingDowngrade}
        onClose={() => setPendingDowngrade(null)}
        onConfirm={handleConfirmDowngrade}
        title="Downgrade Plan?"
        description="Are you sure you want to downgrade your plan? You may need to request admin approval to restore paid plan access."
        confirmLabel="Downgrade"
        confirmVariant="danger"
      />
      <ConfirmDialog
        open={!!pendingUpgrade}
        onClose={() => !actionPlanId && setPendingUpgrade(null)}
        onConfirm={handleConfirmUpgrade}
        title="Request a plan upgrade?"
        description="This submits an upgrade request for administrator review. Your current plan stays active until the request is approved."
        confirmLabel="Submit request"
        confirmVariant="primary"
        loading={!!actionPlanId}
      />
    </PageContainer>
  );
}
