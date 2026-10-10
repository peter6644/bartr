import { ReactNode, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { configured } from './lib/supabase';
import { SessionProvider, useApp } from './lib/session';
import { Spinner, TabBar } from './components/ui';
import Welcome from './pages/Welcome';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Discover from './pages/Discover';
import ProfilePage from './pages/Profile';
import EditProfile from './pages/EditProfile';
import Post from './pages/Post';
import Propose from './pages/Propose';
import Trades from './pages/Trades';
import TradeDetail from './pages/TradeDetail';
import Chat from './pages/Chat';
import Messages from './pages/Messages';
import ReviewPage from './pages/Review';

function Setup() {
  return (
    <div className="app bare">
      <div className="ob">
        <p className="logo" style={{ fontSize: 36 }}>bartr<span>.</span></p>
        <h1 className="obh">Almost there</h1>
        <p className="obp">This copy of BARTR isn't connected to a database yet. Add <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> to your hosting settings, then redeploy.</p>
      </div>
    </div>
  );
}

function Shell({ children, tabs = true }: { children: ReactNode; tabs?: boolean }) {
  return <>{children}{tabs && <TabBar />}</>;
}

function Routed() {
  const { session, loading, me } = useApp();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  if (loading) return <div className="app bare"><Spinner /></div>;
  if (!session) {
    return (
      <Routes>
        <Route path="/signin" element={<Auth mode="signin" />} />
        <Route path="/join" element={<Auth mode="join" />} />
        <Route path="*" element={<Welcome />} />
      </Routes>
    );
  }
  if (!me?.onboarded) return <Onboarding />;
  return (
    <Routes>
      <Route path="/" element={<Shell><Discover /></Shell>} />
      <Route path="/u/:handle" element={<Shell><ProfilePage /></Shell>} />
      <Route path="/me" element={<Shell><ProfilePage mine /></Shell>} />
      <Route path="/me/edit" element={<Shell><EditProfile /></Shell>} />
      <Route path="/post" element={<Shell><Post /></Shell>} />
      <Route path="/propose/:userId" element={<Shell tabs={false}><Propose /></Shell>} />
      <Route path="/trades" element={<Shell><Trades /></Shell>} />
      <Route path="/trades/:id" element={<Shell><TradeDetail /></Shell>} />
      <Route path="/trades/:id/counter" element={<Shell tabs={false}><Propose counter /></Shell>} />
      <Route path="/trades/:id/chat" element={<Shell tabs={false}><Chat /></Shell>} />
      <Route path="/trades/:id/review" element={<Shell tabs={false}><ReviewPage /></Shell>} />
      <Route path="/messages" element={<Shell><Messages /></Shell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  if (!configured) return <Setup />;
  return <SessionProvider><Routed /></SessionProvider>;
}
