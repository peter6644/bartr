import { useState } from 'react';
import { sb } from '../lib/supabase';
import { useApp } from '../lib/session';
import { CATEGORIES, DURATIONS, dur, errText, HOODS, isLAZip, SUGGEST, tidy, uploadMedia, ZIPS } from '../lib/util';
import { ChipPicker, Icon } from '../components/ui';

export default function Onboarding() {
  const { session, me, refreshMe, toast } = useApp();
  const uid = session!.user.id;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(me?.name || '');
  const [handle, setHandle] = useState(me?.handle || '');
  const [avatar, setAvatar] = useState<File | null>(null);
  const [cats, setCats] = useState<string[]>(CATEGORIES);
  const [cat, setCat] = useState('');
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [where, setWhere] = useState('');
  const [wantOpts, setWantOpts] = useState<string[]>(CATEGORIES);
  const [wants, setWants] = useState<string[]>([]);
  const [zip, setZip] = useState('');
  const [hood, setHood] = useState('');
  const [zipMsg, setZipMsg] = useState('');
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const cleanHandle = (s: string) => s.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 24);

  async function next() {
    setErr('');
    if (step === 0) {
      if (!name.trim()) return setErr('Add your name.');
      if (!/^[a-z0-9._]{3,24}$/.test(handle)) return setErr('Usernames are 3 to 24 letters, numbers, dots or underscores.');
      const { data } = await sb.from('profiles').select('id').eq('handle', handle).neq('id', uid).maybeSingle();
      if (data) return setErr('That username is taken. Try another.');
    }
    if (step === 1) {
      if (!cat) return setErr('Pick what you offer, or type it in.');
      if (!title.trim()) return setErr('Name your service.');
    }
    if (step === 2 && !wants.length) return setErr('Pick at least one thing you need.');
    setStep(s => s + 1);
  }

  function applyZip() {
    const z = zip.trim();
    if (!/^\d{5}$/.test(z)) { setZipMsg('Enter a 5-digit ZIP code.'); return false; }
    if (!isLAZip(z)) { setZipMsg('BARTR is starting in LA County. Try an LA County ZIP code.'); return false; }
    setHood(ZIPS[z][2]); setZipMsg(''); return true;
  }

  async function finish() {
    setErr('');
    if (!zip) return setErr('Add your ZIP code or pick your area.');
    if (!applyZip()) return;
    if (!agree) return setErr('Please agree to the trading guidelines to continue.');
    setBusy(true);
    try {
      let avatar_path: string | null = me?.avatar_path ?? null;
      const { error: pe } = await sb.from('profiles').upsert({
        id: uid, handle, name: tidy(name), hood: ZIPS[zip]?.[2] || hood, zip, role: cat, onboarded: false,
      });
      if (pe) throw pe;
      if (avatar) avatar_path = (await uploadMedia(uid, avatar, 'avatar-')).path;
      /* safe to retry: only add the first service once, and replace wants */
      const { count } = await sb.from('services').select('id', { count: 'exact', head: true }).eq('user_id', uid);
      if (!count) {
        const { error: se } = await sb.from('services').insert({ user_id: uid, category: cat, title: tidy(title), duration_min: minutes, location: where.trim() || 'Flexible' });
        if (se) throw se;
      }
      await sb.from('wants').delete().eq('user_id', uid);
      const { error: we } = await sb.from('wants').insert(wants.map(label => ({ user_id: uid, label })));
      if (we) throw we;
      const { error: fe } = await sb.from('profiles').update({ onboarded: true, avatar_path }).eq('id', uid);
      if (fe) throw fe;
      await refreshMe();
      toast('Your shop is open. Welcome to BARTR.');
    } catch (e) { setErr(errText(e)); setBusy(false); }
  }

  const bar = <div className="obbar">{[0, 1, 2, 3].map(n => <span key={n} className={n <= step ? 'on' : ''} />)}</div>;
  const backBtn = step > 0
    ? <button className="back" onClick={() => { setErr(''); setStep(s => s - 1); }}><Icon name="back" size={18} sw={2.4} />Back</button>
    : <button className="back" onClick={() => sb.auth.signOut()}><Icon name="back" size={18} sw={2.4} />Sign out</button>;

  return (
    <div className="app bare">
      <div className="ob">
        {backBtn}{bar}
        {step === 0 && <>
          <h1 className="obh">Set up your shop</h1>
          <p className="obp">This is how people will find you.</p>
          <div className="avpick">
            <div className="av g1" style={{ width: 72, height: 72, fontSize: 26 }}>{avatar ? <img src={URL.createObjectURL(avatar)} alt="" /> : (name.trim()[0] || '?').toUpperCase()}</div>
            <label htmlFor="avatar">{avatar ? 'Change photo' : 'Add a profile photo'}</label>
            <input id="avatar" className="vh" type="file" accept="image/*" onChange={e => setAvatar(e.target.files?.[0] || null)} />
          </div>
          <div className="field"><label className="label" htmlFor="name">Your name</label>
            <input id="name" value={name} maxLength={60} autoComplete="name" onChange={e => { setName(e.target.value); if (!me?.handle && (!handle || handle === cleanHandle(name))) setHandle(cleanHandle(e.target.value.replace(/\s+/g, '.'))); }} /></div>
          <div className="field"><label className="label" htmlFor="handle">Username</label>
            <input id="handle" value={handle} autoCapitalize="none" autoCorrect="off" onChange={e => setHandle(cleanHandle(e.target.value))} placeholder="e.g. rico.boxing" /></div>
        </>}

        {step === 1 && <>
          <h1 className="obh">What can you offer?</h1>
          <p className="obp">Pick your main skill. You can add more services later.</p>
          <ChipPicker single options={cats} selected={cat ? [cat] : []} addLabel="Don't see it? Type what you do"
            onToggle={v => { setCat(v); setTitle(SUGGEST[v] || v); setWants(w => w.filter(x => x !== v)); }}
            onAdd={raw => { const v = tidy(raw); const hit = cats.find(c => c.toLowerCase() === v.toLowerCase()); const c = hit || v; if (!hit) setCats(o => [...o, v]); setCat(c); setTitle(SUGGEST[c] || c); }} />
          <div className="field"><label className="label" htmlFor="title">Name your service</label>
            <input id="title" value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="e.g. 1:1 boxing lesson" /></div>
          <div className="row2">
            <div className="field"><label className="label" htmlFor="dur">Session length</label>
              <select id="dur" value={minutes} onChange={e => setMinutes(+e.target.value)}>{DURATIONS.map(m => <option key={m} value={m}>{dur(m)}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="where">Where</label>
              <input id="where" value={where} maxLength={80} onChange={e => setWhere(e.target.value)} placeholder="My place, a park…" /></div>
          </div>
        </>}

        {step === 2 && <>
          <h1 className="obh">What do you need?</h1>
          <p className="obp">Pick everything you'd trade for. We'll show you people who offer it.</p>
          <ChipPicker options={wantOpts.filter(o => o !== cat)} selected={wants} addLabel="Type anything else you need"
            onToggle={v => setWants(w => (w.includes(v) ? w.filter(x => x !== v) : [...w, v]))}
            onAdd={raw => { const v = tidy(raw); const hit = wantOpts.find(c => c.toLowerCase() === v.toLowerCase()); const c = hit || v; if (!hit) setWantOpts(o => [...o, v]); setWants(w => (w.includes(c) ? w : [...w, c])); }} />
        </>}

        {step === 3 && <>
          <h1 className="obh">Where are you based?</h1>
          <p className="obp">We show you the closest people first. Your exact address is never shown.</p>
          <div className="addrow" style={{ marginTop: 0 }}>
            <input inputMode="numeric" maxLength={5} placeholder="Enter your ZIP code" aria-label="ZIP code" autoComplete="postal-code" value={zip}
              onChange={e => { setZip(e.target.value.replace(/\D/g, '')); setZipMsg(''); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyZip(); } }} />
            <button type="button" onClick={applyZip}>Use</button>
          </div>
          {zipMsg ? <p className="err">{zipMsg}</p> : hood && zip && ZIPS[zip]?.[2] === hood && <p className="note" style={{ color: 'var(--good)', fontWeight: 700 }}>Using ZIP {zip} · {hood}</p>}
          <p className="label" style={{ margin: '18px 0 10px' }}>Or pick your area</p>
          <div className="wrapchips">
            {HOODS.map(([h, z]) => <button key={h} type="button" className={`chip ${hood === h && zip === z ? 'on' : ''}`} onClick={() => { setHood(h); setZip(z); setZipMsg(''); }}>{h}</button>)}
          </div>
          <div className="obnote"><Icon name="shield" size={20} /><span>Meet somewhere public for your first trade, and tell a friend where you're going. You can report or block anyone from their profile.</span></div>
          <label className="check"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>I'm 18 or older. I'll only offer services I'm qualified and licensed to provide, show up when I say I will, and treat people with respect.</span></label>
        </>}

        {err && <p className="err" role="alert">{err}</p>}
        <div className="obfoot">
          {step < 3 ? <button className="btn" onClick={next}>Next{step === 2 && wants.length ? ` · ${wants.length} picked` : ''}</button>
            : <button className="btn" onClick={finish} disabled={busy}>{busy ? 'Opening your shop…' : 'Start trading'}</button>}
        </div>
      </div>
    </div>
  );
}
