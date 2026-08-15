"use client";

import { useEffect, useState } from "react";

import { listGroups } from "@/lib/api/groups";
import type { Group } from "@/types/group";

import { MemberFormModal } from "@/components/members/MemberFormModal";
import { Button } from "@/components/ui/Button";

export function AddMemberButton() {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

  useEffect(() => {
    listGroups()
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoading(false));
  }, []);

  return (
    <>
      <Button variant="mint" onClick={() => setOpen(true)}>
        Add Member
      </Button>
      <MemberFormModal
        open={open}
        onClose={() => setOpen(false)}
        groups={groups}
        groupsLoading={groupsLoading}
      />
    </>
  );
}
