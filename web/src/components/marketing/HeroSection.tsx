import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ProductPreview } from "@/components/marketing/ProductPreview";

export function HeroSection() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-20 pt-12 text-center sm:px-8 sm:pt-20">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto mb-6 inline-flex rounded-full border border-[#ddd8c8] bg-[#fffdf7] px-4 py-2 text-xs font-medium text-stone-700">
          Sermon follow-up for churches
        </div>

        <h1 className="text-5xl font-semibold tracking-[-0.06em] text-[#102015] sm:text-7xl lg:text-8xl">
          Continue the care that started on Sunday.
        </h1>

        <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-stone-600 sm:text-lg">
          After Sunday helps churches turn sermon transcripts into warm follow-up
          emails, takeaways, and discussion questions for people who missed service.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/app/dashboard">
            <Button>Start building</Button>
          </Link>

          <a href="#how-it-works">
            <Button variant="secondary">See how it works</Button>
          </a>
        </div>
      </div>

      <ProductPreview />
    </section>
  );
}