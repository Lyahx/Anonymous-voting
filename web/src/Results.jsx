import { CountUp, swatch } from './fx.jsx';

export default function Results({ type, result }) {
  const { total, labels, values, average } = result;
  const max = Math.max(...values, 1);
  const top = Math.max(...values);
  const leader = total > 0 && values.filter((v) => v === top).length === 1 ? values.indexOf(top) : -1;
  return (
    <div className="results">
      <ul>
        {labels.map((label, i) => (
          <li
            key={i}
            className={i === leader ? 'leader' : ''}
            // puan: kırmızıdan yeşile; diğerleri: seçenek rengi
            style={{ '--c': type === 'rating' ? `hsl(${(i / Math.max(labels.length - 1, 1)) * 120} 85% 62%)` : swatch(i), '--i': i }}
          >
            <span className="r-label">{type === 'rating' ? `${label} puan` : label}</span>
            <span className="r-value">
              <CountUp value={values[i]} />
              {type === 'ranked' ? ' puan' : total > 0 && <small> %{Math.round((values[i] / total) * 100)}</small>}
            </span>
            <span className="r-track">
              <span className="r-fill" style={{ transform: `scaleX(${values[i] / max})` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="r-total">
        <CountUp value={total} /> oy
        {average != null && <>, ortalama <CountUp value={average} decimals={1} /></>}
      </p>
    </div>
  );
}
