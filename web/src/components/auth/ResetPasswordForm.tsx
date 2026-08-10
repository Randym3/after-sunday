"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [sessionState, setSessionState] = useState<
    "checking" | "ready" | "invalid"
  >("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The password-recovery email link carries a session in the URL hash;
  // supabase-js picks it up automatically. If there's no session, the
  // link is stale or invalid.
  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) {
        return;
      }
      setSessionState(data.session ? "ready" : "invalid");
    });

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);

    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirm) {
      setErrorMessage("Passwords don’t match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      // Password updated — clear the recovery session and go to login.
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sessionState === "checking") {
    return (
      <Card className="mx-auto w-full max-w-md">
        <p className="py-8 text-center text-sm text-stone-600">
          Checking your link…
        </p>
      </Card>
    );
  }

  if (sessionState === "invalid") {
    return (
      <Card className="mx-auto w-full max-w-md">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#012f11]">
            After Sunday
          </p>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#102015]">
            Invalid or expired link
          </h1>

          <p className="mt-3 text-sm leading-6 text-stone-600">
            This password reset link is invalid or has already been
            used. Request a new one to continue.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center rounded-full bg-[#012f11] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#073f19]"
          >
            Request a new link
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-[#fffdf7] px-5 py-2.5 text-sm font-medium text-stone-950 transition hover:bg-stone-100"
          >
            Back to log in
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#012f11]">
          After Sunday
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#102015]">
          Choose a new password
        </h1>

        <p className="mt-3 text-sm leading-6 text-stone-600">
          Enter a new password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-stone-800"
          >
            New password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#012f11]"
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>

        <div>
          <label
            htmlFor="confirm"
            className="block text-sm font-medium text-stone-800"
          >
            Confirm new password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#012f11]"
            placeholder="••••••••"
            minLength={6}
            required
          />
        </div>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Updating..." : "Set new password"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-600">
        <Link
          href="/login"
          className="font-medium text-[#012f11] hover:underline"
        >
          Back to log in
        </Link>
      </p>
    </Card>
  );
}
