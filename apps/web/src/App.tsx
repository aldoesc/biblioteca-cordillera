import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { api } from './api';
import Footer from './components/Footer';
import FloatingWhatsApp from './components/FloatingWhatsApp';

export default function App() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { user, cartCount, logout } = useAuth();
  const [ventasNuevas, setVentasNuevas] = useState(0);

  // Alerta para el admin: cuenta de pedidos "por atender" + notificación de
  // escritorio cuando entra una venta nueva (mientras la página está abierta).
  useEffect(() => {
    if (user?.rol !== 'admin') return;
    let activo = true;

    // Pedir permiso de notificaciones una vez
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }

    async function chequear() {
      try {
        const orders = await api.getAdminOrders();
        const pagadas = orders.filter((o) => o.estado === 'pagado');
        const porAtender = pagadas.filter((o) => o.cumplimiento === 'por_atender').length;
        if (activo) setVentasNuevas(porAtender);

        // ¿Hay un pedido más nuevo que el último visto? → notificar
        const maxId = pagadas.reduce((m, o) => Math.max(m, o.id), 0);
        const lastSeen = Number(localStorage.getItem('ultima_venta_id') ?? '0');
        if (maxId > lastSeen) {
          if (lastSeen !== 0 && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('🔔 Nueva venta — Biblioteca Cordillera', {
              body: `Pedido #${maxId} listo para atender.`,
            });
          }
          localStorage.setItem('ultima_venta_id', String(maxId));
        }
      } catch {
        /* ignorar */
      }
    }

    chequear();
    const t = setInterval(chequear, 60000); // cada 60s
    return () => {
      activo = false;
      clearInterval(t);
    };
  }, [user, pathname]);

  async function salir() {
    await logout();
    nav('/');
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/logo-icon.png" alt="Biblioteca Cordillera" className="brand-logo" />
        </Link>
        <nav>
          <Link to="/" className={pathname === '/' || pathname.startsWith('/coleccion') ? 'active' : ''}>Colección</Link>
          <Link to="/tienda" className={pathname.startsWith('/tienda') ? 'active' : ''}>Tienda</Link>

          {user && (
            <Link to="/pedidos" className={pathname === '/pedidos' ? 'active' : ''}>Mis pedidos</Link>
          )}

          {user?.rol === 'admin' && (
            <>
              <Link to="/admin" className={pathname.startsWith('/admin') && pathname !== '/admin/pedidos' && pathname !== '/admin/reclamos' ? 'active' : ''}>Administrar</Link>
              <Link to="/admin/pedidos" className={`ventas-link ${pathname === '/admin/pedidos' ? 'active' : ''}`}>
                Ventas{ventasNuevas > 0 && <span className="cart-badge">{ventasNuevas}</span>}
              </Link>
              <Link to="/admin/reclamos" className={pathname === '/admin/reclamos' ? 'active' : ''}>Reclamos</Link>
            </>
          )}

          <Link to="/carrito" className="cart-link">
            🛒{cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
          </Link>

          {user ? (
            <button className="link" onClick={salir} title={user.email}>Salir</button>
          ) : (
            <Link to="/login" className="btn">Ingresar</Link>
          )}
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
}
