import { EmailSettingsForm } from "@/components/settings/EmailSettingsForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure integrations like email delivery."
      />
      <EmailSettingsForm />
    </>
  );
}
