import zipsRaw from './zips.json';
import { sb } from './supabase';

export const ZIPS = zipsRaw as unknown as Record<string, [number, number, string]>;

export type Social = { label: string; value: string };
export type Profile = {
  id: string; handle: string; name: string; bio: string; role: string; hood: string; zip: string;
  avatar_path: string | null; socials: Social[]; license: string; onboarded: boolean; created_at: string;
};
export type Service = { id: string; user_id: string; category: string; title: string; duration_min: number; location: string; active: boolean };
export type Want = { id: string; user_id: string; label: string };
export type Media = { id: string; user_id: string; service_id: string | null; kind: 'photo' | 'video'; path: string; caption: string; duration_sec: number | null; created_at: string };
export type FullProfile = Profile & { services: Service[]; wants: Want[]; media: Media[] };
export type Stats = { id: string; trades: number; rating: number | null; reviews: number; followers: number; following: number };
export type TradeStatus = 'proposed' | 'accepted' | 'completed' | 'declined' | 'cancelled';
export type Trade = {
  id: string; proposer_id: string; receiver_id: string; proposer_service_id: string; receiver_service_id: string;
  scheduled_at: string | null; location: string; status: TradeStatus; awaiting_id: string | null; counter_count: number;
  proposer_done: boolean; receiver_done: boolean; completed_at: string | null; created_at: string; updated_at: string;
};
export type Message = { id: string; trade_id: string; sender_id: string | null; kind: 'text' | 'system'; body: string; created_at: string };
export type Review = { id: string; trade_id: string; reviewer_id: string; reviewee_id: string; rating: number; tags: string[]; body: string; created_at: string };

export const CATEGORIES = ['Haircut', 'Braids', 'Boxing', 'Fitness', 'Photography', 'Meal prep', 'Wellness', 'Music', 'Design', 'Tutoring', 'Tattoo', 'Cleaning'];
export const SUGGEST: Record<string, string> = {
  Boxing: '1:1 boxing lesson', Fitness: 'Personal training session', Haircut: 'Haircut', Braids: 'Braids', Photography: 'Headshot session',
  'Meal prep': 'Week of meal prep', Wellness: 'Private yoga', Music: 'Guitar lesson', Design: 'Logo design', Tutoring: 'Tutoring session',
  Tattoo: 'Flash tattoo', Cleaning: 'Home deep clean',
};
export const HOODS: [string, string][] = [
  ['Highland Park', '90042'], ['Echo Park', '90026'], ['Silver Lake', '90039'], ['DTLA', '90012'], ['Inglewood', '90301'], ['Boyle Heights', '90033'],
  ['Venice', '90291'], ['Santa Monica', '90401'], ['Pasadena', '91101'], ['Long Beach', '90802'], ['North Hollywood', '91601'], ['Compton', '90220'],
];
export const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
export const REVIEW_TAGS = ['Quality', 'On time', 'Communication', 'Would trade again'];
export const REPORT_REASONS = ['No-show', 'Unsafe or threatening', 'Harassment', 'Fake profile', 'Service not as described', 'Something else'];

export const isLAZip = (z: string) => Boolean(ZIPS[z]);
export const tidy = (s: string) => s.trim().replace(/\s+/g, ' ').replace(/^./, c => c.toUpperCase());
export const norm = (s: string) => s.trim().toLowerCase();
export const first = (name: string) => name.trim().split(/\s+/)[0] || name;
export const dur = (m: number) => (m >= 60 ? `${+(m / 60).toFixed(1)} hr` : `${m} min`);
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?';

