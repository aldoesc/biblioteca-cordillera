import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

/** Envuelve rutas que solo puede ver el administrador. */
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <p style={{ padding: 24 }}>Cargando…</p>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (user.rol !== 'admin')
    return <div className="empty"><p>No tenés permisos para ver esta sección.</p></div>;
  return <>{children}</>;
}
