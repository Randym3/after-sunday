import { PageHeader } from "@/components/ui/PageHeader";
import { SermonForm } from "@/components/sermons/SermonForm";

export default function NewSermonPage() {
  return (
    <>
      <PageHeader
        title="Create a sermon follow-up"
        description="Add sermon details and paste the transcript. After that, we will generate a follow-up draft for review."
      />

      <SermonForm />
    </>
  );
}