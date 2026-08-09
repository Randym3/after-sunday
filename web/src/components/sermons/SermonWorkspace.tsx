"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";

import {
  getSermon,
  updateTranscript as updateTranscriptApi,
} from "@/lib/api/sermons";

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

// --- sessionStorage-backed sermon store ---
//
// The stored sermon is the single source of truth for this prototype. The
// workspace subscribes to it with useSyncExternalStore instead of copying it
// into local state, so React stays in sync with browser storage without an
// effect-driven load (and without a hidden second source of truth).

type StoreListener = () => void;

const storeListeners = new Set<StoreListener>();

function subscribeToSermonStore(listener: StoreListener) {
  storeListeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    storeListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function notifySermonStoreChanged() {
  for (const listener of storeListeners) {
    listener();
  }
}

let cachedRawSermon: string | null = null;
let cachedSermon: Sermon | null = null;

function readStoredSermon(): Sermon | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(SERMON_STORAGE_KEY);

  if (raw === cachedRawSermon) {
    return cachedSermon;
  }

  cachedRawSermon = raw;

  if (!raw) {
    cachedSermon = null;
    return null;
  }

  try {
    cachedSermon = JSON.parse(raw) as Sermon;
  } catch {
    cachedSermon = null;
  }

  return cachedSermon;
}

function writeStoredSermon(sermon: Sermon) {
  window.sessionStorage.setItem(
    SERMON_STORAGE_KEY,
    JSON.stringify(sermon)
  );
  notifySermonStoreChanged();
}

// Follow-up draft state is browser-local in this slice, so keep it when
// refreshing from a server response.
function mergeServerSermon(server: Sermon, local: Sermon): Sermon {
  return {
    ...server,
    followUpSubject: local.followUpSubject,
    followUpBody: local.followUpBody,
    aiDraftStatus: local.aiDraftStatus,
    emailStatus: local.emailStatus,
  };
}

