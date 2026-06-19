import { Badge } from "@/components/ui/Badge";

export function ProductPreview() {
  return (
    <div className="relative mx-auto mt-14 max-w-6xl">
      <div className="absolute -right-8 -top-8 hidden h-40 w-40 rounded-[2rem] bg-[#9cff00] opacity-80 md:block" />

      <div className="relative grid gap-4 rounded-[2rem] bg-[#e9e4d4] p-4 shadow-sm md:grid-cols-[0.9fr_1.4fr]">
        <div className="rounded-[1.5rem] bg-[#012f11] p-5 text-white">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-green-50">Sermon draft</p>
            <Badge variant="warning">Needs review</Badge>
          </div>

          <div className="mt-12">
            <div className="h-14 w-14 rounded-full bg-[#9cff00]" />
            <h3 className="mt-5 text-2xl font-semibold">The Good Shepherd</h3>
            <p className="mt-2 text-sm text-green-100">Psalm 23 · Sunday sermon</p>
          </div>

          <div className="mt-16 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-lime-200">
              Follow-up status
            </p>
            <p className="mt-2 text-sm text-green-50">
              Draft generated. Waiting for pastor approval.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] bg-[#fffdf7] p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#102015]">Email preview</p>
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs text-green-900">
                Draft
              </span>
            </div>

            <div className="mt-5 space-y-3">
              <div className="h-3 w-3/4 rounded-full bg-stone-200" />
              <div className="h-3 w-full rounded-full bg-stone-200" />
              <div className="h-3 w-5/6 rounded-full bg-stone-200" />
            </div>

            <div className="mt-6 rounded-2xl bg-[#f4f1e8] p-4">
              <p className="text-sm font-medium text-[#102015]">
                We missed you Sunday.
              </p>
              <p className="mt-2 text-xs leading-5 text-stone-600">
                Here are three takeaways from this week&apos;s sermon and a few
                questions for reflection.
              </p>
            </div>
          </div>

          <div className="rounded-[1.5rem] bg-[#fffdf7] p-5">
            <p className="text-sm font-semibold text-[#102015]">Review checklist</p>

            <div className="mt-5 space-y-3">
              {[
                "Transcript added",
                "Takeaways generated",
                "Questions reviewed",
                "Test email ready",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-full bg-[#f4f1e8] px-4 py-3"
                >
                  <span className="text-xs font-medium text-stone-700">{item}</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#9cff00]" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] bg-[#fffdf7] p-5 md:col-span-2">
            <p className="text-sm font-semibold text-[#102015]">
              Discussion questions
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                "Where did you see God’s care in the passage?",
                "What part of the sermon challenged you?",
                "How can you encourage someone this week?",
              ].map((question) => (
                <div
                  key={question}
                  className="rounded-2xl border border-[#ddd8c8] bg-white p-4 text-xs leading-5 text-stone-600"
                >
                  {question}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}