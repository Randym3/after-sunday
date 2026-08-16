"use client";

import { useEffect, useRef, useState } from "react";

import { getFollowUpPrompt } from "@/lib/api/sermons";
import type { FollowUpPrompt } from "@/lib/api/sermons";

interface PromptPanelProps {
  sermonId: string;
}

/**
 * Shows the exact system + user prompt sent to the AI when generating the
 * follow-up draft. Rendered inline next to "Generated with" — fetched once
 * on mount and cached for the component's lifetime.
 */
export function PromptPanel({ sermonId }: PromptPanelProps) {
  const [prompt, setPrompt] = useState<FollowUpPrompt | null>(null);
  const [error, setError] = useState("");
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) {
      return;
    }
    fetchedRef.current = true;

    getFollowUpPrompt(sermonId)
      .then(setPrompt)
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Unable to load the prompt.",
        );
      });
  }, [sermonId]);

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
        Exact AI prompt
      </p>

      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-400">{error}</p>
      ) : prompt ? (
        <div className="mt-1.5 space-y-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              System
            </p>
            <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-panel-2 p-3 text-[11px] leading-5 text-ink">
              {prompt.systemPrompt}
            </pre>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              User
            </p>
            <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-panel-2 p-3 text-[11px] leading-5 text-ink">
              {prompt.userPrompt}
            </pre>
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-ink-soft">
          Loading the exact prompt…
        </p>
      )}
    </div>
  );
}