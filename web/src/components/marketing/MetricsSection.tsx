import { landingMetrics } from "@/lib/constants/marketing";

export function MetricsSection() {
  return (
    <section className="border-b border-[#26332f] bg-[#101716] py-12 text-white">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-5 sm:px-8 md:grid-cols-3 md:gap-0">
        {landingMetrics.map((metric, index) => (
          <div key={metric.label} className={`flex items-center gap-4 md:px-8 ${index > 0 ? "border-t border-[#2b3833] pt-6 md:border-l md:border-t-0 md:pt-0" : ""}`}>
            <span className="font-mono text-3xl text-[#5e9df8]">{metric.value}</span>
            <span className="max-w-[180px] text-xs leading-5 text-[#b1bcb6]">{metric.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}