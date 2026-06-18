export interface NavigationItem {
  label: string;
  href: string;
}

export const appNavigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/app/dashboard",
  },
  {
    label: "Sermons",
    href: "/app/sermons",
  },
  {
    label: "Recipients",
    href: "/app/recipients",
  },
  {
    label: "Groups",
    href: "/app/groups",
  },
  {
    label: "Campaigns",
    href: "/app/email-campaigns",
  },
  {
    label: "Settings",
    href: "/app/settings",
  },
];