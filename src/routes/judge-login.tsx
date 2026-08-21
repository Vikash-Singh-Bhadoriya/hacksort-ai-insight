import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/LoginForm";

export const Route = createFileRoute("/judge-login")({
  head: () => ({
    meta: [
      { title: "Judge Login — HackSort AI" },
      { name: "description", content: "Sign in to the HackSort AI judge workspace." },
      { property: "og:title", content: "Judge Login — HackSort AI" },
      { property: "og:description", content: "Sign in to the HackSort AI judge workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LoginForm
      role="judge"
      title="Judge Login"
      blurb="Your workspace brings 24 submissions into clusters, gem candidates and comparable scorecards."
      redirectTo="/judge"
    />
  ),
});
