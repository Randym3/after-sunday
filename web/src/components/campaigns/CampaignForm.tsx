"use client";

import { useMemo, useState } from "react";
import type { Group } from "@/types/group";
import type { Member } from "@/types/member";
import type { Sermon } from "@/types/sermon";
import type { Campaign } from "@/types/campaign";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const inputClass = "w-full rounded-xl border border-edge bg-panel-2 px-3 py-2 text-sm text-ink outline-none focus:border-primary";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_SLOTS = [
  { label: "Morning (8:00 AM)", value: "08:00" },
  { label: "Afternoon (1:00 PM)", value: "13:00" },
  { label: "Evening (7:00 PM)", value: "19:00" },
  { label: "Night (9:00 PM)", value: "21:00" },
];

function nextOccurrence(day: number, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const candidate = new Date();
  candidate.setHours(hours, minutes, 0, 0);
  const daysAhead = (day - candidate.getDay() + 7) % 7;
  if (daysAhead === 0 && candidate.getTime() <= Date.now()) {
    candidate.setDate(candidate.getDate() + 7);
  } else {
    candidate.setDate(candidate.getDate() + daysAhead);
  }
  return candidate;
}

function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isoToLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface CampaignFormValues {
  name: string;
  subject?: string;
  body?: string;
  sermonId?: string;
  groupId?: string;
  memberIds?: string[];
  sendAt?: string;
  weeklyDay?: number;
  weeklyTime?: string;
}

interface CampaignFormProps {
  groups: Group[];
  members: Member[];
  sermons: Sermon[];
  campaign?: Campaign | null;
  error?: string;
  onSubmit: (input: CampaignFormValues) => Promise<void>;
}

