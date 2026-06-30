import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/app/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f1e8] px-4 py-12">
      {children}
    </main>
  );
}