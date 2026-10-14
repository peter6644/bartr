import { Link } from 'react-router-dom';
import { Icon, Logo } from '../components/ui';

const COLLAGE: [string, string, string][] = [['Haircut', 'Fade + beard trim', 'g1'], ['Photography', 'Headshot session', 'g2'], ['Meal prep', 'Meal prep', 'g3'], ['Tattoo', 'Tattoo', 'g4']];

export default function Welcome() {
  return (
    <div className="app bare">
      <div className="ob">
        <Logo size={40} />
        <div className="obcollage" aria-hidden="true">
          {COLLAGE.map(([cat, label, g]) => (
            <div key={label} className={`tile ${g}`}><span className="art"><Icon name={cat} size={56} sw={1.3} /></span><span className="cap">{label}</span></div>
          ))}
        </div>
        <h1 className="obh big">TRADE SKILLS.<br /><span style={{ color: 'var(--accent)' }}>NOT CASH.</span></h1>
        <p className="obp">You've got something someone needs. They've got something you want. Make the trade.</p>
        <div className="obfoot">
          <Link className="btn" to="/join">Open my shop</Link>
          <Link className="btn ghost" to="/signin">I already have an account</Link>
        </div>
      </div>
    </div>
  );
}
