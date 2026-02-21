import { useEffect, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { useRoom } from "@liveblocks/react/suspense";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";
import * as Y from "yjs";
import { supabase } from '../lib/supabase';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Globe, Lock, Menu, X, Link as LinkIcon, FileText, FileCode, Code, Bold, Italic, Strikethrough, List, ListOrdered, Quote, Pencil } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { ExportMenu } from './ExportMenu';
import { useExport } from '../hooks/useExport';
import { useAlert } from './AlertModal';

const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        // ensure minimum brightness for text readability
        const brighterValue = Math.max(value, 50);
        color += ('00' + brighterValue.toString(16)).substr(-2);
    }
    return color;
};

export function Editor({ session, isCollab = false }: { session: Session, isCollab?: boolean }) {
    return isCollab ? <CollabEditor session={session} /> : <LocalEditor session={session} />;
}

function LocalEditor({ session }: { session: Session }) {
    return <BaseEditor session={session} provider={null} ydoc={null} />;
}

function CollabEditor({ session }: { session: Session }) {
    const room = useRoom();
    const [provider, setProvider] = useState<LiveblocksYjsProvider | null>(null);
    const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

    useEffect(() => {
        const ydoc = new Y.Doc();
        const provider = new LiveblocksYjsProvider(room, ydoc);
        setYdoc(ydoc);
        setProvider(provider);

        return () => {
            ydoc?.destroy();
            provider?.destroy();
        };
    }, [room]);

    if (!ydoc || !provider) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /> Connecting...</div>;

    return <BaseEditor session={session} provider={provider} ydoc={ydoc} />;
}

