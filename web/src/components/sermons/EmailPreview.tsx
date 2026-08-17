import type { ReactNode } from "react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { AiDraftStatus } from "@/types/sermon";

interface EmailPreviewProps {
  subject: string;
  body: string;
  status: AiDraftStatus;
  organizationName?: string | null;
}

const numberedItem = /^\s*\d+[.)]\s+(.+)$/;
const takeawaysHeading = /^(one|two|three|four|five|six|seven|eight|nine|ten)\s+takeaways:\s*$/i;
const sectionHeadings: Record<string, string> = {
  "reflection questions:": "Reflection questions",
};

function replacePreviewVariables(value: string) {
  return value.replace(/\{\{\s*firstName\s*\}\}/g, "Jordan");
}

function renderPreviewBody(body: string): ReactNode[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n").map((line) => line.trim());
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let section: string | null = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`paragraph-${blocks.length}`} className="mb-5 text-[15px] leading-7 text-stone-700">
        {paragraph.join("\n")}
      </p>,
    );
    paragraph = [];
  }

  function flushSectionHeading() {
    if (!section) return;
    blocks.push(
      <h3 key={`heading-${blocks.length}`} className="mb-3 mt-7 text-base font-bold text-stone-900">
        {section}
      </h3>,
    );
    section = null;
  }

  function flushList() {
    if (!listItems.length) return;
    const list = (
      <ol className="mt-3 list-decimal space-y-2 pl-6 text-[15px] leading-6 text-stone-700">
        {listItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
      </ol>
    );

    if (section && section.toLowerCase().endsWith("takeaways")) {
      blocks.push(
        <div key={`takeaways-${blocks.length}`} className="mb-6 mt-6 rounded-xl bg-[#edf3ff] p-5">
          <p className="text-base font-bold text-stone-900">{section}</p>
          {list}
        </div>,
      );
    } else if (section === "Reflection questions") {
      blocks.push(
        <div key={`questions-${blocks.length}`} className="mb-6 mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-5">
          <p className="text-base font-bold text-stone-900">Reflection questions</p>
          {list}
        </div>,
      );
    } else {
      blocks.push(
        <ol key={`list-${blocks.length}`} className="mb-6 list-decimal space-y-2 pl-6 text-[15px] leading-6 text-stone-700">
          {listItems.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
        </ol>,
      );
    }

    listItems = [];
    section = null;
  }

  for (const line of lines) {
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    let heading = sectionHeadings[line.toLowerCase()];
    if (!heading && takeawaysHeading.test(line)) {
      heading = line.trim().replace(/:\s*$/, "").replace(/^\w/, (c) => c.toUpperCase());
    }
    if (heading) {
      flushParagraph();
      flushList();
      flushSectionHeading();
      section = heading;
      continue;
    }

    const match = line.match(numberedItem);
    if (match) {
      flushParagraph();
      listItems.push(match[1]);
      continue;
    }

    if (listItems.length) {
      flushList();
    } else if (section) {
      flushSectionHeading();
    }
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  flushSectionHeading();
  return blocks;
}

export function EmailPreview({
  subject,
  body,
  status,
  organizationName,
}: EmailPreviewProps) {
  const previewSubject = subject.trim() || "Your email subject will appear here";
  const previewBody = body.trim()
    ? replacePreviewVariables(body)
    : "Generate a follow-up draft to preview the email church members will receive.";
  const org = organizationName?.trim() || "After Sunday";

  return (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-soft">
            Member preview
          </p>
          <h2 className="mt-2 text-xl font-semibold text-ink">Email preview</h2>
        </div>
        <Badge variant={status === "approved" ? "success" : "warning"}>
          {status === "approved" ? "Approved" : "Draft"}
        </Badge>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl bg-[#f3f0e9] p-3">
        <div className="overflow-hidden bg-white shadow-sm">
          <div className="h-2 bg-[#e7dfcf]" />
          <div className="px-6 pb-5 pt-8 text-center">
            <p className="text-2xl font-bold tracking-tight text-stone-800">{org}</p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-stone-500">
              A follow-up from your church
            </p>
            <h3 className="mt-7 text-xl font-bold leading-tight text-stone-900">
              {previewSubject}
            </h3>
          </div>

          <div className="px-6 pb-8 pt-2">
            {body.trim() ? renderPreviewBody(previewBody) : (
              <p className="text-[15px] leading-7 text-stone-500">{previewBody}</p>
            )}
            <div className="mt-8 border-t border-stone-200 pt-4 text-center text-[11px] leading-5 text-stone-500">
              This is a test email from {org}.<br />
              Generated with care by After Sunday.
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
