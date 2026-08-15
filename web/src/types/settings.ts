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
