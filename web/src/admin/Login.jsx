import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { KineticText } from '../fx.jsx';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checked, setChecked] = useState(false);
  const navigate = useNavigate();

  // Oturum zaten açıksa formu hiç göstermeden panele geç. api() değil düz fetch: 401'de yönlendirmesin.
  useEffect(() => {
    fetch('/api/admin/rooms')
      .then((r) => (r.ok ? navigate('/admin', { replace: true }) : setChecked(true)))
      .catch(() => setChecked(true));
  }, [navigate]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/login', { method: 'POST', body: { password } });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };
  if (!checked) return null;
  return (
    <main className="voter">
      <KineticText text="Yönetici girişi" />
      <form onSubmit={submit} className="stack">
        <label>
          Parola
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus
            autoComplete="current-password" />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" disabled={!password}>Giriş yap</button>
      </form>
    </main>
  );
}
