"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Invisible -- subscribes to Postgres changes on `table` (RLS-scoped, so a
// trainer only ever hears about their own rows unless `filter` narrows it
// further) and refreshes the current page's server data on any change, so
// a resolution made in someone else's tab shows up here without a reload.
export function RealtimeRefresh({ table, filter }: { table: string; filter?: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Realtime's RLS check runs against the socket's authenticated role, which
    // isn't populated until the session is read from cookies and pushed to the
    // realtime client -- subscribing before that finishes connects as `anon`,
    // silently receiving zero rows against a `to authenticated` policy. Await
    // the session and set it explicitly before opening the channel.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel(`realtime-refresh-${table}-${filter ?? "all"}`)
        .on(
          "postgres_changes",
          filter ? { event: "*", schema: "public", table, filter } : { event: "*", schema: "public", table },
          () => router.refresh()
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter]);

  return null;
}
