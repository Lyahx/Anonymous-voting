import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { KineticText } from '../fx.jsx';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api('/admin/login', { method: 'POST', body: { password } });
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    }
  };
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
