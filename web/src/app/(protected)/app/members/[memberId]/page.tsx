import { MemberEdit } from "@/components/members/MemberEdit";

interface MemberPageProps {
  params: Promise<{
    memberId: string;
  }>;
}

export default async function MemberPage({ params }: MemberPageProps) {
  const { memberId } = await params;

  return <MemberEdit memberId={memberId} />;
}
