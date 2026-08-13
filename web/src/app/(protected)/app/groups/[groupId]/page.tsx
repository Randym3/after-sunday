import { GroupEdit } from "@/components/groups/GroupEdit";

interface GroupPageProps {
  params: Promise<{
    groupId: string;
  }>;
}

export default async function GroupPage({ params }: GroupPageProps) {
  const { groupId } = await params;
  return <GroupEdit groupId={groupId} />;
}
