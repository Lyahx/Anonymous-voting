import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { KineticText, swatch } from '../fx.jsx';

export default function Rooms() {
  const [rooms, setRooms] = useState(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = () => api('/admin/rooms').then(setRooms).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      const room = await api('/admin/rooms', { method: 'POST', body: { title } });
      navigate(`/admin/rooms/${room.id}`);
    } catch (err) {
      setError(err.message);
    }
  };
  const remove = async (room) => {
    if (!confirm(`"${room.title}" odası ve içindeki tüm oylar silinsin mi? Bu geri alınamaz.`)) return;
    await api(`/admin/rooms/${room.id}`, { method: 'DELETE' });
    load();
  };
  const logout = async () => {
    await api('/admin/logout', { method: 'POST' });
    navigate('/admin/login');
  };

  return (
    <main className="admin">
      <header className="bar">
        <KineticText text="Oylama odaları" />
        <button className="btn ghost" onClick={logout}>Çıkış yap</button>
      </header>
      {error && <p className="error" role="alert">{error}</p>}

      <form onSubmit={create} className="inline-form">
        <label className="grow">
          Yeni oda adı
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
        </label>
        <button className="btn" disabled={!title.trim()}>Oda oluştur</button>
      </form>

      {rooms?.length === 0 && <p className="muted">Henüz oda yok. Yukarıdan ilkini oluştur.</p>}
      <ul className="room-list">
        {rooms?.map((r, i) => (
          <li key={r.id} style={{ '--c': swatch(i), '--i': i }}>
            <Link to={`/admin/rooms/${r.id}`} className="grow">
              <strong>{r.title}</strong>
              <span className="muted">Kod {r.code}, {r.polls} soru, {r.voters} katılımcı</span>
              <span className="go" aria-hidden="true">→</span>
            </Link>
            <button className="btn ghost danger" onClick={() => remove(r)}>Sil</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
