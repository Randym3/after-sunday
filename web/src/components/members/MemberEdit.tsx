"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { getMember, updateMember } from "@/lib/api/members";
import type { CreateMemberInput, Member } from "@/types/member";

import { MemberForm } from "@/components/members/MemberForm";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

interface MemberEditProps {
  memberId: string;
}

function apiErrorToMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401)
    return "Your session has expired. Please log out and in again.";
  if (err instanceof Error) return err.message;
  return "Could not load this member.";
}

export function MemberEdit({ memberId }: MemberEditProps) {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    getMember(memberId)
      .then((m) => {
        if (!cancelled) setMember(m);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(apiErrorToMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  async function handleSubmit(values: CreateMemberInput) {
    await updateMember(memberId, values);
    router.push("/app/members");
    router.refresh();
  }

  function handleCancel() {
    router.push("/app/members");
  }

  if (error) {
    return (
      <div className="space-y-6 py-10">
        <Link
          href="/app/members"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-primary"
        >
          <span aria-hidden="true">←</span>
          Back to members
        </Link>

        <div>
          <h1 className="text-2xl font-semibold text-ink">
            Unable to load this member
          </h1>

          <p className="mt-2 text-sm leading-6 text-ink-soft">{error}</p>
        </div>
      </div>
    );
  }

  if (member === null) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-ink-soft">
          Loading member…
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <Link
          href="/app/members"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-primary"
        >
          <span aria-hidden="true">←</span>
          Back to members
        </Link>
      </div>

      <PageHeader
        title={`${member.firstName} ${member.lastName}`}
        description={[member.email, member.role]
          .filter(Boolean)
          .join(" · ")}
      />

      <MemberForm
        member={member}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
