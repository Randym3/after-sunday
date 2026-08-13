import Link from "next/link";

import { GroupList } from "@/components/groups/GroupList";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function GroupsPage() {
  return (
    <>
      <PageHeader
        title="Groups"
        action={
          <Link href="/app/groups/new">
            <Button>Add Group</Button>
          </Link>
        }
      />

      <GroupList />
    </>
  );
}
