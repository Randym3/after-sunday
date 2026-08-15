import { apiFetch } from "@/lib/api/client";
import type { EmailSettings, EmailSettingsUpdate } from "@/types/settings";

export function getEmailSettings(): Promise<EmailSettings> {
  return apiFetch<EmailSettings>("/settings/email");
}

export function updateEmailSettings(
  input: EmailSettingsUpdate,
): Promise<EmailSettings> {
  return apiFetch<EmailSettings>("/settings/email", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
