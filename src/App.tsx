import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { DocumentRoom } from './components/DocumentRoom';
import { AlertProvider } from './components/AlertModal';

function PrivateRoute({ session, children }: { session: Session | null, children: React.ReactNode }) {
  if (!session) return <div className="flex justify-center mt-10"><Auth /></div>;
  return <>{children}</>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      if (session) {
        const pendingUsername = localStorage.getItem('pending_username');
        if (pendingUsername && session.user.user_metadata?.username !== pendingUsername) {
          localStorage.removeItem('pending_username');
          await supabase.auth.updateUser({
            data: { username: pendingUsername }
          });
          // Triggers another onAuthStateChange with updated user
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
    <AlertProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={!session ? <Auth /> : <Dashboard session={session} />} />
          {/* Placeholder for Editor route */}
          <Route path="/doc/:id" element={
            <PrivateRoute session={session}>
              {session && <DocumentRoom session={session} />}
            </PrivateRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AlertProvider>
  );
}

export default App;
