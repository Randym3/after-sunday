"use client";

import { useState } from "react";

import { ApiError } from "@/lib/api/client";
import { createMember } from "@/lib/api/members";
import type { CreateMemberInput } from "@/types/member";
import type { Group } from "@/types/group";

import { MemberForm } from "@/components/members/MemberForm";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface MemberFormModalProps {
  open: boolean;
  onClose: () => void;
  groups?: Group[];
  groupsLoading?: boolean;
}

export function MemberFormModal({ open, onClose, groups, groupsLoading = false }: MemberFormModalProps) {
  const { toast } = useToast();
  const [error, setError] = useState("");

  async function handleSubmit(values: CreateMemberInput) {
    setError("");
    try {
      await createMember(values);
      toast("Member added", "success");
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not add member.";
      setError(message);
      toast(message, "error");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      widthClass="max-w-lg"
      labelledBy="member-form-modal-title"
      // Flat white panel: the modal is its own surface, so no card border/shadow.
      panelClass="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-panel p-6"
    >
      {error ? (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {error}
        </div>
      ) : null}

      <MemberForm
        embedded
        availableGroups={groups}
        groupsLoading={groupsLoading}
        onCancel={onClose}
        onSubmit={handleSubmit}
      />
    </Modal>
  );
}
