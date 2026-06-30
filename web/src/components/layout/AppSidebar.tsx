import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { appNavigationItems } from "@/lib/constants/navigation";

export function AppSidebar() {
  return (
    <aside className="hidden min-h-screen w-72 flex-col border-r border-[#ddd8c8] bg-[#fffdf7] px-5 py-6 lg:flex">
      <Link href="/app/dashboard" className="block">
        <div className="text-lg font-semibold tracking-tight text-[#012f11]">
          After Sunday
        </div>
        <div className="mt-1 text-xs text-stone-500">
          Sermon follow-up for churches
        </div>
      </Link>

      <nav className="mt-10 space-y-1">
        {appNavigationItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-full px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-[#f4f1e8] hover:text-[#012f11]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto pt-8">
        <LogoutButton />
      </div>
    </aside>
  );
}