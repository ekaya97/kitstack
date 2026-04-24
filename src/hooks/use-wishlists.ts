"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface WishlistItem {
  targetType: string;
  targetSlug: string;
  createdAt: string | null;
}

interface WishlistsResponse {
  wishlists: WishlistItem[];
}

export function useWishlists() {
  return useQuery<WishlistsResponse>({
    queryKey: ["wishlists"],
    queryFn: async () => {
      const res = await fetch("/api/wishlists");
      if (!res.ok) return { wishlists: [] };
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useIsWishlisted(targetType: string, targetSlug: string) {
  const { data } = useWishlists();
  return (
    data?.wishlists?.some(
      (w) => w.targetType === targetType && w.targetSlug === targetSlug
    ) ?? false
  );
}

export function useToggleWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      targetType,
      targetSlug,
      wishlisted,
    }: {
      targetType: string;
      targetSlug: string;
      wishlisted: boolean;
    }) => {
      const res = await fetch("/api/wishlists", {
        method: wishlisted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetSlug }),
      });
      if (!res.ok) throw new Error("Failed to toggle wishlist");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlists"] });
    },
  });
}
