"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CreateGroupInput, Group } from "@/types/group";

interface GroupFormProps {
  group?: Group | null;
  onCancel: () => void;
  onSubmit: (values: CreateGroupInput) => Promise<void>;
}

const inputClass =
  "w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm text-ink outline-none transition focus:border-primary";

export function GroupForm({ group, onCancel, onSubmit }: GroupFormProps) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">
        {group ? "Edit group" : "Add group"}
      </h2>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div>
          <label
            htmlFor="groupName"
            className="mb-1 block text-sm font-medium text-ink"
          >
            Name
          </label>
          <input
            id="groupName"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="Men's Ministry"
          />
        </div>

        <div>
          <label
            htmlFor="groupDescription"
            className="mb-1 block text-sm font-medium text-ink"
          >
            Description <span className="text-ink-soft">(optional)</span>
          </label>
          <textarea
            id="groupDescription"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y leading-6`}
            placeholder="Who is this group for?"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : group ? "Save changes" : "Add group"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
