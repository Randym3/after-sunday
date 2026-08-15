import { landingSteps } from "@/lib/constants/marketing";

export function HowItWorksSection() {
  return (
    <section id="workflow" className="marketing-grid border-b border-[#d9e0e7] py-24 sm:py-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <div className="marketing-kicker">
              <span className="marketing-kicker-line" aria-hidden="true" />
              The workflow
            </div>
            <h2 className="mt-5 max-w-3xl text-4xl font-semibold leading-[0.98] tracking-[-0.065em] text-[#141a19] sm:text-6xl">
              One clear path from the sermon to the inbox.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-7 text-[#58615f]">
            The product follows the way your team already works. Capture the
            message, improve the draft, and decide what goes out — without adding
            another complicated system to Sunday morning.
          </p>
        </div>

        <div className="mt-14 overflow-hidden rounded-2xl border border-[#bdc9c7] bg-[#f8faf7]">
          <div className="grid border-b border-[#d2dcd9] lg:grid-cols-[160px_1fr]">
            <div className="border-b border-[#d2dcd9] p-6 lg:border-b-0 lg:border-r">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#2161e8]">01 / setup</p>
              <h3 className="mt-7 text-xl font-semibold leading-tight tracking-[-0.04em] text-[#141a19]">Run once per sermon.</h3>
              <p className="mt-3 text-xs leading-5 text-[#68716e]">Build the context that makes a useful follow-up possible.</p>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-3 sm:p-6">
              {landingSteps.map((step) => (
                <div key={step.number} className="rounded-xl border border-[#cbd5d2] bg-white p-4">
                  <span className="font-mono text-[10px] text-[#7c8984]">{step.number}</span>
                  <p className="mt-6 text-sm font-semibold text-[#141a19]">{step.title}</p>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#39846e]">{step.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid bg-[#101716] text-white lg:grid-cols-[160px_1fr]">
            <div className="border-b border-[#2a3531] p-6 lg:border-b-0 lg:border-r">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#5e9df8]">02 / repeat</p>
              <h3 className="mt-7 text-xl font-semibold leading-tight tracking-[-0.04em]">Use it every week.</h3>
              <p className="mt-3 text-xs leading-5 text-[#98a59f]">Every message moves through the same human review gate.</p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#315148] px-3 py-1.5 font-mono text-[9px] text-[#79d5ae]"><span>●</span> HUMAN IN CONTROL</div>
            </div>
            <div className="p-5 sm:p-6">
              <div className="grid gap-3 md:grid-cols-[1fr_36px_1fr_36px_1fr] md:items-center">
                <WorkflowCard label="DRAFT" command="/follow-up" detail="summary + takeaways" />
                <span className="hidden text-center font-mono text-[#5e9df8] md:block">→</span>
                <WorkflowCard label="REVIEW" command="/approve" detail="edit + test email" />
                <span className="hidden text-center font-mono text-[#5e9df8] md:block">→</span>
                <WorkflowCard label="SEND" command="/campaign" detail="group + schedule" active />
              </div>
              <div className="mt-5 rounded-lg border border-[#2d6cf0] bg-[#183373] px-4 py-3 font-mono text-[10px] text-[#dce8ff]">
                <span className="mr-5 text-[#74a9ff]">NEXT</span> another sermon, same calm loop
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorkflowCard({ label, command, detail, active = false }: { label: string; command: string; detail: string; active?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${active ? "border-[#4f89f4] bg-[#2161e8]" : "border-[#34433d] bg-[#17211d]"}`}>
      <p className="font-mono text-[9px] text-[#91a29a]">{label}</p>
      <p className="mt-5 font-mono text-sm font-semibold text-white">{command}</p>
      <p className="mt-2 text-[10px] text-[#a7b5ae]">{detail}</p>
    </div>
  );
}