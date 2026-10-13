// Oy yükü (payload) biçimleri:
//   single: seçenek indeksi · multi: indeks dizisi · rating: 1..max_n · ranked: tüm indekslerin tercih sırası
const int = Number.isInteger;

export function validate({ type, options, max_n }, p) {
  const n = options.length;
  const idx = (i) => int(i) && i >= 0 && i < n;
  switch (type) {
    case 'single': return idx(p);
    case 'multi': return Array.isArray(p) && p.length >= 1 && p.length <= max_n && p.every(idx) && new Set(p).size === p.length;
    case 'rating': return int(p) && p >= 1 && p <= max_n;
    case 'ranked': return Array.isArray(p) && p.length === n && p.every(idx) && new Set(p).size === n;
    default: return false;
  }
}

// Seçmen ekranına sayı sızmasın diye yalnız birincileri verir: berabere ise hepsi, puan sorusunda ortalama.
export function podium({ labels, values, average }) {
  if (average != null) return { average };
  const top = Math.max(...values);
  return { winners: labels.filter((_, i) => values[i] === top) };
}

// ranked: Borda sayımı (ilk sıra n-1 puan, son sıra 0).
export function tally({ type, options, max_n }, payloads) {
  const total = payloads.length;
  if (type === 'rating') {
    const values = Array(max_n).fill(0);
    for (const p of payloads) values[p - 1]++;
    const sum = payloads.reduce((a, b) => a + b, 0);
    return { total, labels: values.map((_, i) => String(i + 1)), values, average: total ? sum / total : null };
  }
  const values = Array(options.length).fill(0);
  for (const p of payloads) {
    if (type === 'single') values[p]++;
    else if (type === 'multi') p.forEach((i) => values[i]++);
    else p.forEach((optIdx, pos) => { values[optIdx] += options.length - 1 - pos; });
  }
  return { total, labels: options, values };
}
