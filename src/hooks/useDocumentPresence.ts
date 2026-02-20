import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export function useDocumentPresence(docId: string, session: Session) {
    const [onlineUsers, setOnlineUsers] = useState<number>(1); // Self is always 1
    const [isCollaborating, setIsCollaborating] = useState(false);

    useEffect(() => {
        if (!docId) return;

        const channel = supabase.channel(`doc:${docId}`)
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                // Supabase presence state is { key: [Presence, ...] }
                const users = Object.values(state).flat().length;
                setOnlineUsers(users);

                // If > 1 user, we should be collaborating
                if (users > 1) {
                    setIsCollaborating(true);
                } else {
                    // Optional: Debounce this
                    setIsCollaborating(false);
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({
                        user_id: session.user.id,
                        online_at: new Date().toISOString(),
                    });
                }
            });

        return () => {
            channel.unsubscribe();
        };
    }, [docId, session.user.id]);

    return { onlineUsers, isCollaborating };
}
