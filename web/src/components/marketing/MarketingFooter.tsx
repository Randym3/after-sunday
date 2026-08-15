import Link from "next/link";

const footerLinks = [
  { label: "Dashboard", href: "/app/dashboard" },
  { label: "Sermons", href: "/app/sermons" },
  { label: "Campaigns", href: "/app/email-campaigns" },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#d9e0e7] bg-[#f8faf7] py-8">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="marketing-mark" aria-hidden="true">AS</span>
          <div>
            <p className="text-xs font-bold text-[#141a19]">After Sunday</p>
            <p className="mt-1 text-[10px] text-[#7b8581]">A calmer way to follow up.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-5">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="text-xs text-[#68716e] transition hover:text-[#141a19]">{link.label}</Link>
          ))}
        </div>
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#8b9690]">Built for care · 2026</p>
      </div>
    </footer>
  );
}