import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  BarChart3,
  LayoutDashboard,
  ListChecks,
  Tags,
  Trophy,
  Users,
  UserCheck,
} from "lucide-react";
import { WorkspaceShell, type NavItem } from "@/components/WorkspaceShell";

const nav: NavItem[] = [
  { label: "Dashboard", to: "/organizer", icon: LayoutDashboard },
  { label: "Participants", to: "/organizer/participants", icon: Users },
  { label: "Submissions", to: "/organizer/submissions", icon: ListChecks },
  { label: "Categories", to: "/organizer/categories", icon: Tags },
  { label: "Judges", to: "/organizer/judges", icon: UserCheck },
  { label: "Analytics", to: "/organizer/analytics", icon: BarChart3 },
  { label: "Results", to: "/organizer/results", icon: Trophy },
];

export const Route = createFileRoute("/organizer")({
  head: () => ({
    meta: [
      { title: "Organizer Workspace — HackSort AI" },
      {
        name: "description",
        content: "Manage participants, judges, categories and results for your hackathon.",
      },
      { property: "og:title", content: "Organizer Workspace — HackSort AI" },
      {
        property: "og:description",
        content: "Manage participants, judges, categories and results.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <WorkspaceShell role="organizer" subtitle="Organizer workspace" nav={nav}>
      <Outlet />
    </WorkspaceShell>
  ),
});
