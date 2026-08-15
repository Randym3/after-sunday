export function ExampleSection() {
  return (
    <section id="campaigns" className="marketing-grid border-b border-[#d9e0e7] py-24 sm:py-32">
      <div className="mx-auto grid max-w-[1180px] gap-12 px-5 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-20">
        <div>
          <div className="marketing-kicker"><span className="marketing-kicker-line" aria-hidden="true" />The output</div>
          <h2 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.065em] text-[#141a19] sm:text-6xl">
            A message that feels like your church.
          </h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-[#58615f]">
            The final email is warm, branded, and easy to read. It is generated
            from the sermon, reviewed by your team, and sent once to the people
            you choose.
          </p>
          <div className="mt-9 space-y-4 border-t border-[#cbd5d2] pt-6">
            <div className="flex gap-4 text-xs"><span className="font-mono text-[#2161e8]">01</span><span className="text-[#58615f]">Choose a group or specific members</span></div>
            <div className="flex gap-4 text-xs"><span className="font-mono text-[#2161e8]">02</span><span className="text-[#58615f]">Preview before anything leaves</span></div>
            <div className="flex gap-4 text-xs"><span className="font-mono text-[#2161e8]">03</span><span className="text-[#58615f]">Schedule one thoughtful send</span></div>
          </div>
        </div>

        <div className="rounded-2xl bg-[#101716] p-3 shadow-[0_24px_60px_-28px_rgba(16,23,22,0.65)] sm:p-4">
          <div className="rounded-xl bg-[#fffefa] p-6 sm:p-9">
            <div className="flex items-start justify-between gap-5 border-b border-[#dfe4df] pb-6">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#39846e]">After Sunday / email draft</p>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-[#141a19] sm:text-2xl">We missed you this Sunday</h3>
              </div>
              <span className="shrink-0 rounded-md bg-[#e2f4eb] px-2 py-1 font-mono text-[9px] text-[#247456]">APPROVED</span>
            </div>
            <div className="space-y-5 pt-7 text-sm leading-7 text-[#58615f]">
              <p className="font-medium text-[#141a19]">Dear member,</p>
              <p>We missed you this Sunday and wanted to share a few reminders from the message. Pastor John reflected on Psalm 23 and the steady care of God in every season.</p>
              <div className="rounded-xl bg-[#edf3ff] p-5">
                <p className="font-semibold text-[#141a19]">Three takeaways</p>
                <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-[#58615f]">
                  <li>God knows and cares for His people personally.</li>
                  <li>God leads us even when the path is difficult.</li>
                  <li>God remains present with us in every valley.</li>
                </ol>
              </div>
              <div className="rounded-xl border border-[#dfe4df] p-5">
                <p className="font-semibold text-[#141a19]">Reflection questions</p>
                <p className="mt-2 text-sm">Where do you need to trust God’s care this week?</p>
              </div>
              <p>We’re praying for you and hope to see you soon.</p>
            </div>
            <div className="mt-8 border-t border-[#dfe4df] pt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-[#8b9690]">A thoughtful note from your church</div>
          </div>
        </div>
      </div>
    </section>
  );
}