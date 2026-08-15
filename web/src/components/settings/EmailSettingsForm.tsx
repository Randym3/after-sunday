"use client";

import { useEffect, useState } from "react";

import { getEmailSettings, updateEmailSettings } from "@/lib/api/settings";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import type { EmailSettings } from "@/types/settings";

const inputClass =
  "mt-2 w-full rounded-2xl border border-edge bg-panel-2 px-4 py-3 text-sm text-ink outline-none transition focus:border-primary disabled:opacity-60";

export function EmailSettingsForm() {
  const { toast } = useToast();

  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [emailFrom, setEmailFrom] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEmailSettings()
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        setEmailFrom(data.emailFrom ?? "");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load email settings.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (settings?.source === "env") return;

    setSaving(true);
    try {
      const updated = await updateEmailSettings({
        emailFrom: emailFrom.trim(),
        resendApiKey: clearKey ? undefined : resendApiKey.trim() || undefined,
        clearResendKey: clearKey,
      });
      setSettings(updated);
      setEmailFrom(updated.emailFrom ?? "");
      setResendApiKey("");
      setClearKey(false);
      toast("Email settings saved.", "success");
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not save email settings.",
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  const isEnvPinned = settings?.source === "env";
  const configured = settings?.resendConfigured ?? false;

  return (
    <Card>
        <div>
          <h2 className="text-lg font-semibold text-ink">
            Email delivery
          </h2>

          <p className="mt-1 text-sm leading-6 text-ink-soft">
            Configure how After Sunday sends test emails from sermon drafts.
            The key is stored on the server and never shown in full.
          </p>
        </div>

        {loadError ? (
          <p role="alert" className="mt-5 text-sm font-medium text-red-600">
            {loadError}
          </p>
        ) : settings === null ? (
          <p className="mt-6 text-sm text-ink-soft">Loading settings…</p>
        ) : (
          <>
            {isEnvPinned ? (
              <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
                Email settings are currently pinned by environment variables
                (RESEND_API_KEY / EMAIL_FROM in api/.env) and can’t be edited
                here. Remove them from the environment to manage settings in
                the app.
              </div>
            ) : null}

            <div className="mt-6 flex items-center gap-3">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  configured ? "bg-mint" : "bg-gold"
                }`}
                aria-hidden="true"
              />
              <p className="text-sm font-medium text-ink">
                {configured
                  ? `Test emails can be sent (${
                      settings.resendKeyMasked ?? "key saved"
                    })`
                  : "Not configured — test emails are unavailable"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="emailFrom"
                  className="block text-sm font-semibold text-ink"
                >
                  Sender address
                </label>
                <input
                  id="emailFrom"
                  type="email"
                  value={emailFrom}
                  onChange={(event) => setEmailFrom(event.target.value)}
                  className={inputClass}
                  placeholder="onboarding@resend.dev"
                  disabled={isEnvPinned || saving}
                />
                <p className="mt-2 text-xs leading-5 text-ink-soft">
                  The address Resend sends from. For testing without your own
                  domain, use onboarding@resend.dev (delivers only to the email
                  you verified with Resend). Once you verify a domain in
                  Resend, use any address on it, e.g. noreply@yourchurch.org.
                </p>
              </div>

              <div>
                <label
                  htmlFor="resendApiKey"
                  className="block text-sm font-semibold text-ink"
                >
                  Resend API key
                </label>
                <input
                  id="resendApiKey"
                  type="password"
                  autoComplete="new-password"
                  value={resendApiKey}
                  onChange={(event) => {
                    setResendApiKey(event.target.value);
                    if (event.target.value) setClearKey(false);
                  }}
                  className={inputClass}
                  placeholder={
                    configured
                      ? "Leave blank to keep the current key"
                      : "re_…"
                  }
                  disabled={isEnvPinned || saving}
                />
                {configured && !isEnvPinned ? (
                  <label className="mt-2 flex w-fit items-center gap-2 text-sm text-ink-soft">
                    <input
                      type="checkbox"
                      checked={clearKey}
                      onChange={(event) => {
                        setClearKey(event.target.checked);
                        if (event.target.checked) setResendApiKey("");
                      }}
                      className="accent-primary"
                    />
                    Remove the saved key
                  </label>
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={isEnvPinned || saving}>
                  {saving ? "Saving…" : "Save settings"}
                </Button>
              </div>
            </form>
          </>
        )}
    </Card>
  );
}
