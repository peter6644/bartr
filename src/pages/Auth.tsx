import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { errText } from '../lib/util';
import { TopBar } from '../components/ui';

export default function Auth({ mode }: { mode: 'signin' | 'join' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const join = mode === 'join';

  async function submit(e: FormEvent) {
    e.preventDefault(); setErr(''); setInfo(''); setBusy(true);
    try {
      if (join) {
        const { data, error } = await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setInfo('Check your email to confirm your account, then come back and sign in.');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }

  return (
    <div className="app bare">
      <TopBar />
      <form className="ob" onSubmit={submit} style={{ minHeight: 'auto' }}>
        <h1 className="obh">{join ? 'Open your shop' : 'Welcome back'}</h1>
        <p className="obp">{join ? 'Create your account. Next you’ll set up what you offer and what you need.' : 'Sign in to keep trading.'}</p>
        <div className="field"><label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="pw">Password</label>
          <input id="pw" type="password" autoComplete={join ? 'new-password' : 'current-password'} minLength={6} required value={password} onChange={e => setPassword(e.target.value)} />
          {join && <span className="note" style={{ marginTop: 0 }}>At least 6 characters.</span>}</div>
        {err && <p className="err" role="alert">{err}</p>}
        {info && <p className="banner" role="status">{info}</p>}
        <div className="btns">
          <button className="btn" disabled={busy}>{busy ? 'One sec…' : join ? 'Create account' : 'Sign in'}</button>
          <Link className="btn ghost" to={join ? '/signin' : '/join'}>{join ? 'I already have an account' : 'New here? Open your shop'}</Link>
        </div>
      </form>
    </div>
  );
}
