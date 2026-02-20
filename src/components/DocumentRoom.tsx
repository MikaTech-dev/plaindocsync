import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from "@liveblocks/react/suspense";
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { useDocumentPresence } from '../hooks/useDocumentPresence';
import { Editor } from './Editor';
import { Loader2 } from 'lucide-react';

export function DocumentRoom({ session }: { session: Session }) {
    const { id } = useParams<{ id: string }>();
    // Use the hook to determine presence
    const { isCollaborating } = useDocumentPresence(id!, session);
    const [docPublic, setDocPublic] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            supabase.from('documents').select('is_public').eq('id', id).single()
                .then(({ data }) => {
                    if (data) setDocPublic(data.is_public);
                    setLoading(false);
                });
        }
    }, [id]);

    if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    // Debugging log
    console.log(`Doc ${id}: Public=${docPublic}, Collab=${isCollaborating}`);

    // Condition: Public AND > 1 user present
    const shouldEnterRoom = docPublic;

    if (shouldEnterRoom) {
        return (
            <LiveblocksProvider publicApiKey={import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY}>
                <RoomProvider id={`room:${id}`} initialPresence={{}}>
                    <ClientSideSuspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /> Loading Room...</div>}>
                        <Editor session={session} isCollab={true} />
                    </ClientSideSuspense>
                </RoomProvider>
            </LiveblocksProvider>
        );
    }

    // Local Mode
    return <Editor session={session} isCollab={false} />;
}
