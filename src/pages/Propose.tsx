import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { sb } from '../lib/supabase';
import { useApp } from '../lib/session';
import { dur, errText, fetchProfile, first, FullProfile, nextSaturday, Service, theyOfferMyWant, toLocalInput, Trade } from '../lib/util';
import { MediaTile, Spinner, TopBar } from '../components/ui';

function Options({ list, value, onPick, owner }: { list: Service[]; value: string; onPick: (id: string) => void; owner: FullProfile }) {
  return (
    <div className="pick" role="radiogroup">
      {list.map(s => (
        <button key={s.id} type="button" role="radio" aria-checked={value === s.id} className={`opt ${value === s.id ? 'on' : ''}`} onClick={() => onPick(s.id)}>
          <MediaTile m={owner.media.find(m => m.service_id === s.id)} cat={s.category} seed={s.id} />
          <div style={{ minWidth: 0 }}><b>{s.title}</b><span className="meta">{dur(s.duration_min)} · {s.location || 'Flexible'}</span></div>
          <span className="rad" />
        </button>
      ))}
    </div>
  );
}

const cleanLoc = (l?: string) => (!l || /^flexible$/i.test(l) ? '' : l);

/** Used for a new proposal (/propose/:userId) and for a counter-offer (/trades/:id/counter). */
export default function Propose({ counter = false }: { counter?: boolean }) {
  const { userId, id: tradeId } = useParams();
  const [params] = useSearchParams();
  const { me, toast, refreshCounts } = useApp();
  const nav = useNavigate();
  const [them, setThem] = useState<FullProfile | null>(null);
  const [theirSvc, setTheirSvc] = useState('');
  const [mySvc, setMySvc] = useState('');
  const [when, setWhen] = useState(toLocalInput(nextSaturday()));
  const [where, setWhere] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const mine = me!.services.filter(s => s.active);

  useEffect(() => {
    (async () => {
      let otherId = userId, trade: Trade | null = null;
      if (counter) {
        const { data } = await sb.from('trades').select('*').eq('id', tradeId!).maybeSingle();
        trade = data as Trade | null;
        if (!trade) return setErr('That trade no longer exists.');
        otherId = trade.proposer_id === me!.id ? trade.receiver_id : trade.proposer_id;
      }
      const p = await fetchProfile({ id: otherId! });
      if (!p) return setErr('We couldn’t find that person.');
      setThem(p);
      const theirs = p.services.filter(s => s.active);
      if (trade) {
        const iAmProposer = trade.proposer_id === me!.id;
        setTheirSvc(iAmProposer ? trade.receiver_service_id : trade.proposer_service_id);
        setMySvc(iAmProposer ? trade.proposer_service_id : trade.receiver_service_id);
        if (trade.scheduled_at) setWhen(toLocalInput(new Date(trade.scheduled_at)));
        setWhere(trade.location);
      } else {
        const want = params.get('svc') || theyOfferMyWant(p, me!.wants)[0]?.id || theirs[0]?.id || '';
        setTheirSvc(want);
        setWhere(cleanLoc(theirs.find(s => s.id === want)?.location));
        setMySvc((mine.find(s => p.wants.some(w => w.label.toLowerCase() === s.category.toLowerCase())) || mine[0])?.id || '');
      }
    })().catch(e => setErr(errText(e)));
  }, [userId, tradeId, counter]);

  async function send(e: FormEvent) {
    e.preventDefault(); setErr('');
    if (!theirSvc || !mySvc) return setErr('Pick what you get and what you give.');
    setBusy(true);
    const whenIso = when ? new Date(when).toISOString() : null;
    try {
      if (counter) {
        const { error } = await sb.rpc('counter_trade', { p_trade: tradeId, p_their_service: theirSvc, p_my_service: mySvc, p_when: whenIso, p_where: where, p_note: note });
        if (error) throw error;
        toast(`Counter-offer sent to ${first(them!.name)}`); await refreshCounts(); nav(`/trades/${tradeId}`, { replace: true });
      } else {
        const { data, error } = await sb.rpc('propose_trade', { p_receiver: them!.id, p_their_service: theirSvc, p_my_service: mySvc, p_when: whenIso, p_where: where, p_note: note });
        if (error) throw error;
        toast(`Proposal sent to ${first(them!.name)}`); await refreshCounts(); nav(`/trades/${data}`, { replace: true });
      }
    } catch (e) { setErr(errText(e)); setBusy(false); }
  }

  if (!them) return <main className="app"><TopBar title={counter ? 'Counter-offer' : 'New trade'} />{err ? <p className="err">{err}</p> : <Spinner />}</main>;
  const theirs = them.services.filter(s => s.active);
  if (!mine.length) return <main className="app"><TopBar title="New trade" /><div className="empty" style={{ marginTop: 20 }}>Add a service you can offer first. <Link to="/post?tab=service" style={{ textDecoration: 'underline', fontWeight: 700 }}>Add a service</Link></div></main>;

  return (
    <main className="app has-cta" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom,0px) + 110px)' }}>
      <TopBar title={counter ? 'Counter-offer' : `Trade with ${first(them.name)}`} />
      <form onSubmit={send} id="tradeform">
        <h2 className="sec">You get <small>from {first(them.name)}</small></h2>
        {theirs.length ? <Options list={theirs} value={theirSvc} onPick={id => { setTheirSvc(id); if (!counter) setWhere(cleanLoc(theirs.find(s => s.id === id)?.location) || where); }} owner={them} />
          : <div className="empty">{first(them.name)} has no services listed right now.</div>}
        <h2 className="sec">You give</h2>
        <Options list={mine} value={mySvc} onPick={setMySvc} owner={me!} />
        <div className="field"><label className="label" htmlFor="when">When</label><input id="when" type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="where">Where</label><input id="where" value={where} maxLength={120} placeholder="A public spot is best for a first trade" onChange={e => setWhere(e.target.value)} /></div>
        <div className="field"><label className="label" htmlFor="note">Note</label><textarea id="note" value={note} maxLength={2000} placeholder={counter ? 'Explain what you changed' : `Say hi and anything ${first(them.name)} should know`} onChange={e => setNote(e.target.value)} /></div>
        <p className="note">You both decide what's fair. {counter ? `${first(them.name)} can accept, decline, or counter again.` : 'Either of you can counter before it’s locked in.'}</p>
        {err && <p className="err" role="alert">{err}</p>}
      </form>
      <div className="cta" style={{ bottom: 0, paddingBottom: 'env(safe-area-inset-bottom,0px)' }}><div>
        <button className="btn" form="tradeform" disabled={busy || !theirs.length}>{busy ? 'Sending…' : counter ? 'Send counter-offer' : 'Send proposal'}</button>
      </div></div>
    </main>
  );
}
