import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function CtaSection() {
  return (
    <section id="pricing" className="relative overflow-hidden py-28">
      <div className="absolute right-0 top-0 h-72 w-72 translate-x-20 rounded-[4rem] bg-[#9cff00]" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#012f11]">
            Start simple
          </p>
          <h2 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-[#102015] sm:text-7xl">
            Ready to follow up after Sunday?
          </h2>

          <p className="mt-6 max-w-2xl text-base leading-8 text-stone-600">
            Build the first sermon workflow, test it with one church, and keep the
            product focused on care before complexity.
          </p>

          <div className="mt-8">
            <Link href="/app/dashboard">
              <Button>Open app</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}