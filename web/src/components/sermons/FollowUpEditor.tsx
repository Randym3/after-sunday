"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AiDraftStatus } from "@/types/sermon";
import { useState } from "react";

interface FollowUpEditorProps {
  subject: string;
  body: string;
  status: AiDraftStatus;
  canGenerate: boolean;
  message?: string;
  error?: string;
  generationProgress?: string;
  onGenerate: () => void | Promise<void>;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
  onSave: () => void;
  onApprove: () => void;
  onReject?: () => void | Promise<void>;
}

const statusConfig: Record<
  AiDraftStatus,
  {
    label: string;
    variant: "neutral" | "success" | "warning";
  }
> = {
  not_started: {
    label: "Not generated",
    variant: "neutral",
  },
  generating: {
    label: "Generating",
    variant: "warning",
  },
  draft_ready: {
    label: "Needs review",
    variant: "warning",
  },
  approved: {
    label: "Approved",
    variant: "success",
  },
};

function GeneratingSwirl({ progress }: { progress?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-80 flex-col items-center justify-center py-10 text-center"
    >
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 rounded-full border border-mint/20" />

        <div
          className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-r-primary border-t-primary"
          style={{
            animationDuration: "1.1s",
          }}
        />

        <div
          className="absolute inset-4 animate-spin rounded-full border-2 border-transparent border-b-mint border-l-mint"
          style={{
            animationDuration: "1.8s",
            animationDirection: "reverse",
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-sm">
            <span
              className="h-3 w-3 rotate-45 rounded-[3px] bg-ink"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <h3 className="mt-6 font-semibold text-ink">
        Preparing your follow-up
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-ink-soft">
        {progress ||
          "After Sunday is reviewing the sermon and preparing takeaways, reflection questions, and a pastoral message."}
      </p>

      <div className="mt-5 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint/60"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary"
          style={{ animationDelay: "300ms" }}
        />
      </div>

      <span className="sr-only">
        Generating the sermon follow-up draft.
      </span>
    </div>
  );
}

export function FollowUpEditor({
  subject,
  body,
  status,
  canGenerate,
  message,
  error,
  generationProgress,
  onGenerate,
  onSubjectChange,
  onBodyChange,
  onSave,
  onApprove,
  onReject,
}: FollowUpEditorProps) {
  const statusDetails = statusConfig[status];
  const hasDraft = Boolean(subject.trim() || body.trim());
  const canApprove = Boolean(subject.trim() && body.trim());
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <Card className="h-full">
      <div className="flex flex-col gap-4 border-b border-edge pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink">
            Follow-up draft
          </h2>

          <p className="mt-1 text-sm leading-6 text-ink-soft">
            Generate a starting point, then review and edit it before
            approval.
          </p>
        </div>

        <Badge variant={statusDetails.variant}>
          {statusDetails.label}
        </Badge>
      </div>

    {status === "generating" ? (
    <GeneratingSwirl progress={generationProgress} />
    ) : !hasDraft ? (
        <div className="flex min-h-80 flex-col items-center justify-center py-10 text-center">
          <h3 className="font-semibold text-ink">
            No follow-up draft yet
          </h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-ink-soft">
            After the transcript is ready, generate a pastoral
            follow-up draft based on the sermon.
          </p>

        <div className="mt-6">
        <Button
            type="button"
            onClick={onGenerate}
            disabled={!canGenerate}
        >
            Generate Follow-Up Draft
        </Button>
        </div>

          {error ? (
            <p className="mt-3 break-words text-sm font-medium text-red-400">
              {error}
            </p>
          ) : !canGenerate ? (
            <p className="mt-3 text-xs text-ink-soft">
              A reviewed transcript is required before generating a
              draft.
            </p>
          ) : (
            <p className="mt-3 text-xs text-ink-soft">
              The draft is generated from the reviewed transcript and can
              be edited before approval.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5 pt-6">
          <div>
            <label
              htmlFor="followUpSubject"
              className="block text-sm font-semibold text-ink"
            >
              Email subject
            </label>

            <input
              id="followUpSubject"
              value={subject}
              onChange={(event) =>
                onSubjectChange(event.target.value)
              }
              className="mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
              placeholder="A few reminders from Sunday’s sermon"
            />
          </div>

          <div>
            <label
              htmlFor="followUpBody"
              className="block text-sm font-semibold text-ink"
            >
              Email message
            </label>

            <textarea
              id="followUpBody"
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              className="mt-2 min-h-[30rem] w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm leading-7 text-ink outline-none transition focus:border-primary"
              placeholder="The generated follow-up will appear here..."
            />
          </div>

          <div className="rounded-2xl bg-panel-2 px-4 py-3 text-xs leading-5 text-ink-soft">
            AI-generated content must be reviewed and approved by church
            staff before it can be sent.
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              {error ? (
                <p className="break-words text-sm font-medium text-red-400">
                  {error}
                </p>
              ) : message ? (
                <p className="text-sm font-medium text-mint">
                  {message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {onReject ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setRejectOpen(true)}
                  >
                    Reject Draft
                  </Button>

                  <ConfirmDialog
                    open={rejectOpen}
                    onCancel={() => setRejectOpen(false)}
                    onConfirm={() => {
                      onReject();
                      setRejectOpen(false);
                    }}
                    title="Reject this draft?"
                    description="This will clear the current follow-up draft. You can generate a new one afterwards."
                    confirmLabel="Yes, reject"
                  />
                </>
              ) : null}

              <Button
                type="button"
                variant="secondary"
                onClick={onSave}
              >
                Save Draft
              </Button>

              <Button
                type="button"
                onClick={onApprove}
                disabled={!canApprove || status === "approved"}
              >
                {status === "approved"
                  ? "Draft Approved"
                  : "Approve Draft"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}