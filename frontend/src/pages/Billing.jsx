import { useState, useCallback } from "react";
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

const EMPTY_PLANS = Object.freeze([]);

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
  const plans = catalogData?.data || EMPTY_PLANS;
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

  return null;
}
