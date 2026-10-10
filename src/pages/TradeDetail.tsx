import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { useApp } from '../lib/session';
import { errText, first, fmtWhen, Review } from '../lib/util';
import { loadTrades, myDone, myService, otherId, statusLabel, theirDone, theirService, TradeBundle } from '../lib/trades';
import { Avatar, Icon, Spinner, Stars, TopBar } from '../components/ui';
import { ReportSheet } from './Profile';

export default function TradeDetail() {
  const { id } = useParams();
  const { session, toast, refreshCounts, unread } = useApp();
  const uid = session!.user.id;
  const nav = useNavigate();
  const [b, setB] = useState<TradeBundle | null>(null);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [confirm, setConfirm] = useState<'' | 'decline' | 'cancel'>('');
  const [report, setReport] = useState(false);

  const load = useCallback(async () => {
    const bundle = await loadTrades([id!]);
    setB(bundle);
    const { data } = await sb.from('reviews').select('*').eq('trade_id', id!).eq('reviewer_id', uid).maybeSingle();
    setMyReview(data as Review | null);
  }, [id, uid]);
  useEffect(() => { load().catch(e => setErr(errText(e))); }, [load]);
  useEffect(() => {
    const ch = sb.channel(`trade-${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trades', filter: `id=eq.${id}` }, () => load()).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [id, load]);

  async function act(action: 'accept' | 'decline' | 'cancel' | 'done') {
    setBusy(true); setErr(''); setConfirm('');
    const { data, error } = await sb.rpc('respond_trade', { p_trade: id, p_action: action });
    setBusy(false);
    if (error) return setErr(errText(error));
    const msgs: Record<string, string> = {
      accept: 'It’s a trade! Use Message to confirm the details.', decline: 'Offer declined', cancel: 'Trade cancelled',
      done: data === 'completed' ? 'Both done. Leave a review.' : 'Marked complete. Waiting on the other person.',
    };
    toast(msgs[action]); await Promise.all([load(), refreshCounts()]);
  }

  if (!b) return <main className="app"><TopBar title="Trade" />{err ? <p className="err">{err}</p> : <Spinner />}</main>;
  const t = b.trades[0];
  if (!t) return <main className="app"><TopBar title="Trade" /><div className="empty" style={{ marginTop: 20 }}>This trade isn't available.</div></main>;
  const other = b.people[otherId(t, uid)], f = first(other?.name || 'them');
  const give = b.services[myService(t, uid)], get = b.services[theirService(t, uid)];
  const st = statusLabel(t, uid, f, Boolean(myReview));
  const labels = ['Offer sent', 'Agree on the deal', 'Meet up and trade', 'Both mark it complete', 'Two-way reviews'];
  const now = t.status === 'proposed' ? 1 : t.status === 'accepted' ? (myDone(t, uid) || theirDone(t, uid) ? 3 : 2) : t.status === 'completed' ? (myReview ? 5 : 4) : -1;
  const n = unread[t.id] || 0;

  return (
    <main className="app">
      <TopBar title="Trade" right={<button className="iconbtn" aria-label={`Report ${f}`} onClick={() => setReport(true)}><Icon name="dots" fill /></button>} />
      <div className="deal">
        <Link to={`/u/${other?.handle}`} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          {other && <Avatar p={other} />}
          <div><b style={{ fontSize: 16 }}>Trade with {other?.name}</b><div className="meta">@{other?.handle} · {other?.hood}</div></div>
        </Link>
        <div className="swap">
          <div className="side"><span className="label">You give</span><b>{give?.title}</b></div>
          <div className="arrows"><Icon name="swap" size={20} /></div>
          <div className="side get"><span className="label">You get</span><b>{get?.title}</b></div>
        </div>
        <dl className="facts">
          <dt>Status</dt><dd><span className={`pill ${st.cls}`}>{st.text}</span>{t.counter_count > 0 && t.status === 'proposed' && <span className="meta"> · {t.counter_count} counter{t.counter_count > 1 ? 's' : ''}</span>}</dd>
          <dt>When</dt><dd>{fmtWhen(t.scheduled_at)}</dd>
          <dt>Where</dt><dd>{t.location || 'To be decided'}</dd>
        </dl>
      </div>

      {now >= 0 && <>
        <h2 className="sec">Progress</h2>
        <ol className="steps">{labels.map((l, i) => <li key={l} className={i < now ? 'done' : i === now ? 'now' : ''}><span className="pt" /><span>{l}</span></li>)}</ol>
      </>}

      {err && <p className="err" role="alert">{err}</p>}
      <div className="btns">
        {t.status === 'proposed' && t.awaiting_id === uid && <>
          <button className="btn" disabled={busy} onClick={() => act('accept')}>Accept trade</button>
          <div className="row2">
            <Link className="btn alt" to={`/trades/${t.id}/counter`}>Counter-offer</Link>
            <button className="btn alt" disabled={busy} onClick={() => setConfirm('decline')}>Decline</button>
          </div>
        </>}
        {t.status === 'proposed' && t.awaiting_id !== uid && <>
          <div className="empty">Waiting for {f} to accept, decline or counter.</div>
          <button className="btn ghost" disabled={busy} onClick={() => setConfirm('cancel')}>Cancel this offer</button>
        </>}
        {t.status === 'accepted' && (myDone(t, uid)
          ? <div className="empty">You marked it complete. Waiting on {f}.</div>
          : <>
            <div className="banner"><b>Before you meet:</b> pick a public spot for a first trade and tell a friend where you're going.</div>
            <button className="btn" disabled={busy} onClick={() => act('done')}>We traded. Mark complete</button>
            {theirDone(t, uid) && <p className="note" style={{ textAlign: 'center' }}>{f} already marked it complete.</p>}
          </>)}
        {t.status === 'accepted' && <button className="btn ghost" disabled={busy} onClick={() => setConfirm('cancel')}>Cancel trade</button>}
        {t.status === 'completed' && (myReview
          ? <div className="deal" style={{ marginTop: 0 }}><div className="rev" style={{ border: 0, padding: 0 }}><div className="hd"><b>Your review</b><Stars n={myReview.rating} /></div>{myReview.body && <p>{myReview.body}</p>}</div></div>
          : <Link className="btn" to={`/trades/${t.id}/review`}>Review {f}</Link>)}
        {(t.status === 'declined' || t.status === 'cancelled') && <Link className="btn alt" to={`/u/${other?.handle}`}>See {f}'s shop</Link>}
        <button className="btn alt" onClick={() => nav(`/trades/${t.id}/chat`)}><Icon name="chat" size={18} />Message {f}{n > 0 ? ` · ${n} new` : ''}</button>
      </div>

      {confirm && <div className="sheet-bg" onClick={() => setConfirm('')}>
        <div className="sheet" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
          <div className="sheet-hd"><b>{confirm === 'decline' ? `Decline ${f}'s offer?` : 'Cancel this trade?'}</b></div>
          <p className="obp">{confirm === 'decline' ? `${f} will see that you declined. You can still message them.` : `${f} will be told it's cancelled. Please message them if you're cancelling close to the time.`}</p>
          <div className="btns"><button className="btn dark" onClick={() => act(confirm)}>{confirm === 'decline' ? 'Decline offer' : 'Cancel trade'}</button><button className="btn ghost" onClick={() => setConfirm('')}>Keep it</button></div>
        </div>
      </div>}
      {report && other && <ReportSheet reportedId={other.id} name={other.name} tradeId={t.id} onClose={() => setReport(false)} />}
    </main>
  );
}
