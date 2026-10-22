import { useEffect, useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "../../components/ui/Modal";
import { FormField, Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { PLAN_VALUES } from "../../constants/plans";

export default function ApprovePlanRequestDialog({
  open,
  onClose,
  onConfirm,
  targetRequest,
  loading = false,
}) {
  const [grantedPlan, setGrantedPlan] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    if (open && targetRequest) {
      setGrantedPlan(targetRequest.requestedPlan);
      setReason("");
      setExpiresAt("");
    }
  }, [open, targetRequest]);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title="Approve upgrade request"
        description={
          targetRequest
            ? `"${targetRequest.user?.name}" will be upgraded and notified immediately.`
            : undefined
        }
        onClose={onClose}
      />
      <ModalBody>
        <FormField
          label="Plan to grant"
          hint="You can override the originally requested plan."
        >
          <Select
            value={grantedPlan}
            onChange={(e) => setGrantedPlan(e.target.value)}
            disabled={loading}
          >
            {PLAN_VALUES.map((planId) => (
              <option key={planId} value={planId}>
                {planId.charAt(0).toUpperCase() + planId.slice(1)}{" "}
                {targetRequest?.requestedPlan === planId ? "(Requested)" : ""}
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
        <FormField label="Expiry date (optional)">
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
            onConfirm({
              grantedPlan:
                grantedPlan === targetRequest?.requestedPlan
                  ? undefined
                  : grantedPlan,
              reason: reason.trim(),
              expiresAt: expiresAt
                ? new Date(expiresAt).toISOString()
                : undefined,
            })
          }
          loading={loading}
          disabled={loading || reason.trim().length < 3}
        >
          Approve request
        </Button>
      </ModalFooter>
    </Modal>
  );
}
