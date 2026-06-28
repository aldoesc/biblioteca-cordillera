import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ORDER_LABEL, type Order } from '../api';
import { useAuth } from '../auth';
import { formatPrecio } from './Store';

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) api.getOrders().then(setOrders).finally(() => setLoading(false));
    else setLoading(false);
  }, [user]);

  if (!user) return (
    <div className="empty">
      <p>Iniciá sesión para ver tus pedidos.</p>
      <Link to="/login" className="btn primary">Iniciar sesión</Link>
    </div>
  );
  if (loading) return <p>Cargando…</p>;
  if (!orders.length) return (
    <div className="empty"><p>Todavía no tenés pedidos.</p><Link to="/tienda" className="btn primary">Ir a la tienda</Link></div>
  );

  return (
    <div className="orders">
      <h1>Mis pedidos</h1>
      {orders.map((o) => (
        <div key={o.id} className="card order-card">
          <div className="order-head">
            <span>Pedido #{o.id}</span>
            <span className={`order-badge ${o.estado}`}>{ORDER_LABEL[o.estado]}</span>
          </div>
          <ul className="order-items">
            {o.items.map((it) => (
              <li key={it.id}>
                <span>{it.titulo}{it.cantidad > 1 ? ` ×${it.cantidad}` : ''}</span>
                <span>{formatPrecio(it.precioUnitario * it.cantidad, o.moneda)}</span>
              </li>
            ))}
          </ul>
          <div className="order-total"><span>Total</span><strong>{formatPrecio(o.total, o.moneda)}</strong></div>
        </div>
      ))}
    </div>
  );
}
