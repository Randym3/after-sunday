"use client";

import { useEffect, useMemo, useState } from "react";

import { EmailPreview } from "@/components/sermons/EmailPreview";
import { FollowUpEditor } from "@/components/sermons/FollowUpEditor";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Sermon,
  SermonSourceType,
  TranscriptionStatus,
} from "@/types/sermon";

interface SermonWorkspaceProps {
  sermonId: string;
}

const SERMON_STORAGE_KEY = "after-sunday:demo-sermon";

const demoTranscript = `Today we considered Psalm 23 and the confidence David expresses when he says, “The Lord is my shepherd.”

A shepherd knows his sheep, leads them, protects them, and provides what they need. David reminds us that God does not care for His people from a distance. His care is personal and present.

Even when the path leads through the valley of the shadow of death, God's people are not abandoned. The valley may still be difficult, but the Shepherd remains with them.

Because the Lord is our Shepherd, we can trust His direction, rest in His provision, and walk through difficult seasons without fear.`;

const fallbackSermon: Sermon = {
  id: "demo",
  title: "The Good Shepherd",
  preacher: "Pastor John",
  scriptureReference: "Psalm 23",
  preachedAt: "2026-08-02",

  sourceType: "upload",
  sourceUrl: null,
  mediaFileName: "sunday-sermon.mp4",

  transcript: null,
  transcriptStatus: "processing",

  followUpSubject: null,
  followUpBody: null,
  aiDraftStatus: "not_started",

  emailStatus: "not_started",
};

const transcriptStatusConfig: Record<
  TranscriptionStatus,
  {
    label: string;
    description: string;
    variant: "neutral" | "success" | "warning" | "danger";
  }
> = {
  not_started: {
    label: "Not started",
    description: "Transcription has not started yet.",
    variant: "neutral",
  },
  awaiting_upload: {
    label: "Awaiting upload",
    description: "The sermon recording still needs to be uploaded.",
    variant: "warning",
  },
  queued: {
    label: "Queued",
    description: "The sermon is waiting to be transcribed.",
    variant: "warning",
  },
  processing: {
    label: "Transcribing",
    description: "After Sunday is preparing the sermon transcript.",
    variant: "warning",
  },
  ready: {
    label: "Transcript ready",
    description: "The transcript is ready for staff review.",
    variant: "success",
  },
  failed: {
    label: "Transcription failed",
    description: "The sermon could not be transcribed.",
    variant: "danger",
  },
};

function getSourceLabel(sourceType: SermonSourceType) {
  const labels: Record<SermonSourceType, string> = {
    upload: "Uploaded recording",
    youtube: "YouTube",
    transcript: "Pasted transcript",
  };

  return labels[sourceType];
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Date not added";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function buildMockFollowUp(sermon: Sermon) {
  const preacher = sermon.preacher || "Your pastor";
  const scripture =
    sermon.scriptureReference || "Sunday’s Scripture passage";

  return {
    subject: "A few reminders from Sunday’s sermon",
    body: `Hi {{ firstName }},

We missed you this Sunday and wanted to share a few reminders from the message.

${preacher} preached from ${scripture} and reminded us that God cares faithfully for His people, leads them through difficult seasons, and remains present with them.

Three takeaways:

1. God knows and cares for His people personally.
2. God leads us even when the path is difficult.
3. God remains present with us in every valley.

Reflection questions:

1. Where do you need to trust God’s care this week?
2. What part of the sermon encouraged or challenged you?
3. Who could you encourage with this passage?

We’re praying for you and hope to see you soon.`,
  };
}

