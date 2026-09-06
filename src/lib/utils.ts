import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Client-side pre-check that a string looks like a GitHub repository URL.
 * Host + path containment only — exact owner/repo validation happens
 * server-side in analyzeGithubRepository.
 */
export function isGithubRepoUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("https://") && !trimmed.startsWith("http://")) return false;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return false;
    return url.pathname.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}
