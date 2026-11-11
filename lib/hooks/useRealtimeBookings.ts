"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeBookings(
  spaceId?: string,
  onBookingChange?: (payload: unknown) => void
) {
  useEffect(() => {
    const supabase = createClient();
    const channelName = spaceId
      ? `realtime:space:${spaceId}`
      : "realtime:bookings:all";

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          ...(spaceId ? { filter: `space_id=eq.${spaceId}` } : {}),
        },
        (payload) => {
          if (onBookingChange) {
            onBookingChange(payload);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [spaceId, onBookingChange]);
}
