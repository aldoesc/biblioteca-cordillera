import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { login, register } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const dest = loc.state?.from ?? '/';

  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (modo === 'login') await login(email, password);
      else await register(email, password, nombre);
      nav(dest, { replace: true });
    } catch (e: any) {
      setError(e?.message ?? 'Error');
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1>{modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <form onSubmit={submit}>
          {modo === 'registro' && (
            <label>Nombre
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </label>
          )}
          <label>Email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>Contraseña
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? '…' : modo === 'login' ? 'Entrar' : 'Registrarme'}
          </button>
        </form>
        <p className="switch">
          {modo === 'login' ? (
            <>¿No tenés cuenta? <button className="link" onClick={() => { setModo('registro'); setError(null); }}>Crear una</button></>
          ) : (
            <>¿Ya tenés cuenta? <button className="link" onClick={() => { setModo('login'); setError(null); }}>Iniciar sesión</button></>
          )}
        </p>
        <Link to="/tienda" className="back">← Volver a la tienda</Link>
      </div>
    </div>
  );
}
