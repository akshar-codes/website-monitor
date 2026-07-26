import { useEffect, useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "../../components/ui/Modal";
import { FormField, Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { PLANS } from "../../constants/plans";

const PLAN_OPTIONS = [
  { value: PLANS.FREE, label: "Free" },
  { value: PLANS.PRO, label: "Pro" },
  { value: PLANS.UNLIMITED, label: "Unlimited" },
];

export default function ChangePlanDialog({
  open,
  onClose,
  onConfirm,
  targetUser,
  loading = false,
}) {
  const [selectedPlan, setSelectedPlan] = useState(
    targetUser?.plan || PLANS.FREE,
  );

  useEffect(() => {
    if (open && targetUser) {
      setSelectedPlan(targetUser.plan || PLANS.FREE);
    }
  }, [open, targetUser]);

  const unchanged = selectedPlan === targetUser?.plan;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title="Change subscription plan"
        description={
          targetUser ? `Update the plan for "${targetUser.name}".` : undefined
        }
        onClose={onClose}
      />
      <ModalBody>
        <FormField label="Plan">
          <Select
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
            disabled={loading}
          >
            {PLAN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormField>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} type="button" disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => onConfirm(selectedPlan)}
          loading={loading}
          disabled={loading || unchanged}
        >
          Update plan
        </Button>
      </ModalFooter>
    </Modal>
  );
}
