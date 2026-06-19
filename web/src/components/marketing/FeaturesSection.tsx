import { landingFeatures } from "@/lib/constants/marketing";

export function FeaturesSection() {
  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#012f11]">
              Features
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#102015] sm:text-5xl">
              Simple tools for the people your church already cares about.
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {landingFeatures.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[2rem] border border-[#ddd8c8] bg-[#fffdf7] p-7"
              >
                <div className="mb-8 h-10 w-10 rounded-full bg-[#9cff00]" />
                <h3 className="text-xl font-semibold tracking-tight text-[#102015]">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}