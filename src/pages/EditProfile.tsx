import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { useApp } from '../lib/session';
import { dur, errText, isLAZip, Social, tidy, uploadMedia, ZIPS } from '../lib/util';
import { Avatar, Icon, TopBar } from '../components/ui';

const SOCIAL_LABELS = ['Instagram', 'TikTok', 'YouTube', 'Website'];

export default function EditProfile() {
  const { me, refreshMe, toast } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState(me!.name);
  const [bio, setBio] = useState(me!.bio);
  const [role, setRole] = useState(me!.role);
  const [zip, setZip] = useState(me!.zip);
  const [license, setLicense] = useState(me!.license);
  const [socials, setSocials] = useState<Record<string, string>>(Object.fromEntries(SOCIAL_LABELS.map(l => [l, (me!.socials || []).find(s => s.label === l)?.value || ''])));
  const [avatar, setAvatar] = useState<File | null>(null);
  const [newWant, setNewWant] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (!name.trim()) return setErr('Add your name.');
    if (!isLAZip(zip)) return setErr('Use an LA County ZIP code.');
    setBusy(true);
    try {
      const avatar_path = avatar ? (await uploadMedia(me!.id, avatar, 'avatar-')).path : me!.avatar_path;
      const s: Social[] = SOCIAL_LABELS.map(label => ({ label, value: socials[label].trim() })).filter(x => x.value);
      const { error } = await sb.from('profiles').update({ name: tidy(name), bio: bio.trim(), role: role.trim(), zip, hood: ZIPS[zip][2], license: license.trim(), socials: s, avatar_path }).eq('id', me!.id);
      if (error) throw error;
      await refreshMe(); toast('Profile saved'); nav('/me');
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  async function removeService(id: string) {
    const { error } = await sb.from('services').update({ active: false }).eq('id', id);
    if (error) return toast(errText(error));
    await refreshMe(); toast('Service removed');
  }
  async function addWant() {
    const label = tidy(newWant); if (!label) return;
    if (me!.wants.some(w => w.label.toLowerCase() === label.toLowerCase())) { setNewWant(''); return; }
    const { error } = await sb.from('wants').insert({ user_id: me!.id, label });
    if (error) return toast(errText(error));
    setNewWant(''); await refreshMe();
  }
  async function removeWant(id: string) {
    const { error } = await sb.from('wants').delete().eq('id', id);
    if (error) return toast(errText(error));
    await refreshMe();
  }

  return (
    <main className="app">
      <TopBar title="Edit profile" />
      <form onSubmit={save}>
        <div className="avpick">
          {avatar ? <div className="av" style={{ width: 72, height: 72 }}><img src={URL.createObjectURL(avatar)} alt="" /></div> : <Avatar p={me!} size={72} />}
          <label htmlFor="av">Change photo</label>
          <input id="av" className="vh" type="file" accept="image/*" onChange={e => setAvatar(e.target.files?.[0] || null)} />
        </div>
        <div className="field"><label className="label" htmlFor="n">Name</label><input id="n" value={name} maxLength={60} onChange={e => setName(e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="r">What you do (one line)</label><input id="r" value={role} maxLength={60} placeholder="e.g. Boxing coach" onChange={e => setRole(e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="b">Bio</label><textarea id="b" value={bio} maxLength={300} placeholder="Your experience, what you're known for, what you'd love to trade for." onChange={e => setBio(e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="z">ZIP code</label><input id="z" inputMode="numeric" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/\D/g, ''))} />
          {isLAZip(zip) && <span className="note" style={{ marginTop: 0 }}>{ZIPS[zip][2]}</span>}</div>
        <div className="field"><label className="label" htmlFor="l">License or certification (if your service needs one)</label><input id="l" value={license} maxLength={120} placeholder="e.g. CA barber license #12345" onChange={e => setLicense(e.target.value)} /></div>
        <h2 className="sec">Socials</h2>
        {SOCIAL_LABELS.map(l => (
          <div key={l} className="field" style={{ marginTop: 8 }}><label className="label" htmlFor={`s-${l}`}>{l}</label>
            <input id={`s-${l}`} value={socials[l]} autoCapitalize="none" placeholder={l === 'Website' ? 'yoursite.com' : '@handle'} onChange={e => setSocials(s => ({ ...s, [l]: e.target.value }))} /></div>
        ))}
        {err && <p className="err" role="alert">{err}</p>}
        <div className="btns"><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button></div>
      </form>

      <h2 className="sec">Your services</h2>
      {me!.services.filter(s => s.active).map(s => (
        <div key={s.id} className="sp-offer" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
          <div><b>{s.title}</b><div className="meta">{s.category} · {dur(s.duration_min)} · {s.location}</div></div>
          <button className="btn small alt" onClick={() => removeService(s.id)}>Remove</button>
        </div>
      ))}
      <button className="btn ghost" onClick={() => nav('/post?tab=service')}><Icon name="plus" size={16} />Add a service</button>

      <h2 className="sec">Looking for</h2>
      <div className="wrapchips">{me!.wants.map(w => <span key={w.id} className="tag">{w.label}<button onClick={() => removeWant(w.id)} aria-label={`Remove ${w.label}`}><Icon name="x" size={14} /></button></span>)}</div>
      <div className="addrow"><input value={newWant} maxLength={40} placeholder="Add something you need" aria-label="Add something you need" onChange={e => setNewWant(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addWant(); } }} /><button onClick={addWant}>Add</button></div>
    </main>
  );
}
