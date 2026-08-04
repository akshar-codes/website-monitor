import { Modal, ModalHeader, ModalBody } from "../../components/ui/Modal";
import PlanCard from "./PlanCard";
import PendingUpgradeBanner from "./PendingUpgradeBanner";
import { Skeleton } from "../../components/ui/Skeleton";

export default function PlanChangeModal({
  open,
  onClose,
  plans = [],
  currentPlanId,
  loading = false,
  changingPlan,
  onSelectPlan,
  getChangeType,
  pendingRequest = null,
}) {
  const pendingPlanName =
    pendingRequest &&
    (plans.find((p) => p.id === pendingRequest.requestedPlan)?.name ||
      pendingRequest.requestedPlan);

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-3xl">
      <ModalHeader
        title="Choose a plan"
        description="Downgrades apply immediately. Upgrades are reviewed by an administrator before taking effect."
        onClose={onClose}
      />
      <ModalBody className="max-h-[70vh] overflow-y-auto">
        {pendingRequest && (
          <PendingUpgradeBanner planName={pendingPlanName} className="mb-5" />
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={plan.id === currentPlanId}
                changeType={getChangeType?.(plan.id)}
                loading={changingPlan === plan.id}
                disabled={
                  !!pendingRequest ||
                  (!!changingPlan && changingPlan !== plan.id)
                }
                onSelect={onSelectPlan}
              />
            ))}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
