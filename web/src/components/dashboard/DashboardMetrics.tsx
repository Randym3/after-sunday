"use client";

import { useEffect, useState } from "react";

import { listSermons } from "@/lib/api/sermons";
import type { Sermon } from "@/types/sermon";

import { Card } from "@/components/ui/Card";

interface Metrics {
  sermons: number;
  draftsNeedingReview: number;
  campaignsSent: number;
}

function deriveMetrics(sermons: Sermon[]): Metrics {
  return {
    sermons: sermons.length,
    draftsNeedingReview: sermons.filter(
      (sermon) => sermon.aiDraftStatus === "draft_ready",
    ).length,
    campaignsSent: sermons.filter(
      (sermon) => sermon.emailStatus === "sent",
    ).length,
  };
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-3 text-4xl font-semibold text-[#102015]">{value}</p>
    </Card>
  );
}

export function DashboardMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listSermons()
      .then((sermons) => {
        if (!cancelled) setMetrics(deriveMetrics(sermons));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Sermons" value="—" />
        <MetricCard label="Drafts needing review" value="—" />
        <MetricCard label="Campaigns sent" value="—" />
        <p className="text-sm text-stone-500 md:col-span-3">
          Couldn&apos;t load metrics. Refresh the page to try again.
        </p>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {["Sermons", "Drafts needing review", "Campaigns sent"].map(
          (label) => (
            <Card key={label}>
              <p className="text-sm text-stone-500">{label}</p>
              <p className="mt-3 h-10 w-12 animate-pulse rounded bg-stone-100" />
            </Card>
          ),
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard label="Sermons" value={metrics.sermons} />
      <MetricCard
        label="Drafts needing review"
        value={metrics.draftsNeedingReview}
      />
      <MetricCard label="Campaigns sent" value={metrics.campaignsSent} />
    </div>
  );
}
