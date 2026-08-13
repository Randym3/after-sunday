"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

interface LogoutButtonProps {
  variant?: "secondary" | "dark";
}

export function LogoutButton({ variant = "secondary" }: LogoutButtonProps) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

    router.push("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant={variant} onClick={handleLogout}>
      Log out
    </Button>
  );
}
