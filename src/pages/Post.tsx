import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { useApp } from '../lib/session';
import { CATEGORIES, DURATIONS, dur, errText, MAX_VIDEO_MB, SUGGEST, tidy, uploadMedia } from '../lib/util';
import { Icon, Logo } from '../components/ui';

export default function Post() {
  const { me, refreshMe, toast } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'footage' | 'service'>(params.get('tab') === 'service' ? 'service' : 'footage');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState('');
  const services = me!.services.filter(s => s.active);
  const [svc, setSvc] = useState(services[0]?.id || '');
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [customCat, setCustomCat] = useState('');
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(60);
  const [where, setWhere] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function pick(f: File | undefined) {
    setErr('');
    if (!f) return;
    if (f.type.startsWith('video') && f.size > MAX_VIDEO_MB * 1024 * 1024) { setErr(`Videos need to be under ${MAX_VIDEO_MB} MB. Try a shorter clip (under a minute works best).`); return; }
    setFile(f); setPreview(URL.createObjectURL(f));
  }

  async function postFootage(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (!file) return setErr('Pick a photo or video first.');
    setBusy(true);
    try {
      const up = await uploadMedia(me!.id, file);
      const { error } = await sb.from('media').insert({ user_id: me!.id, service_id: svc || null, kind: up.kind, path: up.path, caption: caption.trim(), duration_sec: up.duration });
      if (error) throw error;
      await refreshMe(); toast('Posted to your shop'); nav('/me');
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }

  async function addService(e: FormEvent) {
    e.preventDefault(); setErr('');
    const category = cat === 'Other' ? tidy(customCat) : cat;
    if (!category) return setErr('Type your category.');
    if (!title.trim()) return setErr('Name your service.');
    setBusy(true);
    const { error } = await sb.from('services').insert({ user_id: me!.id, category, title: tidy(title), duration_min: minutes, location: where.trim() || 'Flexible' });
    setBusy(false);
    if (error) return setErr(errText(error));
    await refreshMe(); toast('Service added. Your matches update right away.'); nav('/me');
  }

  return (
    <main className="app">
      <header className="top"><Logo /><span className="pillloc">Post to your shop</span></header>
      <div className="seg2" role="tablist">
        <button role="tab" aria-selected={mode === 'footage'} className={mode === 'footage' ? 'on' : ''} onClick={() => setMode('footage')}>Footage</button>
        <button role="tab" aria-selected={mode === 'service'} className={mode === 'service' ? 'on' : ''} onClick={() => setMode('service')}>New service</button>
      </div>

      {mode === 'footage' ? (
        <form onSubmit={postFootage}>
          <label className="drop" htmlFor="file">
            {preview ? <>{file?.type.startsWith('video') ? <video src={preview} muted loop autoPlay playsInline /> : <img src={preview} alt="Your upload" />}<span className="chg">Change</span></>
              : <span><Icon name="plus" size={34} sw={1.8} /><b>Add a photo or video</b>Show yourself at work</span>}
            <input id="file" className="vh" type="file" accept="image/*,video/*" onChange={e => pick(e.target.files?.[0])} />
          </label>
          <div className="field"><label className="label" htmlFor="cap">Caption</label><input id="cap" value={caption} maxLength={140} placeholder="e.g. Saturday sparring drill" onChange={e => setCaption(e.target.value)} /></div>
          {services.length > 0 && <div className="field"><label className="label" htmlFor="svc">Which service is this for?</label>
            <select id="svc" value={svc} onChange={e => setSvc(e.target.value)}>{services.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}<option value="">Not a specific service</option></select></div>}
          <p className="note">Short clips of you at work get the most trade requests. Videos up to {MAX_VIDEO_MB} MB.</p>
          {err && <p className="err" role="alert">{err}</p>}
          <div className="btns"><button className="btn" disabled={busy}>{busy ? 'Uploading…' : 'Post to your shop'}</button></div>
        </form>
      ) : (
        <form onSubmit={addService}>
          <div className="field"><label className="label" htmlFor="cat">Category</label>
            <select id="cat" value={cat} onChange={e => { setCat(e.target.value); if (!title && SUGGEST[e.target.value]) setTitle(SUGGEST[e.target.value]); }}>
              {[...CATEGORIES, 'Other'].map(c => <option key={c}>{c}</option>)}</select></div>
          {cat === 'Other' && <div className="field"><label className="label" htmlFor="cc">Type your category</label><input id="cc" value={customCat} maxLength={40} placeholder="e.g. Car detailing" onChange={e => setCustomCat(e.target.value)} /></div>}
          <div className="field"><label className="label" htmlFor="t">Service name</label><input id="t" value={title} maxLength={80} placeholder="e.g. Jump rope + footwork class" onChange={e => setTitle(e.target.value)} /></div>
          <div className="row2">
            <div className="field"><label className="label" htmlFor="d">Session length</label><select id="d" value={minutes} onChange={e => setMinutes(+e.target.value)}>{DURATIONS.map(m => <option key={m} value={m}>{dur(m)}</option>)}</select></div>
            <div className="field"><label className="label" htmlFor="w">Where</label><input id="w" value={where} maxLength={80} placeholder="My place, a park…" onChange={e => setWhere(e.target.value)} /></div>
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <div className="btns"><button className="btn" disabled={busy}>{busy ? 'Adding…' : 'Add service'}</button></div>
        </form>
      )}
    </main>
  );
}
