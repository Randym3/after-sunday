"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { createMember } from "@/lib/api/members";
import type { CreateMemberInput } from "@/types/member";

import { MemberForm } from "@/components/members/MemberForm";

export function MemberCreate() {
  const router = useRouter();

  async function handleSubmit(values: CreateMemberInput) {
    await createMember(values);
    router.push("/app/members");
    router.refresh();
  }

  function handleCancel() {
    router.push("/app/members");
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

      <MemberForm onCancel={handleCancel} onSubmit={handleSubmit} />
    </div>
  );
}
