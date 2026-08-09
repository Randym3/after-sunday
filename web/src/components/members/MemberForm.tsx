"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type {
  CreateMemberInput,
  Member,
  MemberStatus,
} from "@/types/member";

interface MemberFormProps {
  member?: Member | null;
  onCancel: () => void;
  onSubmit: (values: CreateMemberInput) => Promise<void>;
}

const inputClass =
  "w-full rounded-xl border border-[#ddd8c8] bg-white px-3 py-2 text-sm outline-none transition focus:border-[#012f11]";

export function MemberForm({
  member,
  onCancel,
  onSubmit,
}: MemberFormProps) {
  const [firstName, setFirstName] = useState(member?.firstName ?? "");
  const [lastName, setLastName] = useState(member?.lastName ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [status, setStatus] = useState<MemberStatus>(
    member?.status ?? "active"
  );
  const [notes, setNotes] = useState(member?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitting(true);

    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        status,
        notes: notes.trim() || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-[#102015]">
        {member ? "Edit member" : "Add member"}
      </h2>

      <form
        onSubmit={handleSubmit}
        className="mt-5 space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="memberFirstName"
              className="mb-1 block text-sm font-medium text-stone-800"
            >
              First name
            </label>
            <input
              id="memberFirstName"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="memberLastName"
              className="mb-1 block text-sm font-medium text-stone-800"
            >
              Last name
            </label>
            <input
              id="memberLastName"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="memberEmail"
              className="mb-1 block text-sm font-medium text-stone-800"
            >
              Email
            </label>
            <input
              id="memberEmail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="member@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="memberPhone"
              className="mb-1 block text-sm font-medium text-stone-800"
            >
              Phone <span className="text-stone-400">(optional)</span>
            </label>
            <input
              id="memberPhone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="memberStatus"
            className="mb-1 block text-sm font-medium text-stone-800"
          >
            Status
          </label>
          <select
            id="memberStatus"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as MemberStatus)
            }
            className={inputClass}
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="memberNotes"
            className="mb-1 block text-sm font-medium text-stone-800"
          >
            Notes <span className="text-stone-400">(optional)</span>
          </label>
          <textarea
            id="memberNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y leading-6`}
            placeholder="Anything worth remembering about this member…"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting
              ? "Saving…"
              : member
                ? "Save changes"
                : "Add member"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
