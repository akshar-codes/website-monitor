import { useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import CurrentPlanSummary from "../features/plans/CurrentPlanSummary";
import UpgradePrompt from "../features/plans/UpgradePrompt";
import PlanChangeModal from "../features/plans/PlanChangeModal";
import Button from "../components/ui/Button";
import {
  useCurrentPlan,
  usePlanCatalog,
  usePlanChange,
} from "../hooks/usePlans";
import { useAuth } from "../hooks/useAuth";
import { getPlanChangeType } from "../utils/planCompare";

export default function Billing() {
  const { refetchUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [changingPlan, setChangingPlan] = useState(null);

  const {
    data: currentPlanData,
    loading: currentPlanLoading,
    refetch: refetchCurrentPlan,
  } = useCurrentPlan();
  const { data: catalogData, loading: catalogLoading } = usePlanCatalog();

  const currentPlan = currentPlanData?.data;
  const plans = catalogData?.data || [];

  const handlePlanChangeSuccess = async () => {
    setChangingPlan(null);
    setModalOpen(false);
    await Promise.all([refetchCurrentPlan(), refetchUser()]);
  };

  const { changePlan } = usePlanChange(handlePlanChangeSuccess);

  const handleSelectPlan = async (planId) => {
    setChangingPlan(planId);
    const result = await changePlan(planId);
    if (!result) setChangingPlan(null);
  };

  const handleModalClose = () => {
    if (!changingPlan) setModalOpen(false);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Billing & Plan"
        subtitle="Manage your subscription plan and view your current limits"
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={refetchCurrentPlan}
          >
            Refresh
          </Button>
        }
        className="mb-6"
      />

      <div className="mb-6">
        <CurrentPlanSummary
          currentPlan={currentPlan}
          loading={currentPlanLoading}
        />
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
          Compare plans and switch at any time.
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
        changingPlan={changingPlan}
        onSelectPlan={handleSelectPlan}
        getChangeType={(targetId) => {
          const targetPlan = plans.find((p) => p.id === targetId);
          return getPlanChangeType(currentPlan?.plan, targetPlan, plans);
        }}
      />
    </PageContainer>
  );
}
