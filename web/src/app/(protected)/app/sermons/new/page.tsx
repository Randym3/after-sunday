import { PageHeader } from "@/components/ui/PageHeader";
import { CreateSermonFlow } from "@/components/sermons/CreateSermonFlow";

export default function NewSermonPage() {
  return (
    <>
      <PageHeader
        title="Create a sermon follow-up"
        description="Add the sermon details, then upload a recording, provide a YouTube video, or paste an existing transcript."
      />

      <CreateSermonFlow />
    </>
  );
}