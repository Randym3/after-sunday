import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AiDraftStatus } from "@/types/sermon";

interface EmailPreviewProps {
  subject: string;
  body: string;
  status: AiDraftStatus;
}

function replacePreviewVariables(value: string) {
  return value.replace(
    /\{\{\s*firstName\s*\}\}/g,
    "Jordan"
  );
}

export function EmailPreview({
  subject,
  body,
  status,
}: EmailPreviewProps) {
  const previewSubject =
    subject.trim() || "Your email subject will appear here";

  const previewBody = body.trim()
    ? replacePreviewVariables(body)
    : "Generate a follow-up draft to preview the email church members will receive.";

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
            Member preview
          </p>

          <h2 className="mt-2 text-xl font-semibold text-ink">
            Email preview
          </h2>
        </div>

        <Badge
          variant={status === "approved" ? "success" : "warning"}
        >
          {status === "approved" ? "Approved" : "Draft"}
        </Badge>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl border border-[#ddd8c8] bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
          <p className="text-xs text-stone-500">Subject</p>

          <p className="mt-1 text-sm font-semibold text-stone-900">
            {previewSubject}
          </p>
        </div>

        <div className="px-6 py-8">
          <div className="mb-8">
            <p className="text-lg font-semibold text-primary">
              After Sunday
            </p>

            <p className="mt-1 text-xs text-stone-500">
              A follow-up from your church
            </p>
          </div>

          <div className="whitespace-pre-wrap text-sm leading-7 text-stone-700">
            {previewBody}
          </div>

          <div className="mt-10 border-t border-stone-200 pt-5 text-xs leading-5 text-stone-500">
            You are receiving this message as part of your church’s
            pastoral follow-up.
          </div>
        </div>
      </div>
    </Card>
  );
}