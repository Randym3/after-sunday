import Link from "next/link";

import { MemberList } from "@/components/members/MemberList";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function MembersPage() {
  return (
    <>
      <PageHeader
        title="Members"
        action={
          <Link href="/app/members/new">
            <Button>Add Member</Button>
          </Link>
        }
      />

      <MemberList />
    </>
  );
}
