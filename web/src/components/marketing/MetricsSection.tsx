import { landingMetrics } from "@/lib/constants/marketing";

export function MetricsSection() {
  return (
    <section className="bg-[#012f11] py-24 text-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9cff00]">
              Built for review
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
              AI can draft it. Your church still leads it.
            </h2>
          </div>

          <p className="max-w-xl text-sm leading-7 text-green-50">
            After Sunday should never feel like an auto-blast tool. It should feel
            like a quiet assistant that helps your church prepare thoughtful,
            reviewed, pastoral communication.
          </p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {landingMetrics.map((metric) => (
            <div
              key={metric.label}
              className="border-l border-[#9cff00] px-5 py-2"
            >
              <p className="text-5xl font-semibold tracking-[-0.05em]">
                {metric.value}
              </p>
              <p className="mt-3 text-sm leading-6 text-green-100">
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}