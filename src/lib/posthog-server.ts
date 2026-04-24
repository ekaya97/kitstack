import { PostHog } from "posthog-node";
import { resource } from "./resource";

let _client: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  const key = resource("PosthogKey")?.value || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  if (!_client) {
    _client = new PostHog(key, {
      host: resource("PosthogHost")?.value ?? "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return _client;
}
