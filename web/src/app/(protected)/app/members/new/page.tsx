import { MemberCreate } from "@/components/members/MemberCreate";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewMemberPage() {
  return (
    <>
      <PageHeader
        title="Add a member"
        description="Add someone who will receive sermon follow-ups, then assign their role and status."
      />

      <MemberCreate />
    </>
  );
}
