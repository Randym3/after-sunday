import Link from "next/link";

import { SermonList } from "@/components/sermons/SermonList";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SermonsPage() {
  return (
    <>
      <PageHeader
        title="Sermons"
        action={
          <Link href="/app/sermons/new">
            <Button>Create Sermon</Button>
          </Link>
        }
      />

      <SermonList />
    </>
  );
}