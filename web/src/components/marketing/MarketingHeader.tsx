import Link from "next/link";
import { marketingNavItems } from "@/lib/constants/marketing";
import { Button } from "@/components/ui/Button";
import { MobileMarketingNav } from "@/components/marketing/MobileMarketingNav";

export function MarketingHeader() {
  return (
    <header className="marketing-header sticky top-0 z-40 border-b border-[#d9e0e7] bg-[#f7f8f6]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="marketing-mark" aria-hidden="true">
            AS
          </span>
          <span className="text-sm font-bold tracking-[-0.02em] text-[#141a19]">
            After Sunday
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {marketingNavItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-xs font-medium text-[#58615f] transition hover:text-[#141a19]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-5 md:flex">
          <Link
            href="/app/dashboard"
            className="text-xs font-medium text-[#58615f] transition hover:text-[#141a19]"
          >
            Sign in
          </Link>
          <Link href="/app/dashboard">
            <Button className="rounded-lg bg-[#151b1a] px-4 py-2.5 text-xs text-white shadow-none hover:bg-[#28312f]">
              Open app <span className="ml-2" aria-hidden="true">↗</span>
            </Button>
          </Link>
        </div>

        <MobileMarketingNav />
      </div>
    </header>
  );
}