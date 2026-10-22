import { useEffect, useState } from "react";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "../../components/ui/Modal";
import { FormField, Textarea } from "../../components/ui/Input";
import Button from "../../components/ui/Button";

export default function RejectPlanRequestDialog({
  open,
  onClose,
  onConfirm,
  targetRequest,
  loading = false,
}) {
  const [reason, setReason] = useState("");

  // Clear any leftover text from a previous rejection whenever the dialog
  // opens for a new request.
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title="Reject upgrade request"
        description={
          targetRequest
            ? `"${targetRequest.user?.name}"'s request to upgrade to ${targetRequest.requestedPlan} will be declined.`
            : undefined
        }
        onClose={onClose}
      />
      <ModalBody>
        <FormField
          label="Reason"
          hint="Required for the audit trail and shared with the user."
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="e.g. Please contact billing support to discuss payment options."
            disabled={loading}
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
          variant="danger"
          onClick={() => onConfirm(reason.trim() || undefined)}
          loading={loading}
          disabled={loading || reason.trim().length < 3}
        >
          Reject request
        </Button>
      </ModalFooter>
    </Modal>
  );
}
