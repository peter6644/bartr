import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon, Logo } from '../components/ui';

const TICK = ['A fade for a boxing lesson', 'Headshots for a week of meals', 'Guitar lessons for a logo', 'Knotless braids for a photo shoot', 'Yoga for a new website'];
const COLLAGE: [string, string, string][] = [['Haircut', 'Fade + beard trim', 'g1'], ['Photography', 'Headshot session', 'g2'], ['Meal prep', 'Week of meal prep', 'g3'], ['Braids', 'Knotless braids', 'g4']];

export default function Welcome() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = window.setInterval(() => setI(n => (n + 1) % TICK.length), 2400); return () => window.clearInterval(t); }, []);
  return (
    <div className="app bare">
      <div className="ob">
        <Logo size={40} />
        <div className="obcollage" aria-hidden="true">
          {COLLAGE.map(([cat, label, g]) => (
            <div key={label} className={`tile ${g}`}><span className="art"><Icon name={cat} size={56} sw={1.3} /></span><span className="cap">{label}</span></div>
          ))}
        </div>
        <h1 className="obh big">Keep your cash.<br />Spend your talent.</h1>
        <p className="tick"><span className="tickicon"><Icon name="swap" size={13} sw={2.6} /></span><span key={i} className="in">{TICK[i]}</span></p>
        <p className="obp">Trade the thing you're great at for the thing you need, with people near you in LA County.</p>
        <div className="obfoot">
          <Link className="btn" to="/join">Open my shop</Link>
          <Link className="btn ghost" to="/signin">I already have an account</Link>
        </div>
      </div>
    </div>
  );
}
