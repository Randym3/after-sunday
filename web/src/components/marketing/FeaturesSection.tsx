import { landingFeatures } from "@/lib/constants/marketing";

export function FeaturesSection() {
  return (
    <section id="sermons" className="border-b border-[#d9e0e7] bg-[#f8faf7] py-24 sm:py-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="marketing-kicker"><span className="marketing-kicker-line" aria-hidden="true" />Why it holds together</div>
            <h2 className="mt-5 max-w-md text-4xl font-semibold leading-[0.98] tracking-[-0.065em] text-[#141a19] sm:text-5xl">
              Less admin. More intentional care.
            </h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-[#58615f]">
              After Sunday gives a small church team one place to move from raw
              sermon material to a message they are proud to send.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {landingFeatures.map((feature) => (
              <div key={feature.number} className="border border-[#cbd5d2] bg-white p-6 transition hover:border-[#2161e8]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-[#2161e8]">{feature.number}</span>
                  <span className="h-2 w-2 rounded-full bg-[#57b992]" />
                </div>
                <h3 className="mt-12 text-lg font-semibold tracking-[-0.03em] text-[#141a19]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#68716e]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}