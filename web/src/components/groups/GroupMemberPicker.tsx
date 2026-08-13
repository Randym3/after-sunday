"use client";

import { ReactNode, useState } from "react";

import { cn } from "@/lib/utils/cn";
import type { Member } from "@/types/member";

const DRAG_TYPE = "application/x-after-sunday-member";

interface GroupMemberPickerProps {
  members: Member[];
  memberIds: Set<string>;
  onAdd: (memberId: string) => void;
  onRemove: (memberId: string) => void;
  busy: boolean;
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

interface MemberRowProps {
  member: Member;
  checked: boolean;
  onToggle: () => void;
  disabled: boolean;
}

function MemberRow({ member, checked, onToggle, disabled }: MemberRowProps) {
  return (
    <label
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, member.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "group flex cursor-pointer select-none items-center gap-3 rounded-xl border border-edge bg-panel-2 px-3 py-2.5 transition hover:border-primary/40 hover:bg-panel",
        checked ? "" : "cursor-grab active:cursor-grabbing",
      )}
    >
      <span
        aria-hidden="true"
        className="text-sm leading-none text-ink-soft/50 transition group-hover:text-ink-soft"
      >
        ⠿
      </span>
      <Avatar name={member.firstName} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">
          {member.firstName} {member.lastName}
        </span>
        <span className="block truncate text-xs text-ink-soft">
          {member.email}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={disabled}
        className="h-4 w-4 rounded border-edge accent-primary"
        aria-label={`${checked ? "Remove" : "Add"} ${member.firstName} ${member.lastName}`}
      />
    </label>
  );
}

interface PanelProps {
  title: string;
  hint: string;
  count: number;
  highlighted: boolean;
  className?: string;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (event: React.DragEvent) => void;
  children: ReactNode;
}

function Panel({
  title,
  hint,
  count,
  highlighted,
  className,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: PanelProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex min-h-72 flex-col rounded-2xl border bg-panel p-4 shadow-sm transition",
        highlighted
          ? "border-primary ring-2 ring-primary/20"
          : "border-edge",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
        </div>
        <span className="flex-shrink-0 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
          {count}
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {children}
      </div>
    </div>
  );
}

export function GroupMemberPicker({
  members,
  memberIds,
  onAdd,
  onRemove,
  busy,
}: GroupMemberPickerProps) {
  const [dragOver, setDragOver] = useState<"available" | "in-group" | null>(
    null,
  );

  const inGroup = members.filter((member) => memberIds.has(member.id));
  const available = members.filter((member) => !memberIds.has(member.id));

  function handleDrop(target: "available" | "in-group") {
    return (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(null);
      if (busy) return;
      const id = event.dataTransfer.getData(DRAG_TYPE);
      if (!id) return;
      if (target === "in-group") onAdd(id);
      else onRemove(id);
    };
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Panel
        title="In this group"
        hint="Uncheck or drag out to remove"
        count={inGroup.length}
        highlighted={dragOver === "in-group"}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(null)}
        onDrop={handleDrop("in-group")}
        className="lg:col-span-3"
      >
        {inGroup.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-soft">
            No members yet — check or drop members to add them.
          </p>
        ) : (
          inGroup.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              checked
              disabled={busy}
              onToggle={() => onRemove(member.id)}
            />
          ))
        )}
      </Panel>

      <Panel
        title="Available members"
        hint="Check or drag to add"
        count={available.length}
        highlighted={dragOver === "available"}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(null)}
        onDrop={handleDrop("available")}
        className="lg:col-span-2"
      >
        {available.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-soft">
            Everyone is already in this group.
          </p>
        ) : (
          available.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              checked={false}
              disabled={busy}
              onToggle={() => onAdd(member.id)}
            />
          ))
        )}
      </Panel>
    </div>
  );
}
