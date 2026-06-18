import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-stone-500">Sermons</p>
          <p className="mt-3 text-4xl font-semibold text-[#102015]">0</p>
        </Card>

        <Card>
          <p className="text-sm text-stone-500">Drafts needing review</p>
          <p className="mt-3 text-4xl font-semibold text-[#102015]">0</p>
        </Card>

        <Card>
          <p className="text-sm text-stone-500">Campaigns sent</p>
          <p className="mt-3 text-4xl font-semibold text-[#102015]">0</p>
        </Card>
      </div>

      <div className="mt-6">
        <Card className="bg-[#012f11] text-white">
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
        </Card>
      </div>
    </>
  );
}