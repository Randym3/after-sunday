import Link from "next/link";
import { marketingNavItems } from "@/lib/constants/marketing";
import { Button } from "@/components/ui/Button";
import { MobileMarketingNav } from "@/components/marketing/MobileMarketingNav";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-[#f4f1e8]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#012f11] text-sm font-semibold text-[#9cff00]">
            AS
          </span>
          <span className="text-sm font-semibold tracking-tight text-[#102015]">
            After Sunday
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {marketingNavItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-stone-600 transition hover:text-[#012f11]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <Link href="/app/dashboard">
            <Button className="px-4 py-2 text-xs">Open app</Button>
          </Link>
        </div>

        <MobileMarketingNav />
      </div>
    </header>
  );
}