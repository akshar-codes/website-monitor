import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../utils/cn";

export function Modal({
  open,
  onClose,
  children,
  maxWidthClassName = "max-w-lg",
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(val) => !val && onClose?.()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-full rounded-2xl border border-border-default bg-bg-surface shadow-2xl",
            maxWidthClassName,
            "data-[state=open]:animate-fade-in",
            "focus:outline-none",
          )}
          onInteractOutside={() => onClose?.()}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalHeader({ title, description, onClose }) {
  return (
    <div className="flex items-start justify-between border-b border-border-subtle px-6 py-5">
      <div>
        <Dialog.Title className="text-base font-semibold text-white">
          {title}
        </Dialog.Title>
        {description && (
          <Dialog.Description className="mt-0.5 text-sm text-[#71717a]">
            {description}
          </Dialog.Description>
        )}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#71717a] transition-colors hover:bg-bg-overlay hover:text-white"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children, className }) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

export function ModalFooter({ children, className }) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 border-t border-border-subtle px-6 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
