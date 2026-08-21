import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "@/components/LoginForm";

export const Route = createFileRoute("/organizer-login")({
  head: () => ({
    meta: [
      { title: "Organizer Login — HackSort AI" },
      { name: "description", content: "Sign in to manage your hackathon with HackSort AI." },
      { property: "og:title", content: "Organizer Login — HackSort AI" },
      { property: "og:description", content: "Sign in to manage your hackathon with HackSort AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <LoginForm
      role="organizer"
      title="Organizer Login"
      blurb="Run the event: participants, submissions, categories, judges, progress and exportable results."
      redirectTo="/organizer"
    />
  ),
});
