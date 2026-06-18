"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CreateSermonInput } from "@/types/sermon";

interface SermonFormProps {
  onSubmit?: (values: CreateSermonInput) => void | Promise<void>;
}

export function SermonForm({ onSubmit }: SermonFormProps) {
  const [values, setValues] = useState<CreateSermonInput>({
    title: "",
    preacher: "",
    scriptureReference: "",
    preachedAt: "",
    sermonLink: "",
    transcript: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField<K extends keyof CreateSermonInput>(
    field: K,
    value: CreateSermonInput[K]
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsSubmitting(true);

      if (onSubmit) {
        await onSubmit(values);
      } else {
        console.log("Create sermon payload", values);
        alert("Sermon form works. Backend connection comes next.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-stone-800">
              Sermon title
            </label>
            <input
              id="title"
              value={values.title}
              onChange={(event) => updateField("title", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#012f11]"
              placeholder="The Good Shepherd"
              required
            />
          </div>

          <div>
            <label htmlFor="preacher" className="block text-sm font-medium text-stone-800">
              Preacher
            </label>
            <input
              id="preacher"
              value={values.preacher}
              onChange={(event) => updateField("preacher", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#012f11]"
              placeholder="Pastor John"
            />
          </div>

          <div>
            <label
              htmlFor="scriptureReference"
              className="block text-sm font-medium text-stone-800"
            >
              Scripture reference
            </label>
            <input
              id="scriptureReference"
              value={values.scriptureReference}
              onChange={(event) =>
                updateField("scriptureReference", event.target.value)
              }
              className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#012f11]"
              placeholder="Psalm 23"
            />
          </div>

          <div>
            <label htmlFor="preachedAt" className="block text-sm font-medium text-stone-800">
              Date preached
            </label>
            <input
              id="preachedAt"
              type="date"
              value={values.preachedAt}
              onChange={(event) => updateField("preachedAt", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#012f11]"
            />
          </div>

          <div>
            <label htmlFor="sermonLink" className="block text-sm font-medium text-stone-800">
              Sermon link
            </label>
            <input
              id="sermonLink"
              value={values.sermonLink}
              onChange={(event) => updateField("sermonLink", event.target.value)}
              className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#012f11]"
              placeholder="https://youtube.com/..."
            />
          </div>
        </div>

        <div>
          <label htmlFor="transcript" className="block text-sm font-medium text-stone-800">
            Transcript
          </label>
          <textarea
            id="transcript"
            value={values.transcript}
            onChange={(event) => updateField("transcript", event.target.value)}
            className="mt-2 min-h-80 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-[#012f11]"
            placeholder="Paste the sermon transcript here..."
            required
          />
          <p className="mt-2 text-xs text-stone-500">
            For the MVP, paste transcripts manually. YouTube import can come later.
          </p>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Sermon"}
          </Button>
        </div>
      </form>
    </Card>
  );
}