import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { useApp } from '../lib/session';
import { errText, first, REVIEW_TAGS } from '../lib/util';
import { loadTrades, myService, otherId, theirService, TradeBundle } from '../lib/trades';
import { Avatar, Spinner, TopBar } from '../components/ui';

export default function ReviewPage() {
  const { id } = useParams();
  const { session, toast, refreshCounts } = useApp();
  const uid = session!.user.id;
  const nav = useNavigate();
  const [b, setB] = useState<TradeBundle | null>(null);
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { loadTrades([id!]).then(setB).catch(e => setErr(errText(e))); }, [id]);

  async function post() {
    setBusy(true); setErr('');
    const { error } = await sb.rpc('submit_review', { p_trade: id, p_rating: stars, p_tags: tags, p_body: body.trim() });
    setBusy(false);
    if (error) return setErr(errText(error));
    await refreshCounts(); toast('Review posted'); nav(`/trades/${id}`, { replace: true });
  }

  const t = b?.trades[0];
  if (!t) return <main className="app"><TopBar title="Review" />{err ? <p className="err">{err}</p> : <Spinner />}</main>;
  const o = b!.people[otherId(t, uid)], f = first(o?.name || 'them');
  return (
    <main className="app" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 110px)' }}>
      <TopBar title="Review" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 16, textAlign: 'center' }}>
        {o && <Avatar p={o} size={84} />}
        <b style={{ fontSize: 18 }}>How was your trade with {f}?</b>
        <span className="meta">{b!.services[theirService(t, uid)]?.title} ⇄ {b!.services[myService(t, uid)]?.title}</span>
      </div>
      <h2 className="sec">Rating</h2>
      <div className="starpick" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map(n => <button key={n} role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= stars ? 'on' : ''} onClick={() => setStars(n)}>★</button>)}
      </div>
      <h2 className="sec">What stood out</h2>
      <div className="wrapchips">{REVIEW_TAGS.map(c => <button key={c} className={`chip ${tags.includes(c) ? 'on' : ''}`} aria-pressed={tags.includes(c)} onClick={() => setTags(x => (x.includes(c) ? x.filter(y => y !== c) : [...x, c]))}>{c}</button>)}</div>
      <div className="field"><label className="label" htmlFor="rb">Write a review</label><textarea id="rb" value={body} maxLength={1000} placeholder="What was the trade like?" onChange={e => setBody(e.target.value)} /></div>
      <p className="note">Reviews are double-blind. {f} sees yours once they post theirs, or after 7 days.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="cta" style={{ bottom: 0, paddingBottom: 'env(safe-area-inset-bottom,0px)' }}><div><button className="btn" disabled={busy} onClick={post}>{busy ? 'Posting…' : 'Post review'}</button></div></div>
    </main>
  );
}
