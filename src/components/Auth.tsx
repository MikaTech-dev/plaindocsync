import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAlert } from './AlertModal';

export function Auth() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [sent, setSent] = useState(false);
    const { showAlert } = useAlert();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        localStorage.setItem('pending_username', username);
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                data: {
                    username,
                },
                emailRedirectTo: window.location.href,
            }
        });
        if (error) showAlert('Error', error.message, 'error');
        else setSent(true);
        setLoading(false);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
            <div className="p-8 bg-white rounded-lg shadow-md w-96">
                <h1 className="mb-4 text-2xl font-bold text-center">PlainDocSync</h1>
                <p className="mb-6 text-center text-gray-600">
                    Sign in via Magic Link to start editing.
                </p>

                {sent ? (
                    <div className="p-4 text-green-700 bg-green-100 rounded">
                        Check your email for the login link!
                    </div>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <input
                            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            type="text"
                            placeholder="Your name"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            disabled={loading}
                            required
                        />
                        <input
                            className="w-full px-4 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            type="email"
                            placeholder="Your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            required
                        />
                        <button
                            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? 'Sending...' : 'Send Magic Link'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
