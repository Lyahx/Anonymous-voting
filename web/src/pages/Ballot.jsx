import { useState } from 'react';
import { api, TYPES } from '../api.js';
import { swatch } from '../fx.jsx';

const HINTS = {
  single: () => 'Birini işaretle.',
  multi: (p) => `En fazla ${p.max_n} seçenek işaretle.`,
  rating: (p) => `1 ile ${p.max_n} arasında bir puan ver.`,
  ranked: () => 'Tercih sırana diz: en üstteki en çok istediğin.',
};

const initial = (p) => (p.type === 'multi' ? [] : p.type === 'ranked' ? p.options.map((_, i) => i) : null);
const ready = (p, v) => (p.type === 'multi' ? v.length > 0 : v !== null);

export default function Ballot({ poll, token, onCast }) {
  const [value, setValue] = useState(() => initial(poll));
  const [casting, setCasting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/polls/${poll.id}/vote`, { method: 'POST', body: { payload: value }, token });
    } catch (err) {
      if (err.status === 409) return onCast(); // zaten oy verilmiş ya da soru kapanmış: durumu yeniden çek
      return setError(err.message);
    }
    setCasting(true);
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(onCast, calm ? 200 : 750);
  };

  const toggle = (i) =>
    setValue((v) => (v.includes(i) ? v.filter((x) => x !== i) : [...v, i]));
  const move = (pos, d) =>
    setValue((v) => {
      const next = [...v];
      [next[pos], next[pos + d]] = [next[pos + d], next[pos]];
      return next;
    });

  return (
    <form className="box" onSubmit={submit}>
      <div className={`paper${casting ? ' drop' : ''}`}>
        <div className="stub">
          <span>Oy pusulası</span>
          <span>{TYPES[poll.type]}</span>
        </div>
        <h1 className="question">{poll.question}</h1>
        <p className="hint" id="hint">{HINTS[poll.type](poll)}</p>

        {poll.type === 'single' && (
          <fieldset aria-describedby="hint">
            <legend className="sr">{poll.question}</legend>
            {poll.options.map((o, i) => (
              <label className="mark" key={i} style={{ '--c': swatch(i) }}>
                <input type="radio" name="o" checked={value === i} onChange={() => setValue(i)} />
                <span className="tick round" />
                {o}
              </label>
            ))}
          </fieldset>
        )}

        {poll.type === 'multi' && (
          <fieldset aria-describedby="hint">
            <legend className="sr">{poll.question}</legend>
            {poll.options.map((o, i) => {
              const on = value.includes(i);
              return (
                <label className="mark" key={i} style={{ '--c': swatch(i) }}>
                  <input type="checkbox" checked={on} disabled={!on && value.length >= poll.max_n} onChange={() => toggle(i)} />
                  <span className="tick" />
                  {o}
                </label>
              );
            })}
          </fieldset>
        )}

        {poll.type === 'rating' && (
          <fieldset aria-describedby="hint" className="scale">
            <legend className="sr">{poll.question}</legend>
            {Array.from({ length: poll.max_n }, (_, i) => i + 1).map((n) => (
              <label key={n} style={{ '--t': (n - 1) / (poll.max_n - 1) }}>
                <input type="radio" name="o" checked={value === n} onChange={() => setValue(n)} />
                <span>{n}</span>
              </label>
            ))}
          </fieldset>
        )}

        {poll.type === 'ranked' && (
          <ol className="ranked" aria-describedby="hint">
            {value.map((optIdx, pos) => (
              <li key={optIdx} style={{ '--c': swatch(optIdx) }}>
                <span className="rank">{pos + 1}</span>
                <span className="grow">{poll.options[optIdx]}</span>
                <button type="button" className="icon" disabled={pos === 0} onClick={() => move(pos, -1)}
                  aria-label={`Yukarı taşı: ${poll.options[optIdx]}`}>↑</button>
                <button type="button" className="icon" disabled={pos === value.length - 1} onClick={() => move(pos, 1)}
                  aria-label={`Aşağı taşı: ${poll.options[optIdx]}`}>↓</button>
              </li>
            ))}
          </ol>
        )}

        {error && <p className="paper-error" role="alert">{error}</p>}
        <button className="btn stamp" disabled={!ready(poll, value) || casting}>Oyu sandığa bırak</button>
      </div>
      <div className="slot" aria-hidden="true" />
    </form>
  );
}
