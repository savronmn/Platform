'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase';

/** Subscribe to booking table changes and refetch when the tab regains focus. */
export function useBookingsRealtime(
    onRefresh: () => void,
    channelId = 'default',
    debounceMs = 0,
) {
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;

    useEffect(() => {
        const supabase = createClient();
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const refresh = () => {
            if (debounceMs <= 0) {
                onRefreshRef.current();
                return;
            }
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => onRefreshRef.current(), debounceMs);
        };

        const channel = supabase
            .channel(`bookings-realtime-${channelId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, refresh)
            .subscribe();

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            supabase.removeChannel(channel);
        };
    }, [channelId, debounceMs]);

    useEffect(() => {
        const refresh = () => {
            if (document.visibilityState === 'visible') onRefreshRef.current();
        };
        document.addEventListener('visibilitychange', refresh);
        window.addEventListener('focus', refresh);
        return () => {
            document.removeEventListener('visibilitychange', refresh);
            window.removeEventListener('focus', refresh);
        };
    }, []);
}
