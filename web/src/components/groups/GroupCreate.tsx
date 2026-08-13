"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { createGroup } from "@/lib/api/groups";
import type { CreateGroupInput } from "@/types/group";

import { GroupForm } from "@/components/groups/GroupForm";

export function GroupCreate() {
  const router = useRouter();

  async function handleSubmit(values: CreateGroupInput) {
    await createGroup(values);
    router.push("/app/groups");
    router.refresh();
  }

  function handleCancel() {
    router.push("/app/groups");
  }

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <Link
          href="/app/groups"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft transition hover:text-primary"
        >
          <span aria-hidden="true">←</span>
          Back to groups
        </Link>
      </div>

      <GroupForm onCancel={handleCancel} onSubmit={handleSubmit} />
    </div>
  );
}
