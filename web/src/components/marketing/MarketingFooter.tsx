import Link from "next/link";

const footerLinks = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
  },
  {
    label: "Sermons",
    href: "/app/sermons",
  },
  {
    label: "Create sermon",
    href: "/app/sermons/new",
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#ddd8c8] py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-[#012f11]">After Sunday</p>
          <p className="mt-1 text-xs text-stone-500">
            Sermon follow-up for the people who missed Sunday.
          </p>
        </div>

        <div className="flex flex-wrap gap-5">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-stone-600 hover:text-[#012f11]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}