export function SermonWorkspace({
  sermonId,
}: SermonWorkspaceProps) {
  const [transcriptMessage, setTranscriptMessage] = useState("");
  const [followUpMessage, setFollowUpMessage] = useState("");

  // Real sermon ids are persisted via the API; "demo" is the mock path
  // backed by the sessionStorage store.
  const isPersistedSermon = sermonId !== "demo";

  const [persistedSermon, setPersistedSermon] = useState<Sermon | null>(
    null
  );
  const [persistedLoadState, setPersistedLoadState] = useState<
    "loading" | "ready" | "error"
  >(isPersistedSermon ? "loading" : "ready");
  const [persistedLoadError, setPersistedLoadError] = useState("");

  useEffect(() => {
    if (!isPersistedSermon) {
      return;
    }

    let cancelled = false;

    getSermon(sermonId)
      .then((serverSermon) => {
        if (cancelled) {
          return;
        }
        setPersistedSermon(serverSermon);
        setPersistedLoadState("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setPersistedLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load this sermon."
        );
        setPersistedLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [isPersistedSermon, sermonId]);

  function commitSermon(next: Sermon) {
    if (isPersistedSermon) {
      setPersistedSermon(next);
    } else {
      writeStoredSermon(next);
    }
  }

  const storedSermon = useSyncExternalStore(
    subscribeToSermonStore,
    readStoredSermon,
    () => null // getServerSnapshot: no browser storage on the server
  );

  const sermon: Sermon = isPersistedSermon
    ? persistedSermon ?? {
        ...fallbackSermon,
        id: sermonId,
      }
    : storedSermon
      ? {
          ...fallbackSermon,
          ...storedSermon,
          id: sermonId,
          followUpSubject: storedSermon.followUpSubject ?? null,
          followUpBody: storedSermon.followUpBody ?? null,
        }
      : {
          ...fallbackSermon,
          id: sermonId,
        };

  const trimmedTranscript = sermon.transcript?.trim() ?? "";
  const transcriptWordCount = trimmedTranscript
    ? trimmedTranscript.split(/\s+/).filter(Boolean).length
    : 0;

  function markTranscriptReady() {
    commitSermon({
      ...sermon,
      transcript: sermon.transcript || demoTranscript,
      transcriptStatus: "ready",
    });

    setTranscriptMessage("");
  }

  function updateTranscript(transcript: string) {
    const wasApproved = sermon.aiDraftStatus === "approved";

    commitSermon({
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

  async function saveTranscript() {
    if (isPersistedSermon) {
      try {
        const serverSermon = await updateTranscriptApi(
          sermonId,
          sermon.transcript ?? ""
        );
        commitSermon(mergeServerSermon(serverSermon, sermon));
        setTranscriptMessage("Transcript saved.");
      } catch (error) {
        setTranscriptMessage(
          error instanceof Error
            ? error.message
            : "Could not save the transcript."
        );
      }
      return;
    }

    writeStoredSermon(sermon);
    setTranscriptMessage("Transcript saved.");
  }

  async function generateFollowUp() {
    if (
      sermon.transcriptStatus !== "ready" ||
      !sermon.transcript?.trim()
    ) {
      return;
    }

    commitSermon({
      ...sermon,
      aiDraftStatus: "generating",
    });

    setFollowUpMessage("");

    await new Promise((resolve) => {
      window.setTimeout(resolve, 700);
    });

    const draft = buildMockFollowUp(sermon);

    commitSermon({
      ...sermon,
      followUpSubject: draft.subject,
      followUpBody: draft.body,
      aiDraftStatus: "draft_ready",
      emailStatus: "draft",
    });
  }

  function updateFollowUpSubject(subject: string) {
    const wasApproved = sermon.aiDraftStatus === "approved";

    commitSermon({
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
    const wasApproved = sermon.aiDraftStatus === "approved";

    commitSermon({
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
    commitSermon(sermon);
    setFollowUpMessage(
      isPersistedSermon
        ? "Draft saved in this browser session."
        : "Draft saved."
    );
  }

  function approveFollowUp() {
    if (
      !sermon.followUpSubject?.trim() ||
      !sermon.followUpBody?.trim()
    ) {
      return;
    }

    commitSermon({
      ...sermon,
      aiDraftStatus: "approved",
      emailStatus: "ready",
    });

    setFollowUpMessage("Draft approved.");
  }

  const status = transcriptStatusConfig[sermon.transcriptStatus];

  const canGenerateFollowUp =
    sermon.transcriptStatus === "ready" &&
    Boolean(sermon.transcript?.trim());

  if (isPersistedSermon && persistedLoadState === "loading") {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-stone-600">Loading sermon…</p>
      </div>
    );
  }

  if (isPersistedSermon && persistedLoadState === "error") {
    return (
      <div className="space-y-6 py-10">
        <Link
          href="/app/sermons"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-[#012f11]"
        >
          <span aria-hidden="true">←</span>
          Back to sermons
        </Link>

        <div>
          <h1 className="text-2xl font-semibold text-[#102015]">
            Unable to load this sermon
          </h1>

          <p className="mt-2 text-sm leading-6 text-stone-600">
            {persistedLoadError}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <Link
          href="/app/sermons"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 transition hover:text-[#012f11]"
        >
          <span aria-hidden="true">←</span>
          Back to sermons
        </Link>
      </div>

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

          <p className="mt-3 text-xs leading-5 text-stone-500">
            {sermon.sourceType === "upload"
              ? "Prototype only: the recording is not uploaded or saved. Only its filename is kept in this browser session."
              : sermon.sourceType === "youtube"
                ? "Prototype only: no YouTube connection is made. Only the link is kept in this browser session."
                : isPersistedSermon
                  ? "Saved to the church database. Transcript edits persist when you save."
                  : "Prototype only: this transcript is kept in this browser session only."}
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
                variant="secondary"
                onClick={markTranscriptReady}
              >
                Mark Transcript Ready
              </Button>
            </div>

            <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-stone-500">
              Prototype action — simulates transcription finishing so
              you can test the review and follow-up flow. No recording
              is uploaded or transcribed.
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
