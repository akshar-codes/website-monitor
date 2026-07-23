import { Modal, ModalHeader, ModalBody } from "../../components/ui/Modal";
import PlanCard from "./PlanCard";
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
}) {
  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-3xl">
      <ModalHeader
        title="Choose a plan"
        description="Upgrade or downgrade at any time — changes apply immediately."
        onClose={onClose}
      />
      <ModalBody className="max-h-[70vh] overflow-y-auto">
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
                disabled={!!changingPlan && changingPlan !== plan.id}
                onSelect={onSelectPlan}
              />
            ))}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
