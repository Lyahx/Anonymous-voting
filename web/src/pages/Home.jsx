import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { swatch } from '../fx.jsx';

// Havada süzülen renkli oy pusulaları: konum/dönüş/paralaks derinliği/gecikme.
const SLIPS = [
  { l: '4%', t: '14%', r: '-9deg', d: 22, dl: '-1s' },
  { l: '28%', t: '46%', r: '6deg', d: -30, dl: '-3s' },
  { l: '50%', t: '10%', r: '-4deg', d: 34, dl: '-5s' },
  { l: '72%', t: '40%', r: '11deg', d: -18, dl: '-2s' },
];

export default function Home() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();
  const go = (e) => {
    e.preventDefault();
    if (code.trim()) navigate(`/r/${code.trim().toUpperCase()}`);
  };
  return (
    <main className="home">
      <div className="slips" aria-hidden="true">
        {SLIPS.map((s, i) => (
          <div key={i} className="slip" style={{ '--c': swatch([1, 2, 3, 0][i]), '--l': s.l, '--t': s.t, '--r': s.r, '--d': s.d, '--dl': s.dl }}>
            <div><b>✕</b><s /><s /><s /></div>
          </div>
        ))}
      </div>

      <div className="home-inner">
        <h1 className="mega">Anonim oylama</h1>
        <p className="lead">Ekrandaki QR kodu okut ya da oda kodunu yaz. Oyunun kime ait olduğu kaydedilmez.</p>
        <form onSubmit={go} className="code-form">
          <label>
            Oda kodu
            <input value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} autoCapitalize="characters"
              autoComplete="off" spellCheck={false} className="code-input" placeholder="ABC123" />
          </label>
          <button className="btn" disabled={!code.trim()}>Odaya gir</button>
        </form>
        <p className="foot"><Link to="/admin">Yönetici girişi</Link></p>
      </div>
    </main>
  );
}
