import { MemberList } from "@/components/members/MemberList";
import { PageHeader } from "@/components/ui/PageHeader";

export default function MembersPage() {
  return (
    <>
      <PageHeader
        title="Members"
        description="People who receive sermon follow-ups. Add members to prepare encouragement for those who missed Sunday."
      />

      <MemberList />
    </>
  );
}
