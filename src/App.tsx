import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { DocumentRoom } from './components/DocumentRoom';

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  return (
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
  );
}

export default App;
