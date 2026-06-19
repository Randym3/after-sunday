export function ExampleSection() {
  return (
    <section id="example" className="bg-[#fffdf7] py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#012f11]">
            Example follow-up
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#102015] sm:text-5xl">
            Give people something meaningful to carry into the week.
          </h2>
          <p className="mt-5 text-sm leading-7 text-stone-600">
            A sermon follow-up can include a short encouragement, key takeaways,
            reflection questions, and a reminder that their church family missed them.
          </p>
        </div>

        <div className="rounded-[2rem] bg-[#012f11] p-4">
          <div className="rounded-[1.5rem] bg-[#fffdf7] p-7">
            <div className="flex items-center justify-between border-b border-[#ddd8c8] pb-5">
              <div>
                <p className="text-xs text-stone-500">Subject</p>
                <h3 className="mt-1 text-lg font-semibold text-[#102015]">
                  We missed you this Sunday
                </h3>
              </div>
              <span className="rounded-full bg-[#9cff00] px-3 py-1 text-xs font-medium text-[#012f11]">
                Draft
              </span>
            </div>

            <div className="space-y-5 pt-6 text-sm leading-7 text-stone-700">
              <p>Hi {"{{ firstName }}"},</p>

              <p>
                We missed you this Sunday and wanted to share a few takeaways from
                the message. Pastor focused on Psalm 23 and reminded us that God’s
                care is steady, personal, and present even in difficult seasons.
              </p>

              <div className="rounded-2xl bg-[#f4f1e8] p-5">
                <p className="font-semibold text-[#102015]">Reflection questions</p>
                <ul className="mt-3 list-inside list-disc space-y-2 text-stone-600">
                  <li>Where do you need to remember God’s care this week?</li>
                  <li>What part of the sermon challenged or encouraged you?</li>
                  <li>Who can you encourage with this passage?</li>
                </ul>
              </div>

              <p>
                We’re praying for you and hope to see you soon.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}