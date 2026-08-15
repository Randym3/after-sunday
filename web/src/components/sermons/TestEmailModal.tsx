"use client";

import { FormEvent, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { Member } from "@/types/member";

export interface TestEmailRecipient {
  email?: string;
  memberId?: string;
}

interface TestEmailModalProps {
  open: boolean;
  onClose: () => void;
  subject: string;
  members: Member[];
  membersLoading: boolean;
  sending: boolean;
  onSend: (recipient: TestEmailRecipient) => void | Promise<void>;
}

const inputClass =
  "mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary";

export function TestEmailModal({
  open,
  onClose,
  subject,
  members,
  membersLoading,
  sending,
  onSend,
}: TestEmailModalProps) {
  const [mode, setMode] = useState<"member" | "email">("member");
  const [memberId, setMemberId] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (mode === "member") {
      if (!memberId) {
        setError("Choose a member to receive the test email.");
        return;
      }
      void Promise.resolve(onSend({ memberId })).catch((sendError: unknown) => {
        setError(
          sendError instanceof Error
            ? sendError.message
            : "Unable to send the test email.",
        );
      });
      return;
    }

    const normalizedEmail = email.trim();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    void Promise.resolve(onSend({ email: normalizedEmail })).catch((sendError: unknown) => {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "Unable to send the test email.",
      );
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      widthClass="max-w-md"
      labelledBy="test-email-title"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="test-email-title" className="text-xl font-semibold text-ink">
            Send a test email
          </h2>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            Preview this draft in a real inbox. Test emails can be sent before
            or after approval.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full px-2 py-1 text-xl leading-none text-ink-soft transition hover:bg-panel-2 hover:text-ink"
          aria-label="Close test email dialog"
        >
          ×
        </button>
      </div>

      <div className="mt-5 rounded-2xl bg-panel-2 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Subject
        </p>
        <p className="mt-1 truncate text-sm font-medium text-ink">{subject}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <fieldset>
          <legend className="text-sm font-semibold text-ink">
            Who should receive it?
          </legend>
          <div className="mt-3 flex gap-5 text-sm text-ink">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={mode === "member"}
                onChange={() => setMode("member")}
                className="accent-primary"
              />
              Select a member
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={mode === "email"}
                onChange={() => setMode("email")}
                className="accent-primary"
              />
              Enter an email
            </label>
          </div>
        </fieldset>

        {mode === "member" ? (
          <div>
            <label htmlFor="testEmailMember" className="block text-sm font-semibold text-ink">
              Member
            </label>
            <select
              id="testEmailMember"
              value={memberId}
              onChange={(event) => setMemberId(event.target.value)}
              className={inputClass}
              disabled={membersLoading || sending}
            >
              <option value="">
                {membersLoading ? "Loading members…" : "Choose a member"}
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstName} {member.lastName} — {member.email}
                </option>
              ))}
            </select>
            {!membersLoading && members.length === 0 ? (
              <p className="mt-2 text-xs text-ink-soft">
                No members found. Enter an email address instead.
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <label htmlFor="testEmailAddress" className="block text-sm font-semibold text-ink">
              Email address
            </label>
            <input
              id="testEmailAddress"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
              placeholder="you@example.com"
              disabled={sending}
            />
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button type="submit" disabled={sending || (mode === "member" && membersLoading)}>
            {sending ? "Sending…" : "Send test email"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
