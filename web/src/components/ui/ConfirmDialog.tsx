"use client";

import { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Plain text or JSX; use the latter for rich review lists. */
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} widthClass="max-w-sm" labelledBy="confirm-dialog-title">
      <h2 id="confirm-dialog-title" className="text-lg font-semibold text-ink">
        {title}
      </h2>

      <div className="mt-2 text-sm leading-6 text-ink-soft">
        {description}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>

        <Button
          type="button"
          className={
            confirmVariant === "danger"
              ? "bg-red-600 hover:bg-red-700"
              : ""
          }
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
