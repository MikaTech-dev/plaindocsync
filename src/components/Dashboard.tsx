import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Document } from '../types/supabase';
import { FileText, Plus, LogOut, Trash2, Lock, Globe } from 'lucide-react';

export function Dashboard({ session }: { session: Session }) {
    const [docs, setDocs] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchDocs();
    }, []);

    const fetchDocs = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('owner_id', session.user.id)
                .order('last_updated', { ascending: false });

            if (error) throw error;
            setDocs(data || []);
        } catch (error) {
            console.error('Error fetching docs:', error);
        } finally {
            setLoading(false);
        }
    };

    const createDoc = async () => {
        try {
            const { data, error } = await supabase
                .from('documents')
                .insert([{
                    owner_id: session.user.id,
                    title: 'Untitled Document',
                    is_public: false
                }])
                .select()
                .single();

            if (error) throw error;
            if (data) navigate(`/doc/${data.id}`);
        } catch (error) {
            console.error('Error creating doc:', error);
        }
    };

    const deleteDoc = async (id: string, e: React.MouseEvent) => {
        e.preventDefault(); // Prevent navigation
        if (!confirm('Are you sure you want to delete this document?')) return;

        try {
            const { error } = await supabase.from('documents').delete().eq('id', id);
            if (error) throw error;
            setDocs(docs.filter(d => d.id !== id));
        } catch (error) {
            console.error('Error deleting doc:', error);
        }
    };

    const handleLogout = () => supabase.auth.signOut();

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b border-gray-200">
                <div className="container px-4 mx-auto">
                    <div className="flex items-center justify-between h-16">
                        <h1 className="text-xl font-bold text-gray-800">PlainDocSync</h1>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">{session.user.email}</span>
                            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600">
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="container px-4 py-8 mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-gray-800">Your Documents</h2>
                    <button
                        onClick={createDoc}
                        className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={20} />
                        New Document
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-12">Loading...</div>
                ) : docs.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        No documents yet. Create one to get started!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {docs.map((doc) => (
                            <Link
                                key={doc.id}
                                to={`/doc/${doc.id}`}
                                className="group block p-6 bg-white border border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-md transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={`p-2 rounded-lg ${doc.is_public ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                                        <FileText size={24} />
                                    </div>
                                    <button
                                        onClick={(e) => deleteDoc(doc.id, e)}
                                        className="p-1 text-gray-400 hover:text-red-600 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                                <h3 className="font-semibold text-gray-900 truncate mb-1">{doc.title}</h3>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                    <span>{new Date(doc.last_updated).toLocaleDateString()}</span>
                                    {doc.is_public ? (
                                        <span className="flex items-center gap-1 text-green-600"><Globe size={12} /> Public</span>
                                    ) : (
                                        <span className="flex items-center gap-1"><Lock size={12} /> Private</span>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
