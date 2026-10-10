import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { useApp } from '../lib/session';
import { errText, first, Message, Profile } from '../lib/util';
import { loadTrades, myService, otherId, theirService, TradeBundle } from '../lib/trades';
import { Avatar, Spinner, TopBar } from '../components/ui';

export default function Chat() {
  const { id } = useParams();
  const { session, refreshCounts } = useApp();
  const uid = session!.user.id;
  const [b, setB] = useState<TradeBundle | null>(null);
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTrades([id!]).then(setB).catch(e => setErr(errText(e)));
    sb.from('messages').select('*').eq('trade_id', id!).order('created_at').then(({ data, error }) => {
      if (error) setErr(errText(error)); else setMsgs((data || []) as Message[]);
    });
    sb.rpc('mark_read', { p_trade: id }).then(() => refreshCounts());
    const ch = sb.channel(`chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `trade_id=eq.${id}` }, payload => {
        const m = payload.new as Message;
        setMsgs(list => (list && !list.some(x => x.id === m.id) ? [...list, m] : list));
        sb.rpc('mark_read', { p_trade: id }).then(() => refreshCounts());
      }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim(); if (!body) return;
    setText('');
    const { data, error } = await sb.from('messages').insert({ trade_id: id, sender_id: uid, body }).select().single();
    if (error) { setErr(errText(error)); setText(body); return; }
    setMsgs(list => (list && !list.some(x => x.id === (data as Message).id) ? [...list, data as Message] : list));
  }

  const t = b?.trades[0];
  const other: Profile | undefined = t ? b!.people[otherId(t, uid)] : undefined;
  const closed = t && (t.status === 'declined' || t.status === 'cancelled');
  return (
    <main className="app" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 90px)' }}>
      <TopBar title={other ? <Link to={`/u/${other.handle}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Avatar p={other} size={30} />{first(other.name)}</Link> : 'Messages'}
        right={<Link className="btn small alt" to={`/trades/${id}`}>Trade</Link>} />
      {t && <p className="note" style={{ textAlign: 'center' }}>{b!.services[myService(t, uid)]?.title} ⇄ {b!.services[theirService(t, uid)]?.title}</p>}
      {err && <p className="err">{err}</p>}
      {!msgs ? <Spinner /> : <div className="msgs">
        {msgs.map(m => (
          <div key={m.id} className={`msg ${m.kind === 'system' ? 'sys' : m.sender_id === uid ? 'me' : ''}`}>
            {m.body}
            {m.kind !== 'system' && <time dateTime={m.created_at}>{new Date(m.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</time>}
          </div>
        ))}
        <div ref={endRef} />
      </div>}
      <div className="cta" style={{ bottom: 0, paddingBottom: 'env(safe-area-inset-bottom,0px)' }}><div>
        {closed ? <p className="note" style={{ textAlign: 'center', margin: 0 }}>This trade is closed, but you can still send messages.</p> : null}
        <form className="composer" onSubmit={send} style={{ marginTop: closed ? 8 : 0 }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder={other ? `Message ${first(other.name)}` : 'Message'} aria-label="Message" maxLength={2000} autoComplete="off" />
          <button className="btn" disabled={!text.trim()}>Send</button>
        </form>
      </div></div>
    </main>
  );
}
