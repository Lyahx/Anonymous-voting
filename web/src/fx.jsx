import { useEffect, useRef, useState } from 'react';

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
// Paletteki 6 renk (--c1..--c6); seçenek sırasına göre döner.
export const swatch = (i) => `var(--c${(i % 6) + 1})`;

// Harf harf giren, imleç yaklaşınca genişleyip renklenen başlık (Bricolage'ın wght/wdth eksenleri).
// wave: dokunmatik ekranlarda da hareket olsun diye boştayken dalgalanır.
export function KineticText({ text, as: Tag = 'h1', className = '', wave = false }) {
  const ref = useRef(null);

  useEffect(() => {
    if (reduced()) return;
    const chars = [...ref.current.querySelectorAll('.k-ch')];
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    let mx = -1e4, my = -1e4, last = 0, raf = 0;
    const t0 = performance.now();

    const frame = (now) => {
      const t = (now - t0) / 1000;
      const live = now - last < 1500;
      const rects = live ? chars.map((c) => c.getBoundingClientRect()) : null; // önce hepsini oku, sonra yaz
      chars.forEach((c, i) => {
        let near = 0;
        if (rects) {
          const r = rects[i];
          near = Math.max(0, 1 - Math.hypot(r.left + r.width / 2 - mx, r.top + r.height / 2 - my) / 170);
        }
        const idle = wave ? (Math.sin(t * 1.5 + i * 0.55) + 1) / 2 : 0;
        const k = Math.max(near, idle * 0.6);
        c.style.fontVariationSettings = `'wght' ${Math.round(620 + 180 * k)}, 'wdth' ${Math.round(75 + 25 * k)}`;
        c.style.color = near > 0.3 ? swatch(i) : '';
      });
      raf = live || wave ? requestAnimationFrame(frame) : 0;
    };
    const move = (e) => {
      mx = e.clientX;
      my = e.clientY;
      last = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    };

    if (fine) window.addEventListener('pointermove', move, { passive: true });
    if (wave) raf = requestAnimationFrame(frame);
    return () => {
      window.removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
    };
  }, [text, wave]);

  let offset = 0;
  return (
    <Tag ref={ref} className={`kinetic ${className}`} aria-label={text}>
      {text.split(' ').map((word, w) => {
        const start = offset;
        offset += word.length;
        return (
          <span key={w}>
            <span className="k-word" aria-hidden="true">
              {[...word].map((ch, j) => <span key={j} className="k-ch" style={{ '--i': start + j }}>{ch}</span>)}
            </span>{' '}
          </span>
        );
      })}
    </Tag>
  );
}

// Fare ucunu izleyen nokta; ayrıca slip paralaksı için --mx/--my (-1..1) yazar. Yalnız fare olan cihazlarda.
export function Cursor() {
  const dot = useRef(null);
  useEffect(() => {
    if (reduced() || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const root = document.documentElement;
    root.classList.add('has-cursor');
    let x = -100, y = -100, cx = x, cy = y, raf;
    const move = (e) => {
      x = e.clientX;
      y = e.clientY;
      root.style.setProperty('--mx', (x / innerWidth * 2 - 1).toFixed(3));
      root.style.setProperty('--my', (y / innerHeight * 2 - 1).toFixed(3));
    };
    const over = (e) => dot.current.classList.toggle('big', !!e.target.closest?.('a, button, label, select, input, textarea'));
    const tick = () => {
      cx += (x - cx) * 0.25;
      cy += (y - cy) * 0.25;
      dot.current.style.transform = `translate(${cx}px, ${cy}px)`;
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerover', over);
    raf = requestAnimationFrame(tick);
    return () => {
      root.classList.remove('has-cursor');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerover', over);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <div ref={dot} className="cursor" aria-hidden="true" />;
}

export function Ambient() {
  return <div className="ambient" aria-hidden="true"><i /><i /><i /></div>;
}

export function CountUp({ value, decimals = 0 }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced()) {
      from.current = value;
      return setShown(value);
    }
    const a = from.current, t0 = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 550);
      const v = a + (value - a) * (1 - (1 - p) ** 3);
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return decimals ? shown.toFixed(decimals).replace('.', ',') : Math.round(shown);
}

// Oda kodu: her harf ayrı renkli karo (projeksiyondan okumak kolay).
export function CodeTiles({ code, className = '' }) {
  return (
    <span className={`tiles ${className}`} role="text" aria-label={`Oda kodu ${[...code].join(' ')}`}>
      {[...code].map((ch, i) => <b key={i} aria-hidden="true" style={{ '--c': swatch(i), '--i': i }}>{ch}</b>)}
    </span>
  );
}