export function miles(a?: string, b?: string): number | null {
  const p = a && ZIPS[a], q = b && ZIPS[b];
  if (!p || !q) return null;
  const R = 3958.8, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(q[0] - p[0]), dLng = toR(q[1] - p[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(p[0])) * Math.cos(toR(q[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}
export const fmtMiles = (m: number | null) => (m === null ? '' : m < 0.5 ? 'nearby' : `${m} mi`);

/** A want matches a service when it names the category or appears in the title. */
export const wantHits = (label: string, s: Service) => {
  const l = norm(label);
  return l.length > 0 && (norm(s.category) === l || norm(s.title).includes(l) || l.includes(norm(s.category)));
};
/** Their wants that I can provide. */
export const theyWantMine = (them: FullProfile, mine: Service[]) =>
  them.wants.filter(w => mine.some(s => s.active && wantHits(w.label, s)));
/** Their services that I want. */
export const theyOfferMyWant = (them: FullProfile, myWants: Want[]) =>
  them.services.filter(s => s.active && myWants.some(w => wantHits(w.label, s)));
export const isMatch = (them: FullProfile, me: FullProfile | null) =>
  Boolean(me && theyWantMine(them, me.services).length && theyOfferMyWant(them, me.wants).length);

export const GRADS = ['g1', 'g2', 'g3', 'g4'];
export const gradFor = (id: string) => GRADS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length];

export function fmtWhen(iso: string | null) {
  if (!iso) return 'Time to be set';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
export function toLocalInput(d: Date) {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}
export function nextSaturday() {
  const d = new Date(); d.setDate(d.getDate() + (((6 - d.getDay() + 7) % 7) || 7)); d.setHours(10, 0, 0, 0); return d;
}
export function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now'; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
export const errText = (e: unknown) => {
  const m = (e as { message?: string })?.message || String(e);
  if (/duplicate key.*handle/i.test(m)) return 'That username is taken. Try another.';
  if (/Invalid login credentials/i.test(m)) return 'That email and password don’t match.';
  if (/User already registered/i.test(m)) return 'There’s already an account with that email. Sign in instead.';
  if (/Password should be/i.test(m)) return 'Use a password with at least 6 characters.';
  return m.replace(/^.*?ERROR:\s*/, '');
};

export const PROFILE_SELECT = '*, services(*), wants(*), media(*)';
export async function fetchProfiles(): Promise<FullProfile[]> {
  const { data, error } = await sb.from('profiles').select(PROFILE_SELECT).eq('onboarded', true)
    .order('created_at', { referencedTable: 'media', ascending: false });
  if (error) throw error;
  return (data || []) as FullProfile[];
}
export async function fetchProfile(by: { id?: string; handle?: string }): Promise<FullProfile | null> {
  let q = sb.from('profiles').select(PROFILE_SELECT).order('created_at', { referencedTable: 'media', ascending: false });
  q = by.id ? q.eq('id', by.id) : q.eq('handle', by.handle!);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data as FullProfile | null;
}
export async function fetchStats(ids: string[]): Promise<Record<string, Stats>> {
  if (!ids.length) return {};
  const { data } = await sb.rpc('profile_stats', { ids });
  return Object.fromEntries(((data || []) as Stats[]).map(s => [s.id, s]));
}

/* ---------- media helpers ---------- */
export async function compressImage(file: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not read that photo'))), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}
export function videoDuration(file: File): Promise<number | null> {
  return new Promise(res => {
    const v = document.createElement('video'); const u = URL.createObjectURL(file);
    v.preload = 'metadata';
    v.onloadedmetadata = () => { res(Number.isFinite(v.duration) ? Math.round(v.duration) : null); URL.revokeObjectURL(u); };
    v.onerror = () => { res(null); URL.revokeObjectURL(u); };
    v.src = u;
  });
}
export const MAX_VIDEO_MB = 50;
export async function uploadMedia(uid: string, file: File, prefix = ''): Promise<{ path: string; kind: 'photo' | 'video'; duration: number | null }> {
  const isVideo = file.type.startsWith('video');
  if (isVideo && file.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`Videos need to be under ${MAX_VIDEO_MB} MB. Try a shorter clip.`);
  const body = isVideo ? file : await compressImage(file);
  const ext = isVideo ? (file.name.split('.').pop() || 'mp4').toLowerCase() : 'jpg';
  const path = `${uid}/${prefix}${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from('media').upload(path, body, { contentType: isVideo ? file.type || 'video/mp4' : 'image/jpeg', cacheControl: '31536000' });
  if (error) throw error;
  return { path, kind: isVideo ? 'video' : 'photo', duration: isVideo ? await videoDuration(file) : null };
}
export const mmss = (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);
