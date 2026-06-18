import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SermonsPage() {
  return (
    <>
      <PageHeader
        title="Sermons"
        description="Create sermon follow-ups from transcripts and prepare messages for members who missed Sunday."
        action={
          <Link href="/app/sermons/new">
            <Button>Create Sermon</Button>
          </Link>
        }
      />

      <EmptyState
        title="No sermons yet"
        description="Create your first sermon follow-up by adding sermon details and pasting a transcript."
        action={
          <Link href="/app/sermons/new">
            <Button>Create Sermon</Button>
          </Link>
        }
      />
    </>
  );
}