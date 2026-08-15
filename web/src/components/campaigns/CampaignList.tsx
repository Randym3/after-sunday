"use client";

import Link from "next/link";

import {
  bulkDeleteCampaigns,
  deleteCampaign,
  listCampaigns,
} from "@/lib/api/campaigns";
import type { Campaign } from "@/types/campaign";

import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import type { DataTableColumn } from "@/components/ui/DataTable";
import type { FilterColumn } from "@/components/ui/FilterMenu";
import { useToast } from "@/components/ui/Toast";


function formatSchedule(campaign: Campaign): string {
  const date = new Date(campaign.sendAt);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const COLUMNS: DataTableColumn<Campaign>[] = [
  {
    key: "name",
    label: "Campaign",
    render: (campaign) => (
      <div>
        <Link
          href={`/app/email-campaigns/${campaign.id}`}
          className="font-medium text-ink transition hover:text-primary"
        >
          {campaign.name}
        </Link>
        {campaign.sermonTitle ? (
          <p className="text-xs text-ink-soft">From: {campaign.sermonTitle}</p>
        ) : null}
      </div>
    ),
  },
  {
    key: "recipientCount",
    label: "Recipients",
    render: (campaign) => (
      <span className="text-ink-soft">
        {campaign.recipientCount} via{" "}
        {campaign.recipientSource === "group" ? "group" : "selected members"}
      </span>
    ),
  },
  {
    key: "schedule",
    label: "Schedule",
    render: (campaign) => <span className="text-ink-soft">{formatSchedule(campaign)}</span>,
  },
  {
    key: "status",
    label: "Status",
    render: (campaign) => (
      <span className="capitalize text-ink-soft">{campaign.status}</span>
    ),
  },
  {
    key: "createdAt",
    label: "Created",
    render: (campaign) => (
      <span className="text-ink-soft">
        {new Date(campaign.createdAt).toLocaleDateString()}
      </span>
    ),
  },
];

const FILTER_COLUMNS: FilterColumn[] = [
  { key: "name", label: "Name", type: "entity" },
  { key: "status", label: "Status", type: "entity" },
];

export function CampaignList() {
  const { toast } = useToast();

  return (
    <DataTable
      columns={COLUMNS}
      filterColumns={FILTER_COLUMNS}
      fetchRows={listCampaigns}
      getRowId={(campaign) => campaign.id}
      defaultSort={{ key: "createdAt", dir: "desc" }}
      countLabel={(count) => `${count} ${count === 1 ? "campaign" : "campaigns"}`}
      editHref={(campaign) => `/app/email-campaigns/${campaign.id}`}
      onDelete={async (campaign) => {
        await deleteCampaign(campaign.id);
        toast(`Campaign "${campaign.name}" deleted`, "success");
      }}
      onBulkDelete={async (ids) => {
        await bulkDeleteCampaigns(ids);
        toast(`${ids.length} ${ids.length === 1 ? "campaign" : "campaigns"} deleted`, "success");
      }}
      deleteConfirmTitle={() => "Delete campaign?"}
      deleteConfirmDescription={(campaign) =>
        `"${campaign.name}" will be permanently deleted. This cannot be undone.`
      }
      errorMessage="Could not load campaigns."
      emptyTitle="No campaigns yet"
      emptyDescription="Create a campaign to send a sermon follow-up to a group or selected members."
      emptyAction={
        <Link href="/app/email-campaigns/new">
          <Button>New Campaign</Button>
        </Link>
      }
    />
  );
}
