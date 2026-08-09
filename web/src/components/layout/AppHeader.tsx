import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";

export function AppHeader() {
  return (
    <header className="mb-6 flex items-center justify-between rounded-full border border-[#ddd8c8] bg-[#fffdf7] px-4 py-3 lg:hidden">
      <Link href="/app/dashboard" className="font-semibold text-[#012f11]">
        After Sunday
      </Link>

      <div className="flex items-center gap-3">
        <Link
          href="/app/sermons/new"
          className="text-sm font-medium text-[#012f11]"
        >
          New sermon
        </Link>

        <LogoutButton />
      </div>
    </header>
  );
}