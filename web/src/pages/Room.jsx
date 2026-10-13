import { useCallback, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, store, useLive } from '../api.js';
import Ballot from './Ballot.jsx';
import { KineticText } from '../fx.jsx';

// Oy alındı mührü: yuvaya düşen pusulanın ardından çarpar, halkadaki yazı döner.
function Seal() {
  return (
    <svg className="seal" viewBox="0 0 200 200" aria-hidden="true">
      <defs><path id="seal-ring" d="M100,100 m-76,0 a76,76 0 1,1 152,0 a76,76 0 1,1 -152,0" /></defs>
      <circle cx="100" cy="100" r="97" className="seal-bg" />
      <g className="seal-ring">
        <text><textPath href="#seal-ring" textLength="470" lengthAdjust="spacing">gizli oy ✕ sandığa bırakıldı ✕ gizli oy ✕ sandığa bırakıldı ✕</textPath></text>
      </g>
      <circle cx="100" cy="100" r="54" className="seal-in" />
      <path d="M74 102 l20 20 l36 -42" className="seal-check" />
    </svg>
  );
}

export default function Room() {
  const code = useParams().code.toUpperCase();
  const key = `token:${code}`;
  const token = useRef(null);
  const [state, setState] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (retry = true) => {
    try {
      if (!token.current) {
        const j = await api(`/rooms/${code}/join`, { method: 'POST', token: store.get(key) });
        token.current = j.token;
        store.set(key, j.token);
      }
      setState(await api(`/rooms/${code}/state`, { token: token.current }));
      setError('');
    } catch (e) {
      // Sunucu bu token'ı tanımıyorsa (oda silinip yeniden kuruldu vb.) bir kez yeniden katıl.
      if (e.status === 401 && retry) {
        token.current = null;
        store.del(key);
        return load(false);
      }
      setError(e.message);
    }
  }, [code, key]);

  useLive(`/api/rooms/${code}/events`, load, [code]);

  if (!state) {
    return (
      <main className="voter">
        {error ? <p className="notice error" role="alert">{error}</p> : <p className="muted">Odaya bağlanıyor…</p>}
      </main>
    );
  }

  const { poll, voted, closed, title } = state;
  return (
    <main className="voter">
      <p className="room-title">{title}</p>
      {error && <p className="notice error" role="alert">Bağlantı koptu. Yeniden bağlanılıyor…</p>}

      {poll && !voted && <Ballot key={poll.id} poll={poll} token={token.current} onCast={load} />}
      {poll && voted && (
        <section className="notice done">
          <Seal />
          <KineticText as="h1" text="Oyun alındı" />
          <p>Birinci açıklanınca bu sayfada görünür.</p>
        </section>
      )}
      {!poll && closed.length === 0 && (
        <section className="notice wait">
          <div className="radar" aria-hidden="true"><i /><i /><i /></div>
          <KineticText as="h1" text="Açık soru yok" wave />
          <p>Yönetici bir soru açtığında bu sayfa kendiliğinden değişir. Yenilemene gerek yok.</p>
        </section>
      )}

      {closed.length > 0 && (
        <section className="stack">
          <h2>Sonuçlar</h2>
          {closed.map((p) => (
            <article key={p.id} className="closed-poll">
              <h3>{p.question}</h3>
              {p.average != null ? (
                <p className="podium-avg">Ortalama {p.average.toFixed(1)}</p>
              ) : (
                <>
                  <ul className="podium">
                    {p.winners.map((w, i) => (
                      <li key={i} className={p.winners.length > 1 ? 'tie' : 'win'}>
                        <span className="p-name">{w}</span>
                      </li>
                    ))}
                  </ul>
                  {p.winners.length > 1 && <p className="p-tie">Berabere</p>}
                </>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
