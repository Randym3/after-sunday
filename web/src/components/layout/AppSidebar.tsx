"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { appNavigationItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils/cn";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-72 flex-col border-r border-[#2b2b4a] bg-[#17172c] px-5 py-6 lg:flex">
      <Link href="/app/dashboard" className="block">
        <div className="text-lg font-semibold tracking-tight text-[#34d399]">
          After Sunday
        </div>
        <div className="mt-1 text-xs text-[#8b90ab]">
          Sermon follow-up for churches
        </div>
      </Link>

      <nav className="mt-10 space-y-1">
        {appNavigationItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-full px-4 py-2.5 text-sm font-medium transition",
                isActive
                  ? "bg-[#1e1e3a] text-[#4878f0]"
                  : "text-[#8b90ab] hover:bg-[#1e1e3a] hover:text-[#f0f0f0]"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-8">
        <LogoutButton variant="dark" />
      </div>
    </aside>
  );
}
