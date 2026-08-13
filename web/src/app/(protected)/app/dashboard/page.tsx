import Link from "next/link";

import { DashboardMetrics } from "@/components/dashboard/DashboardMetrics";
import { UserGreeting } from "@/components/dashboard/UserGreeting";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Continue the care that started on Sunday."
        description="Track sermon follow-ups, review AI-assisted drafts, and prepare encouragement for the people who could not attend."
        action={
          <Link href="/app/sermons/new">
            <Button>Create Sermon</Button>
          </Link>
        }
      />

      <div className="mb-4">
        <UserGreeting />
      </div>

      <DashboardMetrics />

      <div className="mt-6">
        <div className="rounded-3xl bg-[#012f11] p-6 text-white shadow-sm">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-lime-300">MVP workflow</p>
            <h2 className="mt-3 text-2xl font-semibold">
              Start with one sermon, one transcript, and one follow-up draft.
            </h2>
            <p className="mt-3 text-sm leading-6 text-green-50">
              Before connecting AI, email sending, or YouTube imports, we will prove
              the core pastoral workflow.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}