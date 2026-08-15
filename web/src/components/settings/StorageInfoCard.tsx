"use client";

import { useEffect, useState } from "react";

import { getStorageSettings } from "@/lib/api/settings";
import { Card } from "@/components/ui/Card";
import type { StorageSettings } from "@/types/settings";

export function StorageInfoCard() {
  const [info, setInfo] = useState<StorageSettings | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getStorageSettings()
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not load storage info.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink">Storage</h2>
      <p className="mt-1 text-sm leading-6 text-ink-soft">
        Where uploaded sermon recordings are stored.
      </p>

      {error ? (
        <p role="alert" className="mt-5 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : info === null ? (
        <p className="mt-6 text-sm text-ink-soft">Loading storage info…</p>
      ) : (
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-ink-soft">Backend</dt>
            <dd className="font-medium text-ink">{info.backend}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-ink-soft">Location</dt>
            <dd className="break-all font-mono text-xs leading-5 text-ink">
              {info.location}
            </dd>
          </div>
        </dl>
      )}

      <p className="mt-5 border-t border-edge pt-4 text-xs leading-5 text-ink-soft">
        Production deployments use cloud object storage (S3/R2) behind the
        same interface. The local location is set with the STORAGE_ROOT
        environment variable.
      </p>
    </Card>
  );
}
