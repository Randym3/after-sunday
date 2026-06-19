import { landingSteps } from "@/lib/constants/marketing";

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="bg-[#fffdf7] py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#012f11]">
            How it works
          </p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#102015] sm:text-6xl">
            From transcript to thoughtful follow-up.
          </h2>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {landingSteps.map((step) => (
            <div
              key={step.title}
              className="rounded-[2rem] border border-[#ddd8c8] bg-[#f4f1e8] p-7"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#012f11]">
                {step.eyebrow}
              </p>

              <h3 className="mt-8 text-2xl font-semibold tracking-tight text-[#102015]">
                {step.title}
              </h3>

              <p className="mt-4 text-sm leading-7 text-stone-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}