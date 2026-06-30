"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

interface AuthFormProps {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === "login";

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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-stone-800">
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
          <label
            htmlFor="password"
            className="block text-sm font-medium text-stone-800"
          >
            Password
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