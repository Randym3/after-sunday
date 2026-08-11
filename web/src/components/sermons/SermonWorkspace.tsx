"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  generateFollowUp as generateFollowUpApi,
  getSermon,
  updateSermon,
} from "@/lib/api/sermons";
import type { SermonUpdate } from "@/lib/api/sermons";

import { EmailPreview } from "@/components/sermons/EmailPreview";
import { FollowUpEditor } from "@/components/sermons/FollowUpEditor";
import { SermonForm } from "@/components/sermons/SermonForm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/utils/cn";
import {
  Sermon,
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
  const [followUpMessage, setFollowUpMessage] = useState("");
  const [followUpError, setFollowUpError] = useState("");
  const [detailsMessage, setDetailsMessage] = useState("");
  const [tab, setTab] = useState<"details" | "ai">("details");

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

  // Ref flag used by the poll below: reading a `cancelled` local inside an
  // interval closure would capture a stale value.
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, [sermonId, isPersistedSermon]);

  // Poll while transcription is in flight so the transcript + status badge
  // update on their own once the worker finishes (no manual reload needed).
  useEffect(() => {
    if (!isPersistedSermon || !persistedSermon) {
      return;
    }

    const status = persistedSermon.transcriptStatus;
    if (status !== "queued" && status !== "processing") {
      return;
    }

    const pollId = setInterval(async () => {
      try {
        const serverSermon = await getSermon(sermonId);
        if (cancelledRef.current) {
          return;
        }
        setPersistedSermon((current) =>
          current
            ? mergeServerSermon(serverSermon, current)
            : serverSermon
        );
      } catch {
        // Transient failure — keep polling; the next tick may succeed.
      }
    }, 2000);

    return () => {
      clearInterval(pollId);
    };
  }, [isPersistedSermon, persistedSermon, sermonId]);

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
  }

  async function generateFollowUp() {
    if (
      sermon.transcriptStatus !== "ready" ||
      !sermon.transcript?.trim()
    ) {
      return;
    }

    setFollowUpMessage("");
    setFollowUpError("");

    commitSermon({
      ...sermon,
      aiDraftStatus: "generating",
    });

    if (!isPersistedSermon) {
      // Demo path (sessionStorage) — keep the local mock.
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
      return;
    }

    try {
      const serverSermon = await generateFollowUpApi(sermonId);
      setPersistedSermon(serverSermon);
    } catch (error) {
      // Back out of the "generating" state so the button can be retried.
      setPersistedSermon((current) =>
        current
          ? { ...current, aiDraftStatus: "not_started" }
          : current,
      );
      setFollowUpError(
        error instanceof Error
          ? error.message
          : "Unable to generate the follow-up draft.",
      );
    }
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

  async function saveFollowUp() {
    if (!isPersistedSermon) {
      commitSermon(sermon);
      setFollowUpMessage("Draft saved.");
      return;
    }

    setFollowUpError("");

    try {
      const serverSermon = await updateSermon(sermonId, {
        followUpSubject: sermon.followUpSubject || null,
        followUpBody: sermon.followUpBody || null,
        aiDraftStatus: sermon.aiDraftStatus,
        emailStatus: sermon.emailStatus,
      });
      setPersistedSermon(serverSermon);
      setFollowUpMessage("Draft saved.");
    } catch (error) {
      setFollowUpError(
        error instanceof Error
          ? error.message
          : "Unable to save the draft.",
      );
    }
  }

  async function approveFollowUp() {
    if (
      !sermon.followUpSubject?.trim() ||
      !sermon.followUpBody?.trim()
    ) {
      return;
    }

    if (!isPersistedSermon) {
      commitSermon({
        ...sermon,
        aiDraftStatus: "approved",
        emailStatus: "ready",
      });
      setFollowUpMessage("Draft approved.");
      return;
    }

    setFollowUpError("");

    try {
      const serverSermon = await updateSermon(sermonId, {
        followUpSubject: sermon.followUpSubject || null,
        followUpBody: sermon.followUpBody || null,
        aiDraftStatus: "approved",
        emailStatus: "ready",
      });
      setPersistedSermon(serverSermon);
      setFollowUpMessage("Draft approved.");
    } catch (error) {
      setFollowUpError(
        error instanceof Error
          ? error.message
          : "Unable to approve the draft.",
      );
    }
  }

  async function rejectDraft() {
    setFollowUpError("");

    commitSermon({
      ...sermon,
      followUpSubject: null,
      followUpBody: null,
      aiDraftStatus: "not_started",
      emailStatus: "not_started",
    });

    if (isPersistedSermon) {
      try {
        await updateSermon(sermonId, {
          followUpSubject: null,
          followUpBody: null,
          aiDraftStatus: "not_started",
          emailStatus: "not_started",
        });
      } catch (error) {
        setFollowUpError(
          error instanceof Error
            ? error.message
            : "Unable to clear the draft.",
        );
        return;
      }
    }

    setFollowUpMessage("Draft rejected. You can generate a new one.");
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
        action={
          <Badge variant={status.variant}>
            {status.label}
          </Badge>
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl bg-stone-100 p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("details")}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-medium transition",
            tab === "details"
              ? "bg-white text-[#012f11] shadow-sm"
              : "text-stone-600 hover:text-[#102015]",
          )}
        >
          Sermon Details
        </button>

        <button
          type="button"
          onClick={() => setTab("ai")}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-medium transition",
            tab === "ai"
              ? "bg-white text-[#012f11] shadow-sm"
              : "text-stone-600 hover:text-[#102015]",
          )}
        >
          AI Draft
        </button>
      </div>

      {/* Tab content with fade transition.
          overflow-hidden keeps the hidden (absolutely-positioned) tab's
          content from extending the page height — otherwise the invisible
          AI tab adds phantom scroll and breaks the sticky sidebar. */}
      <div className="relative overflow-hidden">
        {/* ——— Sermon Details tab ——— */}
        <div
          className={cn(
            "space-y-8 transition-opacity duration-200",
            tab === "details"
              ? "opacity-100"
              : "pointer-events-none absolute inset-0 top-0 opacity-0",
          )}
          aria-hidden={tab !== "details"}
        >
          <SermonForm
            sermon={sermon}
            onSubmit={async (values) => {
              const wasDrafted =
                sermon.aiDraftStatus === "draft_ready" ||
                sermon.aiDraftStatus === "approved";

              const hasMetaChange =
                values.title !== sermon.title ||
                values.preacher !== (sermon.preacher ?? "") ||
                values.scriptureReference !==
                  (sermon.scriptureReference ?? "") ||
                values.preachedAt !== (sermon.preachedAt ?? "");

              const patch: SermonUpdate = {
                title: values.title,
                preacher: values.preacher || null,
                scriptureReference:
                  values.scriptureReference || null,
                preachedAt: values.preachedAt || null,
                sourceType: values.sourceType,
                sourceUrl:
                  values.sourceType === "youtube"
                    ? values.youtubeUrl || null
                    : null,
                transcript: values.transcript || null,
              };

              if (wasDrafted && hasMetaChange) {
                patch.followUpSubject = null;
                patch.followUpBody = null;
                patch.aiDraftStatus = "not_started";
                patch.emailStatus = "not_started";
              }

              if (isPersistedSermon) {
                const serverSermon = await updateSermon(
                  sermonId,
                  patch,
                );
                // When metadata edits cleared the drafts server-side, take
                // the server response as truth — mergeServerSermon would
                // otherwise restore the stale local draft.
                commitSermon(
                  wasDrafted && hasMetaChange
                    ? serverSermon
                    : mergeServerSermon(serverSermon, sermon),
                );

                setDetailsMessage(
                  wasDrafted && hasMetaChange
                    ? "Saved — AI follow-up drafts have been cleared."
                    : "Saved.",
                );
                window.setTimeout(
                  () => setDetailsMessage(""),
                  6_000,
                );
              } else {
                commitSermon({
                  ...sermon,
                  title: values.title,
                  preacher: values.preacher || null,
                  scriptureReference:
                    values.scriptureReference || null,
                  preachedAt: values.preachedAt || null,
                  sourceType: values.sourceType,
                  sourceUrl:
                    values.sourceType === "youtube"
                      ? values.youtubeUrl || null
                      : null,
                  transcript: values.transcript || null,
                  ...(wasDrafted && hasMetaChange
                    ? {
                        followUpSubject: null,
                        followUpBody: null,
                        aiDraftStatus: "not_started" as const,
                        emailStatus: "not_started" as const,
                      }
                    : {}),
                });
                setDetailsMessage("Saved.");
              }
            }}
          />

          {detailsMessage ? (
            <p className="text-sm font-medium text-green-800">
              {detailsMessage}
            </p>
          ) : null}
        </div>

        {/* ——— AI Draft tab ——— */}
        <div
          className={cn(
            "space-y-8 transition-opacity duration-200",
            tab === "ai"
              ? "opacity-100"
              : "pointer-events-none absolute inset-0 top-0 opacity-0",
          )}
          aria-hidden={tab !== "ai"}
        >
          {/* Transcript — read-only */}
          <Card>
            <div className="flex flex-col gap-4 border-b border-[#ddd8c8] pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#102015]">
                  Sermon transcript
                </h2>

                <p className="mt-1 text-sm leading-6 text-stone-600">
                  The finalized transcript used for AI follow-up
                  generation.
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

                {sermon.transcriptStatus === "failed" &&
                sermon.transcriptError ? (
                  <div className="mx-auto mt-4 max-w-lg rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left">
                    <p className="text-sm font-medium text-red-800">
                      Error details
                    </p>
                    <p className="mt-1 break-words font-mono text-xs leading-5 text-red-700">
                      {sermon.transcriptError}
                    </p>
                  </div>
                ) : (
                  <>
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
                      Prototype action — simulates transcription
                      finishing so you can test the follow-up flow.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="pt-6">
                <div className="max-h-72 overflow-y-auto pr-3">
                  <p className="whitespace-pre-wrap italic leading-7 text-stone-600">
                    {sermon.transcript?.trim() ||
                      "No transcript available yet. Switch to the Sermon Details tab to add or edit the transcript."}
                  </p>
                </div>

                <div className="mt-4 text-xs text-stone-500">
                  <span>{transcriptWordCount} words</span>
                </div>
              </div>
            )}
          </Card>

          {/* Follow-up status */}
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

          {/* Follow-up editor + email preview */}
          <div className="grid gap-6 xl:grid-cols-2">
            <FollowUpEditor
              subject={sermon.followUpSubject ?? ""}
              body={sermon.followUpBody ?? ""}
              status={sermon.aiDraftStatus}
              canGenerate={canGenerateFollowUp}
              message={followUpMessage}
              error={followUpError}
              onGenerate={generateFollowUp}
              onSubjectChange={updateFollowUpSubject}
              onBodyChange={updateFollowUpBody}
              onSave={saveFollowUp}
              onApprove={approveFollowUp}
              onReject={rejectDraft}
            />

            <EmailPreview
              subject={sermon.followUpSubject ?? ""}
              body={sermon.followUpBody ?? ""}
              status={sermon.aiDraftStatus}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
