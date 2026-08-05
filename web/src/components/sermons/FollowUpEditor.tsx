"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AiDraftStatus } from "@/types/sermon";

interface FollowUpEditorProps {
  subject: string;
  body: string;
  status: AiDraftStatus;
  canGenerate: boolean;
  message?: string;
  onGenerate: () => void | Promise<void>;
  onSubjectChange: (subject: string) => void;
  onBodyChange: (body: string) => void;
  onSave: () => void;
  onApprove: () => void;
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

function GeneratingSwirl() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-80 flex-col items-center justify-center py-10 text-center"
    >
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 rounded-full border border-green-100" />

        <div
          className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-r-lime-400 border-t-[#012f11]"
          style={{
            animationDuration: "1.1s",
          }}
        />

        <div
          className="absolute inset-4 animate-spin rounded-full border-2 border-transparent border-b-green-300 border-l-green-700"
          style={{
            animationDuration: "1.8s",
            animationDirection: "reverse",
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#012f11] shadow-sm">
            <span
              className="h-3 w-3 rotate-45 rounded-[3px] bg-lime-300"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <h3 className="mt-6 font-semibold text-[#102015]">
        Preparing your follow-up
      </h3>

      <p className="mt-2 max-w-sm text-sm leading-6 text-stone-600">
        After Sunday is reviewing the sermon and preparing takeaways,
        reflection questions, and a pastoral message.
      </p>

      <div className="mt-5 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-900" />
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-700"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-500"
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
  onGenerate,
  onSubjectChange,
  onBodyChange,
  onSave,
  onApprove,
}: FollowUpEditorProps) {
  const statusDetails = statusConfig[status];
  const hasDraft = Boolean(subject.trim() || body.trim());
  const canApprove = Boolean(subject.trim() && body.trim());

  return (
    <Card className="h-full">
      <div className="flex flex-col gap-4 border-b border-[#ddd8c8] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#102015]">
            Follow-up draft
          </h2>

          <p className="mt-1 text-sm leading-6 text-stone-600">
            Generate a starting point, then review and edit it before
            approval.
          </p>
        </div>

        <Badge variant={statusDetails.variant}>
          {statusDetails.label}
        </Badge>
      </div>

    {status === "generating" ? (
    <GeneratingSwirl />
    ) : !hasDraft ? (
        <div className="flex min-h-80 flex-col items-center justify-center py-10 text-center">
          <h3 className="font-semibold text-[#102015]">
            No follow-up draft yet
          </h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-stone-600">
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

          {!canGenerate ? (
            <p className="mt-3 text-xs text-stone-500">
              A reviewed transcript is required before generating a
              draft.
            </p>
          ) : (
            <p className="mt-3 text-xs text-stone-500">
              This currently inserts mocked content. Real AI generation
              will come through FastAPI later.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5 pt-6">
          <div>
            <label
              htmlFor="followUpSubject"
              className="block text-sm font-medium text-stone-800"
            >
              Email subject
            </label>

            <input
              id="followUpSubject"
              value={subject}
              onChange={(event) =>
                onSubjectChange(event.target.value)
              }
              className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none transition focus:border-[#012f11]"
              placeholder="A few reminders from Sunday’s sermon"
            />
          </div>

          <div>
            <label
              htmlFor="followUpBody"
              className="block text-sm font-medium text-stone-800"
            >
              Email message
            </label>

            <textarea
              id="followUpBody"
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              className="mt-2 min-h-[30rem] w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-[#012f11]"
              placeholder="The generated follow-up will appear here..."
            />
          </div>

          <div className="rounded-2xl bg-stone-100 px-4 py-3 text-xs leading-5 text-stone-600">
            AI-generated content must be reviewed and approved by church
            staff before it can be sent.
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-green-800">
              {message}
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
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