// The shared Editor UI and Tiptap logic
function BaseEditor({ session, provider, ydoc }: { session: Session, provider: LiveblocksYjsProvider | null, ydoc: Y.Doc | null }) {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [docTitle, setDocTitle] = useState('Untitled');
    const [saving, setSaving] = useState(false);
    const [isPublic, setIsPublic] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { showAlert } = useAlert();

    // Debounced save (simple version for now)
    // Debounced save
    const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

    const saveContent = useCallback((jsonContent: any) => {
        if (!id) return;
        setSaving(true);

        if (saveTimeout) clearTimeout(saveTimeout);

        const timeout = setTimeout(async () => {
            try {
                await supabase
                    .from('documents')
                    .update({
                        content: jsonContent,
                        last_updated: new Date().toISOString()
                    })
                    .eq('id', id);
            } catch (err) {
                console.error("Save failed", err);
            } finally {
                setSaving(false);
            }
        }, 2000); // 2 second debounce

        setSaveTimeout(timeout);
    }, [id, saveTimeout]);
    const [activeUsers, setActiveUsers] = useState<{ name: string, color: string }[]>([]);

    useEffect(() => {
        if (!provider) {
            setActiveUsers([]);
            return;
        }

        const updateUsers = () => {
            const states = Array.from(provider.awareness.getStates().values());
            const uniqueUsers = new Map();
            states.forEach((state: any) => {
                if (state.user && state.user.name) {
                    uniqueUsers.set(state.user.name, state.user);
                }
            });
            setActiveUsers(Array.from(uniqueUsers.values()));
        };

        provider.awareness.on('change', updateUsers);
        updateUsers();

        return () => {
            provider.awareness.off('change', updateUsers);
        };
    }, [provider]);

    const userName = session.user.user_metadata?.username || "Anonymous Visitor";
    const userColor = stringToColor(userName);

    useEffect(() => {
        if (!provider) return;

        const syncUser = () => {
            provider.awareness.setLocalStateField('user', {
                name: userName,
                color: userColor,
            });
        };

        // Set immediately
        syncUser();

        // Also ensure we re-set it if Liveblocks connects and wipes local awareness
        const handleSync = (isSynced: boolean) => {
            if (isSynced) {
                syncUser();
            }
        };
        provider.on('sync', handleSync);

        // Tiptap might internally try to initialize awareness later
        const timeout = setTimeout(syncUser, 1000);
        return () => {
            clearTimeout(timeout);
            provider.off('sync', handleSync);
        };
    }, [provider, userName, userColor]);

    // Initialize Editor
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // For Tiptap v3, 'history' was renamed to 'undoRedo' in StarterKit options.
                // Disable undo/redo in collaborative mode as Yjs handles it.
                undoRedo: !provider ? undefined : false,
            }),
            // Register Collab extensions if provider exists
            ...(provider && ydoc ? [
                Collaboration.configure({
                    document: ydoc,
                }),
                CollaborationCaret.configure({
                    provider: provider,
                    user: {
                        name: userName,
                        color: userColor,
                    },
                }),
            ] : []),
        ],
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[500px] outline-none',
            },
        },
        onUpdate: ({ editor }) => {
            // Save to Supabase (always, even if collaborating)
            saveContent(editor.getJSON());
        },
    });

    const { exportPDF, exportMarkdown, exportHTML } = useExport(editor, docTitle);

    const fetchDoc = async () => {
        if (!id || !editor) return;

        try {
            const { data, error } = await supabase.from('documents').select('*').eq('id', id).single();
            if (error) throw error;
            if (data) {
                setDocTitle(data.title);
                setIsPublic(data.is_public);
                if (data.content && !provider) { // Only set content if local
                    editor.commands.setContent(data.content);
                }
            }
        } catch (error) {
            console.error('Error fetching doc:', error);
            navigate('/');
        }
    };

    useEffect(() => {
        if (!id || !editor) return;
        fetchDoc();
    }, [id, editor, provider]);

    const togglePublic = async () => {
        const newVal = !isPublic;
        await supabase.from('documents').update({ is_public: newVal }).eq('id', id!);
        setIsPublic(newVal);
    };

    if (!editor) return null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 w-full">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-4 overflow-hidden flex-1 mr-2">
                        <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-100 rounded-full shrink-0">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="relative flex-1 flex items-center min-w-0">
                            <input
                                value={docTitle}
                                onChange={(e) => setDocTitle(e.target.value)}
                                onBlur={() => supabase.from('documents').update({ title: docTitle }).eq('id', id!).then()}
                                className="text-lg font-semibold bg-transparent border border-gray-200 sm:border-transparent hover:bg-gray-100 hover:border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 rounded-md px-2 py-1 min-w-0 w-full truncate transition-all cursor-text pr-8 sm:pr-2"
                                placeholder="Untitled Document"
                                title="Click to rename document"
                            />
                            <Pencil size={14} className="absolute right-2 text-gray-400 pointer-events-none sm:hidden" />
                        </div>
                    </div>

                    {/* Mobile Menu Button */}
                    <button onClick={() => setMobileMenuOpen(true)} className="sm:hidden p-2 hover:bg-gray-100 rounded-full text-gray-600">
                        <Menu size={24} />
                    </button>

                    {/* Desktop Controls */}
                    <div className="hidden sm:flex items-center gap-1 sm:gap-3 text-sm text-gray-500 shrink-0">


                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                showAlert('Success', 'Link copied to clipboard!', 'success');
                            }}
                            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="Copy Link"
                        >
                            <LinkIcon size={14} className="group-hover:animate-pulse" />
                            <span className="hidden sm:inline">Share</span>
                        </button>

                        <button
                            onClick={togglePublic}
                            className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isPublic ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                            title={isPublic ? 'Make Private' : 'Make Public'}
                        >
                            {isPublic ? <Globe size={14} /> : <Lock size={14} />}
                            <span className="hidden sm:inline">{isPublic ? 'Public' : 'Private'}</span>
                        </button>

                        {/* Prominent Desktop Active Users Indicator */}
                        {provider && activeUsers.length > 0 ? (
                            <div className="flex items-center bg-white border border-gray-200 rounded-full px-2 py-1 cursor-default shadow-sm hover:bg-gray-50 transition-colors mr-1 sm:mr-2">
                                <div className="flex items-center -space-x-1.5 ml-1">
                                    {activeUsers.slice(0, 4).map((u, i) => (
                                        <div
                                            key={i}
                                            className="relative w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-1 ring-black/5 hover:z-10 transition-transform hover:scale-110 cursor-help"
                                            style={{ backgroundColor: u.color }}
                                            title={u.name}
                                        >
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                    ))}
                                    {activeUsers.length > 4 && (
                                        <div className="relative w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold bg-gray-200 text-gray-700 shadow-sm ring-1 ring-black/5 hover:z-10 cursor-help" title={`${activeUsers.length - 4} more users`}>
                                            +{activeUsers.length - 4}
                                        </div>
                                    )}
                                </div>
                                <div className="hidden lg:flex flex-col ml-3 mr-2 items-start justify-center">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Live</span>
                                    <span className="text-xs font-semibold text-gray-700 leading-none">{activeUsers.length} active</span>
                                </div>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-2 mr-1"></div>
                            </div>
                        ) : !provider ? (
                            <div className="hidden sm:flex items-center gap-1.5 text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-full text-xs font-medium mr-1 sm:mr-2 shadow-sm" title="Local Editing">
                                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                <span>Local Only</span>
                            </div>
                        ) : null}

                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}

                        <div className="h-4 w-px bg-gray-300 mx-1" />
                        <ExportMenu editor={editor} title={docTitle} />
                    </div>
                </div>
            </header>

            {/* Mobile Side Menu */}
            {mobileMenuOpen && (
                <>
                    <div className="fixed inset-0 bg-black/50 z-40 transition-opacity" onClick={() => setMobileMenuOpen(false)} />
                    <div className="fixed right-0 top-0 h-full w-80 bg-white z-50 shadow-2xl flex flex-col transform transition-transform animate-in slide-in-from-right duration-200">
                        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-gray-900">Document Settings</h2>
                                {saving ? (
                                    <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full animate-pulse">
                                        <Loader2 size={10} className="animate-spin" /> Saving...
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                        <Save size={10} /> Saved
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setMobileMenuOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 p-6 space-y-8 overflow-y-auto">
                            {/* Active Users (Collab only) */}
                            {provider && activeUsers.length > 0 && (
                                <section>
                                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                        Current Collaborators
                                    </h3>
                                    <div className="flex flex-col gap-3">
                                        {activeUsers.map((u, i) => (
                                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 shadow-sm">
                                                <div
                                                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ring-2 ring-white"
                                                    style={{ backgroundColor: u.color }}
                                                >
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="text-sm font-semibold text-gray-800 truncate">{u.name}</span>
                                                    <span className="text-xs text-green-500 font-medium flex items-center gap-1">
                                                        Active now
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Access Control */}
                            <section>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Access Control</h3>
                                <div className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-200">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${isPublic ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-500'}`}>
                                            {isPublic ? <Globe size={20} /> : <Lock size={20} />}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{isPublic ? 'Public' : 'Private'}</div>
                                            <div className="text-xs text-gray-500">{isPublic ? 'Anyone with link can edit' : 'Only you can view'}</div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={togglePublic}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublic ? 'bg-blue-600' : 'bg-gray-200'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </section>

                            {/* Actions */}
                            <section>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Actions</h3>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(window.location.href);
                                        setMobileMenuOpen(false);
                                        showAlert('Success', 'Link copied to clipboard!', 'success');
                                    }}
                                    className="w-full flex items-center gap-3 p-4 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors font-medium"
                                >
                                    <LinkIcon size={20} />
                                    Copy Link
                                </button>
                            </section>

                            {/* Download */}
                            <section>
                                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Download</h3>
                                <div className="space-y-2">
                                    <button onClick={() => { exportPDF(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-gray-700 transition-colors border border-gray-100">
                                        <FileText size={18} className="text-red-500" />
                                        <span>PDF Document</span>
                                    </button>
                                    <button onClick={() => { exportMarkdown(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-gray-700 transition-colors border border-gray-100">
                                        <FileCode size={18} className="text-purple-500" />
                                        <span>Markdown</span>
                                    </button>
                                    <button onClick={() => { exportHTML(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg text-gray-700 transition-colors border border-gray-100">
                                        <Code size={18} className="text-orange-500" />
                                        <span>HTML File</span>
                                    </button>
                                </div>
                            </section>
                        </div>
                    </div>
                </>
            )}

            <main className="flex-1 overflow-y-auto w-full p-2 sm:p-4">
                <div className="max-w-4xl mx-auto bg-white shadow-sm border border-gray-200 rounded-lg sm:mt-4 flex flex-col overflow-hidden">
                    <MenuBar editor={editor} />
                    <div className="p-4 sm:p-12 cursor-text min-h-[500px] sm:min-h-[800px]" onClick={() => editor?.commands.focus()}>
                        <EditorContent editor={editor} />
                    </div>
                </div>
            </main>
        </div>
    );
}

function MenuBar({ editor }: { editor: any }) {
    if (!editor) return null;

    return (
        <div className="flex flex-nowrap sm:flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-200 w-full overflow-x-auto overflow-y-hidden sticky top-0 z-10 scrollbar-hide">
            <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                disabled={!editor.can().chain().focus().toggleBold().run()}
                className={`p-2 rounded shrink-0 transition-colors ${editor.isActive('bold') ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Bold"
            >
                <Bold size={16} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                disabled={!editor.can().chain().focus().toggleItalic().run()}
                className={`p-2 rounded shrink-0 transition-colors ${editor.isActive('italic') ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Italic"
            >
                <Italic size={16} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                disabled={!editor.can().chain().focus().toggleStrike().run()}
                className={`p-2 rounded shrink-0 transition-colors ${editor.isActive('strike') ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Strikethrough"
            >
                <Strikethrough size={16} />
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1 shrink-0" />

            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={`p-2 rounded font-bold text-sm shrink-0 transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Heading 1"
            >
                H1
            </button>
            <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded font-bold text-sm shrink-0 transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Heading 2"
            >
                H2
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1 shrink-0" />

            <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded shrink-0 transition-colors ${editor.isActive('bulletList') ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Bullet List"
            >
                <List size={16} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={`p-2 rounded shrink-0 transition-colors ${editor.isActive('orderedList') ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Ordered List"
            >
                <ListOrdered size={16} />
            </button>
            <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={`p-2 rounded shrink-0 transition-colors ${editor.isActive('blockquote') ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Blockquote"
            >
                <Quote size={16} />
            </button>
        </div>
    );
};
