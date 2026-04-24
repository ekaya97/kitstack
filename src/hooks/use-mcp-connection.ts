"use client";

import { useQuery } from "@tanstack/react-query";

interface McpConnectionResponse {
  connected: boolean;
  reason?: string;
}

export function useMcpConnection() {
  return useQuery<McpConnectionResponse>({
    queryKey: ["mcpConnection"],
    queryFn: async () => {
      const res = await fetch("/api/check-mcp-connection");
      return res.json();
    },
    staleTime: 30 * 1000,
  });
}
