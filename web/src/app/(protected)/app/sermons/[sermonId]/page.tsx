import { SermonWorkspace } from "@/components/sermons/SermonWorkspace";

interface SermonPageProps {
  params: Promise<{
    sermonId: string;
  }>;
}

export default async function SermonPage({
  params,
}: SermonPageProps) {
  const { sermonId } = await params;

  return <SermonWorkspace sermonId={sermonId} />;
}