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
import { ArrowLeft, Save, Loader2, Globe, Lock, Menu, X, Link as LinkIcon, Download, FileText, FileCode, Code } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { ExportMenu } from './ExportMenu';
import { useExport } from '../hooks/useExport';

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

    // Debounced save (simple version for now)
    // Debounced save
    const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

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
                        name: session.user.email,
                        color: '#f783ac',
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
                        <input
                            value={docTitle}
                            onChange={(e) => setDocTitle(e.target.value)}
                            onBlur={() => supabase.from('documents').update({ title: docTitle }).eq('id', id!).then()}
                            className="text-lg font-semibold bg-transparent border-none focus:ring-0 min-w-0 flex-1 truncate"
                            placeholder="Untitled"
                        />
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
                                alert('Link copied to clipboard!');
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

                        {provider ? (
                            <div className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-1 rounded" title="Live Collaboration">
                                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                <span className="hidden sm:inline">Live</span>
                            </div>
                        ) : (
                            <div className="hidden sm:flex items-center gap-1 text-gray-500 bg-gray-100 px-2 py-1 rounded" title="Local Editing">
                                <span>Local</span>
                            </div>
                        )}

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
                                        alert('Link copied!');
                                        setMobileMenuOpen(false);
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

            <main className="flex-1 overflow-y-auto w-full">
                <div className="max-w-4xl mx-auto bg-white shadow-sm border border-gray-200 rounded-lg min-h-[600px] sm:min-h-[800px] mt-4 sm:mt-8 p-4 sm:p-12 cursor-text" onClick={() => editor?.commands.focus()}>
                    <EditorContent editor={editor} />
                </div>
            </main>
        </div>
    );
}
