import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp, needsMe } from '../lib/session';
import { errText, first, fmtWhen, Trade } from '../lib/util';
import { loadTrades, myService, otherId, statusLabel, theirService, TradeBundle } from '../lib/trades';
import { Avatar, Logo, Spinner } from '../components/ui';

export default function Trades() {
  const { session, actionCount } = useApp();
  const uid = session!.user.id;
  const [b, setB] = useState<TradeBundle | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { loadTrades().then(setB).catch(e => setErr(errText(e))); }, [actionCount]);

  const row = (t: Trade) => {
    const o = b!.people[otherId(t, uid)], st = statusLabel(t, uid, first(o?.name || 'them'), b!.reviewed.has(t.id));
    return (
      <Link key={t.id} to={`/trades/${t.id}`} className="row">
        {o && <Avatar p={o} />}
        <div style={{ minWidth: 0 }}>
          <div className="name">{o?.name || 'Someone'}</div>
          <div className="last">{b!.services[myService(t, uid)]?.title} ⇄ {b!.services[theirService(t, uid)]?.title}</div>
          <div className="meta">{fmtWhen(t.scheduled_at)}</div>
        </div>
        <span className={`pill ${st.cls}`}>{st.text}</span>
      </Link>
    );
  };

  if (!b) return <main className="app"><header className="top"><Logo /></header>{err ? <p className="err">{err}</p> : <Spinner />}</main>;
  const yourMove = b.trades.filter(t => needsMe(t, uid, b.reviewed));
  const open = b.trades.filter(t => !yourMove.includes(t) && ['proposed', 'accepted'].includes(t.status));
  const past = b.trades.filter(t => !yourMove.includes(t) && !open.includes(t));

  return (
    <main className="app">
      <header className="top"><h1>Your trades</h1><span className="pillloc">{yourMove.length + open.length} active</span></header>
      {!b.trades.length && <div className="empty" style={{ marginTop: 20 }}>No trades yet. Find someone on <Link to="/" style={{ textDecoration: 'underline', fontWeight: 700 }}>Discover</Link> and propose one.</div>}
      {yourMove.length > 0 && <><h2 className="sec">Your move <small>{yourMove.length}</small></h2><div className="rows">{yourMove.map(row)}</div></>}
      {open.length > 0 && <><h2 className="sec">In progress</h2><div className="rows">{open.map(row)}</div></>}
      {past.length > 0 && <><h2 className="sec">Past</h2><div className="rows">{past.map(row)}</div></>}
    </main>
  );
}
