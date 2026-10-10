import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { useApp } from '../lib/session';
import {
  dur, errText, fetchProfile, fetchProfiles, fetchStats, first, fmtMiles, FullProfile, Media, miles, REPORT_REASONS, Review, Stats, theyWantMine, wantHits,
} from '../lib/util';
import { Avatar, Icon, Logo, MediaTile, MediaViewer, Sheet, Spinner, Stars, TopBar, Verified } from '../components/ui';
import { ShopCard } from './Discover';

type RevRow = Review & { reviewer: { name: string; handle: string } | null };

export default function ProfilePage({ mine = false }: { mine?: boolean }) {
  const { handle } = useParams();
  const { me, session, following, saved, refreshSocial, toast } = useApp();
  const uid = session!.user.id;
  const nav = useNavigate();
  const [p, setP] = useState<FullProfile | null | undefined>(undefined);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<'offers' | 'footage' | 'reviews' | 'saved'>('offers');
  const [reviews, setReviews] = useState<RevRow[] | null>(null);
  const [theyReviewed, setTheyReviewed] = useState<Set<string>>(new Set());
  const [savedList, setSavedList] = useState<FullProfile[] | null>(null);
  const [view, setView] = useState<Media | null>(null);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);

  const load = useCallback(async () => {
    const prof = mine ? await fetchProfile({ id: uid }) : await fetchProfile({ handle: handle! });
    setP(prof);
    if (prof) setStats((await fetchStats([prof.id]))[prof.id] || null);
  }, [mine, handle, uid]);
  useEffect(() => { setP(undefined); setTab('offers'); setReviews(null); load(); }, [load]);

  useEffect(() => {
    if (tab === 'reviews' && p && !reviews) {
      sb.from('reviews').select('*, reviewer:profiles!reviews_reviewer_id_fkey(name, handle)').eq('reviewee_id', p.id).order('created_at', { ascending: false })
        .then(({ data }) => setReviews((data || []) as RevRow[]));
      sb.from('reviews').select('trade_id').eq('reviewer_id', p.id).eq('reviewee_id', uid)
        .then(({ data }) => setTheyReviewed(new Set((data || []).map(x => x.trade_id as string))));
    }
    if (tab === 'saved' && mine && !savedList) fetchProfiles().then(all => setSavedList(all.filter(x => saved.has(x.id))));
  }, [tab, p, reviews, mine, savedList, saved]);

  if (p === undefined) return <main className="app"><TopBar back={!mine} /><Spinner /></main>;
  if (p === null) return <main className="app"><TopBar /><div className="empty" style={{ marginTop: 20 }}>We couldn't find that shop.</div></main>;
  if (p.id === uid && !mine) return <Navigate to="/me" replace />;

  const follows = following.has(p.id);
  const active = p.services.filter(s => s.active);
  const dist = mine ? null : miles(me?.zip, p.zip);
  const hits = new Set(me && !mine ? theyWantMine(p, me.services).map(w => w.label) : []);
  const offerHit = (sid: string) => !mine && me ? me.wants.some(w => wantHits(w.label, active.find(s => s.id === sid)!)) : false;

  async function toggleFollow() {
    const { error } = follows ? await sb.from('follows').delete().eq('follower_id', uid).eq('followee_id', p!.id)
      : await sb.from('follows').insert({ follower_id: uid, followee_id: p!.id });
    if (error) return toast(errText(error));
    await refreshSocial(); setStats(s => s && { ...s, followers: s.followers + (follows ? -1 : 1) });
    toast(follows ? `Unfollowed ${first(p!.name)}` : `Following ${first(p!.name)}`);
  }
  async function share() {
    const url = `${location.origin}/u/${p!.handle}`;
    try {
      if (navigator.share) await navigator.share({ title: `${p!.name} on BARTR`, url });
      else { await navigator.clipboard.writeText(url); toast('Profile link copied'); }
    } catch { /* closed share sheet */ }
  }
  async function block() {
    const { error } = await sb.from('blocks').insert({ blocker_id: uid, blocked_id: p!.id });
    if (error && !/duplicate/i.test(error.message)) return toast(errText(error));
    await refreshSocial(); toast(`Blocked ${first(p!.name)}. You won't see each other.`); nav('/', { replace: true });
  }

  const tabs: [typeof tab, string][] = mine ? [['offers', 'Offers'], ['footage', 'Footage'], ['reviews', 'Reviews'], ['saved', 'Saved']] : [['offers', 'Offers'], ['footage', 'Footage'], ['reviews', 'Reviews']];
  const socials = (p.socials || []).filter(s => s.value?.trim());
  const socialHref = (s: { label: string; value: string }) => {
    const v = s.value.trim().replace(/^@/, '');
    if (/^https?:\/\//i.test(s.value)) return s.value;
    if (s.label === 'Instagram') return `https://instagram.com/${v}`;
    if (s.label === 'TikTok') return `https://tiktok.com/@${v}`;
    if (s.label === 'YouTube') return `https://youtube.com/@${v}`;
    return `https://${v}`;
  };

  return (
    <main className="app">
      {mine ? <header className="top"><Logo /><Link className="pillloc" to="/me/edit">Edit profile</Link></header>
        : <TopBar title={`@${p.handle}`} right={<button className="iconbtn" onClick={() => setMenu(true)} aria-label="More options"><Icon name="dots" fill /></button>} />}

      <div className="sp-head">
        <Avatar p={p} size={84} />
        <div style={{ minWidth: 0 }}>
          <h1 className="sp-name">{p.name} <Verified /></h1>
          <div className="meta">@{p.handle} · {p.hood}{dist !== null && ` · ${fmtMiles(dist)}`}</div>
          {stats?.rating != null ? <div style={{ marginTop: 4, fontSize: 14 }}><Stars n={stats.rating} /> <b>{stats.rating.toFixed(1)}</b> <span className="muted">({stats.reviews})</span></div>
            : <div className="meta" style={{ marginTop: 4 }}>New to BARTR</div>}
          <div className="sp-stats"><span><b>{stats?.trades ?? 0}</b> {stats?.trades === 1 ? 'trade' : 'trades'}</span><span><b>{stats?.followers ?? 0}</b> {stats?.followers === 1 ? 'follower' : 'followers'}</span>{mine && <span><b>{stats?.following ?? 0}</b> following</span>}</div>
        </div>
      </div>
      {p.bio && <p className="bio">{p.bio}</p>}
      {socials.length > 0 && <div className="links">{socials.map(s => <a key={s.label} href={socialHref(s)} target="_blank" rel="noopener noreferrer"><Icon name="link" size={14} />{s.value.replace(/^https?:\/\//, '')}</a>)}</div>}
      {p.license && <div className="cred"><Icon name="shield" size={18} />{p.license}</div>}

      <div className="row2" style={{ marginTop: 16 }}>
        {mine ? <>
          <Link className="btn alt" to="/me/edit">Edit profile</Link>
          <button className="btn alt" onClick={share}>Share my shop</button>
        </> : <>
          <Link className="btn" to={`/propose/${p.id}`}>Propose trade</Link>
          <button className="btn alt" onClick={toggleFollow} aria-pressed={follows}>{follows ? <><Icon name="check" size={16} sw={2.6} />Following</> : 'Follow'}</button>
        </>}
      </div>

      <div className="ptabs" style={{ gridTemplateColumns: `repeat(${tabs.length},1fr)` }}>
        {tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'offers' && <>
        {active.length ? active.map(s => (
          <div key={s.id} className="sp-offer">
            <MediaTile m={p.media.find(m => m.service_id === s.id)} cat={s.category} seed={s.id} />
            <div style={{ minWidth: 0 }}><b>{s.title}</b><div className="meta">{dur(s.duration_min)} · {s.location || 'Flexible'}{offerHit(s.id) && <span style={{ color: 'var(--accent)', fontWeight: 700 }}> · you want this</span>}</div></div>
            {!mine && <Link className="btn small" to={`/propose/${p.id}?svc=${s.id}`}>Trade</Link>}
          </div>
        )) : <div className="empty" style={{ marginTop: 16 }}>{mine ? 'Add a service so people can trade with you.' : 'No services listed right now.'}</div>}
        {mine && <Link to="/post?tab=service" className="btn ghost" style={{ marginTop: 6 }}><Icon name="plus" size={16} />Add a service</Link>}
        <h2 className="sec">Looking for</h2>
        <div className="wrapchips">{p.wants.length ? p.wants.map(w => <span key={w.id} className={`tag ${hits.has(w.label) ? 'hit' : ''}`}>{w.label}</span>) : <span className="muted">Nothing listed yet.</span>}</div>
        {mine && <Link to="/me/edit" className="note" style={{ display: 'inline-block', textDecoration: 'underline' }}>Edit what you're looking for</Link>}
      </>}

      {tab === 'footage' && <div className="sgrid">
        {mine && <Link to="/post" className="addtile"><Icon name="plus" size={24} />Add</Link>}
        {p.media.map(m => <MediaTile key={m.id} m={m} seed={m.id} onClick={() => setView(m)} />)}
        {!mine && !p.media.length && <div className="empty" style={{ gridColumn: '1/-1', margin: '16px' }}>No footage yet.</div>}
      </div>}

      {tab === 'reviews' && (!reviews ? <Spinner /> : reviews.length ? <div>{reviews.map(r => (
        <div key={r.id} className="rev">
          <div className="hd"><b>{r.reviewer?.name || 'Someone'}</b><Stars n={r.rating} /></div>
          {r.tags.length > 0 && <div className="meta">{r.tags.join(' · ')}</div>}
          {r.body && <p>{r.body}</p>}
          {r.reviewer_id === uid && !theyReviewed.has(r.trade_id) && Date.now() - new Date(r.created_at).getTime() < 7 * 864e5 && <div className="note">Your review. {first(p.name)} sees it once they post theirs, or after 7 days.</div>}
        </div>))}</div>
        : <div className="empty" style={{ marginTop: 16 }}>No reviews yet. Reviews appear after completed trades.</div>)}

      {tab === 'saved' && (!savedList ? <Spinner /> : savedList.length
        ? <div className="grid2" style={{ marginTop: 16 }}>{savedList.map(x => <ShopCard key={x.id} p={x} me={me} dist={miles(me?.zip, x.zip)} />)}</div>
        : <div className="empty" style={{ marginTop: 16 }}>Tap the heart on anyone in Discover to save them here.</div>)}

      {mine && <button className="btn ghost" style={{ marginTop: 28 }} onClick={() => sb.auth.signOut()}>Sign out</button>}

      {view && <MediaViewer m={view} onClose={() => setView(null)} />}
      {menu && <Sheet title={p.name} onClose={() => setMenu(false)}>
        <div className="menu">
          <button onClick={() => { setMenu(false); share(); }}>Share profile</button>
          <button onClick={() => { setMenu(false); setReport(true); }}>Report {first(p.name)}</button>
          <button className="danger" onClick={() => { setMenu(false); block(); }}>Block {first(p.name)}</button>
        </div>
      </Sheet>}
      {report && <ReportSheet reportedId={p.id} name={p.name} onClose={() => setReport(false)} />}
    </main>
  );
}

export function ReportSheet({ reportedId, name, tradeId, onClose }: { reportedId: string; name: string; tradeId?: string; onClose: () => void }) {
  const { session, toast } = useApp();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  async function send() {
    if (!reason) return;
    setBusy(true);
    const { error } = await sb.from('reports').insert({ reporter_id: session!.user.id, reported_id: reportedId, trade_id: tradeId ?? null, reason, details: details.trim() });
    setBusy(false);
    if (error) return toast(errText(error));
    toast('Thanks. We’ll review this within 24 hours.'); onClose();
  }
  return (
    <Sheet title={`Report ${first(name)}`} onClose={onClose}>
      <p className="obp" style={{ margin: '0 0 12px' }}>Reports are private. {first(name)} won't know who sent it. If you're in danger, call 911.</p>
      <div className="wrapchips">{REPORT_REASONS.map(r => <button key={r} className={`chip ${reason === r ? 'on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}</div>
      <div className="field"><label className="label" htmlFor="rd">What happened? (optional)</label><textarea id="rd" value={details} maxLength={1000} onChange={e => setDetails(e.target.value)} /></div>
      <div className="btns"><button className="btn" disabled={!reason || busy} onClick={send}>{busy ? 'Sending…' : 'Send report'}</button></div>
    </Sheet>
  );
}
