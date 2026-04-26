"use client";

import { useEffect } from "react";
import { trackSkillPageViewed, trackKitPageViewed } from "@/lib/analytics";

export function TrackSkillPageView({ slug }: { slug: string }) {
  useEffect(() => {
    trackSkillPageViewed(slug);
  }, [slug]);
  return null;
}

export function TrackKitPageView({ slug }: { slug: string }) {
  useEffect(() => {
    trackKitPageViewed(slug);
  }, [slug]);
  return null;
}
