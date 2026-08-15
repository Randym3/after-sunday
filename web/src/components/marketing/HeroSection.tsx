import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ProductPreview } from "@/components/marketing/ProductPreview";

export function HeroSection() {
  return (
    <section className="marketing-grid relative overflow-hidden border-b border-[#d9e0e7]">
      <div className="marketing-wire marketing-wire-left" aria-hidden="true" />
      <div className="marketing-wire marketing-wire-right" aria-hidden="true" />

      <div className="mx-auto grid max-w-[1180px] gap-12 px-5 pb-20 pt-20 sm:px-8 sm:pt-28 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-16 lg:pb-28">
        <div>
          <div className="marketing-kicker">
            <span className="marketing-kicker-line" aria-hidden="true" />
            A follow-up system for churches
          </div>

          <h1 className="mt-7 max-w-[620px] text-[3.5rem] font-semibold leading-[0.94] tracking-[-0.075em] text-[#141a19] sm:text-7xl lg:text-[5.75rem]">
            Keep Sunday going.
            <span className="block text-[#2161e8]">All week long.</span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-8 text-[#58615f] sm:text-lg">
            After Sunday helps your church turn one sermon into a thoughtful,
            reviewable follow-up for the people who could not be there.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/app/dashboard">
              <Button className="w-full rounded-lg bg-[#151b1a] px-5 py-3 text-sm text-white shadow-none hover:bg-[#28312f] sm:w-auto">
                Start with a sermon <span className="ml-3" aria-hidden="true">↗</span>
              </Button>
            </Link>
            <a href="#workflow">
              <Button variant="secondary" className="w-full rounded-lg border-[#c8d0d2] bg-[#f7f8f6] px-5 py-3 text-sm shadow-none sm:w-auto">
                See the workflow
              </Button>
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#68716e]">
            <span><b className="mr-2 text-[#15815f]">●</b>Human review first</span>
            <span>Works with your existing sermon process</span>
          </div>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}