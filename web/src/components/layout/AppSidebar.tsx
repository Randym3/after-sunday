"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { LogoutButton } from "@/components/auth/LogoutButton";
import { appNavigationItems } from "@/lib/constants/navigation";
import { getBrandingSettings } from "@/lib/api/settings";
import { cn } from "@/lib/utils/cn";
import type { BrandingSettings } from "@/types/settings";

export function AppSidebar() {
  const pathname = usePathname();
  const [branding, setBranding] = useState<BrandingSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBrandingSettings()
      .then((data) => {
        if (!cancelled) setBranding(data);
      })
      .catch(() => {
        // Branding is optional — keep the default name.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="sticky top-0 hidden h-screen w-72 flex-col border-r border-[#2b2b4a] bg-[#17172c] px-5 py-6 lg:flex">
      <Link href="/app/dashboard" className="block">
        <div className="flex items-center gap-3">
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}${branding.logoUrl}`}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <div>
            <div className="text-lg font-semibold tracking-tight text-[#34d399]">
              {branding?.organizationName || "After Sunday"}
            </div>
            <div className="mt-1 text-xs text-[#8b90ab]">
              Sermon follow-up for churches
            </div>
          </div>
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
