import { apiFetch } from "@/lib/api/client";
import type {
  BrandingSettings,
  BrandingUpdate,
  EmailSettings,
  EmailSettingsUpdate,
  StorageSettings,
} from "@/types/settings";

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

export function getBrandingSettings(): Promise<BrandingSettings> {
  return apiFetch<BrandingSettings>("/settings/branding");
}

export function updateBrandingSettings(
  input: BrandingUpdate,
): Promise<BrandingSettings> {
  return apiFetch<BrandingSettings>("/settings/branding", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function uploadBrandingLogo(file: File): Promise<BrandingSettings> {
  const body = new FormData();
  body.set("file", file);
  return apiFetch<BrandingSettings>("/settings/branding/logo", {
    method: "PUT",
    body,
  });
}

export function deleteBrandingLogo(): Promise<BrandingSettings> {
  return apiFetch<BrandingSettings>("/settings/branding/logo", {
    method: "DELETE",
  });
}

export function getStorageSettings(): Promise<StorageSettings> {
  return apiFetch<StorageSettings>("/settings/storage");
}
