import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { mediaUrl } from '../lib/supabase';
import { gradFor, initials, Media, mmss, Profile } from '../lib/util';
import { useApp } from '../lib/session';

const P: Record<string, string> = {
  Haircut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6L20 18M8.6 16.4L20 6"/>',
  Braids: '<path d="M8 3c4 3-4 6 0 9s-4 6 0 9M16 3c4 3-4 6 0 9s-4 6 0 9"/>',
  Boxing: '<path d="M8 3h6a5 5 0 0 1 5 5v4a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V6a3 3 0 0 1 3-3z"/><path d="M8 16v5h8v-5M5 10h5"/>',
  Fitness: '<path d="M3 10v4M6.5 7v10M17.5 7v10M21 10v4M6.5 12h11"/>',
  Photography: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="13.5" r="3.6"/>',
  'Meal prep': '<path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M2 10h20M9.5 6.5c0-1.2 1-1.2 1-2.5M14 6.5c0-1.2 1-1.2 1-2.5"/>',
  Music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  Wellness: '<path d="M12 21c-5-3-8-7-8-12 4 0 7 2 8 5 1-3 4-5 8-5 0 5-3 9-8 12z"/>',
  Design: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 7l3 3"/>',
  Tutoring: '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10v6c3 2 9 2 12 0v-6"/>',
  Tattoo: '<path d="M14 3l7 7-9 9H5v-7z"/><path d="M5 19l-2 2"/>',
  Cleaning: '<path d="M4 21l4-9h8l4 9z"/><path d="M12 12V3"/>',
  swap: '<path d="M4 8h14l-4-4M20 16H6l4 4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  heart: '<path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20z"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>',
  play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
};
export function Icon({ name, size = 22, sw = 2, fill = false }: { name: string; size?: number; sw?: number; fill?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={sw}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[name] || P.swap }} />
  );
}
export const Verified = () => <span className="vchk" title="Member"><Icon name="check" size={10} sw={3.5} /></span>;

export function Avatar({ p, size = 52 }: { p: Pick<Profile, 'id' | 'name' | 'avatar_path'>; size?: number }) {
  return (
    <div className={`av ${gradFor(p.id)}`} style={{ width: size, height: size, fontSize: size * 0.36 }} aria-hidden="true">
      {p.avatar_path ? <img src={mediaUrl(p.avatar_path)} alt="" /> : initials(p.name)}
    </div>
  );
}

/** A photo or video tile, or a gradient with the category icon when there's no media yet. */
export function MediaTile({ m, cat, seed, className = '', caption, onClick }: { m?: Media; cat?: string; seed: string; className?: string; caption?: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`tile ${m ? '' : gradFor(seed)} ${className}`} onClick={onClick} type={onClick ? 'button' : undefined}>
      {m ? (m.kind === 'video'
        ? <video src={`${mediaUrl(m.path)}#t=0.1`} muted playsInline preload="metadata" />
        : <img src={mediaUrl(m.path)} alt={m.caption || ''} loading="lazy" />)
        : <span className="art"><Icon name={cat || 'swap'} size={56} sw={1.3} /></span>}
      {m?.kind === 'video' && <span className="playbadge"><Icon name="play" size={12} />{mmss(m.duration_sec)}</span>}
      {caption && <span className="cap">{caption}</span>}
    </Tag>
  );
}

export function MediaViewer({ m, onClose }: { m: Media; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="viewer" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="viewer-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      <div onClick={e => e.stopPropagation()} className="viewer-body">
        {m.kind === 'video' ? <video src={mediaUrl(m.path)} controls autoPlay playsInline /> : <img src={mediaUrl(m.path)} alt={m.caption} />}
        {m.caption && <p>{m.caption}</p>}
      </div>
    </div>
  );
}

export function TopBar({ title, back = true, right }: { title?: ReactNode; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="top">
      {back ? <button className="back" onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}><Icon name="back" size={18} sw={2.4} />Back</button> : <span />}
      {title && <h1>{title}</h1>}
      {right ?? <span />}
    </header>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return <p className="logo" style={{ fontSize: size }}>bartr<span>.</span></p>;
}

export function TabBar() {
  const { pathname } = useLocation();
  const { me, unread, actionCount } = useApp();
  const unreadCount = Object.values(unread).filter(n => n > 0).length;
  const tabs: [string, string, string, number][] = [
    ['/', 'Discover', 'home', 0], ['/trades', 'Trades', 'swap', actionCount], ['/post', 'Post', 'plus', 0],
    ['/messages', 'Messages', 'chat', unreadCount], ['/me', 'Profile', 'user', 0],
  ];
  const on = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));
  return (
    <nav className="tabs" aria-label="Main">
      <div className="in">
        {tabs.map(([to, label, icon, n]) => (
          <Link key={to} to={to} className={on(to) ? 'on' : ''} aria-current={on(to) ? 'page' : undefined}>
            {icon === 'plus' ? <span className="postbtn"><Icon name="plus" size={20} sw={2.6} /></span>
              : to === '/me' && me ? <span className={`tabav ${on(to) ? 'ring' : ''}`}><Avatar p={me} size={24} /></span>
              : <Icon name={icon} size={23} sw={on(to) ? 2.4 : 2} />}
            {label}
            {n > 0 && <span className="badge">{n}</span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function Stars({ n }: { n: number }) {
  const r = Math.round(n);
  return <span className="stars" aria-label={`${n} of 5 stars`}>{'★'.repeat(r)}{'☆'.repeat(5 - r)}</span>;
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div className="spin" role="status"><span />{label}</div>;
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="sheet-hd"><b>{title}</b><button onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        {children}
      </div>
    </div>
  );
}

/** Shows "x" chip list with a free-text add box (used for wants and categories). */
export function ChipPicker({ options, selected, onToggle, addLabel, onAdd, single }: {
  options: string[]; selected: string[]; onToggle: (v: string) => void; addLabel: string; onAdd: (v: string) => void; single?: boolean;
}) {
  const [v, setV] = useState('');
  return (
    <>
      <div className="wrapchips" role={single ? 'radiogroup' : 'group'}>
        {options.map(o => (
          <button key={o} type="button" className={`chip ${selected.includes(o) ? 'on' : ''}`} aria-pressed={selected.includes(o)} onClick={() => onToggle(o)}>{o}</button>
        ))}
      </div>
      <div className="addrow">
        <input value={v} onChange={e => setV(e.target.value)} placeholder={addLabel} aria-label={addLabel} maxLength={40}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (v.trim()) { onAdd(v); setV(''); } } }} />
        <button type="button" onClick={() => { if (v.trim()) { onAdd(v); setV(''); } }}>Add</button>
      </div>
    </>
  );
}
