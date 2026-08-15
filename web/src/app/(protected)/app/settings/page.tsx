import { EmailSettingsForm } from "@/components/settings/EmailSettingsForm";
import { OrganizationSettingsForm } from "@/components/settings/OrganizationSettingsForm";
import { StorageInfoCard } from "@/components/settings/StorageInfoCard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure your church’s branding, email delivery, and storage."
      />
      <div className="max-w-2xl space-y-6">
        <OrganizationSettingsForm />
        <EmailSettingsForm />
        <StorageInfoCard />
      </div>
    </>
  );
}
