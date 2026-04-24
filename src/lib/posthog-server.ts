import { PostHog } from "posthog-node";
import { Resource } from "sst";

let _client: PostHog | null = null;

export function getPostHogServer(): PostHog | null {
  const key = Resource.PosthogKey.value || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;

  if (!_client) {
    _client = new PostHog(key, {
      host: Resource.PosthogHost.value ?? "https://eu.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return _client;
}
