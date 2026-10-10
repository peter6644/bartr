import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { sb } from './supabase';
import { FullProfile, fetchProfile, Trade } from './util';

type Ctx = {
  session: Session | null;
  loading: boolean;
  me: FullProfile | null;
  refreshMe: () => Promise<void>;
  hidden: Set<string>;
  following: Set<string>;
  saved: Set<string>;
  refreshSocial: () => Promise<void>;
  unread: Record<string, number>;
  actionCount: number;
  refreshCounts: () => Promise<void>;
  toast: (msg: string) => void;
};
const SessionCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(SessionCtx);

/** Trades where it's your move: respond to an offer, mark done, or leave a review. */
export function needsMe(t: Trade, uid: string, reviewed: Set<string>) {
  const mine = t.proposer_id === uid ? t.proposer_done : t.receiver_done;
  return (t.status === 'proposed' && t.awaiting_id === uid)
    || (t.status === 'accepted' && !mine)
    || (t.status === 'completed' && !reviewed.has(t.id));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<FullProfile | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [actionCount, setActionCount] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef<number>();
  const uid = session?.user.id;

  const toast = useCallback((msg: string) => {
    setToastMsg(msg); window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(''), 2800);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!uid) { setMe(null); return; }
    setMe(await fetchProfile({ id: uid }));
  }, [uid]);

  const refreshSocial = useCallback(async () => {
    if (!uid) return;
    const [h, f, s] = await Promise.all([
      sb.rpc('my_hidden_ids'),
      sb.from('follows').select('followee_id').eq('follower_id', uid),
      sb.from('saves').select('saved_id').eq('user_id', uid),
    ]);
    setHidden(new Set(((h.data || []) as unknown[]).map(x => (typeof x === 'string' ? x : (x as Record<string, string>).my_hidden_ids))));
    setFollowing(new Set((f.data || []).map(r => r.followee_id as string)));
    setSaved(new Set((s.data || []).map(r => r.saved_id as string)));
  }, [uid]);

  const refreshCounts = useCallback(async () => {
    if (!uid) return;
    const [u, t, r] = await Promise.all([
      sb.rpc('my_unread'),
      sb.from('trades').select('*').in('status', ['proposed', 'accepted', 'completed']),
      sb.from('reviews').select('trade_id').eq('reviewer_id', uid),
    ]);
    setUnread(Object.fromEntries(((u.data || []) as { trade_id: string; unread: number }[]).map(x => [x.trade_id, x.unread])));
    const reviewed = new Set((r.data || []).map(x => x.trade_id as string));
    setActionCount(((t.data || []) as Trade[]).filter(x => needsMe(x, uid, reviewed)).length);
  }, [uid]);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => { setSession(data.session); if (!data.session) setLoading(false); });
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!uid) { setMe(null); return; }
    setLoading(true);
    Promise.all([refreshMe(), refreshSocial(), refreshCounts()]).finally(() => setLoading(false));
  }, [uid, refreshMe, refreshSocial, refreshCounts]);

  /* live badge updates when a message or trade changes */
  useEffect(() => {
    if (!uid) return;
    const ch = sb.channel('badges')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => refreshCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades' }, () => refreshCounts())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [uid, refreshCounts]);

  return (
    <SessionCtx.Provider value={{ session, loading, me, refreshMe, hidden, following, saved, refreshSocial, unread, actionCount, refreshCounts, toast }}>
      {children}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </SessionCtx.Provider>
  );
}
