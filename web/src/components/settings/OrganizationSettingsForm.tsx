"use client";

import { useEffect, useState } from "react";

import {
  deleteBrandingLogo,
  getBrandingSettings,
  updateBrandingSettings,
  uploadBrandingLogo,
} from "@/lib/api/settings";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { BrandingSettings } from "@/types/settings";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const inputClass =
  "mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60";

export function OrganizationSettingsForm() {
  const { toast } = useToast();
  const [branding, setBranding] = useState<BrandingSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBrandingSettings()
      .then((data) => {
        if (cancelled) return;
        setBranding(data);
        setName(data.organizationName ?? "");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load organization settings.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateBrandingSettings({
        organizationName: name.trim(),
      });
      setBranding(updated);
      toast("Organization settings saved.", "success");
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not save organization settings.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoChange(file: File | undefined) {
    if (!file) return;
    setSaving(true);
    try {
      const updated = await uploadBrandingLogo(file);
      setBranding(updated);
      toast("Logo uploaded.", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not upload the logo.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveLogo() {
    setSaving(true);
    try {
      const updated = await deleteBrandingLogo();
      setBranding(updated);
      toast("Logo removed.", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not remove the logo.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <div>
        <h2 className="text-lg font-semibold text-ink">Organization</h2>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          Your church’s name and logo, shown in the app and used as the
          sender branding on follow-up emails.
        </p>
      </div>

      {loadError ? (
        <p role="alert" className="mt-5 text-sm font-medium text-red-600">
          {loadError}
        </p>
      ) : branding === null ? (
        <p className="mt-6 text-sm text-ink-soft">Loading settings…</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="organizationName"
              className="block text-sm font-semibold text-ink"
            >
              Organization name
            </label>
            <input
              id="organizationName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
              placeholder="Grace Church"
              disabled={saving}
            />
          </div>

          <div>
            <span className="block text-sm font-semibold text-ink">Logo</span>
            <div className="mt-3 flex items-center gap-4">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${API_BASE_URL}${branding.logoUrl}`}
                  alt="Organization logo"
                  className="h-14 w-14 rounded-full border border-edge object-cover"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-dashed border-edge text-xs text-ink-soft">
                  No logo
                </span>
              )}

              <div className="flex items-center gap-3">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center justify-center rounded-full border border-edge bg-panel-2 px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50">
                    {branding.logoUrl ? "Replace logo" : "Upload logo"}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="sr-only"
                    disabled={saving}
                    onChange={(event) =>
                      handleLogoChange(event.target.files?.[0])
                    }
                  />
                </label>

                {branding.logoUrl ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleRemoveLogo}
                    disabled={saving}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-ink-soft">
              PNG, JPEG, WebP, or SVG — up to 2 MB.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
