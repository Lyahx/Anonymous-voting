import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, TYPES, useLive } from '../api.js';
import Results from '../Results.jsx';
import { CodeTiles, KineticText, swatch } from '../fx.jsx';

const STATUS = { draft: 'Henüz açılmadı', open: 'Açık', closed: 'Kapalı', revealed: 'Birinci projeksiyonda' };

export default function AdminRoom() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ type: 'single', question: '', options: '', max_n: 2 });

  const load = useCallback(
    () => api(`/admin/rooms/${id}`).then(setData).catch((e) => setError(e.message)),
    [id],
  );
  useLive(`/api/admin/rooms/${id}/events`, load, [id]);

  const run = (p) => p.then(load).catch((e) => setError(e.message));
  const setStatus = (poll, status) => run(api(`/admin/polls/${poll.id}/status`, { method: 'POST', body: { status } }));
  const remove = (poll) => {
    if (confirm(`"${poll.question}" sorusu ve oyları silinsin mi?`)) run(api(`/admin/polls/${poll.id}`, { method: 'DELETE' }));
  };

  const add = async (e) => {
    e.preventDefault();
    setError('');
    const options = form.options.split('\n').map((s) => s.trim()).filter(Boolean);
    const max_n = form.type === 'rating' ? Number(form.max_n) || 5 : Number(form.max_n);
    try {
      await api(`/admin/rooms/${id}/polls`, { method: 'POST', body: { type: form.type, question: form.question, options, max_n } });
      setForm((f) => ({ ...f, question: '', options: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (!data) return <main className="admin">{error ? <p className="error" role="alert">{error}</p> : <p className="muted">Yükleniyor…</p>}</main>;

  const { room, voters, polls, publicUrl } = data;
  const base = publicUrl || location.origin;
  const joinUrl = `${base}/r/${room.code}`;
  const local = /localhost|127\.0\.0\.1/.test(base);

  return (
    <main className="admin">
      <header className="bar">
        <div>
          <Link to="/admin" className="muted">Tüm odalar</Link>
          <KineticText text={room.title} />
        </div>
        <div className="actions">
          <Link className="btn" to={`/admin/rooms/${id}/projector`} target="_blank">Projeksiyon modu</Link>
          <a className="btn ghost" href={`/api/admin/rooms/${id}/export.csv`}>CSV indir</a>
        </div>
      </header>

      <section className="join-card">
        <div className="qr"><QRCodeSVG value={joinUrl} size={132} bgColor="#E4DFD3" fgColor="#0E1118" marginSize={2} /></div>
        <div>
          <p className="muted">Katılım adresi</p>
          <p className="join-url">{joinUrl}</p>
          <p className="code-row">Oda kodu <CodeTiles code={room.code} className="sm" /></p>
          <p>{voters} katılımcı bağlandı.</p>
        </div>
      </section>
      {local && (
        <p className="notice error" role="alert">
          QR kodu localhost adresini içeriyor; telefonlar bu adrese ulaşamaz. Bu sayfayı bilgisayarın ağ adresiyle aç
          (örnek: http://192.168.1.20:5173) ya da PUBLIC_URL ayarla.
        </p>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <h2>Sorular</h2>
      {polls.length === 0 && <p className="muted">Soru yok. Aşağıdan ekle, sonra “Oylamayı başlat” ile aç.</p>}
      {polls.map((p, i) => (
        <article key={p.id} className={`poll ${p.status}`} style={{ '--c': swatch(i) }}>
          <header>
            <div className="grow">
              <h3>{p.question}</h3>
              <p className="muted">{TYPES[p.type]}</p>
            </div>
            <span className={`chip ${p.status}`}>{STATUS[p.status]}</span>
          </header>
          <Results type={p.type} result={p.result} />
          <footer className="actions">
            {p.status === 'open'
              ? <button className="btn" onClick={() => setStatus(p, 'closed')}>Oylamayı bitir</button>
              : <button className="btn" onClick={() => setStatus(p, 'open')}>{p.status === 'draft' ? 'Oylamayı başlat' : 'Yeniden aç'}</button>}
            {p.status === 'closed' && (
              <button className="btn" disabled={p.result.total === 0} onClick={() => setStatus(p, 'revealed')}>Birinciyi göster</button>
            )}
            {p.status === 'revealed' && <button className="btn ghost" onClick={() => setStatus(p, 'closed')}>Gizle</button>}
            <button className="btn ghost danger" onClick={() => remove(p)}>Sil</button>
          </footer>
        </article>
      ))}

      <h2>Soru ekle</h2>
      <form onSubmit={add} className="stack add-form">
        <label>
          Soru tipi
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, max_n: e.target.value === 'rating' ? 5 : 2 })}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>
          Soru
          <input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} maxLength={200} />
        </label>
        {form.type !== 'rating' && (
          <label>
            Seçenekler (her satıra bir tane)
            <textarea rows={5} value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} />
          </label>
        )}
        {form.type === 'multi' && (
          <label>
            En fazla kaç seçenek işaretlenebilir
            <input type="number" min={1} max={12} value={form.max_n} onChange={(e) => setForm({ ...form, max_n: e.target.value })} />
          </label>
        )}
        {form.type === 'rating' && (
          <label>
            Puan ölçeği
            <select value={form.max_n} onChange={(e) => setForm({ ...form, max_n: e.target.value })}>
              <option value={5}>1 ile 5</option>
              <option value={10}>1 ile 10</option>
            </select>
          </label>
        )}
        <button className="btn" disabled={!form.question.trim()}>Soruyu ekle</button>
      </form>
    </main>
  );
}
