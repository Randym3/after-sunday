import Link from "next/link";
import { Button } from "@/components/ui/Button";

const questions = [
  ["Do I need a perfect transcript?", "No. Start with a recording, notes, or the transcript you already have. The workflow can improve as your process gets better."],
  ["Does AI send emails automatically?", "No. Drafts need human review and approval. You choose the recipients and when a campaign goes out."],
  ["Can I test the email first?", "Yes. Send a test to a member or any email address before approving the final campaign."],
];

export function CtaSection() {
  return (
    <section id="faq" className="marketing-grid py-24 sm:py-32">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-8">
        <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="marketing-kicker"><span className="marketing-kicker-line" aria-hidden="true" />Start here</div>
            <h2 className="mt-5 text-4xl font-semibold leading-[0.98] tracking-[-0.065em] text-[#141a19] sm:text-6xl">
              Make the next Sunday easier.
            </h2>
            <p className="mt-6 max-w-md text-sm leading-7 text-[#58615f]">
              Bring one sermon into the app and see the whole loop before you
              decide what your church needs next.
            </p>
            <div className="mt-8">
              <Link href="/app/dashboard">
                <Button className="rounded-lg bg-[#151b1a] px-5 py-3 text-sm text-white shadow-none hover:bg-[#28312f]">
                  Open After Sunday <span className="ml-3" aria-hidden="true">↗</span>
                </Button>
              </Link>
            </div>
          </div>

          <div className="divide-y divide-[#d5dedb] border-y border-[#cbd5d2]">
            {questions.map(([question, answer]) => (
              <div key={question} className="grid gap-3 py-6 sm:grid-cols-[0.75fr_1.25fr] sm:gap-8">
                <h3 className="text-sm font-semibold text-[#141a19]">{question}</h3>
                <p className="text-sm leading-6 text-[#68716e]">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}