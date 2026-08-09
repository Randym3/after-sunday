"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listSermons } from "@/lib/api/sermons";
import type { Sermon } from "@/types/sermon";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

function formatDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function transcriptBadge(status: string) {
  if (status === "ready") {
    return <Badge variant="success">Transcript ready</Badge>;
  }

  if (status === "processing" || status === "queued") {
    return <Badge variant="warning">Transcribing</Badge>;
  }

  return <Badge variant="neutral">No transcript</Badge>;
}

function draftBadge(status: string) {
  if (status === "approved") {
    return <Badge variant="success">Approved</Badge>;
  }

  if (status === "draft_ready") {
    return <Badge variant="warning">Needs review</Badge>;
  }

  if (status === "generating") {
    return <Badge variant="neutral">Generating</Badge>;
  }

  return <Badge variant="neutral">Not generated</Badge>;
}

export function SermonList() {
  const [sermons, setSermons] = useState<Sermon[] | null>(null);
  const [error, setError] = useState("");

  function handleRetry() {
    setSermons(null);
    setError("");

    listSermons()
      .then(setSermons)
      .catch((err: unknown) => {
        const message =
          err instanceof ApiError && err.status === 401
            ? "Your session has expired. Please log out and in again."
            : err instanceof Error
              ? err.message
              : "Could not load sermons.";

        setError(message);
        setSermons(null);
      });
  }

  useEffect(() => {
    listSermons()
      .then(setSermons)
      .catch((err: unknown) => {
        const message =
          err instanceof ApiError && err.status === 401
            ? "Your session has expired. Please log out and in again."
            : err instanceof Error
              ? err.message
              : "Could not load sermons.";

        setError(message);
        setSermons(null);
      });
  }, []);

  if (error) {
    return (
      <EmptyState
        title="Unable to load sermons"
        description={error}
        action={
          <Button type="button" onClick={handleRetry}>
            Try again
          </Button>
        }
      />
    );
  }

  if (sermons === null) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-stone-500">
          Loading sermons…
        </p>
      </Card>
    );
  }

  if (sermons.length === 0) {
    return (
      <EmptyState
        title="No sermons yet"
        description="Create your first sermon follow-up by adding sermon details and pasting a transcript."
        action={
          <Link href="/app/sermons/new">
            <Button>Create Sermon</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {sermons.map((sermon) => {
        const subtitle = [
          sermon.preacher,
          sermon.scriptureReference,
          formatDate(sermon.preachedAt),
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <Link
            key={sermon.id}
            href={`/app/sermons/${sermon.id}`}
            className="block"
          >
            <Card className="transition hover:border-[#012f11]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-[#102015]">
                    {sermon.title}
                  </h3>

                  {subtitle ? (
                    <p className="mt-1 truncate text-sm text-stone-600">
                      {subtitle}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-shrink-0 flex-wrap gap-2">
                  {transcriptBadge(sermon.transcriptStatus)}
                  {draftBadge(sermon.aiDraftStatus)}
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
