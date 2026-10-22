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
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (open && targetUser) {
      setSelectedPlan(targetUser.plan || PLANS.FREE);
      setReason("");
      setExpiresAt("");
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
        <FormField label="Administrative reason">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            className="w-full rounded-md border border-border-default bg-bg-elevated px-3 py-2 text-sm text-white"
            placeholder="Required audit reason"
          />
        </FormField>
        <FormField
          label="Expiry date (optional)"
          hint="Leave blank for no scheduled expiry."
        >
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full rounded-md border border-border-default bg-bg-elevated px-3 py-2 text-sm text-white"
          />
        </FormField>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="ghost"
          onClick={onClose}
          type="button"
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() =>
            onConfirm(selectedPlan, {
              reason: reason.trim(),
              expiresAt: expiresAt
                ? new Date(expiresAt).toISOString()
                : undefined,
            })
          }
          loading={loading}
          disabled={loading || unchanged || reason.trim().length < 3}
        >
          Update plan
        </Button>
      </ModalFooter>
    </Modal>
  );
}