export function SermonWorkspace({
  sermonId,
}: SermonWorkspaceProps) {
  const [sermon, setSermon] = useState<Sermon | null>(null);
  const [transcriptMessage, setTranscriptMessage] = useState("");
  const [followUpMessage, setFollowUpMessage] = useState("");

  useEffect(() => {
    const storedSermon = sessionStorage.getItem(
      SERMON_STORAGE_KEY
    );

    if (!storedSermon) {
      setSermon({
        ...fallbackSermon,
        id: sermonId,
      });

      return;
    }

    try {
      const parsedSermon = JSON.parse(
        storedSermon
      ) as Partial<Sermon>;

      setSermon({
        ...fallbackSermon,
        ...parsedSermon,
        id: sermonId,
        followUpSubject:
          parsedSermon.followUpSubject ?? null,
        followUpBody: parsedSermon.followUpBody ?? null,
      });
    } catch {
      setSermon({
        ...fallbackSermon,
        id: sermonId,
      });
    }
  }, [sermonId]);

  const transcriptWordCount = useMemo(() => {
    if (!sermon?.transcript?.trim()) {
      return 0;
    }

    return sermon.transcript
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }, [sermon?.transcript]);

  function persistSermon(updatedSermon: Sermon) {
    setSermon(updatedSermon);

    sessionStorage.setItem(
      SERMON_STORAGE_KEY,
      JSON.stringify(updatedSermon)
    );
  }

  function markTranscriptReady() {
    if (!sermon) {
      return;
    }

    persistSermon({
      ...sermon,
      transcript: sermon.transcript || demoTranscript,
      transcriptStatus: "ready",
    });

    setTranscriptMessage("");
  }

  function updateTranscript(transcript: string) {
    if (!sermon) {
      return;
    }

    const wasApproved = sermon.aiDraftStatus === "approved";

    setSermon({
      ...sermon,
      transcript,
      aiDraftStatus: wasApproved
        ? "draft_ready"
        : sermon.aiDraftStatus,
      emailStatus: wasApproved
        ? "draft"
        : sermon.emailStatus,
    });

    setTranscriptMessage("");
  }

  function saveTranscript() {
    if (!sermon) {
      return;
    }

    persistSermon(sermon);
    setTranscriptMessage("Transcript saved.");
  }

  async function generateFollowUp() {
    if (
      !sermon ||
      sermon.transcriptStatus !== "ready" ||
      !sermon.transcript?.trim()
    ) {
      return;
    }

    setSermon({
      ...sermon,
      aiDraftStatus: "generating",
    });

    setFollowUpMessage("");

    await new Promise((resolve) => {
      window.setTimeout(resolve, 700);
    });

    const draft = buildMockFollowUp(sermon);

    persistSermon({
      ...sermon,
      followUpSubject: draft.subject,
      followUpBody: draft.body,
      aiDraftStatus: "draft_ready",
      emailStatus: "draft",
    });
  }

  function updateFollowUpSubject(subject: string) {
    if (!sermon) {
      return;
    }

    const wasApproved = sermon.aiDraftStatus === "approved";

    setSermon({
      ...sermon,
      followUpSubject: subject,
      aiDraftStatus: wasApproved
        ? "draft_ready"
        : sermon.aiDraftStatus,
      emailStatus: wasApproved
        ? "draft"
        : sermon.emailStatus,
    });

    setFollowUpMessage("");
  }

  function updateFollowUpBody(body: string) {
    if (!sermon) {
      return;
    }

    const wasApproved = sermon.aiDraftStatus === "approved";

    setSermon({
      ...sermon,
      followUpBody: body,
      aiDraftStatus: wasApproved
        ? "draft_ready"
        : sermon.aiDraftStatus,
      emailStatus: wasApproved
        ? "draft"
        : sermon.emailStatus,
    });

    setFollowUpMessage("");
  }

  function saveFollowUp() {
    if (!sermon) {
      return;
    }

    persistSermon(sermon);
    setFollowUpMessage("Draft saved.");
  }

  function approveFollowUp() {
    if (
      !sermon ||
      !sermon.followUpSubject?.trim() ||
      !sermon.followUpBody?.trim()
    ) {
      return;
    }

    persistSermon({
      ...sermon,
      aiDraftStatus: "approved",
      emailStatus: "ready",
    });

    setFollowUpMessage("Draft approved.");
  }

  if (!sermon) {
    return (
      <Card>
        <p className="text-sm text-stone-600">
          Loading sermon workspace...
        </p>
      </Card>
    );
  }

  const status =
    transcriptStatusConfig[sermon.transcriptStatus];

  const canGenerateFollowUp =
    sermon.transcriptStatus === "ready" &&
    Boolean(sermon.transcript?.trim());

  return (
    <div className="space-y-8">
      <PageHeader
        title={sermon.title}
        description={[
          sermon.preacher,
          sermon.scriptureReference,
          formatDate(sermon.preachedAt),
        ]
          .filter(Boolean)
          .join(" · ")}
        action={
          <Badge variant={status.variant}>
            {status.label}
          </Badge>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
            Sermon source
          </p>

          <p className="mt-3 font-semibold text-[#102015]">
            {getSourceLabel(sermon.sourceType)}
          </p>

          <p className="mt-2 break-words text-sm leading-6 text-stone-600">
            {sermon.sourceType === "upload"
              ? sermon.mediaFileName || "Recording selected"
              : null}

            {sermon.sourceType === "youtube"
              ? sermon.sourceUrl || "YouTube video"
              : null}

            {sermon.sourceType === "transcript"
              ? "Transcript provided by church staff"
              : null}
          </p>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
            Scripture
          </p>

          <p className="mt-3 font-semibold text-[#102015]">
            {sermon.scriptureReference || "Not added"}
          </p>

          <p className="mt-2 text-sm text-stone-600">
            {sermon.preacher || "Preacher not added"}
          </p>
        </Card>

        <Card>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
            Follow-up status
          </p>

          <div className="mt-3">
            <Badge
              variant={
                sermon.aiDraftStatus === "approved"
                  ? "success"
                  : sermon.aiDraftStatus === "draft_ready"
                    ? "warning"
                    : "neutral"
              }
            >
              {sermon.aiDraftStatus === "approved"
                ? "Approved"
                : sermon.aiDraftStatus === "draft_ready"
                  ? "Needs review"
                  : sermon.aiDraftStatus === "generating"
                    ? "Generating"
                    : "Not generated"}
            </Badge>
          </div>

          <p className="mt-3 text-sm leading-6 text-stone-600">
            AI-generated content must be approved before it can be
            sent.
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 border-b border-[#ddd8c8] pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#102015]">
              Sermon transcript
            </h2>

            <p className="mt-1 text-sm leading-6 text-stone-600">
              Review and correct the transcript before generating
              pastoral follow-up content.
            </p>
          </div>

          <Badge variant={status.variant}>
            {status.label}
          </Badge>
        </div>

        {sermon.transcriptStatus !== "ready" ? (
          <div className="py-10 text-center">
            <h3 className="font-semibold text-[#102015]">
              {status.label}
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-stone-600">
              {status.description}
            </p>

            <div className="mt-6">
              <Button
                type="button"
                onClick={markTranscriptReady}
              >
                Mark Transcript Ready
              </Button>
            </div>

            <p className="mt-3 text-xs text-stone-500">
              This button is only for testing the frontend workflow.
            </p>
          </div>
        ) : (
          <div className="pt-6">
            <label
              htmlFor="workspaceTranscript"
              className="block text-sm font-medium text-stone-800"
            >
              Transcript
            </label>

            <textarea
              id="workspaceTranscript"
              value={sermon.transcript ?? ""}
              onChange={(event) =>
                updateTranscript(event.target.value)
              }
              className="mt-2 min-h-[28rem] w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm leading-7 outline-none transition focus:border-[#012f11]"
              placeholder="The sermon transcript will appear here..."
            />

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-stone-500">
                <span>{transcriptWordCount} words</span>

                {transcriptMessage ? (
                  <span className="ml-3 font-medium text-green-800">
                    {transcriptMessage}
                  </span>
                ) : null}
              </div>

              <Button
                type="button"
                onClick={saveTranscript}
              >
                Save Transcript
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <FollowUpEditor
          subject={sermon.followUpSubject ?? ""}
          body={sermon.followUpBody ?? ""}
          status={sermon.aiDraftStatus}
          canGenerate={canGenerateFollowUp}
          message={followUpMessage}
          onGenerate={generateFollowUp}
          onSubjectChange={updateFollowUpSubject}
          onBodyChange={updateFollowUpBody}
          onSave={saveFollowUp}
          onApprove={approveFollowUp}
        />

        <EmailPreview
          subject={sermon.followUpSubject ?? ""}
          body={sermon.followUpBody ?? ""}
          status={sermon.aiDraftStatus}
        />
      </div>
    </div>
  );
}