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

  useEffect(() => {
    if (open && targetRequest) {
      setGrantedPlan(targetRequest.requestedPlan);
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
            onConfirm(
              grantedPlan === targetRequest?.requestedPlan
                ? undefined
                : grantedPlan,
            )
          }
          loading={loading}
        >
          Approve request
        </Button>
      </ModalFooter>
    </Modal>
  );
}
