import { sb } from './supabase';
import { Profile, Service, Trade } from './util';

export type TradeBundle = { trades: Trade[]; services: Record<string, Service>; people: Record<string, Profile>; reviewed: Set<string> };

export async function loadTrades(ids?: string[]): Promise<TradeBundle> {
  const uid = (await sb.auth.getUser()).data.user?.id;
  let q = sb.from('trades').select('*').order('updated_at', { ascending: false });
  if (ids) q = q.in('id', ids);
  const { data, error } = await q;
  if (error) throw error;
  const trades = (data || []) as Trade[];
  const sids = [...new Set(trades.flatMap(t => [t.proposer_service_id, t.receiver_service_id]))];
  const pids = [...new Set(trades.flatMap(t => [t.proposer_id, t.receiver_id]))];
  const [s, p, r] = await Promise.all([
    sids.length ? sb.from('services').select('*').in('id', sids) : Promise.resolve({ data: [] as Service[] }),
    pids.length ? sb.from('profiles').select('*').in('id', pids) : Promise.resolve({ data: [] as Profile[] }),
    sb.from('reviews').select('trade_id').eq('reviewer_id', uid ?? ''),
  ]);
  return {
    trades,
    services: Object.fromEntries(((s.data || []) as Service[]).map(x => [x.id, x])),
    people: Object.fromEntries(((p.data || []) as Profile[]).map(x => [x.id, x])),
    reviewed: new Set(((r.data || []) as { trade_id: string }[]).map(x => x.trade_id)),
  };
}

export const otherId = (t: Trade, uid: string) => (t.proposer_id === uid ? t.receiver_id : t.proposer_id);
export const myService = (t: Trade, uid: string) => (t.proposer_id === uid ? t.proposer_service_id : t.receiver_service_id);
export const theirService = (t: Trade, uid: string) => (t.proposer_id === uid ? t.receiver_service_id : t.proposer_service_id);
export const myDone = (t: Trade, uid: string) => (t.proposer_id === uid ? t.proposer_done : t.receiver_done);
export const theirDone = (t: Trade, uid: string) => (t.proposer_id === uid ? t.receiver_done : t.proposer_done);

export function statusLabel(t: Trade, uid: string, otherName: string, reviewed: boolean): { text: string; cls: string } {
  switch (t.status) {
    case 'proposed':
      return t.awaiting_id === uid
        ? { text: t.counter_count ? 'Counter-offer for you' : 'New offer for you', cls: 'you' }
        : { text: `Waiting on ${otherName}`, cls: '' };
    case 'accepted':
      return myDone(t, uid) ? { text: `Waiting on ${otherName}`, cls: 'accepted' } : { text: 'Scheduled', cls: 'accepted' };
    case 'completed':
      return reviewed ? { text: 'Completed', cls: 'completed' } : { text: 'Review due', cls: 'you' };
    case 'declined': return { text: 'Declined', cls: '' };
    case 'cancelled': return { text: 'Cancelled', cls: '' };
  }
}
