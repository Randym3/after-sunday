"use client";

import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function UserGreeting() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setEmail(data.user?.email ?? null);
      })
      .catch(() => {
        if (!cancelled) setEmail(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!email) return null;

  return (
    <p className="text-sm font-medium text-ink-soft">
      Hello, <span className="text-primary">{email}</span>
    </p>
  );
}