export function CampaignForm({ groups, members, sermons, campaign, error, onSubmit }: CampaignFormProps) {
  const editing = Boolean(campaign);
  const [name, setName] = useState(campaign?.name ?? "");
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const [sermonId, setSermonId] = useState(campaign?.sermonId ?? "");
  const [source, setSource] = useState<"group" | "members">("group");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [scheduleMode, setScheduleMode] = useState<"specific" | "dayTime">("dayTime");
  const [sendAt, setSendAt] = useState(isoToLocalInput(campaign?.sendAt));
  const [weeklyDay, setWeeklyDay] = useState(0);
  const [weeklyTime, setWeeklyTime] = useState("08:00");
  const [saving, setSaving] = useState(false);

  const sermon = useMemo(() => sermons.find(item => item.id === sermonId), [sermons, sermonId]);
  const selectedGroup = groups.find(group => group.id === groupId);
  const groupHasNoMembers = source === "group" && selectedGroup?.memberCount === 0;
  const computedSendAt = useMemo(
    () => (scheduleMode === "dayTime" ? toLocalInput(nextOccurrence(weeklyDay, weeklyTime)) : sendAt),
    [scheduleMode, weeklyDay, weeklyTime, sendAt],
  );
  const computedDate = useMemo(
    () => (scheduleMode === "dayTime" ? nextOccurrence(weeklyDay, weeklyTime) : null),
    [scheduleMode, weeklyDay, weeklyTime],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing && !sermonId) return;
    if (!editing && source === "members" && memberIds.length === 0) return;

    const values: CampaignFormValues = {
      name: name.trim() || (editing ? campaign!.name : `${sermon?.title ?? "Sermon"} follow-up`),
      subject: subject.trim() || undefined,
      body: body.trim() || undefined,
      sendAt: computedSendAt,
    };
    if (!editing) {
      Object.assign(values, { sermonId, ...(source === "group" ? { groupId } : { memberIds }) });
    }

    setSaving(true);
    try { await onSubmit(values); }
    finally { setSaving(false); }
  }

  return <Card>
    <h2 className="text-lg font-semibold text-ink">{editing ? "Edit email campaign" : "New email campaign"}</h2>
    {editing ? null : <p className="mt-1 text-sm text-ink-soft">Choose a sermon to use its reviewed email draft.</p>}
    {error ? <div role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{error}</div> : null}
    <form onSubmit={submit} className="mt-5 space-y-5">
      {editing ? <div><p className="mb-1 text-sm font-semibold text-ink">Sermon</p><p className="text-sm text-ink-soft">{campaign?.sermonTitle ?? "—"}</p></div> : <div><label className="mb-1 block text-sm font-semibold text-ink" htmlFor="campaignSermon">Sermon</label><select id="campaignSermon" value={sermonId} onChange={e => setSermonId(e.target.value)} className={inputClass} required><option value="">Select a sermon</option>{sermons.map(item => <option key={item.id} value={item.id}>{item.title}{item.followUpSubject ? " — draft ready" : " — Needs email draft"}</option>)}</select></div>}
      {!editing && sermon ? <div className="rounded-xl border border-edge bg-panel-2 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Email draft preview</p>{sermon.followUpSubject && sermon.followUpBody ? <><h3 className="mt-2 font-semibold text-ink">{sermon.followUpSubject}</h3><p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-ink-soft">{sermon.followUpBody}</p></> : <p className="mt-2 text-sm font-medium text-amber-800">Needs email draft. Generate and approve a follow-up on the sermon first.</p>}</div> : null}
      <div><label className="mb-1 block text-sm font-semibold text-ink" htmlFor="campaignName">Campaign name</label><input id="campaignName" value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Sunday follow-up" /></div>
      <div><label className="mb-1 block text-sm font-semibold text-ink" htmlFor="campaignSubject">Email subject <span className="text-ink-soft">({editing ? "optional" : "defaults to the sermon draft"})</span></label><input id="campaignSubject" value={subject} onChange={e => setSubject(e.target.value)} className={inputClass} placeholder="A thought from Sunday" /></div>
      <div><label className="mb-1 block text-sm font-semibold text-ink" htmlFor="campaignBody">Email body <span className="text-ink-soft">({editing ? "optional" : "defaults to the sermon draft"})</span></label><textarea id="campaignBody" rows={6} value={body} onChange={e => setBody(e.target.value)} className={`${inputClass} resize-y leading-6`} /></div>
      {editing ? null : <fieldset><legend className="mb-2 text-sm font-semibold text-ink">Recipients</legend><div className="flex gap-5 text-sm"><label><input type="radio" checked={source === "group"} onChange={() => setSource("group")} className="mr-2 accent-primary" />A group</label><label><input type="radio" checked={source === "members"} onChange={() => setSource("members")} className="mr-2 accent-primary" />Specific members</label></div>{source === "group" ? <><select value={groupId} onChange={e => setGroupId(e.target.value)} className={`${inputClass} mt-3`} required><option value="">Select a group</option>{groups.map(group => <option key={group.id} value={group.id} disabled={group.memberCount === 0}>{group.name} ({group.memberCount} members{group.memberCount === 0 ? " — no members" : ""})</option>)}</select>{groupHasNoMembers ? <p className="mt-2 text-sm font-medium text-amber-800">This group has no members. Add members before creating a campaign.</p> : null}</> : <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-edge p-3">{members.map(member => <label key={member.id} className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={memberIds.includes(member.id)} onChange={e => setMemberIds(ids => e.target.checked ? [...ids, member.id] : ids.filter(id => id !== member.id))} className="accent-primary" />{member.firstName} {member.lastName} <span className="text-ink-soft">({member.email})</span></label>)}</div>}</fieldset>}
      {editing ? <fieldset><legend className="mb-2 text-sm font-semibold text-ink">When should it go out?</legend><input type="datetime-local" value={sendAt} onChange={e => setSendAt(e.target.value)} className={`${inputClass} mt-1`} required /></fieldset> : <fieldset><legend className="mb-2 text-sm font-semibold text-ink">When should it go out?</legend><div className="flex gap-5 text-sm"><label><input type="radio" checked={scheduleMode === "specific"} onChange={() => setScheduleMode("specific")} className="mr-2 accent-primary" />Specific date &amp; time</label><label><input type="radio" checked={scheduleMode === "dayTime"} onChange={() => setScheduleMode("dayTime")} className="mr-2 accent-primary" />Next day &amp; time</label></div>{scheduleMode === "specific" ? <input type="datetime-local" value={sendAt} onChange={e => setSendAt(e.target.value)} className={`${inputClass} mt-3`} required /> : <><div className="mt-3 flex flex-wrap gap-3"><select value={weeklyDay} onChange={e => setWeeklyDay(Number(e.target.value))} className={inputClass} style={{ width: "auto" }}>{DAY_LABELS.map((label, index) => <option key={label} value={index}>{label}</option>)}</select><select value={weeklyTime} onChange={e => setWeeklyTime(e.target.value)} className={inputClass} style={{ width: "auto" }}>{TIME_SLOTS.map(slot => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select></div>{computedDate ? <p className="mt-2 text-sm font-medium text-ink-soft">This will go out {computedDate.toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.</p> : null}</>}</fieldset>}
      <div className="flex items-center gap-3"><Button type="submit" disabled={saving || (!editing && groupHasNoMembers)}>{saving ? "Saving…" : editing ? "Save changes" : "Create campaign"}</Button></div>
    </form>
  </Card>;
}
