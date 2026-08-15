export type EmailSettingsSource = "env" | "db" | "unset";

export interface EmailSettings {
  emailFrom: string | null;
  resendConfigured: boolean;
  resendKeyMasked: string | null;
  source: EmailSettingsSource;
}

export interface EmailSettingsUpdate {
  resendApiKey?: string;
  emailFrom?: string;
  clearResendKey?: boolean;
}

export interface BrandingSettings {
  organizationName: string | null;
  logoUrl: string | null;
  logoContentType: string | null;
}

export interface BrandingUpdate {
  organizationName?: string;
}

export interface StorageSettings {
  backend: string;
  location: string;
  publicBaseUrl: string;
}
