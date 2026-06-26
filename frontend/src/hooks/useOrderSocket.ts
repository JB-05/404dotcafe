"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getSession } from "@/lib/auth";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

type OrderSocketOptions = {
  orderId?: number;
  queryKeys?: string[][];
  enabled?: boolean;
};

export function useOrderSocket({ orderId, queryKeys = [], enabled = true }: OrderSocketOptions = {}) {
  const queryClient = useQueryClient();
  const keysKey = JSON.stringify(queryKeys);

  useEffect(() => {
    if (!enabled) return;

    const session = getSession();
    const params = new URLSearchParams();
    if (session?.access_token) {
      params.set("token", session.access_token);
    } else if (orderId != null) {
      params.set("order_id", String(orderId));
    } else {
      return;
    }

    const url = `${WS_URL.replace(/\/$/, "")}/ws/orders?${params}`;
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(url);

      ws.onmessage = () => {
        for (const key of queryKeys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
        if (orderId != null) {
          queryClient.invalidateQueries({ queryKey: ["order", orderId] });
        }
      };

      ws.onclose = () => {
        if (!closed) {
          retryTimer = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, [enabled, orderId, queryClient, keysKey]);
}
