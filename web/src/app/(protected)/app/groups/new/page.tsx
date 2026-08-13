import { GroupCreate } from "@/components/groups/GroupCreate";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewGroupPage() {
  return (
    <>
      <PageHeader title="Add a group" />
      <GroupCreate />
    </>
  );
}
