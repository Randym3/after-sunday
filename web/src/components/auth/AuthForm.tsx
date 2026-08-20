"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const isLogin = mode === "login";

  async function handleGoogleSignIn() {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErrorMessage(error.message);
        toast(error.message, "error");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const response = isLogin
        ? await supabase.auth.signInWithPassword({
            email,
            password,
          })
        : await supabase.auth.signUp({
            email,
            password,
          });

      if (response.error) {
        setErrorMessage(response.error.message);
        toast(response.error.message, "error");
        return;
      }

      if (!isLogin && !response.data.session) {
        setSuccessMessage("Check your email to confirm your account.");
        return;
      }

      router.push("/app/dashboard");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#012f11]">
          After Sunday
        </p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#102015]">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>

        <p className="mt-3 text-sm leading-6 text-stone-600">
          {isLogin
            ? "Log in to manage sermon follow-ups."
            : "Start preparing sermon follow-ups for your church."}
        </p>
      </div>

      <div className="space-y-3">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading}
        >
          {isGoogleLoading ? (
            "Redirecting to Google..."
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </Button>

        <div className="flex items-center gap-3 pt-1">
          <div className="h-px flex-1 bg-[#e5e0d0]" />
          <span className="text-xs font-medium uppercase tracking-wider text-stone-400">
            or
          </span>
          <div className="h-px flex-1 bg-[#e5e0d0]" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-stone-800">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-[#ddd8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#012f11]"
            placeholder="you@church.com"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-stone-800"
            >
              Password
            </label>

            {isLogin ? (
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-[#012f11] hover:underline"
              >
                Forgot password?
              </Link>
            ) : null}
          </div>
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

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {successMessage}
          </div>
        ) : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting
            ? isLogin
              ? "Logging in..."
              : "Creating account..."
            : isLogin
              ? "Log in"
              : "Sign up"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-stone-600">
        {isLogin ? "No account yet?" : "Already have an account?"}{" "}
        <Link
          href={isLogin ? "/signup" : "/login"}
          className="font-medium text-[#012f11] hover:underline"
        >
          {isLogin ? "Sign up" : "Log in"}
        </Link>
      </p>
    </Card>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}