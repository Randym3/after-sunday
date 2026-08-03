import { PageHeader } from "@/components/ui/PageHeader";
import { SermonForm } from "@/components/sermons/SermonForm";

export default function NewSermonPage() {
  return (
    <>
      <PageHeader
        title="Create a sermon follow-up"
        description="Add the sermon details, then upload a recording, provide a YouTube video, or paste an existing transcript."
      />
      <SermonForm />
    </>
  );
}