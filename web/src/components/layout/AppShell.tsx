import { ReactNode } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-app text-ink">
      <div className="flex">
        <AppSidebar />

        <main className="min-h-screen flex-1 px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
          <AppHeader />
          {children}
        </main>
      </div>
    </div>
  );
}