import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { useApp } from '../lib/session';
import { ago, errText, Message } from '../lib/util';
import { loadTrades, otherId, TradeBundle } from '../lib/trades';
import { Avatar, Spinner } from '../components/ui';

export default function Messages() {
  const { session, unread } = useApp();
  const uid = session!.user.id;
  const [b, setB] = useState<TradeBundle | null>(null);
  const [last, setLast] = useState<Record<string, Message>>({});
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const bundle = await loadTrades();
      const ids = bundle.trades.map(t => t.id);
      if (ids.length) {
        const { data } = await sb.from('messages').select('*').in('trade_id', ids).order('created_at', { ascending: false }).limit(500);
        const m: Record<string, Message> = {};
        ((data || []) as Message[]).forEach(x => { if (!m[x.trade_id]) m[x.trade_id] = x; });
        setLast(m);
      }
      setB(bundle);
    })().catch(e => setErr(errText(e)));
  }, [unread]);

  const sorted = b ? [...b.trades].sort((x, y) => (last[y.id]?.created_at || y.updated_at).localeCompare(last[x.id]?.created_at || x.updated_at)) : [];
  return (
    <main className="app">
      <header className="top"><h1>Messages</h1></header>
      {err && <p className="err">{err}</p>}
      {!b ? <Spinner /> : !sorted.length ? <div className="empty" style={{ marginTop: 20 }}>Messages start when you propose a trade. Each trade gets its own chat.</div> : (
        <div className="rows">
          {sorted.map(t => {
            const o = b.people[otherId(t, uid)], m = last[t.id], n = unread[t.id] || 0;
            return (
              <Link key={t.id} to={`/trades/${t.id}/chat`} className="row">
                {o && <Avatar p={o} />}
                <div style={{ minWidth: 0 }}>
                  <div className="name">{o?.name || 'Someone'}</div>
                  <div className={`last ${n ? 'unr' : ''}`}>{m ? `${m.sender_id === uid && m.kind === 'text' ? 'You: ' : ''}${m.body}` : 'Say hi and confirm the details'}</div>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{m && <span className="meta">{ago(m.created_at)}</span>}{n > 0 && <span className="dot" aria-label={`${n} unread`} />}</span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
