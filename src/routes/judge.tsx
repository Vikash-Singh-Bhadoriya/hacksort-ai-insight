import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardCheck,
  GitCompare,
  Gem,
  LayoutDashboard,
  Layers,
  ListChecks,
} from "lucide-react";
import { WorkspaceShell, type NavItem } from "@/components/WorkspaceShell";

const nav: NavItem[] = [
  { label: "Dashboard", to: "/judge", icon: LayoutDashboard },
  { label: "Submissions", to: "/judge/submissions", icon: ListChecks },
  { label: "Similarity Clusters", to: "/judge/clusters", icon: Layers },
  { label: "Potential Hidden Gems", to: "/judge/gems", icon: Gem },
  { label: "Compare", to: "/judge/compare", icon: GitCompare },
  { label: "Evaluations", to: "/judge/evaluations", icon: ClipboardCheck },
  { label: "Analytics", to: "/judge/analytics", icon: BarChart3 },
];

export const Route = createFileRoute("/judge")({
  head: () => ({
    meta: [
      { title: "Judge Workspace — HackSort AI" },
      { name: "description", content: "Review, cluster and compare hackathon submissions." },
      { property: "og:title", content: "Judge Workspace — HackSort AI" },
      { property: "og:description", content: "Review, cluster and compare hackathon submissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <WorkspaceShell role="judge" subtitle="Judge workspace" nav={nav}>
      <Outlet />
    </WorkspaceShell>
  ),
});
