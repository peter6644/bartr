import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { useApp } from '../lib/session';
import { errText, fetchProfiles, first, fmtMiles, FullProfile, isMatch, miles, norm, theyWantMine } from '../lib/util';
import { Avatar, Icon, Logo, MediaTile, Spinner, Verified } from '../components/ui';

export function ShopCard({ p, me, dist }: { p: FullProfile; me: FullProfile | null; dist: number | null }) {
  const { saved, refreshSocial, toast, session } = useApp();
  const nav = useNavigate();
  const isSaved = saved.has(p.id);
  const svc = p.services.find(s => s.active);
  const match = isMatch(p, me);
  const mineCats = me?.services.filter(s => s.active) ?? [];
  async function toggleSave() {
    const uid = session!.user.id;
    const { error } = isSaved ? await sb.from('saves').delete().eq('user_id', uid).eq('saved_id', p.id)
      : await sb.from('saves').insert({ user_id: uid, saved_id: p.id });
    if (error) return toast(errText(error));
    await refreshSocial(); toast(isSaved ? 'Removed from Saved' : `Saved ${first(p.name)}`);
  }
  const hitLabels = new Set(theyWantMine(p, mineCats).map(w => w.label));
  return (
    <div className="shop">
      <div className="ph">
        <MediaTile m={p.media[0]} cat={svc?.category} seed={p.id} onClick={() => nav(`/u/${p.handle}`)} />
        {match && <span className="mbadge">Match</span>}
        <button className={`heart ${isSaved ? 'on' : ''}`} onClick={toggleSave} aria-label={`${isSaved ? 'Unsave' : 'Save'} ${p.name}`} aria-pressed={isSaved}>
          <Icon name="heart" size={17} fill={isSaved} />
        </button>
      </div>
      <Link to={`/u/${p.handle}`} style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span className="who">@{p.handle} <Verified />{dist !== null && ` · ${fmtMiles(dist)}`}</span>
        <b>{svc?.title || p.role}</b>
        {p.wants.length > 0 && <span className="for">for {p.wants.map((w, i) => <span key={w.id}>{i ? ', ' : ''}{hitLabels.has(w.label) ? <em>{w.label}</em> : w.label}</span>)}</span>}
      </Link>
    </div>
  );
}

export default function Discover() {
  const { me, hidden, following } = useApp();
  const [all, setAll] = useState<FullProfile[] | null>(null);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');

  useEffect(() => { fetchProfiles().then(setAll).catch(e => setErr(errText(e))); }, []);

  const others = useMemo(() => (all || []).filter(p => p.id !== me?.id && !hidden.has(p.id)), [all, me, hidden]);
  const cats = useMemo(() => {
    const seen = new Map<string, number>();
    others.forEach(p => p.services.filter(s => s.active).forEach(s => seen.set(s.category, (seen.get(s.category) || 0) + 1)));
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c).slice(0, 10);
  }, [others]);

  const dist = (p: FullProfile) => miles(me?.zip, p.zip);
  const list = useMemo(() => {
    const term = norm(q);
    let l = others.filter(p => !term || [p.name, p.handle, p.hood, p.role, ...p.services.map(s => `${s.title} ${s.category}`)].join(' ').toLowerCase().includes(term));
    if (cat === 'Matches') l = l.filter(p => isMatch(p, me));
    else if (cat === 'Following') l = l.filter(p => following.has(p.id));
    else if (cat !== 'All') l = l.filter(p => p.services.some(s => s.active && s.category === cat));
    return l.sort((a, b) => (dist(a) ?? 999) - (dist(b) ?? 999));
  }, [others, q, cat, me, following]);
  const matches = list.filter(p => isMatch(p, me));

  return (
    <main className="app">
      <header className="top"><Logo /><span className="pillloc">{me?.hood || 'LA County'} · {me?.zip}</span></header>
      <label className="search"><Icon name="search" size={18} />
        <input type="search" placeholder="Search haircut, photos, meal prep" value={q} onChange={e => setQ(e.target.value)} aria-label="Search" /></label>
      <div className="chips">
        {['All', 'Matches', 'Following', ...cats].map(c => <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      {err && <p className="err">{err}</p>}
      {!all ? <Spinner /> : <>
        {matches.length > 0 && cat !== 'Matches' && <>
          <h2 className="sec">Matches for you <small>{matches.length} {matches.length === 1 ? 'person' : 'people'}</small></h2>
          <div className="stories">
            {matches.map(p => <Link key={p.id} to={`/u/${p.handle}`} className="story"><span className="ring"><Avatar p={p} size={62} /></span><span>{first(p.name)}</span></Link>)}
          </div>
        </>}
        <h2 className="sec">{cat === 'All' ? 'Near you' : cat} <small>Closest first</small></h2>
        {list.length ? <div className="grid2">{list.map(p => <ShopCard key={p.id} p={p} me={me} dist={dist(p)} />)}</div>
          : <div className="empty">{others.length === 0
            ? 'You’re one of the first people here. Invite a friend who has a skill to trade, and they’ll show up here.'
            : cat === 'Following' ? 'You’re not following anyone yet. Open a profile and tap Follow.'
            : cat === 'Matches' ? 'No matches yet. Add more things you need on your profile to find more people.'
            : 'Nobody nearby offers that yet.'}</div>}
      </>}
    </main>
  );
}
